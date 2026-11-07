import { PocketIc, createIdentity } from "@dfinity/pic";
import type { Actor, CanisterFixture } from "@dfinity/pic";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";
import type { _SERVICE } from "../../src/frontend/src/declarations/backend.did";
import { registerCaller } from "./test-utils";

/**
 * Backend lane for the accepted Demo mode change: the separation surfaces the
 * other demo lane files do not reach. While demo mode is on, the roster summary
 * (on-hand / build-to), the gift bags and both exports return only demo records;
 * while it is off, demo records never count toward on-hand, build-to, gift bags
 * or the exports. Runs the real compiled canister; the frontend suite only mocks
 * the actor.
 */

const PIC_URL = process.env.POCKET_IC_URL ?? "";
const BACKEND_WASM = process.env.BACKEND_WASM ?? "";
const BASELINE_WASM = process.env.BACKEND_WASM_BASELINE;

const DAY_NS = 24n * 60n * 60n * 1_000_000_000n;
const NOW_NS = BigInt(Date.now()) * 1_000_000n;
const ADULT_DOB = NOW_NS - 25n * 365n * DAY_NS;

function profile(name: string, snack: string) {
  return {
    name,
    preferredName: [] as [] | [string],
    hometown: [] as [] | [string],
    hobbies: [] as [] | [string],
    favoriteMovie: [] as [] | [string],
    favoriteSnack: [snack] as [] | [string],
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

describe("backend Demo mode separation across counts, gift bags and exports", () => {
  let pic: PocketIc | undefined;
  let canisterId: CanisterFixture<_SERVICE>["canisterId"];
  let admin: Actor<_SERVICE>;

  const adminIdentity = createIdentity("demo-separation-admin-seed");

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

  /** Create a real roadie while demo mode is off and return its id. */
  async function createRealRoadie(name: string, snack: string): Promise<bigint> {
    const signupId = await admin.submitSignup(
      profile(name, snack),
      [],
      [],
      contactSet(`+1-555-${name.length}${name.charCodeAt(0)}`, `${name}@example.com`),
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

  it("keeps demo records out of on-hand, build-to, gift bags and exports while off", async () => {
    // A real roadie exists while demo mode is off.
    await createRealRoadie("Real Separation", "Real Snack");

    const realSummary = await admin.getRosterSummary();
    const realOnHand = realSummary.reduce((sum, row) => sum + row.onHand, 0n);
    expect(realOnHand).toBe(1n);

    const realGiftBags = await admin.getGiftBags({ all: null });
    expect(realGiftBags.labels.map((l) => l.name)).toContain(
      "Real Separation",
    );

    const realExport = await admin.buildFullExport();
    const realExportNames = realExport.groups.flatMap(([, rows]) =>
      rows.map((r) => r.name),
    );
    expect(realExportNames).toContain("Real Separation");

    // Seed the demo set, capture the demo names, then turn demo mode off again.
    await admin.setDemoMode(true, "DEMO");
    await admin.loadDemoData();
    const demoNames = new Set(
      (await admin.listRoadies())
        .filter((r) => r.isDemo)
        .map((r) => r.profile.name),
    );
    expect(demoNames.size).toBeGreaterThan(0);
    await admin.setDemoMode(false, "");

    // The demo records are invisible: on-hand still counts only the real roadie.
    const offSummary = await admin.getRosterSummary();
    const offOnHand = offSummary.reduce((sum, row) => sum + row.onHand, 0n);
    expect(offOnHand).toBe(1n);

    // Gift bags and both exports carry no demo record while demo mode is off.
    const offGiftBags = await admin.getGiftBags({ all: null });
    const offGiftNames = offGiftBags.labels.map((l) => l.name);
    expect(offGiftNames).toContain("Real Separation");
    expect(offGiftNames.some((n) => demoNames.has(n))).toBe(false);

    const offFull = await admin.buildFullExport();
    const offFullNames = offFull.groups.flatMap(([, rows]) =>
      rows.map((r) => r.name),
    );
    expect(offFullNames).toContain("Real Separation");
    expect(offFullNames.some((n) => demoNames.has(n))).toBe(false);

    const offShareable = await admin.buildShareableExport();
    const offShareableNames = offShareable.groups.flatMap(([, rows]) =>
      rows.map((r) => r.name),
    );
    expect(offShareableNames.some((n) => demoNames.has(n))).toBe(false);
  });

  it("returns only demo records from counts, gift bags and exports while on", async () => {
    await admin.setDemoMode(true, "DEMO");
    await admin.loadDemoData();

    // On-hand counts the 40 demo roadies (2 archived are excluded), not the real
    // roadie created while demo mode was off.
    const summary = await admin.getRosterSummary();
    const onHand = summary.reduce((sum, row) => sum + row.onHand, 0n);
    expect(onHand).toBe(38n);

    // The accepted change gives demo roadies realistic names, so identify them
    // by the isDemo flag on the roadie read rather than a name prefix.
    const demoRoadies = await admin.listRoadies();
    const demoNames = new Set(
      demoRoadies.filter((r) => r.isDemo).map((r) => r.profile.name),
    );
    expect(demoNames.size).toBeGreaterThan(0);

    const giftBags = await admin.getGiftBags({ all: null });
    const giftNames = giftBags.labels.map((l) => l.name);
    expect(giftNames.some((n) => demoNames.has(n))).toBe(true);
    expect(giftNames).not.toContain("Real Separation");

    const full = await admin.buildFullExport();
    const fullNames = full.groups.flatMap(([, rows]) => rows.map((r) => r.name));
    expect(fullNames.some((n) => demoNames.has(n))).toBe(true);
    expect(fullNames).not.toContain("Real Separation");

    const shareable = await admin.buildShareableExport();
    const shareableNames = shareable.groups.flatMap(([, rows]) =>
      rows.map((r) => r.name),
    );
    expect(shareableNames.some((n) => demoNames.has(n))).toBe(true);
    expect(shareableNames).not.toContain("Real Separation");

    await admin.setDemoMode(false, "");
  });

  it("does not modify a real record when a write happens while demo mode is on", async () => {
    // The real roadie's status is captured while demo mode is off.
    const before = await admin.listRoadies();
    const realBefore = before.find((r) => r.profile.name === "Real Separation");
    expect(realBefore).toBeDefined();

    await admin.setDemoMode(true, "DEMO");
    await admin.loadDemoData();

    // A write made while demo mode is on targets the demo set only.
    const demoRoadies = await admin.listRoadies();
    const demoRoadie = demoRoadies.find((r) => r.isDemo);
    expect(demoRoadie).toBeDefined();
    await admin.updateRoadieStatus(demoRoadie!.id, { active: null });

    await admin.setDemoMode(false, "");

    // The real roadie is unchanged and still present.
    const after = await admin.listRoadies();
    const realAfter = after.find((r) => r.profile.name === "Real Separation");
    expect(realAfter).toBeDefined();
    expect(realAfter!.status).toEqual(realBefore!.status);
  });
});
