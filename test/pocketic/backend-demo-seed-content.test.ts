import { PocketIc, createIdentity } from "@dfinity/pic";
import type { Actor, CanisterFixture } from "@dfinity/pic";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";
import type { _SERVICE } from "../../src/frontend/src/declarations/backend.did";
import { registerCaller } from "./test-utils";

/**
 * Backend lane for the accepted demo-seed content change, run against the real
 * compiled canister. The structure lane deliberately asserts no seeded name,
 * age, position or About Me answer; this lane covers exactly that content: the
 * seed writes realistic names, ages, positions and About Me answers (no
 * placeholder text), and every demo roadie and leader carries a real demo photo
 * URL. The frontend suite only mocks the actor, so only this lane proves the
 * seed content.
 */

const PIC_URL = process.env.POCKET_IC_URL ?? "";
const BACKEND_WASM = process.env.BACKEND_WASM ?? "";
const BASELINE_WASM = process.env.BACKEND_WASM_BASELINE;

/** Placeholder text the old seed used; the accepted change removes it. */
const PLACEHOLDER = /demo roadie|placeholder|lorem|test person/i;

describe("backend demo seed content is realistic", () => {
  let pic: PocketIc | undefined;
  let canisterId: CanisterFixture<_SERVICE>["canisterId"];
  let admin: Actor<_SERVICE>;

  const adminIdentity = createIdentity("demo-seed-content-admin");

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

  it("seeds 40 roadies with realistic names, ages, positions and About Me answers", async () => {
    await admin.setDemoMode(true, "DEMO");
    await admin.loadDemoData();

    const roadies = await admin.listRoadies();
    expect(roadies).toHaveLength(40);

    for (const roadie of roadies) {
      // A realistic full name, never placeholder text.
      expect(roadie.profile.name.trim().length).toBeGreaterThan(0);
      expect(roadie.profile.name).not.toMatch(PLACEHOLDER);
      // A full About Me answer set, not empty placeholders.
      expect(roadie.profile.hometown?.[0]?.trim().length ?? 0).toBeGreaterThan(
        0,
      );
      expect(roadie.profile.hobbies?.[0]?.trim().length ?? 0).toBeGreaterThan(
        0,
      );
      expect(roadie.profile.goalHere?.[0]?.trim().length ?? 0).toBeGreaterThan(
        0,
      );
      // A real age: the derived date of birth is in the past and the roadie is
      // a plausible working age (16-70).
      const dob = roadie.contactSet?.[0]?.dateOfBirth;
      expect(dob).toBeDefined();
      const ageYears =
        (Date.now() - Number((dob as bigint) / 1_000_000n)) /
        (365.25 * 24 * 60 * 60 * 1000);
      expect(ageYears).toBeGreaterThanOrEqual(15);
      expect(ageYears).toBeLessThanOrEqual(70);
    }

    // The seed spreads across more than one position, so the roster is not a
    // single-position placeholder set.
    const positionIds = new Set(roadies.map((r) => r.mainPositionId.toString()));
    expect(positionIds.size).toBeGreaterThan(1);

    await admin.setDemoMode(false, "");
  });

  it("seeds 4 leaders with realistic names and About Me answers", async () => {
    await admin.setDemoMode(true, "DEMO");
    await admin.loadDemoData();

    const leaders = await admin.listLeaders();
    expect(leaders).toHaveLength(4);

    for (const leader of leaders) {
      const profile = leader.staffProfile?.[0];
      expect(profile).toBeDefined();
      expect(profile?.fullName.trim().length ?? 0).toBeGreaterThan(0);
      expect(profile?.fullName).not.toMatch(PLACEHOLDER);
      expect(profile?.hometown?.[0]?.trim().length ?? 0).toBeGreaterThan(0);
      expect(profile?.goalHere?.[0]?.trim().length ?? 0).toBeGreaterThan(0);
    }

    await admin.setDemoMode(false, "");
  });

  it("gives every demo roadie and leader a real demo photo URL", async () => {
    await admin.setDemoMode(true, "DEMO");
    await admin.loadDemoData();

    const roadies = await admin.listRoadies();
    for (const roadie of roadies) {
      expect(roadie.demoPhotoUrl).toHaveLength(1);
      expect(roadie.demoPhotoUrl[0]).toMatch(/^https:\/\/.+\..+/);
      // The stored photo stays null; the demo URL is the only photo source.
      expect(roadie.photo).toEqual([]);
    }

    const leaders = await admin.listLeaders();
    for (const leader of leaders) {
      expect(leader.demoPhotoUrl).toHaveLength(1);
      expect(leader.demoPhotoUrl[0]).toMatch(/^https:\/\/.+\..+/);
      expect(leader.staffProfile?.[0]?.demoPhotoUrl).toHaveLength(1);
      expect(leader.staffProfile?.[0]?.photo).toEqual([]);
    }

    await admin.setDemoMode(false, "");
  });
});
