import { PocketIc, createIdentity } from "@dfinity/pic";
import type { Actor, CanisterFixture } from "@dfinity/pic";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";
import type { _SERVICE } from "../../src/frontend/src/declarations/backend.did";
import { registerCaller } from "./test-utils";

/**
 * Backend lane for the accepted paperwork / uniform / override change. It runs
 * the real compiled canister and exercises the public behavior the frontend
 * suite only mocks:
 *   - saveUniformCheckoff updates only the uniform fields and keeps the
 *     roadie's paperworkItems,
 *   - setPaperworkItems updates only paperworkItems and keeps the uniform
 *     fields, and is restricted to Admin and Store Manager,
 *   - markPresent traps "Paperwork incomplete" unless an Admin or Store Manager
 *     supplies a non-empty override reason, which is logged,
 *   - markPresent rejects an archived roadie,
 *   - getOrientationSessionView, markPresent, getUniformCheckoff and
 *     saveUniformCheckoff accept Training Manager and Visiting Manager.
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

describe("backend paperwork, uniform and override contract", () => {
  let pic: PocketIc | undefined;
  let canisterId: CanisterFixture<_SERVICE>["canisterId"];
  let admin: Actor<_SERVICE>;
  let manager: Actor<_SERVICE>;
  let trainingManager: Actor<_SERVICE>;
  let visitingManager: Actor<_SERVICE>;

  const adminIdentity = createIdentity("paperwork-override-admin-seed");
  const managerIdentity = createIdentity("paperwork-override-manager-seed");
  const trainingIdentity = createIdentity("paperwork-override-training-seed");
  const visitingIdentity = createIdentity("paperwork-override-visiting-seed");

  /** The single seeded orientation session id. */
  let eventId: bigint;

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
    manager = await registerCaller(
      pic.createActor<_SERVICE>(idlFactory, canisterId),
      managerIdentity,
    );
    trainingManager = await registerCaller(
      pic.createActor<_SERVICE>(idlFactory, canisterId),
      trainingIdentity,
    );
    visitingManager = await registerCaller(
      pic.createActor<_SERVICE>(idlFactory, canisterId),
      visitingIdentity,
    );

    // The first registered caller is the Admin; approve the others with their
    // real roles through the public approval flow.
    for (const [identity, role] of [
      [managerIdentity, { storeManager: null } as const],
      [trainingIdentity, { trainingManager: null } as const],
      [visitingIdentity, { visitingManager: null } as const],
    ] as const) {
      const actor =
        role.storeManager !== undefined
          ? manager
          : role.trainingManager !== undefined
            ? trainingManager
            : visitingManager;
      await actor.requestAccess();
      await admin.approveUser({
        principal: identity.getPrincipal(),
        role,
        trainerPositionIds: [],
        accessEndsAt: [],
        linkedRoadieId: [],
        staffProfile: [],
      });
    }

    const schedule = await admin.listSchedule();
    const session = schedule.find(
      (event) => event.kind.orientation !== undefined,
    );
    eventId = session!.id;
  });

  afterAll(async () => {
    await pic?.tearDown();
  });

  /** Approve a fresh roadie assigned to the seeded orientation session. */
  async function newRoadie(name: string, phone: string): Promise<bigint> {
    const signupId = await admin.submitSignup(
      profile(name),
      [],
      [],
      contactSet(phone, `${phone}@example.com`),
    );
    return admin.approveSignup(
      signupId,
      {
        mainPositionId: 0n,
        secondPositionId: [],
        crewId: [],
        orientationEventId: [eventId],
        startDate: [],
      },
      sig("sig"),
    );
  }

  // The Servers position (id 0) needs an alcohol cert, so a non-minor roadie's
  // applicable paperwork is the four seeded items in checklist order
  // (Digital Paperwork, I-9 / W-4, Alcohol Certificate, Policies & Procedures);
  // item 4 is minor-only.
  const COMPLETE_PAPERWORK = ["0", "5", "3", "1"];

  it("keeps the roadie's paperwork when the uniform check-off is saved", async () => {
    const roadieId = await newRoadie("Uniform Saver", "+1-555-0301");

    // Seed complete paperwork through the new endpoint.
    await admin.setPaperworkItems(roadieId, COMPLETE_PAPERWORK);
    const before = await admin.getOrientationCheckoff(roadieId);
    expect(before[0]?.paperworkItems).toEqual(COMPLETE_PAPERWORK);

    // Saving the uniform check-off must not clear the paperwork items.
    await admin.saveUniformCheckoff(roadieId, ["1"], [[1n, 3n]]);
    const after = await admin.getOrientationCheckoff(roadieId);
    expect(after[0]?.paperworkItems).toEqual(COMPLETE_PAPERWORK);
    expect(after[0]?.uniformItems).toEqual(["1"]);
    expect(after[0]?.uniformCounts).toEqual([[1n, 3n]]);
  });

  it("keeps the roadie's uniform fields when the paperwork is saved", async () => {
    const roadieId = await newRoadie("Paperwork Saver", "+1-555-0302");

    // Complete the paperwork first so the uniform check-off is unlocked.
    await admin.setPaperworkItems(roadieId, COMPLETE_PAPERWORK);
    await admin.saveUniformCheckoff(roadieId, ["1"], [[1n, 3n]]);
    // Re-saving the paperwork must not clear the uniform fields.
    await admin.setPaperworkItems(roadieId, COMPLETE_PAPERWORK);

    const after = await admin.getOrientationCheckoff(roadieId);
    expect(after[0]?.paperworkItems).toEqual(COMPLETE_PAPERWORK);
    // The uniform fields survive the paperwork save.
    expect(after[0]?.uniformItems).toEqual(["1"]);
    expect(after[0]?.uniformCounts).toEqual([[1n, 3n]]);
  });

  it("restricts setPaperworkItems to Admin and Store Manager", async () => {
    const roadieId = await newRoadie("Role Gated", "+1-555-0303");

    // A Store Manager may set paperwork (the first applicable item, in order).
    await expect(
      manager.setPaperworkItems(roadieId, ["0"]),
    ).resolves.toBeNull();

    // A Training Manager and a Visiting Manager may not.
    await expect(
      trainingManager.setPaperworkItems(roadieId, ["0"]),
    ).rejects.toThrow();
    await expect(
      visitingManager.setPaperworkItems(roadieId, ["0"]),
    ).rejects.toThrow();
  });

  it("traps Paperwork incomplete when marking present without an override", async () => {
    const roadieId = await newRoadie("Incomplete Paperwork", "+1-555-0304");

    // The Servers position needs an alcohol cert, so item 3 applies and the
    // roadie's paperwork is incomplete until it is checked.
    await expect(admin.markPresent(roadieId, eventId, [])).rejects.toThrow(
      "Paperwork incomplete",
    );
  });

  it("marks present with a non-empty override reason and logs it", async () => {
    const roadieId = await newRoadie("Override Present", "+1-555-0305");

    await expect(
      admin.markPresent(roadieId, eventId, ["Paperwork on file at the store"]),
    ).resolves.toBeNull();

    const roadie = await admin.getRoadie(roadieId);
    expect(roadie[0]?.rosterState).toEqual({ active: null });

    const log = await admin.listChangeLog();
    const override = log.find(
      (entry) =>
        entry.action === "markPresent" &&
        entry.detail.includes("Paperwork on file at the store"),
    );
    expect(override).toBeDefined();
  });

  it("rejects an empty override reason from a manager", async () => {
    const roadieId = await newRoadie("Blank Override", "+1-555-0306");

    await expect(manager.markPresent(roadieId, eventId, [""])).rejects.toThrow(
      "Paperwork incomplete",
    );
  });

  it("rejects an archived roadie", async () => {
    const roadieId = await newRoadie("Archived Roadie", "+1-555-0307");
    await admin.archiveRoadie(roadieId, { paperworkIncomplete: null });

    await expect(
      admin.markPresent(roadieId, eventId, ["Override reason"]),
    ).rejects.toThrow("Roadie is archived; rehire first");
  });

  it("lets a Training Manager and a Visiting Manager read the session view and mark present", async () => {
    const roadieId = await newRoadie("Orientation Staff", "+1-555-0308");

    // Both roles may read the session view.
    await expect(
      trainingManager.getOrientationSessionView(eventId),
    ).resolves.toBeDefined();
    await expect(
      visitingManager.getOrientationSessionView(eventId),
    ).resolves.toBeDefined();

    // Both roles may read the uniform check-off.
    await expect(
      trainingManager.getUniformCheckoff(roadieId),
    ).resolves.toBeDefined();
    await expect(
      visitingManager.getUniformCheckoff(roadieId),
    ).resolves.toBeDefined();

    // A Training Manager may mark present once the paperwork is complete.
    await admin.setPaperworkItems(roadieId, COMPLETE_PAPERWORK);
    await expect(
      trainingManager.markPresent(roadieId, eventId, []),
    ).resolves.toBeNull();

    // A Visiting Manager may save the uniform check-off.
    await expect(
      visitingManager.saveUniformCheckoff(roadieId, ["1"], [[1n, 3n]]),
    ).resolves.toBeNull();
  });
});
