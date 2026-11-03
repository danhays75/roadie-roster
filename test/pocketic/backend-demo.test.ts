import { PocketIc, createIdentity } from "@dfinity/pic";
import type { Actor, CanisterFixture } from "@dfinity/pic";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";
import type { _SERVICE } from "../../src/frontend/src/declarations/backend.did";
import { registerCaller } from "./test-utils";

/**
 * Backend lane for the accepted Demo mode change. It runs the real compiled
 * canister: the demo state read, the Admin-only DEMO-confirmed switch, the
 * change-log records, the demo/real record separation across roadies, sign-ups,
 * crews and leaders, the idempotent seed and clear, and the demo-role
 * impersonation permission rules. The frontend suite only mocks the actor.
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

describe("backend Demo mode contract", () => {
  let pic: PocketIc | undefined;
  let canisterId: CanisterFixture<_SERVICE>["canisterId"];
  let admin: Actor<_SERVICE>;
  let manager: Actor<_SERVICE>;
  let trainer: Actor<_SERVICE>;

  const adminIdentity = createIdentity("demo-admin-seed");
  const managerIdentity = createIdentity("demo-manager-seed");
  const trainerIdentity = createIdentity("demo-trainer-seed");

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
    manager = await registerCaller(
      pic.createActor<_SERVICE>(idlFactory, canisterId),
      managerIdentity,
    );
    trainer = await registerCaller(
      pic.createActor<_SERVICE>(idlFactory, canisterId),
      trainerIdentity,
    );
    await manager.requestAccess();
    await admin.approveUser({
      principal: managerIdentity.getPrincipal(),
      role: { storeManager: null },
      trainerPositionIds: [],
      accessEndsAt: [],
      linkedRoadieId: [],
      staffProfile: [],
    });
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

  it("answers an empty-state demo read instead of trapping", async () => {
    const state = await admin.getDemoState();
    expect(state.enabled).toBe(false);
    expect(state.demoRole).toEqual({ admin: null });
    expect(state.pretendDate).toEqual([]);
  });

  it("requires the literal DEMO confirmation to turn demo mode on", async () => {
    const blank = await admin.setDemoMode(true, "");
    expect(blank).toEqual({ err: "Type DEMO to confirm" });
    expect((await admin.getDemoState()).enabled).toBe(false);

    const wrong = await admin.setDemoMode(true, "demo");
    expect(wrong).toEqual({ err: "Type DEMO to confirm" });
    expect((await admin.getDemoState()).enabled).toBe(false);

    const ok = await admin.setDemoMode(true, "DEMO");
    expect(ok).toHaveProperty("ok");
    const state = await admin.getDemoState();
    expect(state.enabled).toBe(true);
    // Turning it on sets the eight-hour auto-off window.
    expect(state.autoOffAt).toHaveLength(1);
    expect(state.turnedOnAt).toHaveLength(1);

    await admin.setDemoMode(false, "");
  });

  it("records every demo mode on and off in the change log", async () => {
    // The on/off entries are real (non-demo) entries, so they are visible while
    // demo mode is off.
    await admin.setDemoMode(true, "DEMO");
    await admin.setDemoMode(false, "");

    const log = await admin.listChangeLog();
    const actions = log.map((entry) => entry.action);
    expect(actions).toContain("demoModeOn");
    expect(actions).toContain("demoModeOff");
  });

  it("rejects a non-admin turning demo mode on", async () => {
    await expect(manager.setDemoMode(true, "DEMO")).rejects.toThrow();
    await expect(trainer.setDemoMode(true, "DEMO")).rejects.toThrow();
    expect((await admin.getDemoState()).enabled).toBe(false);
  });

  it("seeds the demo data set idempotently and clears it without touching real records", async () => {
    // A real roadie created while demo mode is OFF must survive the demo
    // lifecycle and never appear in a demo read.
    const realSignup = await admin.submitSignup(
      profile("Real Roadie"),
      [],
      [],
      contactSet("+1-555-0300", "real@example.com"),
    );
    const realRoadieId = await admin.approveSignup(
      realSignup,
      {
        mainPositionId: 0n,
        secondPositionId: [],
        crewId: [],
        orientationEventId: [],
        startDate: [],
      },
      sig("sig"),
    );

    await admin.setDemoMode(true, "DEMO");
    const first = await admin.loadDemoData();
    expect(first.roadies).toBe(40n);
    expect(first.leaders).toBe(4n);
    expect(first.signups).toBe(3n);
    expect(first.crews).toBe(3n);

    // Loading twice does not duplicate the seed.
    const second = await admin.loadDemoData();
    expect(second.roadies).toBe(40n);
    expect(second.leaders).toBe(4n);
    expect(second.signups).toBe(3n);
    expect(second.crews).toBe(3n);

    // While demo mode is on, reads return only demo records.
    const demoRoadies = await admin.listRoadies();
    expect(demoRoadies).toHaveLength(40);
    expect(demoRoadies.every((r) => r.isDemo)).toBe(true);
    expect(demoRoadies.some((r) => r.id === realRoadieId)).toBe(false);

    const demoSignups = await admin.listPendingSignups();
    expect(demoSignups).toHaveLength(3);
    expect(demoSignups.every((s) => s.isDemo)).toBe(true);

    const demoCrews = await admin.listCrews();
    expect(demoCrews).toHaveLength(3);
    expect(demoCrews.every((c) => c.isDemo)).toBe(true);

    const demoLeaders = await admin.listLeaders();
    expect(demoLeaders).toHaveLength(4);

    // Clearing removes every demo record and leaves the real roadie intact.
    const cleared = await admin.clearDemoData();
    expect(cleared.roadies).toBe(40n);
    expect(cleared.leaders).toBe(4n);
    expect(cleared.signups).toBe(3n);
    expect(cleared.crews).toBe(3n);

    // Turn demo mode off so the real roadie is visible again.
    await admin.setDemoMode(false, "");
    const afterClear = await admin.listRoadies();
    expect(afterClear.some((r) => r.id === realRoadieId)).toBe(true);
    expect(afterClear.every((r) => !r.isDemo)).toBe(true);
    expect(await admin.listCrews()).toEqual([]);
    expect(await admin.listPendingSignups()).toEqual([]);
  });

  it("hides demo records while demo mode is off", async () => {
    await admin.setDemoMode(true, "DEMO");
    await admin.loadDemoData();
    await admin.setDemoMode(false, "");

    const roadies = await admin.listRoadies();
    expect(roadies.every((r) => !r.isDemo)).toBe(true);
    expect(await admin.listCrews()).toEqual([]);
    expect(await admin.listPendingSignups()).toEqual([]);
    // No demo leader is visible while demo mode is off.
    const leaders = await admin.listLeaders();
    expect(leaders.every((l) => l.staffProfile?.workEmail !== "DEMO")).toBe(
      true,
    );
  });

  it("lets an unapproved signed-in caller act as the chosen demo role", async () => {
    await admin.setDemoMode(true, "DEMO");
    await admin.loadDemoData();

    // A signed-in caller with no access grant can still read demo data while
    // demo mode is on, because the effective role is the chosen demo role.
    const strangerIdentity = createIdentity("demo-stranger-seed");
    const stranger = pic!.createActor<_SERVICE>(idlFactory, canisterId);
    stranger.setIdentity(strangerIdentity);
    await expect(stranger.listRoadies()).resolves.toHaveLength(40);

    // A demo Kiosk login cannot read the roster, matching the real role.
    await admin.setDemoRole({ kiosk: null }, []);
    await expect(stranger.listRoadies()).rejects.toThrow();

    // A demo Trainer cannot read contact info, matching the real role.
    await admin.setDemoRole({ trainer: null }, [0n]);
    const trainerView = await stranger.listRoadies();
    expect(trainerView.length).toBeGreaterThan(0);
    // A redacted contact set is an empty Candid optional, not a value.
    expect(trainerView.every((r) => r.contactSet.length === 0)).toBe(true);

    await admin.setDemoMode(false, "");
  });

  it("stores a pretend date and clears it when demo mode turns off", async () => {
    await admin.setDemoMode(true, "DEMO");
    const day = 20_000n;
    const set = await admin.setPretendDate([{ day, shift: { pm: null } }]);
    expect(set).toHaveProperty("ok");
    const state = await admin.getDemoState();
    expect(state.pretendDate).toHaveLength(1);
    expect(state.pretendDate[0]?.day).toBe(day);
    expect(state.pretendDate[0]?.shift).toEqual({ pm: null });

    await admin.setDemoMode(false, "");
    expect((await admin.getDemoState()).pretendDate).toEqual([]);
  });
});
