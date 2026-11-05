import { PocketIc, createIdentity } from "@dfinity/pic";
import type { Actor, CanisterFixture } from "@dfinity/pic";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";
import type { _SERVICE } from "../../src/frontend/src/declarations/backend.did";
import { registerCaller } from "./test-utils";

/**
 * Backend lane for the accepted store-time and demo-trainer change, run against
 * the real compiled canister. It exercises the store-local shift window (a
 * 10:00 AM store-local shift is computed at 10:00 AM store-local time), the
 * store-local Today date, and the demo NSO Trainer viewing the chosen demo
 * leader's group. The frontend suite mocks the actor, so only this lane proves
 * the real computation and the acting-principal match.
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

/**
 * The UTC instant of a store-local wall-clock time on a given local calendar
 * day. Only America/Chicago is modeled by the backend; January is CST (UTC-6)
 * and July is CDT (UTC-5).
 */
function storeLocalInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  offsetHours: number,
): bigint {
  return (
    BigInt(Date.UTC(year, month - 1, day, hour + offsetHours, minute)) *
    1_000_000n
  );
}

/** A pretend `DateOnly` (UTC midnight) whose local calendar day is `day`. */
function pretendDay(year: number, month: number, day: number): bigint {
  return BigInt(Date.UTC(year, month - 1, day)) * 1_000_000n;
}

describe("backend store-local shift window and Today date", () => {
  let pic: PocketIc | undefined;
  let canisterId: CanisterFixture<_SERVICE>["canisterId"];
  let admin: Actor<_SERVICE>;
  let trainer: Actor<_SERVICE>;

  const adminIdentity = createIdentity("storetime-admin-seed");
  const trainerIdentity = createIdentity("storetime-trainer-seed");

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

  it("computes a 10:00 AM store-local shift at 10:00 AM store-local time", async () => {
    // The event's start is 2026-01-14 10:00 store-local (CST, UTC-6) ==
    // 2026-01-14T16:00:00Z. The pretend day 2026-01-15T00:00:00Z is the local
    // calendar day 2026-01-14, and the AM pretend time is 10:30 store-local.
    const eventStart = storeLocalInstant(2026, 1, 14, 10, 0, 6);
    const eventId = await admin.createScheduleEvent({
      id: 0n,
      name: "Store-local AM Shift",
      kind: { trainingDay: null } as const,
      start: eventStart,
      end: [],
    });

    // Demo mode on: load the demo data set and place a demo roadie in a demo
    // leader's group on a demo board.
    await admin.setDemoMode(true, "DEMO");
    await admin.loadDemoData();
    const demoRoadies = await admin.listRoadies();
    expect(demoRoadies.length).toBeGreaterThan(0);
    const roadieId = demoRoadies[0].id;

    // In demo mode a board's trainer must be a demo leader.
    const leaders = await admin.listLeaders();
    const demoTrainer = leaders.find(
      (l) => "trainer" in l.role && l.trainerPositionIds.length > 0,
    );
    expect(demoTrainer).toBeDefined();

    await admin.saveShiftBoard({
      eventId,
      shift: { am: null } as const,
      groups: [
        {
          trainerPrincipal: demoTrainer!.principal,
          capacity: 4n,
          roadieIds: [roadieId],
        },
      ],
      offRoadieIds: [],
      isDemo: true,
      editedAt: 0n,
    });

    // The trainer caller acts as a demo NSO Trainer viewing as that demo
    // leader, so the board lock reflects the shift window rather than a
    // manager's override.
    await trainer.setDemoRole({ trainer: null }, [0n]);
    await trainer.setDemoTrainerAs(demoTrainer!.principal);

    // Pin "now" to 10:30 store-local on the event's local day.
    await admin.setPretendDate([
      { day: pretendDay(2026, 1, 15), shift: { am: null } },
    ]);

    // The AM window is 10:00-15:00 store-local, so 10:30 is inside it and the
    // trainer's board is unlocked. A UTC-date window would place the shift at
    // 10:00 UTC and report the board locked.
    const board = await trainer.getCheckInBoard(eventId, { am: null });
    expect(board).toHaveLength(1);
    expect(board[0].locked).toBe(false);

    await admin.setDemoMode(false, "");
  });

  it("keeps Today on the store-local date for an evening local instant", async () => {
    // Ensure demo mode is off so the real-settings guard allows the event.
    await admin.setDemoMode(false, "");

    // The event's start is 2026-01-14 20:00 store-local (CST) ==
    // 2026-01-15T02:00:00Z, whose UTC date is the next day. The pretend day
    // 2026-01-15T00:00:00Z is the local calendar day 2026-01-14, so Today must
    // still include the event.
    const eventStart = storeLocalInstant(2026, 1, 14, 20, 0, 6);
    const eventId = await admin.createScheduleEvent({
      id: 0n,
      name: "Evening Local Shift",
      kind: { trainingDay: null } as const,
      start: eventStart,
      end: [],
    });

    await admin.setDemoMode(true, "DEMO");
    await admin.setPretendDate([
      { day: pretendDay(2026, 1, 15), shift: { pm: null } },
    ]);

    const view = await admin.getToday();
    const ids = view.shiftSummaries.map((s) => s.eventId);
    expect(ids).toContain(eventId);

    await admin.setDemoMode(false, "");
  });
});

describe("backend demo NSO Trainer views the chosen demo leader's group", () => {
  let pic: PocketIc | undefined;
  let canisterId: CanisterFixture<_SERVICE>["canisterId"];
  let admin: Actor<_SERVICE>;

  const adminIdentity = createIdentity("demotrainer-admin-seed");
  const strangerIdentity = createIdentity("demotrainer-stranger-seed");

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

  it("matches getMyGroup to the chosen demo leader for a demo NSO Trainer", async () => {
    // A future shift so the group is the current-or-next one. Created while
    // demo mode is off, because the real-settings guard blocks it while on.
    const eventId = await admin.createScheduleEvent({
      id: 0n,
      name: "Demo Training Day",
      kind: { trainingDay: null } as const,
      start: NOW_NS + 30n * DAY_NS,
      end: [],
    });

    await admin.setDemoMode(true, "DEMO");
    await admin.loadDemoData();

    // The seeded demo leaders include two NSO Trainers with stations.
    const leaders = await admin.listLeaders();
    const demoTrainers = leaders.filter(
      (l) => "trainer" in l.role && l.trainerPositionIds.length > 0,
    );
    expect(demoTrainers.length).toBeGreaterThan(0);
    const chosen = demoTrainers[0];

    // A demo roadie to place in the chosen leader's group.
    const demoRoadies = await admin.listRoadies();
    expect(demoRoadies.length).toBeGreaterThan(0);
    const roadieId = demoRoadies[0].id;

    await admin.saveShiftBoard({
      eventId,
      shift: { am: null } as const,
      groups: [
        {
          trainerPrincipal: chosen.principal,
          capacity: 4n,
          roadieIds: [roadieId],
        },
      ],
      offRoadieIds: [],
      isDemo: true,
      editedAt: 0n,
    });

    // A signed-in caller with no real grant acts as a demo NSO Trainer and
    // chooses the demo leader to view as.
    const stranger = pic!.createActor<_SERVICE>(idlFactory, canisterId);
    stranger.setIdentity(strangerIdentity);
    await stranger.setDemoRole({ trainer: null }, [0n]);
    const set = await stranger.setDemoTrainerAs(chosen.principal);
    expect("ok" in set).toBe(true);

    // The demo state reports the chosen leader.
    const state = await stranger.getDemoState();
    expect(state.demoTrainerAs).toHaveLength(1);
    expect(state.demoTrainerAs[0]?.toText()).toBe(chosen.principal.toText());

    // The caller sees the chosen demo leader's group, not their own.
    const mine = await stranger.getMyGroup();
    expect(mine).toHaveLength(1);
    expect(mine[0].eventId).toBe(eventId);
    expect(mine[0].roadies.map((r) => r.roadieId)).toEqual([roadieId]);

    await admin.clearDemoData();
    await admin.setDemoMode(false, "");
  });
});
