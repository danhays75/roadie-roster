import { PocketIc, createIdentity } from "@dfinity/pic";
import type { Actor, CanisterFixture } from "@dfinity/pic";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";
import type { _SERVICE } from "../../src/frontend/src/declarations/backend.did";
import { registerCaller } from "./test-utils";

const PIC_URL = process.env.POCKET_IC_URL ?? "";
const BACKEND_WASM = process.env.BACKEND_WASM ?? "";
const BASELINE_WASM = process.env.BACKEND_WASM_BASELINE;

/**
 * The projected-count math against the real canister. The frontend suite mocks
 * the actor, so only this lane proves the accepted rule: the units to project
 * (unfilled build-to slots plus hired roadies missing the item's size, times the
 * position's quantity) are summed across every in-scope position FIRST, the size
 * curve's percentage is applied once, and the result is rounded once, half up.
 * It also proves the per-item Totals row and that a missing-size roadie is
 * projected by the curve and still listed under Size unknown.
 */
describe("backend uniform projected counts", () => {
  let pic: PocketIc | undefined;
  let canisterId: CanisterFixture<_SERVICE>["canisterId"];
  let admin: Actor<_SERVICE>;

  const adminIdentity = createIdentity("uniforms-projected-admin");

  /** A position with a controlled build-to and uniform quantity. */
  function position(
    name: string,
    openingBuildTo: bigint,
    shirtQty: bigint,
    hatQty: bigint,
  ) {
    return {
      id: 0n,
      name,
      code: name.slice(0, 3).toUpperCase(),
      house: { foh: null } as const,
      openingBuildTo,
      afterOpeningBuildTo: openingBuildTo,
      minimumAge: 16n,
      shirtsRequired: 0n,
      hatsRequired: 0n,
      needsAlcoholCert: false,
      shirtType: "Polo",
      shirtQty,
      hatType: "Cap",
      hatQty,
      crewManager: [] as [] | [string],
    };
  }

  /** A curve that puts all shirts on M and all hats on One size. */
  const CURVE = {
    sizeCurve: {
      shirts: [
        { size: "M", percent: 50n },
        { size: "L", percent: 50n },
      ],
      hats: [{ size: "One size", percent: 100n }],
    },
    bufferPercent: 10n,
  };

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

    // Replace the seeded positions with a controlled set so the expected
    // projected counts are exact. No roadies exist yet, so deletion is allowed.
    for (const seeded of await admin.listPositions()) {
      await admin.deletePosition(seeded.id);
    }
    await admin.updateUniformSettings(CURVE);
  });

  afterAll(async () => {
    await pic?.tearDown();
  });

  /** Remove every position so each test starts from a known, empty set. */
  async function resetPositions() {
    for (const existing of await admin.listPositions()) {
      await admin.deletePosition(existing.id);
    }
  }

  it("sums units across positions before applying the curve and rounds once", async () => {
    await resetPositions();
    // Two positions, each one unfilled slot of one shirt. Summed first: 2 units
    // x 50% = 1. Rounding each position separately would give 1 + 1 = 2.
    await admin.createPosition(position("Alpha", 1n, 1n, 0n));
    await admin.createPosition(position("Beta", 1n, 1n, 0n));

    const order = await admin.getUniformOrder({ all: null });
    const m = order.rows.find((row) => row.item === "Polo" && row.size === "M");
    expect(m).toBeDefined();
    expect(m?.projected).toBe(1n);
    // No roadies are hired, so nothing is counted as hired.
    expect(m?.hired).toBe(0n);
  });

  it("projects a hired roadie missing a size and still lists them under Size unknown", async () => {
    await resetPositions();
    // One position with two build-to slots and one shirt each. A hired roadie
    // with no shirt size occupies one slot and adds one missing-size unit, so
    // the units are (2 - 1) + 1 = 2, and 2 x 50% = 1.
    const positionId = await admin.createPosition(position("Gamma", 2n, 1n, 0n));

    const signupId = await admin.submitSignup(
      {
        name: "No Size",
        preferredName: [],
        hometown: [],
        hobbies: [],
        favoriteMovie: [],
        favoriteSnack: [],
        favoriteTeam: [],
        favoriteDrink: [],
        favoriteColor: [],
        funFact: [],
        goalHere: [],
        positionAppliedFor: [],
        shirtSize: [],
        hatSize: [],
        shiftsWantedPerWeek: [],
        weekdayLunch: [],
      },
      [],
      [],
      {
        phone: "+1-555-7100",
        email: "no-size@example.com",
        emergencyContactName: "Emergency",
        emergencyContactPhone: "+1-555-9999",
        dateOfBirth:
          BigInt(Date.now()) * 1_000_000n -
          25n * 365n * 24n * 60n * 60n * 1_000_000_000n,
        availability: [],
        availabilitySignature: [],
        availabilitySignedAt: [],
        availabilityResignPending: false,
        managerSignature: [],
        managerSignedAt: [],
        managerSignedBy: [],
      },
    );
    await admin.approveSignup(
      signupId,
      {
        mainPositionId: positionId,
        secondPositionId: [],
        crewId: [],
        orientationEventId: [],
        startDate: [],
      },
      new TextEncoder().encode("sig"),
    );

    const order = await admin.getUniformOrder({ all: null });
    const m = order.rows.find((row) => row.item === "Polo" && row.size === "M");
    expect(m?.projected).toBe(1n);

    // The missing-size roadie is listed by name with the missing flag set.
    const unknown = order.sizeUnknown.find((row) => row.name === "No Size");
    expect(unknown).toBeDefined();
    expect(unknown?.missingShirt).toBe(true);
    expect(unknown?.missingHat).toBe(true);
  });

  it("reports a per-item Totals row summing the size rows", async () => {
    // The positions and roadie from the earlier tests are still in scope, which
    // is enough: the totals must equal the sum of the size rows for each item.
    const order = await admin.getUniformOrder({ all: null });

    for (const totals of order.totals) {
      const rows = order.rows.filter((row) => row.item === totals.item);
      const hired = rows.reduce((sum, row) => sum + row.hired, 0n);
      const projected = rows.reduce((sum, row) => sum + row.projected, 0n);
      const orderTotal = rows.reduce((sum, row) => sum + row.orderTotal, 0n);
      expect(totals.hired).toBe(hired);
      expect(totals.projected).toBe(projected);
      expect(totals.orderTotal).toBe(orderTotal);
    }

    // The Polo item has a totals row because it has rows.
    expect(order.totals.some((row) => row.item === "Polo")).toBe(true);
  });
});
