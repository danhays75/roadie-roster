import { PocketIc, createIdentity } from "@dfinity/pic";
import type { Actor, CanisterFixture } from "@dfinity/pic";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";
import type { _SERVICE } from "../../src/frontend/src/declarations/backend.did";
import { registerCaller } from "./test-utils";

/**
 * Backend lane for the orientation assignment request. This runs the real
 * compiled canister and exercises the accepted public behavior the frontend
 * suite only mocks:
 *   - listOrientationSessions returns the orientation events ordered by start,
 *   - listUnassignedPendingRoadies returns pending roadies whose assignment is
 *     null or dangling, and drops them once assigned,
 *   - moveRoadieToSession attaches a session to a roadie with none,
 *   - moveAllRoadiesToSession moves every non-archived roadie from one session
 *     to another and returns the count moved.
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

describe("backend orientation assignment", () => {
  let pic: PocketIc | undefined;
  let canisterId: CanisterFixture<_SERVICE>["canisterId"];
  let admin: Actor<_SERVICE>;

  const adminIdentity = createIdentity("orientation-assignment-admin");

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

  /** Create a second orientation session and return its id. */
  async function addOrientationSession(name: string, daysAhead: number) {
    return admin.createScheduleEvent({
      id: 0n,
      kind: { orientation: null },
      name,
      start: NOW_NS + BigInt(daysAhead) * DAY_NS,
      end: [],
    });
  }

  /** Approve a sign-up with no orientation session and return the roadie id. */
  async function createUnassignedRoadie(name: string, phone: string) {
    const signupId = await admin.submitSignup(
      profile(name),
      [],
      [],
      contactSet(phone, `${phone}@example.com`, ADULT_DOB),
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

  it("lists orientation sessions ordered by start", async () => {
    const sessions = await admin.listOrientationSessions();
    expect(sessions.length).toBeGreaterThan(0);
    for (let i = 1; i < sessions.length; i += 1) {
      expect(sessions[i - 1].start <= sessions[i].start).toBe(true);
    }
  });

  it("auto-assigns the next session on approval, so the roadie is not unassigned", async () => {
    const roadieId = await createUnassignedRoadie("Assigned Ana", "+1-555-0300");

    // Approving with no chosen session assigns the next upcoming one, so the
    // roadie is not in the unassigned list.
    const roadie = await admin.getRoadie(roadieId);
    expect(roadie[0]?.orientationEventId).not.toEqual([]);

    const unassigned = await admin.listUnassignedPendingRoadies();
    expect(unassigned.some((row) => row.roadieId === roadieId)).toBe(false);
  });

  it("attaches a session to a roadie through moveRoadieToSession", async () => {
    const roadieId = await createUnassignedRoadie("Moved Mia", "+1-555-0301");
    const targetId = await addOrientationSession("Move Target", 25);

    await admin.moveRoadieToSession(roadieId, targetId);

    const roadie = await admin.getRoadie(roadieId);
    expect(roadie[0]?.orientationEventId).toEqual([targetId]);

    // The roadie now appears in the target session's view.
    const view = await admin.getOrientationSessionView(targetId);
    expect(view[0]?.roadies.some((row) => row.roadieId === roadieId)).toBe(
      true,
    );
  });

  it("moves every non-archived roadie from one session to another and returns the count", async () => {
    const sourceId = await addOrientationSession("Source Session", 30);
    const targetId = await addOrientationSession("Target Session", 40);

    const first = await createUnassignedRoadie("Move One", "+1-555-0310");
    const second = await createUnassignedRoadie("Move Two", "+1-555-0311");
    await admin.moveRoadieToSession(first, sourceId);
    await admin.moveRoadieToSession(second, sourceId);

    const moved = await admin.moveAllRoadiesToSession(sourceId, targetId);
    expect(moved).toBe(2n);

    const firstAfter = await admin.getRoadie(first);
    const secondAfter = await admin.getRoadie(second);
    expect(firstAfter[0]?.orientationEventId).toEqual([targetId]);
    expect(secondAfter[0]?.orientationEventId).toEqual([targetId]);

    // The source session is now empty.
    const sourceView = await admin.getOrientationSessionView(sourceId);
    expect(sourceView[0]?.assignedCount).toBe(0n);
  });
});
