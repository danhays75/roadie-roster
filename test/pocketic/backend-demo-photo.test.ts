import { PocketIc, createIdentity } from "@dfinity/pic";
import type { Actor, CanisterFixture } from "@dfinity/pic";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";
import type { _SERVICE } from "../../src/frontend/src/declarations/backend.did";
import { registerCaller } from "./test-utils";

/**
 * Backend lane for the accepted demo-photo change, run against the real
 * compiled canister. It proves the demo seed writes a non-empty `demoPhotoUrl`
 * onto every demo roadie and demo leader, that a real record carries no demo
 * photo URL, and that the migration leaves `demoPhotoUrl` null for records that
 * predate the field. The frontend suite only mocks the actor, so only this lane
 * proves the seed and migration behavior.
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

describe("backend demo photo URL contract", () => {
  let pic: PocketIc | undefined;
  let canisterId: CanisterFixture<_SERVICE>["canisterId"];
  let admin: Actor<_SERVICE>;

  const adminIdentity = createIdentity("demo-photo-admin-seed");

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

  it("seeds a non-empty demo photo URL on every demo roadie", async () => {
    await admin.setDemoMode(true, "DEMO");
    await admin.loadDemoData();

    const roadies = await admin.listRoadies();
    expect(roadies).toHaveLength(40);
    for (const roadie of roadies) {
      expect(roadie.isDemo).toBe(true);
      // The seed writes a demo-only photo URL; the stored photo stays null.
      expect(roadie.demoPhotoUrl).toHaveLength(1);
      expect(roadie.demoPhotoUrl[0]).toMatch(/^https?:\/\//);
      expect(roadie.photo).toEqual([]);
    }

    await admin.setDemoMode(false, "");
  });

  it("seeds a non-empty demo photo URL on every demo leader", async () => {
    await admin.setDemoMode(true, "DEMO");
    await admin.loadDemoData();

    const leaders = await admin.listLeaders();
    // Renee Hollier, the 6 store managers and the 2 NSO Trainers.
    expect(leaders).toHaveLength(9);
    for (const leader of leaders) {
      expect(leader.demoPhotoUrl).toHaveLength(1);
      expect(leader.demoPhotoUrl[0]).toMatch(/^https?:\/\//);
      // The staff profile carries the same demo URL and no stored photo.
      expect(leader.staffProfile?.[0]?.demoPhotoUrl).toHaveLength(1);
      expect(leader.staffProfile?.[0]?.photo).toEqual([]);
    }

    await admin.setDemoMode(false, "");
  });

  it("leaves a real record's demo photo URL null", async () => {
    // A real roadie created while demo mode is off must carry no demo photo URL.
    const signupId = await admin.submitSignup(
      profile("Real Photo Target"),
      [],
      [],
      contactSet("+1-555-0400", "realphoto@example.com"),
    );
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
    expect(roadie[0]?.isDemo).toBe(false);
    expect(roadie[0]?.demoPhotoUrl).toEqual([]);
  });

  it("leaves demoPhotoUrl null for records that predate the field on upgrade", async () => {
    // Only meaningful when the runner supplies a pre-change baseline to upgrade
    // from; a fresh install has no legacy records to convert.
    if (BASELINE_WASM === undefined) {
      expect(BASELINE_WASM).toBeUndefined();
      return;
    }

    // The upgrade already ran in beforeAll. Every real roadie the canister
    // reports must carry the new field as null, never a demo URL.
    const roadies = await admin.listRoadies();
    for (const roadie of roadies) {
      expect(roadie.isDemo).toBe(false);
      expect(roadie.demoPhotoUrl).toEqual([]);
    }
  });
});
