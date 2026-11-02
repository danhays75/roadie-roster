import { PocketIc, createIdentity } from "@dfinity/pic";
import type { Actor, CanisterFixture } from "@dfinity/pic";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";
import type { _SERVICE } from "../../src/frontend/src/declarations/backend.did";
import { registerCaller } from "./test-utils";

/**
 * Backend lane for the accepted store-template and staff-profile changes. It
 * exercises the real compiled canister for the four new public methods:
 * `downloadStoreTemplate` (Admin only, no people data), `loadStoreTemplate`
 * (Admin only, refuses once roadies exist, recomputes schedule dates from this
 * store's opening date), `submitStaffProfile` (stores the profile on the
 * caller's pending request) and `updateMyStaffProfile` (updates the caller's own
 * grant without losing access). The frontend suite only mocks the actor.
 */

const PIC_URL = process.env.POCKET_IC_URL ?? "";
const BACKEND_WASM = process.env.BACKEND_WASM ?? "";
const BASELINE_WASM = process.env.BACKEND_WASM_BASELINE;

const DAY_NS = 24n * 60n * 60n * 1_000_000_000n;
const NOW_NS = BigInt(Date.now()) * 1_000_000n;
const ADULT_DOB = NOW_NS - 25n * 365n * DAY_NS;

function profile(name: string) {
  return {
    name,
    preferredName: [] as [] | [string],
    hometown: [] as [] | [string],
    hobbies: [] as [] | [string],
    favoriteMovie: [] as [] | [string],
    favoriteSnack: [] as [] | [string],
    favoriteTeam: [] as [] | [string],
    favoriteDrink: [] as [] | [string],
    favoriteColor: [] as [] | [string],
    funFact: [] as [] | [string],
    goalHere: [] as [] | [string],
    positionAppliedFor: [] as [] | [string],
    shirtSize: [] as [] | [string],
    hatSize: [] as [] | [string],
    shiftsWantedPerWeek: [] as [] | [bigint],
    weekdayLunch: [] as [] | [boolean],
  };
}

function sig(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function contactSet(phone: string, email: string, dob: bigint) {
  return {
    phone,
    email,
    emergencyContactName: "Emergency",
    emergencyContactPhone: "+1-555-9999",
    dateOfBirth: dob,
    availability: [
      { day: { wed: null } as const, shift: { am: null } as const },
    ],
    availabilitySignature: [] as [] | [Uint8Array],
    availabilitySignedAt: [] as [] | [bigint],
    availabilityResignPending: false,
    managerSignature: [] as [] | [Uint8Array],
    managerSignedAt: [] as [] | [bigint],
    managerSignedBy: [] as [] | [unknown],
  };
}

/** A staff profile as the declarations shape it (optionals are arrays). */
function staffProfile(fullName: string, title: string) {
  return {
    fullName,
    preferredName: [fullName.split(" ")[0] ?? fullName] as [] | [string],
    title,
    requestedRole: { storeManager: null } as const,
    homeStoreNumber: "975",
    homeStoreCity: "Lake Charles",
    workPhone: [] as [] | [string],
    workEmail: [] as [] | [string],
    trainerPositionIds: [] as bigint[],
    arrivalDate: [] as [] | [bigint],
    departureDate: [] as [] | [bigint],
    photo: [] as [] | [Uint8Array],
    hometown: [] as [] | [string],
    hobbies: [] as [] | [string],
    favoriteTeam: [] as [] | [string],
    favoriteSnack: [] as [] | [string],
    favoriteDrink: [] as [] | [string],
    favoriteColor: [] as [] | [string],
    funFact: [] as [] | [string],
    goalHere: [] as [] | [string],
    shirtSize: [] as [] | [string],
    hatSize: [] as [] | [string],
  };
}

/** A minimal valid template file to load. */
function templateFile() {
  return {
    version: 1n,
    leaderTalkName: "Template Talk",
    leaderTalkSize: 12n,
    trainingGroupSize: 6n,
    positions: [
      {
        name: "Template Servers",
        code: "TSV",
        house: { foh: null } as const,
        openingBuildTo: 10n,
        afterOpeningBuildTo: 20n,
        minimumAge: 18n,
        needsAlcoholCert: true,
      },
    ],
    schedule: [
      {
        kind: { openingDay: null } as const,
        name: "Template Opening",
        startOffsetDays: 3n,
        endOffsetDays: [] as [] | [bigint],
      },
    ],
    checklists: {
      orientationUniform: [
        {
          id: 0n,
          text: "Template uniform",
          requiresAlcoholCert: false,
          minorOnly: false,
        },
      ],
      paperwork: [
        {
          id: 0n,
          text: "Template paperwork",
          requiresAlcoholCert: false,
          minorOnly: false,
        },
      ],
    },
  };
}

describe("backend store template and staff profile contract", () => {
  let pic: PocketIc | undefined;
  let canisterId: CanisterFixture<_SERVICE>["canisterId"];
  let admin: Actor<_SERVICE>;
  let member: Actor<_SERVICE>;

  const adminIdentity = createIdentity("template-admin-seed");
  const memberIdentity = createIdentity("template-member-seed");

  beforeAll(async () => {
    pic = await PocketIc.create(PIC_URL);
    if (BASELINE_WASM === undefined) {
      const installed = await pic.setupCanister<_SERVICE>({
        idlFactory,
        wasm: BACKEND_WASM,
      });
      canisterId = installed.canisterId;
    } else {
      const installed = await pic.setupCanister<_SERVICE>({
        idlFactory,
        wasm: BASELINE_WASM,
      });
      await pic.upgradeCanister({
        canisterId: installed.canisterId,
        wasm: BACKEND_WASM,
        arg: new Uint8Array(),
      });
      canisterId = installed.canisterId;
    }

    admin = await registerCaller(
      pic.createActor<_SERVICE>(idlFactory, canisterId),
      adminIdentity,
    );
    member = await registerCaller(
      pic.createActor<_SERVICE>(idlFactory, canisterId),
      memberIdentity,
    );
  });

  afterAll(async () => {
    await pic?.tearDown();
  });

  it("downloads a template with no people data, logos, store number, city or opening date", async () => {
    const file = await admin.downloadStoreTemplate();

    // The file carries the schedule, positions, checklists and leader talk.
    expect(file.version).toBe(1n);
    expect(typeof file.leaderTalkName).toBe("string");
    expect(file.positions.length).toBeGreaterThan(0);
    expect(file.schedule.length).toBeGreaterThan(0);
    expect(file.checklists.orientationUniform.length).toBeGreaterThan(0);
    expect(file.checklists.paperwork.length).toBeGreaterThan(0);

    // It must not leak people data, logos, store number, city or opening date.
    const serialized = JSON.stringify(file, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value,
    );
    expect(serialized).not.toContain("roadies");
    expect(serialized).not.toContain("logo");
    expect(serialized).not.toContain("storeNumber");
    expect(serialized).not.toContain("locationName");
    expect(serialized).not.toContain("openingDate");
  });

  it("rejects downloadStoreTemplate for a non-admin caller", async () => {
    await member.requestAccess();
    await admin.approveUser({
      principal: memberIdentity.getPrincipal(),
      role: { storeManager: null },
      staffProfile: [],
      trainerPositionIds: [],
      accessEndsAt: [],
      linkedRoadieId: [],
    });
    await expect(member.downloadStoreTemplate()).rejects.toThrow();
  });

  it("loads a template, replacing positions, schedule and checklists", async () => {
    const result = await admin.loadStoreTemplate(templateFile());
    expect(result).toHaveProperty("ok");

    const positions = await admin.listPositions();
    expect(positions).toHaveLength(1);
    expect(positions[0]?.name).toBe("Template Servers");

    const checklists = await admin.getChecklists();
    expect(checklists.paperwork.map((item) => item.text)).toContain(
      "Template paperwork",
    );

    const store = await admin.getStoreInfo();
    expect(store.leaderTalkName).toBe("Template Talk");
    expect(store.leaderTalkSize).toBe(12n);
  });

  it("recomputes imported schedule dates from this store's opening date", async () => {
    const store = await admin.getStoreInfo();
    const schedule = await admin.listSchedule();
    const opening = schedule.find((event) => event.name === "Template Opening");
    expect(opening).toBeDefined();
    // The template's startOffsetDays is 3, so the event lands three days after
    // the store's opening date.
    expect(opening?.start).toBe(store.openingDate + 3n * DAY_NS);
  });

  it("refuses to load a template once a roadie exists", async () => {
    const signupId = await admin.submitSignup(
      profile("Template Guard Target"),
      [],
      [],
      contactSet("+1-555-0300", "templateguard@example.com", ADULT_DOB),
    );
    await admin.approveSignup(
      signupId,
      {
        mainPositionId: 0n,
        secondPositionId: [],
        crewId: [],
        orientationEventId: [],
        startDate: [],
      },
      sig("sig"),
    );

    const result = await admin.loadStoreTemplate(templateFile());
    expect(result).toHaveProperty("err");
    if ("err" in result) {
      expect(result.err).toBe("Cannot load a template once roadies exist");
    }
  });

  it("stores a submitted staff profile on the caller's pending request", async () => {
    const pendingIdentity = createIdentity("template-pending-seed");
    const pending = await registerCaller(
      pic!.createActor<_SERVICE>(idlFactory, canisterId),
      pendingIdentity,
    );
    await pending.requestAccess();
    await pending.submitStaffProfile(staffProfile("Pending Person", "Trainer"));

    const pendingUsers = await admin.listPendingUsers();
    const entry = pendingUsers.find(
      (user) =>
        user.principal.toText() === pendingIdentity.getPrincipal().toText(),
    );
    expect(entry?.staffProfile[0]?.fullName).toBe("Pending Person");
    expect(entry?.staffProfile[0]?.title).toBe("Trainer");
  });

  it("carries the pending profile onto the access grant on approval", async () => {
    const pendingIdentity = createIdentity("template-carry-seed");
    const pending = await registerCaller(
      pic!.createActor<_SERVICE>(idlFactory, canisterId),
      pendingIdentity,
    );
    await pending.requestAccess();
    await pending.submitStaffProfile(staffProfile("Carried Person", "Manager"));

    const pendingUsers = await admin.listPendingUsers();
    const entry = pendingUsers.find(
      (user) =>
        user.principal.toText() === pendingIdentity.getPrincipal().toText(),
    );
    await admin.approveUser({
      principal: pendingIdentity.getPrincipal(),
      role: { storeManager: null },
      staffProfile: entry?.staffProfile ?? [],
      trainerPositionIds: [],
      accessEndsAt: [],
      linkedRoadieId: [],
    });

    const grants = await admin.listAccessGrants();
    const grant = grants.find(
      (g) => g.principal.toText() === pendingIdentity.getPrincipal().toText(),
    );
    expect(grant?.staffProfile[0]?.fullName).toBe("Carried Person");
  });

  it("lets a caller update their own profile without losing access", async () => {
    await member.updateMyStaffProfile(staffProfile("Member Updated", "Manager"));

    const grant = await member.getMyAccess();
    expect(grant[0]?.staffProfile[0]?.fullName).toBe("Member Updated");
    // The role is unchanged: updating the profile never drops access.
    expect(grant[0]?.role).toEqual({ storeManager: null });
  });

  it("rejects updateMyStaffProfile for a caller with no grant", async () => {
    const strangerIdentity = createIdentity("template-stranger-seed");
    const stranger = pic!.createActor<_SERVICE>(idlFactory, canisterId);
    stranger.setIdentity(strangerIdentity);
    await expect(
      stranger.updateMyStaffProfile(staffProfile("No Grant", "None")),
    ).rejects.toThrow();
  });
});
