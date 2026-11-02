import { PocketIc, createIdentity } from "@dfinity/pic";
import type { Actor, CanisterFixture } from "@dfinity/pic";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";
import type { _SERVICE } from "../../src/frontend/src/declarations/backend.did";
import { registerCaller } from "./test-utils";

/**
 * Backend lane for the seeded paperwork checklist. The item's display text is
 * intentionally being renamed, so this test protects the semantics that must
 * survive the rename: the item keeps its id (4) and its minorOnly = true /
 * requiresAlcoholCert = false flags, and the seeded paperwork list keeps its
 * other entries. This runs the real compiled canister; the frontend suite only
 * mocks the actor.
 */

const PIC_URL = process.env.POCKET_IC_URL ?? "";
const BACKEND_WASM = process.env.BACKEND_WASM ?? "";
const BASELINE_WASM = process.env.BACKEND_WASM_BASELINE;

describe("backend seeded paperwork checklist", () => {
  let pic: PocketIc | undefined;
  let canisterId: CanisterFixture<_SERVICE>["canisterId"];
  let admin: Actor<_SERVICE>;

  const adminIdentity = createIdentity("paperwork-admin-seed");

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

  it("keeps the minor-only paperwork item's id and flags across the rename", async () => {
    const checklists = await admin.getChecklists();

    // The minor-only item keeps its stable id and its two flags; only its
    // display text is allowed to change.
    const minorItem = checklists.paperwork.find((item) => item.id === 4n);
    expect(minorItem).toBeDefined();
    expect(minorItem?.minorOnly).toBe(true);
    expect(minorItem?.requiresAlcoholCert).toBe(false);

    // The alcohol-cert item keeps its own flag and is not the minor item.
    const alcoholItem = checklists.paperwork.find((item) => item.id === 3n);
    expect(alcoholItem?.requiresAlcoholCert).toBe(true);
    expect(alcoholItem?.minorOnly).toBe(false);

    // The seeded paperwork list keeps all five entries.
    expect(checklists.paperwork).toHaveLength(5);
  });

  it("round-trips a renamed paperwork item through updateChecklists", async () => {
    const checklists = await admin.getChecklists();
    const renamed = checklists.paperwork.map((item) =>
      item.id === 4n
        ? { ...item, text: "LA employment certificate (LWC confirmation received)" }
        : item,
    );

    await admin.updateChecklists({
      orientationUniform: checklists.orientationUniform,
      paperwork: renamed,
    });

    const after = await admin.getChecklists();
    const minorItem = after.paperwork.find((item) => item.id === 4n);
    expect(minorItem?.text).toBe(
      "LA employment certificate (LWC confirmation received)",
    );
    // The rename must not disturb the flags.
    expect(minorItem?.minorOnly).toBe(true);
    expect(minorItem?.requiresAlcoholCert).toBe(false);
  });
});
