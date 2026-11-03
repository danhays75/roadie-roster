import { PocketIc, createIdentity } from "@dfinity/pic";
import type { Actor, CanisterFixture } from "@dfinity/pic";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";
import type { _SERVICE } from "../../src/frontend/src/declarations/backend.did";
import { registerCaller } from "./test-utils";

/**
 * Backend lane for the accepted Demo mode change: a kiosk sign-up submitted
 * while demo mode is on is stored as a demo sign-up and never appears in the
 * real pending queue, and a real sign-up submitted while demo mode is off is
 * never returned by a demo read. Runs the real compiled canister; the frontend
 * suite only mocks the actor.
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

describe("backend Demo mode kiosk sign-up separation", () => {
  let pic: PocketIc | undefined;
  let canisterId: CanisterFixture<_SERVICE>["canisterId"];
  let admin: Actor<_SERVICE>;

  const adminIdentity = createIdentity("demo-kiosk-admin-seed");

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

  it("stores a kiosk sign-up made in demo mode as a demo sign-up", async () => {
    await admin.setDemoMode(true, "DEMO");

    const demoSignupId = await admin.submitSignup(
      profile("Demo Kiosk Signup"),
      [],
      [],
      contactSet("+1-555-0400", "demo-kiosk@example.com"),
    );

    // The demo pending queue returns it, flagged as a demo record.
    const demoQueue = await admin.listPendingSignups();
    const stored = demoQueue.find((s) => s.id === demoSignupId);
    expect(stored).toBeDefined();
    expect(stored?.isDemo).toBe(true);

    // Turning demo mode off hides it from the real pending queue.
    await admin.setDemoMode(false, "");
    const realQueue = await admin.listPendingSignups();
    expect(realQueue.some((s) => s.id === demoSignupId)).toBe(false);
    expect(realQueue.every((s) => !s.isDemo)).toBe(true);
  });

  it("never returns a real sign-up in a demo read", async () => {
    // A real sign-up created while demo mode is off.
    const realSignupId = await admin.submitSignup(
      profile("Real Kiosk Signup"),
      [],
      [],
      contactSet("+1-555-0401", "real-kiosk@example.com"),
    );

    await admin.setDemoMode(true, "DEMO");
    const demoQueue = await admin.listPendingSignups();
    expect(demoQueue.some((s) => s.id === realSignupId)).toBe(false);
    expect(demoQueue.every((s) => s.isDemo)).toBe(true);

    await admin.setDemoMode(false, "");
  });
});
