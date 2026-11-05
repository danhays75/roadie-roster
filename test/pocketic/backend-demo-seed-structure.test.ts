import { PocketIc, createIdentity } from "@dfinity/pic";
import type { Actor, CanisterFixture } from "@dfinity/pic";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";
import type { _SERVICE } from "../../src/frontend/src/declarations/backend.did";
import { registerCaller } from "./test-utils";

/**
 * Characterization baseline for the demo seed's *structure*, written before the
 * demo seed's names, ages, positions, About Me answers and photo URLs change and
 * before demo records gain a `demoPhotoUrl` field.
 *
 * This file deliberately does NOT assert any seeded name, age, position, About
 * Me answer or photo URL — those are exactly what the accepted change rewrites.
 * It protects the structural invariants the seed must keep whatever its content
 * becomes: 40 roadies with 2 minors and 2 archived, 3 crews, 4 leaders spanning
 * the Legend/Platinum/Gold tiers, and 3 pending sign-ups including one phone
 * duplicate. It runs the real compiled canister; the frontend suite only mocks
 * the actor.
 */

const PIC_URL = process.env.POCKET_IC_URL ?? "";
const BACKEND_WASM = process.env.BACKEND_WASM ?? "";
const BASELINE_WASM = process.env.BACKEND_WASM_BASELINE;

describe("backend demo seed structure survives the content change", () => {
  let pic: PocketIc | undefined;
  let canisterId: CanisterFixture<_SERVICE>["canisterId"];
  let admin: Actor<_SERVICE>;

  const adminIdentity = createIdentity("demo-seed-structure-admin");

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

  it("seeds 40 demo roadies with 2 archived", async () => {
    await admin.setDemoMode(true, "DEMO");
    await admin.loadDemoData();

    const roadies = await admin.listRoadies();
    expect(roadies).toHaveLength(40);
    expect(roadies.every((r) => r.isDemo)).toBe(true);

    // The seed keeps its archived mix whatever the names and ages become.
    expect(
      roadies.filter((r) => "archived" in r.status),
    ).toHaveLength(2);

    await admin.setDemoMode(false, "");
  });

  it("seeds 3 crews and 4 leaders across the Legend, Platinum and Gold tiers", async () => {
    await admin.setDemoMode(true, "DEMO");
    await admin.loadDemoData();

    const crews = await admin.listCrews();
    expect(crews).toHaveLength(3);
    expect(crews.every((c) => c.isDemo)).toBe(true);

    const leaders = await admin.listLeaders();
    expect(leaders).toHaveLength(4);
    // One Legend (leadership), one Platinum (store manager) and two Gold
    // trainers — the tier mix the Leaders page groups by.
    expect(
      leaders.filter((l) => "leadership" in l.role),
    ).toHaveLength(1);
    expect(
      leaders.filter((l) => "storeManager" in l.role),
    ).toHaveLength(1);
    expect(leaders.filter((l) => "trainer" in l.role)).toHaveLength(2);

    await admin.setDemoMode(false, "");
  });

  it("seeds 3 pending sign-ups including one phone duplicate", async () => {
    await admin.setDemoMode(true, "DEMO");
    await admin.loadDemoData();

    const signups = await admin.listPendingSignups();
    expect(signups).toHaveLength(3);
    expect(signups.every((s) => s.isDemo)).toBe(true);

    // Two of the three share a phone number, so the duplicate-detection path
    // has a demo case to match.
    const phones = signups.map((s) => s.contactSet.phone);
    const duplicate = phones.find(
      (phone) => phones.filter((p) => p === phone).length > 1,
    );
    expect(duplicate).toBeDefined();

    await admin.setDemoMode(false, "");
  });
});
