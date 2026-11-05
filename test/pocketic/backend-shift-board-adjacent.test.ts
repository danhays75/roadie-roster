import { PocketIc, createIdentity } from "@dfinity/pic";
import type { Actor, CanisterFixture } from "@dfinity/pic";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";
import type { _SERVICE } from "../../src/frontend/src/declarations/backend.did";
import { registerCaller } from "./test-utils";

/**
 * Backend lane for behavior adjacent to the accepted "start a brand-new shift
 * board" change. It runs the real compiled canister and protects the parts of
 * the shift-board contract the change does not intentionally alter:
 *   - a stored board still round-trips through saveShiftBoard/getShiftBoard,
 *   - a board in the other partition is still invisible (getShiftBoard returns
 *     an empty option, not the other partition's board),
 *   - autoFillShiftBoard still never moves an already-placed roadie,
 *   - autoFillShiftBoard still rejects a caller who may not edit.
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

describe("backend shift-board adjacent behavior", () => {
  let pic: PocketIc | undefined;
  let canisterId: CanisterFixture<_SERVICE>["canisterId"];
  let admin: Actor<_SERVICE>;
  let trainer: Actor<_SERVICE>;

  const adminIdentity = createIdentity("board-adjacent-admin-seed");
  const trainerIdentity = createIdentity("board-adjacent-trainer-seed");

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

  /** A board for event 1, AM shift, with the given groups and Off list. */
  function board(
    groups: Array<{
      trainerPrincipal: ReturnType<typeof trainerIdentity.getPrincipal>;
      capacity: bigint;
      roadieIds: bigint[];
    }>,
    offRoadieIds: bigint[],
    isDemo = false,
  ) {
    return {
      eventId: 1n,
      shift: { am: null } as const,
      groups,
      offRoadieIds,
      isDemo,
      editedAt: 0n,
    };
  }

  it("round-trips a stored board through save and get", async () => {
    const roadieId = await approveRoadie(
      "Adjacent Round Trip",
      "+1-555-0700",
      "adjacent-round-trip@example.com",
    );
    const trainerPrincipal = trainerIdentity.getPrincipal();

    await admin.saveShiftBoard(
      board(
        [{ trainerPrincipal, capacity: 4n, roadieIds: [roadieId] }],
        [],
      ),
    );

    const view = await admin.getShiftBoard(1n, { am: null });
    expect(view).toHaveLength(1);
    expect(view[0].groups).toHaveLength(1);
    expect(view[0].groups[0].capacity).toBe(4n);
    expect(view[0].groups[0].roadies.map((r) => r.roadieId)).toEqual([
      roadieId,
    ]);
  });

  it("keeps a board in the other partition invisible to a real read", async () => {
    // A real board exists while demo mode is off.
    const realRoadie = await approveRoadie(
      "Adjacent Partition",
      "+1-555-0701",
      "adjacent-partition@example.com",
    );
    const trainerPrincipal = trainerIdentity.getPrincipal();
    await admin.saveShiftBoard(
      board(
        [{ trainerPrincipal, capacity: 4n, roadieIds: [realRoadie] }],
        [],
        false,
      ),
    );

    // While demo mode is on, the real board is not returned. Event 1 exists, so
    // the accepted contract returns an unsaved empty demo view: no groups and
    // none of the real board's roadies.
    await admin.setDemoMode(true, "DEMO");
    const demoView = await admin.getShiftBoard(1n, { am: null });
    expect(demoView).toHaveLength(1);
    expect(demoView[0].isDemo).toBe(true);
    expect(demoView[0].groups).toEqual([]);
    expect(
      demoView[0].unassigned.some((r) => r.roadieId === realRoadie),
    ).toBe(false);
    await admin.setDemoMode(false, "");
  });

  it("never moves an already-placed roadie during auto-fill", async () => {
    const placed = await approveRoadie(
      "Adjacent Placed",
      "+1-555-0702",
      "adjacent-placed@example.com",
    );
    const spare = await approveRoadie(
      "Adjacent Spare",
      "+1-555-0703",
      "adjacent-spare@example.com",
    );
    // Auto-fill only draws from active roadies; a fresh sign-up is pending.
    await admin.markPresent(spare, 1n, ["test override"]);
    const trainerPrincipal = trainerIdentity.getPrincipal();

    // A board with one placed roadie and one empty seat.
    await admin.saveShiftBoard(
      board(
        [{ trainerPrincipal, capacity: 2n, roadieIds: [placed] }],
        [],
      ),
    );

    await admin.autoFillShiftBoard(1n, { am: null });

    const view = await admin.getShiftBoard(1n, { am: null });
    const ids = view[0].groups[0].roadies.map((r) => r.roadieId);
    // The placed roadie stays; the empty seat is filled from the pool.
    expect(ids).toContain(placed);
    expect(ids).toContain(spare);
    expect(ids).toHaveLength(2);
  });

  it("rejects an auto-fill from a caller who may not edit", async () => {
    // A Trainer may read boards but may not auto-fill one.
    await expect(
      trainer.autoFillShiftBoard(1n, { am: null }),
    ).rejects.toThrow(/Admin, Store Manager or Training Manager/);
  });
});
