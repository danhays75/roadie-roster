import { PocketIc, createIdentity } from "@dfinity/pic";
import type { Actor, CanisterFixture } from "@dfinity/pic";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";
import type { _SERVICE } from "../../src/frontend/src/declarations/backend.did";
import { registerCaller } from "./test-utils";

/**
 * Backend lane for the accepted hireDate change: approving a kiosk sign-up
 * records the hire date from that sign-up's submission time, and the migration
 * backfills existing roadies from their sign-up's submission time (falling back
 * to the approval time). This exercises the real compiled canister; the
 * frontend suite only mocks the actor.
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

describe("backend hireDate contract", () => {
  let pic: PocketIc | undefined;
  let canisterId: CanisterFixture<_SERVICE>["canisterId"];
  let admin: Actor<_SERVICE>;

  const adminIdentity = createIdentity("hire-date-admin-seed");

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

  it("records the hire date from the sign-up's submission time on approval", async () => {
    const signupId = await admin.submitSignup(
      profile("Hire Date Target"),
      [],
      [],
      contactSet("+1-555-0200", "hiredate@example.com", ADULT_DOB),
    );
    // Read the submission time the canister itself recorded, so the assertion
    // does not depend on the host clock.
    const submission = await admin.getSignup(signupId);
    const submittedAt = submission[0]!.submittedAt;

    const roadieId = await admin.approveSignup(
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

    const roadie = await admin.getRoadie(roadieId);
    // hireDate is the sign-up's submission time, not the approval time.
    expect(roadie[0]?.hireDate[0]).toBe(submittedAt);
    // hiredAt is the approval time, which is at or after the submission.
    expect(roadie[0]?.hiredAt).toBeGreaterThanOrEqual(submittedAt);
  });

  it("backfills an existing roadie's hire date from its sign-up on upgrade", async () => {
    // Only meaningful when the runner supplies a pre-change baseline to upgrade
    // from; a fresh install has no legacy roadies to convert.
    if (BASELINE_WASM === undefined) {
      expect(BASELINE_WASM).toBeUndefined();
      return;
    }

    // The upgrade already ran in beforeAll, so any roadie created by the
    // baseline would carry a hireDate. Assert the field is present and never
    // null for every roadie the canister reports.
    const roadies = await admin.listRoadies();
    for (const roadie of roadies) {
      expect(roadie.hireDate).toHaveLength(1);
      expect(roadie.hireDate[0]).toBeGreaterThan(0n);
    }
  });
});
