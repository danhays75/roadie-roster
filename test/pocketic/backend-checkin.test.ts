import { PocketIc, createIdentity } from "@dfinity/pic";
import type { Actor, CanisterFixture } from "@dfinity/pic";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";
import type { _SERVICE } from "../../src/frontend/src/declarations/backend.did";
import { registerCaller } from "./test-utils";

/**
 * Backend lane for the accepted trainer check-in change. It runs the real
 * compiled canister: recordCheckIn/getCheckInBoard round-trips, the trainer
 * group boundary (a trainer may check in only their own group), the trainer
 * lock window, the absent alert raised by an Absent mark and its manager
 * actions, and the role-shaped getToday payload. The frontend suite only mocks
 * the actor, so this is the only place the real enforcement is exercised.
 *
 * The trainer lock window is anchored to the store's AM shift times on the
 * event's UTC date, so a "window open" test would depend on the wall clock.
 * The round-trip and alert paths therefore run as an Admin, who may check in
 * anyone at any time; the trainer-specific tests use a past event, which is
 * deterministically locked, and the group boundary, which is checked before
 * the window.
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

describe("backend trainer check-in contract", () => {
  let pic: PocketIc | undefined;
  let canisterId: CanisterFixture<_SERVICE>["canisterId"];
  let admin: Actor<_SERVICE>;
  let trainer: Actor<_SERVICE>;
  let otherTrainer: Actor<_SERVICE>;

  const adminIdentity = createIdentity("checkin-admin-seed");
  const trainerIdentity = createIdentity("checkin-trainer-seed");
  const otherTrainerIdentity = createIdentity("checkin-other-trainer-seed");

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
    otherTrainer = await registerCaller(
      pic.createActor<_SERVICE>(idlFactory, canisterId),
      otherTrainerIdentity,
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
    await otherTrainer.requestAccess();
    await admin.approveUser({
      principal: otherTrainerIdentity.getPrincipal(),
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

  /** A schedule event far in the past, so the trainer window is closed. */
  async function createPastShiftEvent(): Promise<bigint> {
    return admin.createScheduleEvent({
      id: 0n,
      name: "Past Training Day",
      kind: { trainingDay: null } as const,
      start: NOW_NS - 30n * DAY_NS,
      end: [],
    });
  }

  it("answers an empty-state read instead of trapping", async () => {
    await expect(admin.listAbsentAlerts()).resolves.toEqual([]);
    await expect(admin.getCheckInBoard(1n, { am: null })).resolves.toEqual([]);
  });

  it("round-trips a Present check-in through the real canister", async () => {
    const roadieId = await approveRoadie(
      "Present Roadie",
      "+1-555-0801",
      "present@example.com",
    );
    const eventId = await createPastShiftEvent();
    const trainerPrincipal = trainerIdentity.getPrincipal();

    await admin.saveShiftBoard({
      eventId,
      shift: { am: null } as const,
      groups: [{ trainerPrincipal, capacity: 4n, roadieIds: [roadieId] }],
      offRoadieIds: [],
      isDemo: false,
      editedAt: 0n,
    });

    // An Admin may check in anyone at any time, so this path is deterministic.
    await admin.recordCheckIn(
      eventId,
      { am: null },
      roadieId,
      { present: null },
      [],
      [],
    );

    const board = await trainer.getCheckInBoard(eventId, { am: null });
    expect(board).toHaveLength(1);
    expect(board[0].checkedInCount).toBe(1n);
    expect(board[0].totalCount).toBe(1n);
    expect(board[0].roadies[0].state).toEqual([{ present: null }]);
    // The past shift is locked for the trainer.
    expect(board[0].locked).toBe(true);
  });

  it("records Late with a late time and Absent raises an alert", async () => {
    const lateRoadie = await approveRoadie(
      "Late Roadie",
      "+1-555-0802",
      "late@example.com",
    );
    const absentRoadie = await approveRoadie(
      "Absent Roadie",
      "+1-555-0803",
      "absent@example.com",
    );
    const eventId = await createPastShiftEvent();
    const trainerPrincipal = trainerIdentity.getPrincipal();

    await admin.saveShiftBoard({
      eventId,
      shift: { am: null } as const,
      groups: [
        {
          trainerPrincipal,
          capacity: 4n,
          roadieIds: [lateRoadie, absentRoadie],
        },
      ],
      offRoadieIds: [],
      isDemo: false,
      editedAt: 0n,
    });

    const lateAt = NOW_NS;
    await admin.recordCheckIn(
      eventId,
      { am: null },
      lateRoadie,
      { late: null },
      [lateAt],
      [],
    );
    await admin.recordCheckIn(
      eventId,
      { am: null },
      absentRoadie,
      { absent: null },
      [],
      [],
    );

    const board = await trainer.getCheckInBoard(eventId, { am: null });
    const lateRow = board[0].roadies.find((r) => r.roadieId === lateRoadie);
    expect(lateRow?.state).toEqual([{ late: null }]);
    expect(lateRow?.lateAt).toEqual([lateAt]);

    // Marking absent raises an unarchived alert visible to a manager.
    const alerts = await admin.listAbsentAlerts();
    const raised = alerts.find((a) => a.roadieId === absentRoadie);
    expect(raised).toBeDefined();
    expect(raised?.archived).toBe(false);
    // An Admin may see the contact phone, so Call/Text can render.
    expect(raised?.phone).toEqual(["+1-555-0803"]);
  });

  it("rejects a trainer checking in a roadie outside their own group", async () => {
    const roadieId = await approveRoadie(
      "Other Group Roadie",
      "+1-555-0804",
      "othergroup@example.com",
    );
    const eventId = await createPastShiftEvent();
    // The board places the roadie in the OTHER trainer's group.
    await admin.saveShiftBoard({
      eventId,
      shift: { am: null } as const,
      groups: [
        {
          trainerPrincipal: otherTrainerIdentity.getPrincipal(),
          capacity: 4n,
          roadieIds: [roadieId],
        },
      ],
      offRoadieIds: [],
      isDemo: false,
      editedAt: 0n,
    });

    await expect(
      trainer.recordCheckIn(
        eventId,
        { am: null },
        roadieId,
        { present: null },
        [],
        [],
      ),
    ).rejects.toThrow(/own group/);
  });

  it("locks a trainer out of a shift whose window has closed", async () => {
    const roadieId = await approveRoadie(
      "Locked Roadie",
      "+1-555-0805",
      "locked@example.com",
    );
    const eventId = await createPastShiftEvent();
    const trainerPrincipal = trainerIdentity.getPrincipal();
    await admin.saveShiftBoard({
      eventId,
      shift: { am: null } as const,
      groups: [{ trainerPrincipal, capacity: 4n, roadieIds: [roadieId] }],
      offRoadieIds: [],
      isDemo: false,
      editedAt: 0n,
    });

    // The board reports locked for the trainer...
    const board = await trainer.getCheckInBoard(eventId, { am: null });
    expect(board[0].locked).toBe(true);

    // ...and a trainer write is refused.
    await expect(
      trainer.recordCheckIn(
        eventId,
        { am: null },
        roadieId,
        { present: null },
        [],
        [],
      ),
    ).rejects.toThrow(/locked/);

    // A manager may still change records outside the window.
    await admin.recordCheckIn(
      eventId,
      { am: null },
      roadieId,
      { present: null },
      [],
      [],
    );
    const after = await trainer.getCheckInBoard(eventId, { am: null });
    expect(after[0].roadies[0].state).toEqual([{ present: null }]);
  });

  it("excuses and archives an absent alert through the manager actions", async () => {
    const roadieId = await approveRoadie(
      "Alert Action Roadie",
      "+1-555-0806",
      "alertaction@example.com",
    );
    const eventId = await createPastShiftEvent();
    const trainerPrincipal = trainerIdentity.getPrincipal();
    await admin.saveShiftBoard({
      eventId,
      shift: { am: null } as const,
      groups: [{ trainerPrincipal, capacity: 4n, roadieIds: [roadieId] }],
      offRoadieIds: [],
      isDemo: false,
      editedAt: 0n,
    });
    await admin.recordCheckIn(
      eventId,
      { am: null },
      roadieId,
      { absent: null },
      [],
      [],
    );

    const alerts = await admin.listAbsentAlerts();
    const alert = alerts.find((a) => a.roadieId === roadieId);
    expect(alert).toBeDefined();

    // An empty excuse reason is refused.
    await expect(admin.excuseAbsentAlert(alert!.id, "")).rejects.toThrow();

    await admin.excuseAbsentAlert(alert!.id, "Called in sick");
    const excused = (await admin.listAbsentAlerts()).find(
      (a) => a.id === alert!.id,
    );
    expect(excused?.excused).toEqual(["Called in sick"]);

    await admin.archiveAbsentAlert(alert!.id);
    const afterArchive = await admin.listAbsentAlerts();
    expect(afterArchive.find((a) => a.id === alert!.id)).toBeUndefined();
  });

  it("rejects the absent-alert reads and actions for a non-manager role", async () => {
    // A trainer is not a group editor, so the alert surface is closed to them.
    await expect(trainer.listAbsentAlerts()).rejects.toThrow();
  });

  it("shapes getToday for a manager with the shift summaries and alerts", async () => {
    const view = await admin.getToday();
    expect(view.role).toEqual({ admin: null });
    expect(Array.isArray(view.shiftSummaries)).toBe(true);
    expect(Array.isArray(view.absentAlerts)).toBe(true);
  });
});
