import { PocketIc, createIdentity } from "@dfinity/pic";
import type { Actor, CanisterFixture } from "@dfinity/pic";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";
import type { _SERVICE } from "../../src/frontend/src/declarations/backend.did";
import { registerCaller } from "./test-utils";

/**
 * Backend lane for the accepted paperwork enabled-flag and admin-order change.
 * Runs the real compiled canister: the frontend suite only mocks the actor, so
 * this is the only place the seeded `enabled` flag, the Food Handler Card's
 * disabled default and the stored order are exercised against real Motoko.
 *
 *   - every seeded paperwork item carries an `enabled` flag,
 *   - the Food Handler Card (id 2) is seeded disabled,
 *   - the seeded order is Digital Paperwork, I-9 / W-4, Alcohol Certificate,
 *     Food Handler Card, Policies & Procedures, then the minor-only item,
 *   - `updateChecklists` round-trips a reordered list and an enabled flag.
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

function contactSet(phone: string, email: string, dob: bigint) {
  return {
    phone,
    email,
    emergencyContactName: "Emergency",
    emergencyContactPhone: "+1-555-9999",
    dateOfBirth: dob,
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

describe("backend paperwork enabled flag and order", () => {
  let pic: PocketIc | undefined;
  let canisterId: CanisterFixture<_SERVICE>["canisterId"];
  let admin: Actor<_SERVICE>;

  const adminIdentity = createIdentity("paperwork-enabled-admin");

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

  it("seeds every paperwork item with an enabled flag and the Food Handler Card disabled", async () => {
    const checklists = await admin.getChecklists();

    // Every item carries the flag; the Food Handler Card is the only disabled
    // seeded item.
    for (const item of checklists.paperwork) {
      expect(typeof item.enabled).toBe("boolean");
    }
    const foodHandler = checklists.paperwork.find((item) => item.id === 2n);
    expect(foodHandler).toBeDefined();
    expect(foodHandler?.text).toBe("Food Handler Card");
    expect(foodHandler?.enabled).toBe(false);

    const enabledIds = checklists.paperwork
      .filter((item) => item.enabled)
      .map((item) => item.id);
    expect(enabledIds).not.toContain(2n);
  });

  it("seeds the paperwork list in the admin completion order", async () => {
    const checklists = await admin.getChecklists();
    expect(checklists.paperwork.map((item) => item.id)).toEqual([
      0n,
      5n,
      3n,
      2n,
      1n,
      4n,
    ]);
  });

  it("round-trips a reordered list and an enabled flag through updateChecklists", async () => {
    const checklists = await admin.getChecklists();
    // Move the Food Handler Card to the front and turn it on.
    const foodHandler = checklists.paperwork.find((item) => item.id === 2n);
    expect(foodHandler).toBeDefined();
    const reordered = [
      { ...foodHandler!, enabled: true },
      ...checklists.paperwork.filter((item) => item.id !== 2n),
    ];

    await admin.updateChecklists({
      orientationUniform: checklists.orientationUniform,
      paperwork: reordered,
    });

    const after = await admin.getChecklists();
    expect(after.paperwork.map((item) => item.id)).toEqual([
      2n,
      0n,
      5n,
      3n,
      1n,
      4n,
    ]);
    const moved = after.paperwork.find((item) => item.id === 2n);
    expect(moved?.enabled).toBe(true);
  });

  it("records a change-log entry naming each paperwork item and its on/off state", async () => {
    const checklists = await admin.getChecklists();
    // Turn the Food Handler Card on and rename Digital Paperwork, then save.
    const edited = checklists.paperwork.map((item) => {
      if (item.id === 2n) return { ...item, enabled: true };
      return item;
    });

    await admin.updateChecklists({
      orientationUniform: checklists.orientationUniform,
      paperwork: edited,
    });

    const log = await admin.listChangeLog();
    const entry = log.find((row) => row.action === "updateChecklists");
    expect(entry).toBeDefined();
    // The detail names the paperwork items and their on/off state.
    expect(entry?.detail).toContain("Food Handler Card on");
    expect(entry?.detail).toContain("Digital Paperwork on");
    expect(entry?.isDemo).toBe(false);
  });

  it("moves an already-passed roadie's stage back when a new item is enabled above their checked items", async () => {
    // Restore the canonical seeded order (Food Handler Card disabled) so this
    // test does not depend on the checklist state the earlier tests left.
    const seeded = await admin.getChecklists();
    const foodHandler = seeded.paperwork.find((item) => item.id === 2n);
    expect(foodHandler).toBeDefined();
    await admin.updateChecklists({
      orientationUniform: seeded.orientationUniform,
      paperwork: [
        ...seeded.paperwork.filter((item) => item.id !== 2n),
        { ...foodHandler!, enabled: false },
      ].sort((a, b) => Number(a.id) - Number(b.id)),
    });

    // A fresh roadie on the Servers position (needs an alcohol cert) checks
    // every applicable item, so their stage is Paperwork Done.
    const signupId = await admin.submitSignup(
      profile("Stage Rollback"),
      [],
      [],
      contactSet("+1-555-0401", "stage-rollback@example.com", ADULT_DOB),
    );
    const roadieId = await admin.approveSignup(
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
    await admin.setPaperworkItems(roadieId, ["0", "5", "3", "1"]);
    expect((await admin.getRoadie(roadieId))[0]?.stage).toEqual([
      { paperworkDone: null },
    ]);

    // Enable the Food Handler Card and insert it at the front of the list, so
    // it now sits above the items the roadie already checked.
    const checklists = await admin.getChecklists();
    const enabledFoodHandler = checklists.paperwork.find(
      (item) => item.id === 2n,
    );
    expect(enabledFoodHandler).toBeDefined();
    await admin.updateChecklists({
      orientationUniform: checklists.orientationUniform,
      paperwork: [
        { ...enabledFoodHandler!, enabled: true },
        ...checklists.paperwork.filter((item) => item.id !== 2n),
      ],
    });

    // Re-saving the roadie's existing checks drops the now-out-of-order items
    // below the newly enabled step, so their stage moves back to Hired.
    await admin.setPaperworkItems(roadieId, ["0", "5", "3", "1"]);
    const checkoff = await admin.getOrientationCheckoff(roadieId);
    expect(checkoff[0]?.paperworkItems).toEqual([]);
    expect((await admin.getRoadie(roadieId))[0]?.stage).toEqual([
      { hired: null },
    ]);
  });
});
