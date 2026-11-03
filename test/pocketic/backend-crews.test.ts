import { PocketIc, createIdentity } from "@dfinity/pic";
import type { Actor, CanisterFixture } from "@dfinity/pic";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";
import type { _SERVICE } from "../../src/frontend/src/declarations/backend.did";
import { registerCaller } from "./test-utils";

/**
 * Backend lane for the accepted Crews change. It runs the real compiled
 * canister: createCrew/updateCrew/deleteCrew/listCrews, the leaderPrincipal
 * field, the manager-only write guard, the "move its roadies first" refusal,
 * and the change-log record. The frontend suite only mocks the actor.
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

function contactSet(phone: string, email: string) {
  return {
    phone,
    email,
    emergencyContactName: "Emergency",
    emergencyContactPhone: "+1-555-9999",
    dateOfBirth: ADULT_DOB,
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

describe("backend Crews contract", () => {
  let pic: PocketIc | undefined;
  let canisterId: CanisterFixture<_SERVICE>["canisterId"];
  let admin: Actor<_SERVICE>;
  let trainer: Actor<_SERVICE>;

  const adminIdentity = createIdentity("crews-admin-seed");
  const trainerIdentity = createIdentity("crews-trainer-seed");

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
    trainer = await registerCaller(
      pic.createActor<_SERVICE>(idlFactory, canisterId),
      trainerIdentity,
    );
    await trainer.requestAccess();
    await admin.approveUser({
      principal: trainerIdentity.getPrincipal(),
      role: { trainer: null },
      trainerPositionIds: [0n],
      accessEndsAt: [],
      linkedRoadieId: [],
      staffProfile: [],
    });
  });

  afterAll(async () => {
    await pic?.tearDown();
  });

  it("answers an empty-state read instead of trapping", async () => {
    await expect(admin.listCrews()).resolves.toEqual([]);
  });

  it("round-trips a crew through create, list and update", async () => {
    const id = await admin.createCrew("Opening Crew");
    const created = await admin.listCrews();
    expect(created).toContainEqual(
      expect.objectContaining({ id, name: "Opening Crew" }),
    );
    // A new crew has no leader by default.
    const row = created.find((crew) => crew.id === id);
    expect(row?.leaderPrincipal).toEqual([]);

    const leader = trainerIdentity.getPrincipal();
    await admin.updateCrew(id, "Renamed Crew", [leader]);
    const updated = (await admin.listCrews()).find((crew) => crew.id === id);
    expect(updated?.name).toBe("Renamed Crew");
    expect(updated?.leaderPrincipal[0]?.toText()).toBe(leader.toText());
  });

  it("records every crew change in the change log", async () => {
    const id = await admin.createCrew("Logged Crew");
    await admin.updateCrew(id, "Logged Crew Renamed", []);
    await admin.deleteCrew(id);

    const log = await admin.listChangeLog();
    const actions = log.map((entry) => entry.action.toLowerCase());
    expect(actions.some((action) => action.includes("crew"))).toBe(true);
  });

  it("refuses to delete a crew that still has members", async () => {
    const crewId = await admin.createCrew("Occupied Crew");
    const signupId = await admin.submitSignup(
      profile("Crew Member"),
      [],
      [],
      contactSet("+1-555-0700", "crewmember@example.com"),
    );
    await admin.approveSignup(
      signupId,
      {
        mainPositionId: 0n,
        secondPositionId: [],
        crewId: [crewId],
        orientationEventId: [],
        startDate: [],
      },
      sig("sig"),
    );

    await expect(admin.deleteCrew(crewId)).rejects.toThrow();
    // The crew survives the refused delete.
    const crews = await admin.listCrews();
    expect(crews.some((crew) => crew.id === crewId)).toBe(true);
  });

  it("deletes an empty crew", async () => {
    const id = await admin.createCrew("Empty Crew");
    await expect(admin.deleteCrew(id)).resolves.toBeNull();
    const crews = await admin.listCrews();
    expect(crews.some((crew) => crew.id === id)).toBe(false);
  });

  it("rejects crew writes from a non-manager but allows the read", async () => {
    // A Trainer may read the crews list but may not create, update or delete.
    await expect(trainer.listCrews()).resolves.toBeInstanceOf(Array);
    await expect(trainer.createCrew("Trainer Crew")).rejects.toThrow();

    const id = await admin.createCrew("Manager Crew");
    await expect(trainer.updateCrew(id, "Hijacked", [])).rejects.toThrow();
    await expect(trainer.deleteCrew(id)).rejects.toThrow();
  });
});

describe("backend duplicate-match contract", () => {
  let pic: PocketIc | undefined;
  let canisterId: CanisterFixture<_SERVICE>["canisterId"];
  let admin: Actor<_SERVICE>;

  const adminIdentity = createIdentity("duplicates-admin-seed");

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
  });

  afterAll(async () => {
    await pic?.tearDown();
  });

  /** Approve a sign-up into position 0 and return the created roadie id. */
  async function approveRoadie(
    name: string,
    phone: string,
    email: string,
  ): Promise<bigint> {
    const signupId = await admin.submitSignup(
      profile(name),
      [],
      [],
      contactSet(phone, email),
    );
    return admin.approveSignup(
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
  }

  it("names the matched roadie and their main position, never a raw id", async () => {
    const roadieId = await approveRoadie(
      "Casey Morgan",
      "+1-555-0800",
      "casey@example.com",
    );
    const signupId = await admin.submitSignup(
      profile("New Applicant"),
      [],
      [],
      contactSet("+1-555-0800", "new@example.com"),
    );

    const matches = await admin.findDuplicates(signupId);
    const match = matches.find((m) => m.roadieId === roadieId);
    expect(match).toBeDefined();
    expect(match?.name).toBe("Casey Morgan");
    // Position 0 is the seeded "Servers" position.
    expect(match?.mainPositionName).toBe("Servers");
    expect(match?.matchedOn).toBe("phone");
    expect(match?.archived).toBe(false);
  });

  it("reports email only when the email is the sole match", async () => {
    await approveRoadie("Email Only", "+1-555-0801", "emailonly@example.com");
    const signupId = await admin.submitSignup(
      profile("Email Applicant"),
      [],
      [],
      contactSet("+1-555-0899", "emailonly@example.com"),
    );

    const matches = await admin.findDuplicates(signupId);
    expect(matches).toHaveLength(1);
    expect(matches[0].matchedOn).toBe("email");
  });

  it("still warns about an archived roadie whose phone matches", async () => {
    const roadieId = await approveRoadie(
      "Archived Roadie",
      "+1-555-0802",
      "archived@example.com",
    );
    await admin.archiveRoadie(roadieId, { other: "test" });

    const signupId = await admin.submitSignup(
      profile("Archived Applicant"),
      [],
      [],
      contactSet("+1-555-0802", "archivedapplicant@example.com"),
    );

    const matches = await admin.findDuplicates(signupId);
    const match = matches.find((m) => m.roadieId === roadieId);
    expect(match).toBeDefined();
    expect(match?.name).toBe("Archived Roadie");
    expect(match?.archived).toBe(true);
  });
});
