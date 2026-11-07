import { PocketIc, createIdentity } from "@dfinity/pic";
import type { Actor, CanisterFixture } from "@dfinity/pic";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";
import type { _SERVICE } from "../../src/frontend/src/declarations/backend.did";
import { registerCaller } from "./test-utils";

/**
 * Backend lane for the accepted demo-seed spread change, run against the real
 * compiled canister. The frontend suite only mocks the actor, so only this lane
 * proves the seed's underlying records:
 *   - every non-archived demo roadie is booked into the demo Orientation event,
 *   - the 38 non-archived roadies are spread across Hired, Paperwork Done,
 *     Oriented and In Training with matching paperwork, attendance, check-in,
 *     roster state and uniform check-offs,
 *   - the two minors are Oriented, the 2 archived roadies stay archived with
 *     reason No-show, and the 3 pending sign-ups, crews and managers are
 *     unchanged.
 */

const PIC_URL = process.env.POCKET_IC_URL ?? "";
const BACKEND_WASM = process.env.BACKEND_WASM ?? "";
const BASELINE_WASM = process.env.BACKEND_WASM_BASELINE;

/** The stage a roadie's derived stage reports, as a plain string. */
function stageName(stage: [] | [{ [key: string]: null }]): string | null {
  if (stage.length === 0) return null;
  return Object.keys(stage[0])[0] ?? null;
}

describe("backend demo seed spread", () => {
  let pic: PocketIc | undefined;
  let canisterId: CanisterFixture<_SERVICE>["canisterId"];
  let admin: Actor<_SERVICE>;

  const adminIdentity = createIdentity("demo-seed-spread-admin");

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

  it("books every non-archived demo roadie into the demo Orientation event", async () => {
    await admin.setDemoMode(true, "DEMO");
    await admin.loadDemoData();

    const schedule = await admin.listSchedule();
    const orientation = schedule.find(
      (event) => event.kind.orientation !== undefined,
    );
    expect(orientation).toBeDefined();

    const roadies = await admin.listRoadies();
    const live = roadies.filter((r) => !("archived" in r.status));
    expect(live).toHaveLength(38);
    for (const roadie of live) {
      expect(roadie.orientationEventId).toEqual([orientation!.id]);
    }

    await admin.setDemoMode(false, "");
  });

  it("spreads the 38 non-archived roadies across the four stages", async () => {
    await admin.setDemoMode(true, "DEMO");
    await admin.loadDemoData();

    const roadies = await admin.listRoadies();
    const live = roadies.filter((r) => !("archived" in r.status));
    expect(live).toHaveLength(38);

    const counts: Record<string, number> = {};
    for (const roadie of live) {
      const name = stageName(roadie.stage);
      expect(name).not.toBeNull();
      counts[name as string] = (counts[name as string] ?? 0) + 1;
    }

    // Every live roadie is in one of the four pre-certification stages, and
    // each stage is populated.
    expect(Object.keys(counts).sort()).toEqual([
      "hired",
      "inTraining",
      "oriented",
      "paperworkDone",
    ]);
    expect(counts.hired).toBeGreaterThan(0);
    expect(counts.paperworkDone).toBeGreaterThan(0);
    expect(counts.oriented).toBeGreaterThan(0);
    expect(counts.inTraining).toBeGreaterThan(0);
    expect(
      counts.hired + counts.paperworkDone + counts.oriented + counts.inTraining,
    ).toBe(38);

    await admin.setDemoMode(false, "");
  });

  it("gives Oriented and In Training roadies active roster state, attendance and uniform check-offs", async () => {
    await admin.setDemoMode(true, "DEMO");
    await admin.loadDemoData();

    const schedule = await admin.listSchedule();
    const orientation = schedule.find(
      (event) => event.kind.orientation !== undefined,
    );
    expect(orientation).toBeDefined();
    const attendance = await admin.listAttendanceForEvent(orientation!.id);

    const roadies = await admin.listRoadies();
    const live = roadies.filter((r) => !("archived" in r.status));

    for (const roadie of live) {
      const name = stageName(roadie.stage);
      const active = name === "oriented" || name === "inTraining";
      // Oriented and In Training roadies are Active; the rest are Pending.
      expect(roadie.rosterState).toEqual(
        active ? { active: null } : { pending: null },
      );

      const checkoff = await admin.getOrientationCheckoff(roadie.id);
      expect(checkoff).toHaveLength(1);
      const stored = checkoff[0]!;

      if (active) {
        // A Present orientation attendance record exists.
        expect(
          attendance.some(
            (record) =>
              record.roadieId === roadie.id &&
              record.state.present !== undefined,
          ),
        ).toBe(true);
        // The uniform was handed out: a name tag checked and shirts/hats
        // counted from the position defaults.
        expect(stored.uniformItems.length).toBeGreaterThan(0);
        expect(stored.shirtsCount).toBeGreaterThan(0n);
        expect(stored.hatsCount).toBeGreaterThan(0n);
      } else {
        // No orientation attendance and no uniform handed out yet.
        expect(
          attendance.some((record) => record.roadieId === roadie.id),
        ).toBe(false);
        expect(stored.uniformItems).toEqual([]);
        expect(stored.shirtsCount).toBe(0n);
        expect(stored.hatsCount).toBe(0n);
      }
    }

    await admin.setDemoMode(false, "");
  });

  it("keeps the two minors Oriented and the two archived roadies archived with reason No-show", async () => {
    await admin.setDemoMode(true, "DEMO");
    await admin.loadDemoData();

    const roadies = await admin.listRoadies();
    const minors = roadies.filter((r) => r.isMinor);
    expect(minors).toHaveLength(2);
    for (const minor of minors) {
      expect(stageName(minor.stage)).toBe("oriented");
    }

    const archived = roadies.filter((r) => "archived" in r.status);
    expect(archived).toHaveLength(2);
    for (const roadie of archived) {
      expect(roadie.archivedReason).toEqual([{ noShow: null }]);
      // An archived roadie has no stage and no orientation booking.
      expect(roadie.stage).toEqual([]);
      expect(roadie.orientationEventId).toEqual([]);
    }

    await admin.setDemoMode(false, "");
  });

  it("leaves the 3 pending sign-ups, 6 crews and 9 managers unchanged", async () => {
    await admin.setDemoMode(true, "DEMO");
    await admin.loadDemoData();

    const signups = await admin.listPendingSignups();
    expect(signups).toHaveLength(3);
    expect(signups.every((s) => s.isDemo)).toBe(true);

    const crews = await admin.listCrews();
    expect(crews).toHaveLength(6);
    expect(crews.every((c) => c.leaderPrincipal.length === 1)).toBe(true);

    const leaders = await admin.listLeaders();
    expect(leaders).toHaveLength(9);
    expect(leaders.filter((l) => "storeManager" in l.role)).toHaveLength(6);

    await admin.setDemoMode(false, "");
  });
});
