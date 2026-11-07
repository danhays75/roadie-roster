import { PocketIc, createIdentity } from "@dfinity/pic";
import type { Actor, CanisterFixture } from "@dfinity/pic";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";
import type { _SERVICE } from "../../src/frontend/src/declarations/backend.did";
import { registerCaller } from "./test-utils";

/**
 * Backend lane for the accepted manager-owned Crews change, run against the
 * real compiled canister. It covers the parts the inherited crew lane does not:
 * a new crew requires an eligible owner, a manager may own only one crew
 * ("<Name> already has a crew"), the owner picker's role rule is enforced by the
 * backend, and the demo seed now writes 6 manager-owned crews with every
 * non-archived roadie assigned by the back-of-house / front-of-house round-robin
 * rule while Terrence Wallace is gone. The frontend suite only mocks the actor.
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

/** A staff profile for an approved leader, so the owner name is resolvable. */
function staffProfile(fullName: string, preferredName?: string) {
  return {
    fullName,
    preferredName: preferredName ? [preferredName] : ([] as [] | [string]),
    title: "Manager",
    requestedRole: { storeManager: null } as const,
    homeStoreNumber: "975",
    homeStoreCity: "Lake Charles",
    trainerPositionIds: [] as bigint[],
    workPhone: [] as [] | [string],
    workEmail: [] as [] | [string],
    photo: [] as [] | [unknown],
    demoPhotoUrl: [] as [] | [string],
    arrivalDate: [] as [] | [bigint],
    departureDate: [] as [] | [bigint],
    hometown: [] as [] | [string],
    hobbies: [] as [] | [string],
    favoriteTeam: [] as [] | [string],
    favoriteSnack: [] as [] | [string],
    favoriteDrink: [] as [] | [string],
    favoriteColor: [] as [] | [string],
    funFact: [] as [] | [string],
    goalHere: [] as [] | [string],
    shirtSize: [] as [] | [string],
    hatSize: [] as [] | [string],
  };
}

describe("backend manager-owned crew rules", () => {
  let pic: PocketIc | undefined;
  let canisterId: CanisterFixture<_SERVICE>["canisterId"];
  let admin: Actor<_SERVICE>;
  let manager: Actor<_SERVICE>;
  let trainer: Actor<_SERVICE>;

  const adminIdentity = createIdentity("crew-owner-admin-seed");
  const managerIdentity = createIdentity("crew-owner-manager-seed");
  const trainerIdentity = createIdentity("crew-owner-trainer-seed");

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
    // Approve the manager and the trainer as leaders with staff profiles, so
    // the owner-eligibility rule and the "already has a crew" name resolve.
    await manager.requestAccess();
    await admin.approveUser({
      principal: managerIdentity.getPrincipal(),
      role: { storeManager: null },
      trainerPositionIds: [],
      accessEndsAt: [],
      linkedRoadieId: [],
      staffProfile: [staffProfile("Jordan Rivera", "Jordan")],
    });
    await trainer.requestAccess();
    await admin.approveUser({
      principal: trainerIdentity.getPrincipal(),
      role: { trainer: null },
      trainerPositionIds: [0n],
      accessEndsAt: [],
      linkedRoadieId: [],
      staffProfile: [staffProfile("Kristen Marcotte")],
    });
  });

  afterAll(async () => {
    await pic?.tearDown();
  });

  it("creates a crew owned by an eligible manager", async () => {
    const id = await admin.createCrew("Jordan's Crew", managerIdentity.getPrincipal());
    const crews = await admin.listCrews();
    const created = crews.find((crew) => crew.id === id);
    expect(created?.name).toBe("Jordan's Crew");
    expect(created?.leaderPrincipal[0]?.toText()).toBe(
      managerIdentity.getPrincipal().toText(),
    );
  });

  it('refuses a second crew for the same manager with "<Name> already has a crew"', async () => {
    // The manager already owns a crew from the previous test.
    await expect(
      admin.createCrew("Second Crew", managerIdentity.getPrincipal()),
    ).rejects.toThrow(/already has a crew/);
  });

  it("refuses an NSO Trainer as a crew owner", async () => {
    // A trainer is not an eligible owner, so the backend rejects the write.
    await expect(
      admin.createCrew("Trainer Crew", trainerIdentity.getPrincipal()),
    ).rejects.toThrow();
  });

  it("refuses an unapproved principal as a crew owner", async () => {
    const stranger = createIdentity("crew-owner-stranger-seed");
    await expect(
      admin.createCrew("Stranger Crew", stranger.getPrincipal()),
    ).rejects.toThrow();
  });

  it("lets a manager own a crew after the previous owner is freed", async () => {
    // Move the manager's crew to the trainer is refused, so instead delete the
    // manager's crew and confirm the manager can own a new one.
    const crews = await admin.listCrews();
    const owned = crews.find(
      (crew) =>
        crew.leaderPrincipal[0]?.toText() ===
        managerIdentity.getPrincipal().toText(),
    );
    expect(owned).toBeDefined();
    await admin.deleteCrew(owned!.id);

    const id = await admin.createCrew("Jordan's New Crew", managerIdentity.getPrincipal());
    const after = await admin.listCrews();
    expect(after.some((crew) => crew.id === id)).toBe(true);
  });
});

describe("backend demo seed: manager-owned crews and round-robin", () => {
  let pic: PocketIc | undefined;
  let canisterId: CanisterFixture<_SERVICE>["canisterId"];
  let admin: Actor<_SERVICE>;

  const adminIdentity = createIdentity("crew-seed-admin-seed");

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

  it("seeds 6 manager-owned crews and 6 store managers, with Terrence Wallace gone", async () => {
    await admin.setDemoMode(true, "DEMO");
    await admin.loadDemoData();

    const crews = await admin.listCrews();
    expect(crews).toHaveLength(6);
    expect(crews.every((crew) => crew.isDemo)).toBe(true);
    // Every seeded crew has an owner.
    expect(crews.every((crew) => crew.leaderPrincipal.length === 1)).toBe(true);
    // Each crew is named "<First>'s Crew".
    for (const crew of crews) {
      expect(crew.name).toMatch(/'s Crew$/);
    }

    const leaders = await admin.listLeaders();
    const storeManagers = leaders.filter((l) => "storeManager" in l.role);
    expect(storeManagers).toHaveLength(6);
    // The old Store Manager leader is gone.
    expect(
      leaders.some((l) => l.staffProfile?.[0]?.fullName === "Terrence Wallace"),
    ).toBe(false);
    // Renee Hollier and the two NSO Trainers stay.
    expect(
      leaders.some((l) => l.staffProfile?.[0]?.fullName === "Renee Hollier"),
    ).toBe(true);
    expect(leaders.filter((l) => "trainer" in l.role)).toHaveLength(2);

    await admin.setDemoMode(false, "");
  });

  it("assigns every non-archived demo roadie to a crew", async () => {
    await admin.setDemoMode(true, "DEMO");
    await admin.loadDemoData();

    const roadies = await admin.listRoadies();
    const live = roadies.filter((r) => !("archived" in r.status));
    expect(live.length).toBeGreaterThan(0);
    // Every non-archived roadie has a crew assignment.
    expect(live.every((r) => r.crewId.length === 1)).toBe(true);

    // The archived roadies are not assigned.
    const archived = roadies.filter((r) => "archived" in r.status);
    expect(archived.every((r) => r.crewId.length === 0)).toBe(true);

    await admin.setDemoMode(false, "");
  });

  it("spreads the round-robin across all 6 crews", async () => {
    await admin.setDemoMode(true, "DEMO");
    await admin.loadDemoData();

    const roadies = await admin.listRoadies();
    const usedCrewIds = new Set(
      roadies
        .filter((r) => !("archived" in r.status) && r.crewId.length === 1)
        .map((r) => r.crewId[0].toString()),
    );
    // The back-of-house and front-of-house round-robins together reach all six
    // manager-owned crews.
    expect(usedCrewIds.size).toBe(6);

    await admin.setDemoMode(false, "");
  });

  it("clears the 6 managers, the 6 crews and the crew assignments", async () => {
    await admin.setDemoMode(true, "DEMO");
    await admin.loadDemoData();
    const cleared = await admin.clearDemoData();
    expect(cleared.crews).toBe(6n);
    expect(cleared.leaders).toBe(9n);

    // No demo crew or demo leader survives the clear.
    expect(await admin.listCrews()).toEqual([]);
    expect(await admin.listLeaders()).toEqual([]);

    await admin.setDemoMode(false, "");
  });
});

describe("backend demo manager drives My crew", () => {
  let pic: PocketIc | undefined;
  let canisterId: CanisterFixture<_SERVICE>["canisterId"];
  let admin: Actor<_SERVICE>;

  const adminIdentity = createIdentity("crew-manager-as-admin-seed");

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

  it("returns the chosen demo manager's crew from getMyCrew", async () => {
    await admin.setDemoMode(true, "DEMO");
    await admin.loadDemoData();

    // Act as a demo Store Manager, then choose a demo manager to view as.
    await admin.setDemoRole({ storeManager: null }, []);
    const leaders = await admin.listLeaders();
    const managers = leaders.filter((l) => "storeManager" in l.role);
    expect(managers.length).toBeGreaterThan(0);
    const chosen = managers[0];

    const set = await admin.setDemoManagerAs(chosen.principal);
    expect(set).toHaveProperty("ok");

    const myCrew = await admin.getMyCrew();
    expect(myCrew).toHaveLength(1);
    // The crew belongs to the chosen demo manager.
    const crews = await admin.listCrews();
    const owned = crews.find(
      (crew) => crew.leaderPrincipal[0]?.toText() === chosen.principal.toText(),
    );
    expect(owned).toBeDefined();
    expect(myCrew[0]?.crewId).toBe(owned!.id);

    await admin.setDemoMode(false, "");
  });

  it("rejects a non-manager principal as the demo manager", async () => {
    await admin.setDemoMode(true, "DEMO");
    await admin.loadDemoData();
    await admin.setDemoRole({ storeManager: null }, []);

    const leaders = await admin.listLeaders();
    const trainer = leaders.find((l) => "trainer" in l.role);
    expect(trainer).toBeDefined();
    const result = await admin.setDemoManagerAs(trainer!.principal);
    expect(result).toHaveProperty("err");

    await admin.setDemoMode(false, "");
  });
});
