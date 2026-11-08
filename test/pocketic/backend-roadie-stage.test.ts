import { PocketIc, createIdentity } from "@dfinity/pic";
import type { Actor, CanisterFixture } from "@dfinity/pic";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";
import type { _SERVICE } from "../../src/frontend/src/declarations/backend.did";
import { registerCaller } from "./test-utils";

/**
 * Backend lane for the accepted computed-stage change. The frontend suite mocks
 * the actor, so it passes unchanged against a canister whose stage is never
 * computed. This runs the real compiled canister and asserts the derived stage
 * the acceptance criteria describe:
 *   - a freshly approved roadie with incomplete paperwork is Hired,
 *   - complete paperwork moves them to Paperwork Done,
 *   - marking Present at orientation makes them Oriented,
 *   - a Present/Late check-in on a training-day shift makes them In Training,
 *   - a Certified status shows Certified,
 *   - an Archived roadie has no stage (null, rendered as Former),
 *   - the stage is recomputed on every read, never hand-set.
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

describe("backend computed roadie stage", () => {
  let pic: PocketIc | undefined;
  let canisterId: CanisterFixture<_SERVICE>["canisterId"];
  let admin: Actor<_SERVICE>;

  const adminIdentity = createIdentity("roadie-stage-admin");

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

  /** Approve a fresh sign-up and return the new roadie id. */
  async function approveRoadie(
    name: string,
    phone: string,
    email: string,
    orientationEventId: [] | [bigint] = [],
  ): Promise<bigint> {
    const signupId = await admin.submitSignup(
      profile(name),
      [],
      [],
      contactSet(phone, email, ADULT_DOB),
    );
    return admin.approveSignup(
      signupId,
      {
        mainPositionId: 0n,
        secondPositionId: [],
        crewId: [],
        orientationEventId,
        startDate: [],
      },
      sig("sig"),
    );
  }

  /** The stage of one roadie as the canister reports it on a fresh read. */
  async function stageOf(roadieId: bigint) {
    const roadie = await admin.getRoadie(roadieId);
    return roadie[0]?.stage;
  }

  it("derives Hired for a new roadie with incomplete paperwork", async () => {
    const roadieId = await approveRoadie(
      "Stage Hired",
      "+1-555-0301",
      "stage-hired@example.com",
    );
    expect(await stageOf(roadieId)).toEqual([{ hired: null }]);
  });

  it("derives Paperwork Done once every applicable item is checked", async () => {
    const roadieId = await approveRoadie(
      "Stage Paperwork",
      "+1-555-0302",
      "stage-paperwork@example.com",
    );
    // The Servers position needs an alcohol cert, so all four seeded paperwork
    // items apply; checking them all in checklist order completes the paperwork.
    await admin.setPaperworkItems(roadieId, ["0", "5", "3", "1"]);
    expect(await stageOf(roadieId)).toEqual([{ paperworkDone: null }]);
  });

  it("derives Oriented for an active roadie with no training check-in", async () => {
    const schedule = await admin.listSchedule();
    const session = schedule.find(
      (event) => event.kind.orientation !== undefined,
    );
    expect(session).toBeDefined();

    const roadieId = await approveRoadie(
      "Stage Oriented",
      "+1-555-0303",
      "stage-oriented@example.com",
      [session!.id],
    );
    await admin.setPaperworkItems(roadieId, ["0", "5", "3", "1"]);
    await admin.markPresent(roadieId, session!.id, []);

    // Active with no training-day check-in is Oriented.
    expect(await stageOf(roadieId)).toEqual([{ oriented: null }]);
  });

  it("derives In Training for an active roadie with a training-day check-in", async () => {
    const schedule = await admin.listSchedule();
    const session = schedule.find(
      (event) => event.kind.orientation !== undefined,
    );
    const trainingDay = schedule.find(
      (event) => event.kind.trainingDay !== undefined,
    );
    expect(session).toBeDefined();
    expect(trainingDay).toBeDefined();

    const roadieId = await approveRoadie(
      "Stage In Training",
      "+1-555-0304",
      "stage-training@example.com",
      [session!.id],
    );
    await admin.setPaperworkItems(roadieId, ["0", "5", "3", "1"]);
    await admin.markPresent(roadieId, session!.id, []);
    // A Present check-in on a training-day shift moves the stage to In Training.
    // The stage reads the trainer check-in map, so record it through the real
    // recordCheckIn API; an Admin may record outside the trainer lock window.
    await admin.recordCheckIn(
      trainingDay!.id,
      { am: null },
      roadieId,
      { present: null },
      [],
      [],
    );

    expect(await stageOf(roadieId)).toEqual([{ inTraining: null }]);
  });

  it("derives Certified for a roadie whose status is Certified", async () => {
    const roadieId = await approveRoadie(
      "Stage Certified",
      "+1-555-0305",
      "stage-certified@example.com",
    );
    await admin.updateRoadieStatus(roadieId, { certified: null });
    expect(await stageOf(roadieId)).toEqual([{ certified: null }]);
  });

  it("reports no stage for an archived roadie", async () => {
    const roadieId = await approveRoadie(
      "Stage Former",
      "+1-555-0306",
      "stage-former@example.com",
    );
    await admin.archiveRoadie(roadieId, { noShow: null });
    // An archived roadie has no stage; the UI renders Former instead.
    expect(await stageOf(roadieId)).toEqual([]);
  });

  it("recomputes the stage on every read rather than storing it", async () => {
    const roadieId = await approveRoadie(
      "Stage Recompute",
      "+1-555-0307",
      "stage-recompute@example.com",
    );
    // Hired while paperwork is incomplete...
    expect(await stageOf(roadieId)).toEqual([{ hired: null }]);
    // ...and Paperwork Done on the very next read once it is complete, with no
    // separate stage write in between.
    await admin.setPaperworkItems(roadieId, ["0", "5", "3", "1"]);
    expect(await stageOf(roadieId)).toEqual([{ paperworkDone: null }]);
  });
});
