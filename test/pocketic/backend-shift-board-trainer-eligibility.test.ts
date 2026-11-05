import { PocketIc, createIdentity } from "@dfinity/pic";
import type { Actor, CanisterFixture } from "@dfinity/pic";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";
import type { _SERVICE } from "../../src/frontend/src/declarations/backend.did";
import { registerCaller } from "./test-utils";

/**
 * Characterization lane for the trainer-eligibility behavior adjacent to the
 * accepted real-mode change. It runs the real compiled canister and protects
 * the parts of the contract the change must NOT alter:
 *   - demo-mode auto-fill still starts a board whose columns are the seeded
 *     demo leaders with the NSO Trainer role (the demo branch of
 *     eligibleTrainers),
 *   - a real board still rejects a trainer principal that holds no access grant
 *     at all (the null-grant branch of trainerAllowed).
 * The frontend suite only mocks the actor, so this is the only place the real
 * canister behavior is exercised.
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

describe("backend shift-board trainer eligibility (adjacent behavior)", () => {
  let pic: PocketIc | undefined;
  let canisterId: CanisterFixture<_SERVICE>["canisterId"];
  let admin: Actor<_SERVICE>;

  const adminIdentity = createIdentity("trainer-eligibility-admin-seed");

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

  /** Create a training-day event `daysAhead` from now and return its id. */
  async function addTrainingDay(name: string, daysAhead: number) {
    return admin.createScheduleEvent({
      id: 0n,
      kind: { trainingDay: null },
      name,
      start: NOW_NS + BigInt(daysAhead) * DAY_NS,
      end: [],
    });
  }

  it("starts a demo board from the seeded demo leaders with the NSO Trainer role", async () => {
    const eventId = await addTrainingDay("Demo Eligibility Day", 50);

    await admin.setDemoMode(true, "DEMO");
    await admin.loadDemoData();

    // The seeded demo leaders include NSO Trainers with stations; those are the
    // demo-mode eligible trainers.
    const leaders = await admin.listLeaders();
    const demoTrainers = leaders.filter(
      (l) => "trainer" in l.role && l.trainerPositionIds.length > 0,
    );
    expect(demoTrainers.length).toBeGreaterThan(0);

    // No board stored yet: auto-fill must start one from the demo leaders.
    await admin.autoFillShiftBoard(eventId, { am: null });

    const view = await admin.getShiftBoard(eventId, { am: null });
    expect(view).toHaveLength(1);
    const board = view[0];
    expect(board.isDemo).toBe(true);
    const trainerPrincipals = board.groups.map((g) =>
      g.trainerPrincipal.toText(),
    );
    // Every seeded demo NSO Trainer gets a column.
    for (const leader of demoTrainers) {
      expect(trainerPrincipals).toContain(leader.principal.toText());
    }

    await admin.clearDemoData();
    await admin.setDemoMode(false, "");
  });

  it("rejects a real board whose trainer principal holds no access grant", async () => {
    await admin.setDemoMode(false, "");

    // A principal that never registered has no access grant at all.
    const strangerIdentity = createIdentity("trainer-eligibility-stranger-seed");
    const strangerPrincipal = strangerIdentity.getPrincipal();

    await expect(
      admin.saveShiftBoard({
        eventId: 1n,
        shift: { am: null } as const,
        groups: [
          { trainerPrincipal: strangerPrincipal, capacity: 4n, roadieIds: [] },
        ],
        offRoadieIds: [],
        isDemo: false,
        editedAt: 0n,
      }),
    ).rejects.toThrow(/Trainer is not eligible to lead a group/);
  });
});
