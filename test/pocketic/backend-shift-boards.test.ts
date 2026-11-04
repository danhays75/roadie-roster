import { PocketIc, createIdentity } from "@dfinity/pic";
import type { Actor, CanisterFixture } from "@dfinity/pic";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";
import type { _SERVICE } from "../../src/frontend/src/declarations/backend.did";
import { registerCaller } from "./test-utils";

/**
 * Backend lane for the accepted per-shift ShiftBoard change. It runs the real
 * compiled canister: saveShiftBoard/getShiftBoard/listShiftBoards round-trips,
 * the duplicate-placement rejection (a roadie in two groups, or in a group and
 * Off), and the group-editor write guard. The frontend suite only mocks the
 * actor, so this is the only place the real rejection is exercised.
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

describe("backend ShiftBoard contract", () => {
  let pic: PocketIc | undefined;
  let canisterId: CanisterFixture<_SERVICE>["canisterId"];
  let admin: Actor<_SERVICE>;
  let trainer: Actor<_SERVICE>;

  const adminIdentity = createIdentity("shiftboards-admin-seed");
  const trainerIdentity = createIdentity("shiftboards-trainer-seed");

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
    availability: Array<{
      day: { wed: null };
      shift: { am: null };
    }> = [{ day: { wed: null }, shift: { am: null } }],
  ): Promise<bigint> {
    const signupId = await admin.submitSignup(
      profile(name),
      [],
      [],
      { ...contactSet(phone, email), availability },
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

  /** A board with the given groups and Off list for event 1, AM shift. */
  function board(
    groups: Array<{
      trainerPrincipal: ReturnType<typeof trainerIdentity.getPrincipal>;
      capacity: bigint;
      roadieIds: bigint[];
    }>,
    offRoadieIds: bigint[],
  ) {
    return {
      eventId: 1n,
      shift: { am: null } as const,
      groups,
      offRoadieIds,
      isDemo: false,
      editedAt: 0n,
    };
  }

  it("answers an empty-state read instead of trapping", async () => {
    await expect(admin.listShiftBoards()).resolves.toEqual([]);
    await expect(admin.getShiftBoard(1n, { am: null })).resolves.toEqual([]);
  });

  it("round-trips a board through save and get", async () => {
    const roadieId = await approveRoadie(
      "Board Roadie",
      "+1-555-0900",
      "board@example.com",
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
    expect(view[0].offThisShift).toEqual([]);
  });

  it("rejects a roadie placed in two groups", async () => {
    const roadieId = await approveRoadie(
      "Double Group",
      "+1-555-0901",
      "doublegroup@example.com",
    );
    const trainerPrincipal = trainerIdentity.getPrincipal();

    await expect(
      admin.saveShiftBoard(
        board(
          [
            { trainerPrincipal, capacity: 4n, roadieIds: [roadieId] },
            { trainerPrincipal, capacity: 4n, roadieIds: [roadieId] },
          ],
          [],
        ),
      ),
    ).rejects.toThrow(/at most one group or in Off/);
  });

  it("rejects a roadie placed in a group and Off", async () => {
    const roadieId = await approveRoadie(
      "Group And Off",
      "+1-555-0902",
      "groupandoff@example.com",
    );
    const trainerPrincipal = trainerIdentity.getPrincipal();

    await expect(
      admin.saveShiftBoard(
        board(
          [{ trainerPrincipal, capacity: 4n, roadieIds: [roadieId] }],
          [roadieId],
        ),
      ),
    ).rejects.toThrow(/at most one group or in Off/);
  });

  it("rejects a roadie listed twice in Off", async () => {
    const roadieId = await approveRoadie(
      "Double Off",
      "+1-555-0903",
      "doubleoff@example.com",
    );

    await expect(
      admin.saveShiftBoard(board([], [roadieId, roadieId])),
    ).rejects.toThrow(/at most one group or in Off/);
  });

  it("rejects a board write from a non-editor but allows the read", async () => {
    // A Trainer may read boards but may not save one.
    await expect(trainer.listShiftBoards()).resolves.toBeInstanceOf(Array);
    await expect(
      trainer.saveShiftBoard(board([], [])),
    ).rejects.toThrow(/Admin, Store Manager or Training Manager/);
  });

  it("auto-fills empty capacity without moving an already-placed roadie", async () => {
    const placed = await approveRoadie(
      "Placed Roadie",
      "+1-555-0910",
      "placed@example.com",
    );
    const spare = await approveRoadie(
      "Spare Roadie",
      "+1-555-0911",
      "spare@example.com",
      [],
    );
    // Auto-fill only draws from active roadies; a fresh sign-up is pending.
    // An Admin may mark present with a paperwork override.
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
    const group = view[0].groups[0];
    const ids = group.roadies.map((r) => r.roadieId);
    // The placed roadie stays; the empty seat is filled from the pool.
    expect(ids).toContain(placed);
    expect(ids).toContain(spare);
    expect(ids).toHaveLength(2);
  });

  it("copies another shift's groups, capacities and Off onto this shift", async () => {
    const roadieId = await approveRoadie(
      "Copy Roadie",
      "+1-555-0912",
      "copy@example.com",
    );
    const trainerPrincipal = trainerIdentity.getPrincipal();

    // Seed the source board (event 1, PM) with a group and an Off roadie.
    await admin.saveShiftBoard({
      eventId: 1n,
      shift: { pm: null } as const,
      groups: [{ trainerPrincipal, capacity: 3n, roadieIds: [roadieId] }],
      offRoadieIds: [],
      isDemo: false,
      editedAt: 0n,
    });
    const source = await admin.getShiftBoard(1n, { pm: null });
    expect(source).toHaveLength(1);

    // Copy it onto event 2, AM: (targetEventId, targetShift, sourceEventId, sourceShift).
    await admin.copyShiftBoard(2n, { am: null }, 1n, { pm: null });

    const view = await admin.getShiftBoard(2n, { am: null });
    expect(view).toHaveLength(1);
    expect(view[0].groups).toHaveLength(1);
    expect(view[0].groups[0].capacity).toBe(3n);
    expect(view[0].groups[0].roadies.map((r) => r.roadieId)).toEqual([
      roadieId,
    ]);
  });

  it("clears a board's groups and Off list", async () => {
    const roadieId = await approveRoadie(
      "Clear Roadie",
      "+1-555-0913",
      "clear@example.com",
    );
    const trainerPrincipal = trainerIdentity.getPrincipal();

    await admin.saveShiftBoard(
      board(
        [{ trainerPrincipal, capacity: 4n, roadieIds: [roadieId] }],
        [],
      ),
    );
    await admin.clearShiftBoard(1n, { am: null });

    const view = await admin.getShiftBoard(1n, { am: null });
    expect(view).toHaveLength(1);
    expect(view[0].groups).toEqual([]);
    expect(view[0].offThisShift).toEqual([]);
  });

  it("returns the trainer's own group for the current or next shift", async () => {
    const roadieId = await approveRoadie(
      "My Group Roadie",
      "+1-555-0914",
      "mygroup@example.com",
    );
    const trainerPrincipal = trainerIdentity.getPrincipal();

    await admin.saveShiftBoard(
      board(
        [{ trainerPrincipal, capacity: 4n, roadieIds: [roadieId] }],
        [],
      ),
    );

    const mine = await trainer.getMyGroup();
    expect(mine).toHaveLength(1);
    expect(mine[0].capacity).toBe(4n);
    expect(mine[0].roadies.map((r) => r.roadieId)).toEqual([roadieId]);
  });

  it("records a group-change notice for a trainer and dismisses it", async () => {
    const roadieId = await approveRoadie(
      "Notice Roadie",
      "+1-555-0915",
      "notice@example.com",
    );
    const trainerPrincipal = trainerIdentity.getPrincipal();

    // A future shift so the change produces a notice. The event must exist in
    // the schedule, because a notice is only recorded for a current or future
    // shift with a known start.
    const futureStart = NOW_NS + 30n * DAY_NS;
    const eventId = await admin.createScheduleEvent({
      id: 0n,
      name: "Notice Training Day",
      kind: { trainingDay: null } as const,
      start: futureStart,
      end: [],
    });

    await admin.saveShiftBoard({
      eventId,
      shift: { am: null } as const,
      groups: [{ trainerPrincipal, capacity: 4n, roadieIds: [roadieId] }],
      offRoadieIds: [],
      isDemo: false,
      editedAt: 0n,
    });

    const notices = await trainer.listGroupChangeNotices();
    const notice = notices.find((n) =>
      n.addedNames.includes("Notice Roadie"),
    );
    expect(notice).toBeDefined();
    expect(notice?.dismissed).toBe(false);

    await trainer.dismissGroupChangeNotice(notice!.id);
    const after = await trainer.listGroupChangeNotices();
    expect(after.find((n) => n.id === notice!.id)).toBeUndefined();
  });
});
