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
 * The uniforms batch against the real canister: the seeded size curve and
 * buffer, the order rows the page consumes, the size-unknown bucket, the
 * settings round-trip and the demo-mode write guard. The frontend suite mocks
 * this actor, so only this lane proves the public methods actually answer.
 */
describe("backend uniforms contract", () => {
  let pic: PocketIc | undefined;
  let canisterId: CanisterFixture<_SERVICE>["canisterId"];
  let admin: Actor<_SERVICE>;

  const adminIdentity = createIdentity("uniforms-admin");

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

  it("returns the seeded size curve and the default 10% buffer", async () => {
    const settings = await admin.getUniformSettings();
    expect(settings.bufferPercent).toBe(10n);
    expect(settings.sizeCurve.shirts).toEqual([
      { size: "XS", percent: 3n },
      { size: "S", percent: 12n },
      { size: "M", percent: 25n },
      { size: "L", percent: 28n },
      { size: "XL", percent: 18n },
      { size: "2XL", percent: 10n },
      { size: "3XL", percent: 4n },
    ]);
    expect(settings.sizeCurve.hats).toEqual([
      { size: "One size", percent: 60n },
      { size: "S/M", percent: 20n },
      { size: "L/XL", percent: 20n },
    ]);
  });

  it("round-trips an updated size curve and buffer and logs the change", async () => {
    const before = await admin.getUniformSettings();
    const updated = {
      sizeCurve: {
        shirts: before.sizeCurve.shirts.map((entry) => ({
          size: entry.size,
          percent: entry.size === "XS" ? 1n : entry.percent,
        })),
        hats: before.sizeCurve.hats,
      },
      bufferPercent: 15n,
    };
    await admin.updateUniformSettings(updated);

    const after = await admin.getUniformSettings();
    expect(after.bufferPercent).toBe(15n);
    expect(after.sizeCurve.shirts[0]).toEqual({ size: "XS", percent: 1n });

    const log = await admin.listChangeLog();
    expect(
      log.some((entry) => entry.action === "updateUniformSettings"),
    ).toBe(true);

    // Restore the seeded settings so later assertions see the defaults.
    await admin.updateUniformSettings(before);
  });

  it("builds order rows with hired, projected and order totals per item and size", async () => {
    // A converted project's migration zeroes the uniform defaults on existing
    // positions, so create one that gives a shirt and a hat to exercise rows.
    await admin.ensureSeeded();
    const positions = await admin.listPositions();
    const base = positions[0]!;
    await admin.createPosition({
      ...base,
      id: 0n,
      name: "Uniform Probe",
      code: "UPR",
      shirtType: "Polo",
      shirtQty: 2n,
      hatType: "Cap",
      hatQty: 1n,
    });

    const order = await admin.getUniformOrder({ all: null });
    expect(order.bufferPercent).toBe(10n);
    expect(order.rows.length).toBeGreaterThan(0);
    // The row's item label is the position's uniform type, not a generic name.
    expect(order.rows.some((row) => row.item === "Polo")).toBe(true);
    expect(order.rows.some((row) => row.item === "Cap")).toBe(true);
    for (const row of order.rows) {
      expect(row.item.length).toBeGreaterThan(0);
      expect(row.size.length).toBeGreaterThan(0);
      // Order total is (hired + projected) with the buffer added, rounded up.
      const total = row.hired + row.projected;
      expect(row.orderTotal).toBe((total * 110n + 99n) / 100n);
    }
  });

  it("filters the order by house", async () => {
    const all = await admin.getUniformOrder({ all: null });
    const foh = await admin.getUniformOrder({ foh: null });
    const boh = await admin.getUniformOrder({ boh: null });
    expect(foh.filter).toEqual({ foh: null });
    expect(boh.filter).toEqual({ boh: null });
    // Every FOH and BOH row is also present in the All order.
    for (const row of [...foh.rows, ...boh.rows]) {
      expect(all.rows).toContainEqual(row);
    }
  });

  it("refuses a uniform settings write while demo mode is on", async () => {
    await admin.setDemoMode(true, "DEMO");
    const settings = await admin.getUniformSettings();
    await expect(admin.updateUniformSettings(settings)).rejects.toThrow(
      /Turn off demo mode/,
    );
    await admin.setDemoMode(false, "");
  });

  it("returns only demo records from the order while demo mode is on", async () => {
    // A real roadie exists while demo mode is off.
    await admin.ensureSeeded();
    const realSignup = await admin.submitSignup(
      {
        name: "Real Uniform",
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
        shirtSize: ["L"],
        hatSize: ["M"],
        shiftsWantedPerWeek: [],
        weekdayLunch: [],
      },
      [],
      [],
      {
        phone: "+1-555-7000",
        email: "real-uniform@example.com",
        emergencyContactName: "Emergency",
        emergencyContactPhone: "+1-555-9999",
        dateOfBirth: BigInt(Date.now()) * 1_000_000n - 25n * 365n * 24n * 60n * 60n * 1_000_000_000n,
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
      realSignup,
      {
        mainPositionId: 0n,
        secondPositionId: [],
        crewId: [],
        orientationEventId: [],
        startDate: [],
      },
      new TextEncoder().encode("sig"),
    );

    const realOrder = await admin.getUniformOrder({ all: null });
    expect(realOrder.sizeUnknown.some((r) => r.name === "Real Uniform")).toBe(
      false,
    );

    // Seed the demo set, then turn demo mode off again.
    await admin.setDemoMode(true, "DEMO");
    await admin.loadDemoData();
    await admin.setDemoMode(false, "");

    // While demo mode is off, the demo records are invisible to the order.
    const offOrder = await admin.getUniformOrder({ all: null });
    expect(offOrder.sizeUnknown.some((r) => r.name.startsWith("Demo"))).toBe(
      false,
    );

    // While demo mode is on, the order carries demo records only.
    await admin.setDemoMode(true, "DEMO");
    const onOrder = await admin.getUniformOrder({ all: null });
    expect(onOrder.rows.length).toBeGreaterThan(0);
    expect(onOrder.sizeUnknown.some((r) => r.name === "Real Uniform")).toBe(
      false,
    );
    await admin.setDemoMode(false, "");
  });
});
