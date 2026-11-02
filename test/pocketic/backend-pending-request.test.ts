import { PocketIc, createIdentity } from "@dfinity/pic";
import type { Actor, CanisterFixture } from "@dfinity/pic";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";
import type { _SERVICE } from "../../src/frontend/src/declarations/backend.did";
import { registerCaller } from "./test-utils";

/**
 * Backend lane for the accepted pending-request and kiosk-leader changes. It
 * exercises the real compiled canister for the new `getMyPendingRequest` query
 * (null with no pending entry, then requestedAt + hasProfile after a profile is
 * submitted) and for `listLeaders` returning an empty list to a kiosk caller.
 * The frontend suite only mocks the actor.
 */

const PIC_URL = process.env.POCKET_IC_URL ?? "";
const BACKEND_WASM = process.env.BACKEND_WASM ?? "";
const BASELINE_WASM = process.env.BACKEND_WASM_BASELINE;

/** A staff profile as the declarations shape it (optionals are arrays). */
function staffProfile(fullName: string, title: string) {
  return {
    fullName,
    preferredName: [] as [] | [string],
    title,
    requestedRole: { storeManager: null } as const,
    homeStoreNumber: "975",
    homeStoreCity: "Lake Charles",
    workPhone: [] as [] | [string],
    workEmail: [] as [] | [string],
    trainerPositionIds: [] as bigint[],
    arrivalDate: [] as [] | [bigint],
    departureDate: [] as [] | [bigint],
    photo: [] as [] | [Uint8Array],
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

describe("backend pending request and kiosk leader contract", () => {
  let pic: PocketIc | undefined;
  let canisterId: CanisterFixture<_SERVICE>["canisterId"];
  let admin: Actor<_SERVICE>;

  const adminIdentity = createIdentity("pending-admin-seed");

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

  it("returns null from getMyPendingRequest for a caller with no pending entry", async () => {
    const strangerIdentity = createIdentity("pending-stranger-seed");
    const stranger = pic!.createActor<_SERVICE>(idlFactory, canisterId);
    stranger.setIdentity(strangerIdentity);

    // No requestAccess call: the caller has no pending entry at all.
    await expect(stranger.getMyPendingRequest()).resolves.toEqual([]);
  });

  it("reports requestedAt and hasProfile=false after requestAccess, then true after a profile", async () => {
    const pendingIdentity = createIdentity("pending-flow-seed");
    const pending = await registerCaller(
      pic!.createActor<_SERVICE>(idlFactory, canisterId),
      pendingIdentity,
    );

    await pending.requestAccess();
    const before = await pending.getMyPendingRequest();
    expect(before).toHaveLength(1);
    expect(before[0]?.hasProfile).toBe(false);
    expect(before[0]?.requestedAt).toBeGreaterThan(0n);

    await pending.submitStaffProfile(staffProfile("Pending Person", "Trainer"));
    const after = await pending.getMyPendingRequest();
    expect(after).toHaveLength(1);
    expect(after[0]?.hasProfile).toBe(true);
    // The requestedAt is stable across the profile submission.
    expect(after[0]?.requestedAt).toBe(before[0]?.requestedAt);
  });

  it("denies listLeaders to a kiosk caller so no leader is ever shown", async () => {
    const kioskIdentity = createIdentity("pending-kiosk-seed");
    const kiosk = await registerCaller(
      pic!.createActor<_SERVICE>(idlFactory, canisterId),
      kioskIdentity,
    );
    await kiosk.requestAccess();
    await admin.approveUser({
      principal: kioskIdentity.getPrincipal(),
      role: { kiosk: null },
      trainerPositionIds: [],
      accessEndsAt: [],
      linkedRoadieId: [],
      staffProfile: [],
    });

    // The backend rejects the leader read for a kiosk caller at the shared
    // readable guard, so a kiosk login can never receive a leader entry. The
    // frontend route guard (LEADERS_ROLES) keeps kiosk off the Leaders page, so
    // this trap is not reachable through the app.
    await expect(kiosk.listLeaders()).rejects.toThrow();
  });
});
