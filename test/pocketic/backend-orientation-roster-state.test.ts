import { PocketIc, createIdentity } from "@dfinity/pic";
import type { Actor, CanisterFixture } from "@dfinity/pic";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";
import type { _SERVICE } from "../../src/frontend/src/declarations/backend.did";
import { registerCaller } from "./test-utils";

/**
 * Backend lane for the orientation / roster-state request. This runs the real
 * compiled canister and exercises the accepted public behavior the frontend
 * suite only mocks:
 *   - approving a sign-up creates the roadie Pending,
 *   - marking Present at an orientation session sets Active and records
 *     attendance; undoing Present returns them to Pending,
 *   - the orientation session view reports the assigned roadies and Present x/y,
 *   - the store carries an editable paperwork due date and positions carry
 *     default shirts/hats,
 *   - a single default orientation session exists.
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

describe("backend orientation and roster state", () => {
  let pic: PocketIc | undefined;
  let canisterId: CanisterFixture<_SERVICE>["canisterId"];
  let admin: Actor<_SERVICE>;

  const adminIdentity = createIdentity("orientation-admin");

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

  it("seeds a single default orientation session", async () => {
    const schedule = await admin.listSchedule();
    const orientations = schedule.filter(
      (event) => event.kind.orientation !== undefined,
    );
    expect(orientations).toHaveLength(1);
  });

  it("carries an editable paperwork due date and position default shirts/hats", async () => {
    const info = await admin.getStoreInfo();
    // The seeded due date is Jan 29, 2027 (the store encodes it as a UTC
    // midnight DateOnly, so allow the adjacent UTC day).
    const dueDay = new Date(Number(info.paperworkDueDate / 1_000_000n));
    expect(dueDay.getUTCFullYear()).toBe(2027);
    expect(dueDay.getUTCMonth()).toBe(0);
    expect([29, 30]).toContain(dueDay.getUTCDate());

    // The due date is editable through updateStoreInfo.
    const newDue = BigInt(Date.UTC(2027, 1, 15)) * 1_000_000n;
    await admin.updateStoreInfo({ ...info, paperworkDueDate: newDue });
    const after = await admin.getStoreInfo();
    expect(after.paperworkDueDate).toBe(newDue);

    const positions = await admin.listPositions();
    expect(positions.length).toBeGreaterThan(0);
    for (const position of positions) {
      expect(position.defaultShirts).toBe(3n);
      expect(position.defaultHats).toBe(2n);
    }
  });

  it("creates a Pending roadie on approve, then Active on Present and back to Pending on undo", async () => {
    const schedule = await admin.listSchedule();
    const session = schedule.find(
      (event) => event.kind.orientation !== undefined,
    );
    expect(session).toBeDefined();
    const eventId = session!.id;

    const signupId = await admin.submitSignup(
      profile("Orientation Target"),
      [],
      [],
      contactSet("+1-555-0200", "orientation@example.com", ADULT_DOB),
    );
    const roadieId = await admin.approveSignup(
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

    // Approving a sign-up creates the roadie Pending.
    const created = await admin.getRoadie(roadieId);
    expect(created[0]?.rosterState).toEqual({ pending: null });

    // The session view lists the assigned roadie with Present 0 / 1.
    const before = await admin.getOrientationSessionView(eventId);
    expect(before[0]?.assignedCount).toBe(1n);
    expect(before[0]?.presentCount).toBe(0n);
    expect(before[0]?.roadies[0]?.roadieId).toBe(roadieId);
    expect(before[0]?.roadies[0]?.present).toBe(false);

    // Marking Present sets Active and records attendance. The Servers position
    // needs an alcohol cert, so the roadie's paperwork must be complete first
    // (the request adds the paperwork gate to markPresent).
    await admin.setPaperworkItems(roadieId, ["0", "5", "3", "1"]);
    await admin.markPresent(roadieId, eventId, []);
    const afterPresent = await admin.getRoadie(roadieId);
    expect(afterPresent[0]?.rosterState).toEqual({ active: null });

    const attendance = await admin.listAttendanceForEvent(eventId);
    expect(
      attendance.some(
        (record) =>
          record.roadieId === roadieId && record.state.present !== undefined,
      ),
    ).toBe(true);

    const viewAfter = await admin.getOrientationSessionView(eventId);
    expect(viewAfter[0]?.presentCount).toBe(1n);
    expect(viewAfter[0]?.roadies[0]?.present).toBe(true);

    // Undoing Present returns the roadie to Pending.
    await admin.undoPresent(roadieId, eventId);
    const afterUndo = await admin.getRoadie(roadieId);
    expect(afterUndo[0]?.rosterState).toEqual({ pending: null });
  });

  it("counts Pending and Active together in the roster summary and excludes archived", async () => {
    const summary = await admin.getRosterSummary();
    const servers = summary.find((row) => row.positionId === 0n);
    expect(servers).toBeDefined();
    // On-hand is the sum of the pending and active breakdowns.
    expect(servers!.onHand).toBe(servers!.active + servers!.pending);
  });

  it("reports Pending and Active totals on the dashboard", async () => {
    const dashboard = await admin.getDashboard();
    expect(dashboard.hired).toBe(dashboard.active + dashboard.pending);
  });
});
