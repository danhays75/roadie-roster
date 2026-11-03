import { PocketIc, createIdentity } from "@dfinity/pic";
import type { Actor, CanisterFixture } from "@dfinity/pic";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";
import type { _SERVICE } from "../../src/frontend/src/declarations/backend.did";
import { registerCaller } from "./test-utils";

/**
 * Characterization baseline for the real-settings reads and writes the Demo
 * mode change touches. It protects the behavior that must survive: while demo
 * mode is ON, reading positions, schedule and store info still succeeds; while
 * demo mode is OFF, a real Admin can read and write real data normally. It
 * deliberately does not assert the demo-on write behavior, which the change
 * intentionally alters. Runs the real compiled canister; the frontend suite
 * only mocks the actor.
 */

const PIC_URL = process.env.POCKET_IC_URL ?? "";
const BACKEND_WASM = process.env.BACKEND_WASM ?? "";
const BASELINE_WASM = process.env.BACKEND_WASM_BASELINE;

function position(name: string) {
  return {
    id: 0n,
    name,
    code: "SRV",
    house: { foh: null } as const,
    openingBuildTo: 5n,
    afterOpeningBuildTo: 5n,
    minimumAge: 18n,
    shirtsRequired: 1n,
    hatsRequired: 1n,
    needsAlcoholCert: false,
    crewManager: [] as [] | [string],
    defaultShirts: 3n,
    defaultHats: 2n,
  };
}

describe("backend real-settings reads and writes around Demo mode", () => {
  let pic: PocketIc | undefined;
  let canisterId: CanisterFixture<_SERVICE>["canisterId"];
  let admin: Actor<_SERVICE>;

  const adminIdentity = createIdentity("demo-real-settings-admin-seed");

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

  it("reads positions, schedule and store info while demo mode is on", async () => {
    await admin.setDemoMode(true, "DEMO");

    // The accepted requirement keeps these reads allowed in demo mode.
    await expect(admin.listPositions()).resolves.toBeInstanceOf(Array);
    await expect(admin.listSchedule()).resolves.toBeInstanceOf(Array);
    const store = await admin.getStoreInfo();
    expect(typeof store.storeNumber).toBe("string");
    await expect(admin.getChecklists()).resolves.toBeDefined();

    await admin.setDemoMode(false, "");
  });

  it("lets a real Admin read and write real data while demo mode is off", async () => {
    // Demo mode is off: the normal real-data path still works.
    const created = await admin.createPosition(position("Real Position"));
    const positions = await admin.listPositions();
    expect(positions.some((p) => p.id === created)).toBe(true);

    const store = await admin.getStoreInfo();
    await admin.updateStoreInfo({ ...store, locationName: "Sulphur" });
    expect((await admin.getStoreInfo()).locationName).toBe("Sulphur");
  });
});
