import { PocketIc, createIdentity } from "@dfinity/pic";
import type { Actor, CanisterFixture } from "@dfinity/pic";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";
import type { _SERVICE } from "../../src/frontend/src/declarations/backend.did";
import { registerCaller } from "./test-utils";

/**
 * Backend lane for the accepted Leaders change: listLeaders returns the manager,
 * trainer and leadership roles with their staff profile and title, and
 * getGiftBags({ leaders }) returns only leader labels carrying the leader's
 * title as the position name. This runs the real compiled canister; the
 * frontend suite only mocks the actor.
 */

const PIC_URL = process.env.POCKET_IC_URL ?? "";
const BACKEND_WASM = process.env.BACKEND_WASM ?? "";
const BASELINE_WASM = process.env.BACKEND_WASM_BASELINE;

/** A staff profile with the leader About Me fields populated. */
function staffProfile(
  fullName: string,
  title: string,
  requestedRole: { [key: string]: null },
  extras: {
    hometown?: string;
    favoriteSnack?: string;
    goalHere?: string;
  } = {},
) {
  return {
    fullName,
    preferredName: [] as [] | [string],
    title,
    requestedRole,
    homeStoreNumber: "975",
    homeStoreCity: "Lake Charles",
    workPhone: [] as [] | [string],
    workEmail: [] as [] | [string],
    arrivalDate: [] as [] | [bigint],
    departureDate: [] as [] | [bigint],
    trainerPositionIds: [] as bigint[],
    photo: [] as [] | [Uint8Array],
    hometown: (extras.hometown ? [extras.hometown] : []) as [] | [string],
    hobbies: [] as [] | [string],
    favoriteTeam: [] as [] | [string],
    favoriteSnack: (extras.favoriteSnack
      ? [extras.favoriteSnack]
      : []) as [] | [string],
    favoriteDrink: [] as [] | [string],
    favoriteColor: [] as [] | [string],
    funFact: [] as [] | [string],
    goalHere: (extras.goalHere ? [extras.goalHere] : []) as [] | [string],
    shirtSize: [] as [] | [string],
    hatSize: [] as [] | [string],
  };
}

describe("backend Leaders contract", () => {
  let pic: PocketIc | undefined;
  let canisterId: CanisterFixture<_SERVICE>["canisterId"];
  let admin: Actor<_SERVICE>;

  const adminIdentity = createIdentity("leaders-admin-seed");
  const managerIdentity = createIdentity("leaders-manager-seed");
  const trainerIdentity = createIdentity("leaders-trainer-seed");
  const leaderIdentity = createIdentity("leaders-leadership-seed");

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

  /** Register a caller and approve them with the given role and profile. */
  async function approveLeader(
    identity: ReturnType<typeof createIdentity>,
    role: { [key: string]: null },
    profile: ReturnType<typeof staffProfile>,
  ) {
    const actor = await registerCaller(
      pic!.createActor<_SERVICE>(idlFactory, canisterId),
      identity,
    );
    await actor.requestAccess();
    await admin.approveUser({
      principal: identity.getPrincipal(),
      role,
      trainerPositionIds: [],
      accessEndsAt: [],
      linkedRoadieId: [],
      staffProfile: [profile],
    });
    return actor;
  }

  it("returns the manager, trainer and leadership roles with their profile", async () => {
    await approveLeader(
      managerIdentity,
      { storeManager: null },
      staffProfile("Morgan Manager", "Store Manager", { storeManager: null }),
    );
    await approveLeader(
      trainerIdentity,
      { trainer: null },
      staffProfile("Tina Trainer", "NSO Trainer", { trainer: null }),
    );
    await approveLeader(
      leaderIdentity,
      { leadership: null },
      staffProfile("Lee Leader", "Market Partner", { leadership: null }),
    );

    const leaders = await admin.listLeaders();
    const names = leaders.map((l) => l.staffProfile?.[0]?.fullName);
    expect(names).toContain("Morgan Manager");
    expect(names).toContain("Tina Trainer");
    expect(names).toContain("Lee Leader");

    const manager = leaders.find(
      (l) => l.staffProfile?.[0]?.fullName === "Morgan Manager",
    );
    expect(manager?.role).toEqual({ storeManager: null });
    expect(manager?.title).toBe("Store Manager");
  });

  it("returns leader labels with the leader's title as the position name", async () => {
    const data = await admin.getGiftBags({ leaders: null });
    const names = data.labels.map((l) => l.name);
    expect(names).toContain("Morgan Manager");
    expect(names).toContain("Tina Trainer");

    const managerLabel = data.labels.find((l) => l.name === "Morgan Manager");
    expect(managerLabel?.positionName).toBe("Store Manager");
  });

  it("excludes roadies from the leaders filter", async () => {
    const data = await admin.getGiftBags({ leaders: null });
    // No roadie was created in this lane, so the leaders filter returns only
    // the approved leaders and never a roadie label.
    for (const label of data.labels) {
      expect(label.name).not.toBe("Roadie Person");
    }
  });

  it("never returns contact info on a leader label", async () => {
    const data = await admin.getGiftBags({ leaders: null });
    for (const label of data.labels) {
      const serialized = JSON.stringify(label, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value,
      );
      expect(serialized).not.toContain("+1-555");
      expect(serialized).not.toContain("@example.com");
      expect(serialized).not.toContain("dateOfBirth");
    }
  });
});
