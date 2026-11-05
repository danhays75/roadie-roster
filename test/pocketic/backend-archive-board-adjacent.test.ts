import { PocketIc, createIdentity } from "@dfinity/pic";
import type { Actor, CanisterFixture } from "@dfinity/pic";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";
import type { _SERVICE } from "../../src/frontend/src/declarations/backend.did";
import { registerCaller } from "./test-utils";

/**
 * Characterization lane for behavior adjacent to the accepted archive/board
 * change, exercised against the real compiled canister. These are the working
 * rules the change must not disturb:
 *   - archiveNoShows archives only the pending no-shows assigned to a session
 *     whose date has passed, returns exactly those ids, and leaves active
 *     roadies and roadies assigned to other sessions alone,
 *   - archiveNoShows still traps for a session that has not passed and for a
 *     schedule event that is not an orientation,
 *   - a board write for a past shift records no group-change notice (the
 *     current-or-future-only rule in recordGroupChanges).
 * The frontend suite only mocks the actor, so this is the only place the real
 * behavior is exercised.
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

describe("backend archive and board adjacent behavior", () => {
  let pic: PocketIc | undefined;
  let canisterId: CanisterFixture<_SERVICE>["canisterId"];
  let admin: Actor<_SERVICE>;
  let trainer: Actor<_SERVICE>;

  const adminIdentity = createIdentity("archive-adjacent-admin-seed");
  const trainerIdentity = createIdentity("archive-adjacent-trainer-seed");

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

  /** Create an orientation session `daysAhead` from now and return its id. */
  async function addOrientationSession(name: string, daysAhead: number) {
    return admin.createScheduleEvent({
      id: 0n,
      kind: { orientation: null },
      name,
      start: NOW_NS + BigInt(daysAhead) * DAY_NS,
      end: [],
    });
  }

  /** Approve a sign-up assigned to the given orientation session. */
  async function approveRoadie(
    name: string,
    phone: string,
    orientationEventId: bigint,
  ): Promise<bigint> {
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
        orientationEventId: [orientationEventId],
        startDate: [],
      },
      sig("sig"),
    );
  }

  it("archives only the pending no-shows of a passed session and returns their ids", async () => {
    // A session in the past, and a second session in the future.
    const pastId = await addOrientationSession("Past Session", -5);
    const futureId = await addOrientationSession("Future Session", 20);

    const noShow = await approveRoadie("No Show", "+1-555-0700", pastId);
    const otherSession = await approveRoadie(
      "Other Session",
      "+1-555-0701",
      futureId,
    );

    const archived = await admin.archiveNoShows(pastId);
    expect(archived).toEqual([noShow]);

    // The no-show is archived as NCNS Orientation.
    const noShowAfter = await admin.getRoadie(noShow);
    expect(noShowAfter[0]?.status).toEqual({ archived: null });
    expect(noShowAfter[0]?.archivedReason).toEqual({
      ncnsOrientation: null,
    });

    // A roadie assigned to another session is untouched.
    const otherAfter = await admin.getRoadie(otherSession);
    expect(otherAfter[0]?.status).not.toEqual({ archived: null });
  });

  it("leaves an active roadie alone even when assigned to the passed session", async () => {
    const pastId = await addOrientationSession("Past Active Session", -6);
    const active = await approveRoadie("Active Roadie", "+1-555-0702", pastId);

    // Marking Present makes the roadie Active, so archiveNoShows must skip it.
    await admin.setPaperworkItems(active, ["0", "1", "2", "3"]);
    await admin.markPresent(active, pastId, []);

    const archived = await admin.archiveNoShows(pastId);
    expect(archived).toEqual([]);

    const after = await admin.getRoadie(active);
    expect(after[0]?.status).not.toEqual({ archived: null });
  });

  it("traps when the session has not passed yet", async () => {
    const futureId = await addOrientationSession("Not Yet Session", 15);
    await expect(admin.archiveNoShows(futureId)).rejects.toThrow(
      /has not passed yet/,
    );
  });

  it("traps when the schedule event is not an orientation", async () => {
    const trainingId = await admin.createScheduleEvent({
      id: 0n,
      kind: { trainingDay: null },
      name: "Not Orientation",
      start: NOW_NS - 3n * DAY_NS,
      end: [],
    });
    await expect(admin.archiveNoShows(trainingId)).rejects.toThrow(
      /not an orientation session/,
    );
  });

  it("records no group-change notice for a past shift", async () => {
    const roadieId = await approveRoadie(
      "Past Board Roadie",
      "+1-555-0703",
      await addOrientationSession("Past Board Session", -7),
    );
    const trainerPrincipal = trainerIdentity.getPrincipal();

    // A schedule event in the past, so recordGroupChanges returns early.
    const pastEventId = await admin.createScheduleEvent({
      id: 0n,
      kind: { trainingDay: null },
      name: "Past Training Day",
      start: NOW_NS - 2n * DAY_NS,
      end: [],
    });

    await admin.saveShiftBoard({
      eventId: pastEventId,
      shift: { am: null } as const,
      groups: [{ trainerPrincipal, capacity: 4n, roadieIds: [roadieId] }],
      offRoadieIds: [],
      isDemo: false,
      editedAt: 0n,
    });

    const notices = await trainer.listGroupChangeNotices();
    expect(
      notices.some((n) => n.eventId === pastEventId),
    ).toBe(false);
  });
});
