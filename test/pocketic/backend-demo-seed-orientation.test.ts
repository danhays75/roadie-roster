import { PocketIc, createIdentity } from "@dfinity/pic";
import type { Actor, CanisterFixture } from "@dfinity/pic";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";
import type { _SERVICE } from "../../src/frontend/src/declarations/backend.did";
import { registerCaller } from "./test-utils";

/**
 * Backend lane for the accepted demo-seed change, run against the real compiled
 * canister. The frontend suite only mocks the actor, so only this lane proves
 * the seed's underlying records:
 *   - every non-archived demo roadie is booked into the demo Orientation event
 *     with rosterState pending,
 *   - no demo roadie has an orientation attendance record, a check-in record, a
 *     shift board assignment or a uniform check-off,
 *   - about 18 roadies are Paperwork Done (every applicable item checked) and
 *     the other 20 are Hired (0-3 items checked), with mixed positions and crews
 *     and the two minors fully done,
 *   - Load demo data resets the caller's pretend date to none, View as to Admin
 *     and clears any demo practice progress.
 */

const PIC_URL = process.env.POCKET_IC_URL ?? "";
const BACKEND_WASM = process.env.BACKEND_WASM ?? "";
const BASELINE_WASM = process.env.BACKEND_WASM_BASELINE;

/** The stage a roadie's derived stage reports, as a plain string. */
function stageName(stage: [] | [{ [key: string]: null }]): string | null {
  if (stage.length === 0) return null;
  return Object.keys(stage[0])[0] ?? null;
}

describe("backend demo seed starts every roadie at Orientation", () => {
  let pic: PocketIc | undefined;
  let canisterId: CanisterFixture<_SERVICE>["canisterId"];
  let admin: Actor<_SERVICE>;

  const adminIdentity = createIdentity("demo-seed-orientation-admin");

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

  it("books every non-archived demo roadie into the demo Orientation event as pending", async () => {
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
      expect(roadie.rosterState).toEqual({ pending: null });
    }

    await admin.setDemoMode(false, "");
  });

  it("seeds no orientation attendance, check-ins, shift boards or uniform check-offs", async () => {
    await admin.setDemoMode(true, "DEMO");
    await admin.loadDemoData();

    const schedule = await admin.listSchedule();
    const orientation = schedule.find(
      (event) => event.kind.orientation !== undefined,
    );
    expect(orientation).toBeDefined();

    // No orientation attendance record for the demo Orientation event.
    const attendance = await admin.listAttendanceForEvent(orientation!.id);
    expect(attendance).toEqual([]);

    // No shift board exists at all, so no roadie is assigned to one.
    const boards = await admin.listShiftBoards();
    expect(boards).toEqual([]);

    const roadies = await admin.listRoadies();
    const live = roadies.filter((r) => !("archived" in r.status));
    for (const roadie of live) {
      const checkoff = await admin.getOrientationCheckoff(roadie.id);
      expect(checkoff).toHaveLength(1);
      const stored = checkoff[0]!;
      // No uniform handed out: no items, no shirts, no hats.
      expect(stored.uniformItems).toEqual([]);
      expect(stored.uniformCounts).toEqual([]);
      expect(stored.shirtsCount).toBe(0n);
      expect(stored.hatsCount).toBe(0n);
    }

    await admin.setDemoMode(false, "");
  });

  it("spreads the 38 roadies across Hired and Paperwork Done with mixed positions and crews", async () => {
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

    // Only the two pre-paperwork stages are populated.
    expect(Object.keys(counts).sort()).toEqual(["hired", "paperworkDone"]);
    expect(counts.paperworkDone).toBe(18);
    expect(counts.hired).toBe(20);

    // Positions and crews mix across the two stages rather than clustering.
    const positionIds = new Set(live.map((r) => r.mainPositionId.toString()));
    expect(positionIds.size).toBeGreaterThan(1);
    const crewIds = new Set(
      live.map((r) => (r.crewId.length > 0 ? r.crewId[0]!.toString() : "none")),
    );
    expect(crewIds.size).toBeGreaterThan(1);

    await admin.setDemoMode(false, "");
  });

  it("checks every applicable paperwork item for Paperwork Done roadies and 0-3 for Hired roadies", async () => {
    await admin.setDemoMode(true, "DEMO");
    await admin.loadDemoData();

    const checklists = await admin.getChecklists();
    const positions = await admin.listPositions();
    const positionById = new Map(
      positions.map((p) => [p.id.toString(), p] as const),
    );

    const roadies = await admin.listRoadies();
    const live = roadies.filter((r) => !("archived" in r.status));

    for (const roadie of live) {
      const name = stageName(roadie.stage);
      const checkoff = await admin.getOrientationCheckoff(roadie.id);
      expect(checkoff).toHaveLength(1);
      const checked = checkoff[0]!.paperworkItems;

      const position = positionById.get(roadie.mainPositionId.toString());
      const needsAlcohol = position?.needsAlcoholCert ?? false;
      const applicable = checklists.paperwork.filter(
        (item) =>
          (!item.requiresAlcoholCert || needsAlcohol) &&
          (!item.minorOnly || roadie.isMinor),
      );
      const applicableIds = applicable.map((item) => item.id.toString());

      if (name === "paperworkDone") {
        // Every applicable item is checked.
        for (const id of applicableIds) {
          expect(checked).toContain(id);
        }
      } else {
        // A Hired roadie has 0-3 items checked and never all of them.
        expect(checked.length).toBeLessThanOrEqual(3);
        if (applicableIds.length > 0) {
          expect(checked.length).toBeLessThan(applicableIds.length);
        }
      }
    }

    await admin.setDemoMode(false, "");
  });

  it("keeps the two minors fully done and the two archived roadies archived", async () => {
    await admin.setDemoMode(true, "DEMO");
    await admin.loadDemoData();

    const roadies = await admin.listRoadies();
    const minors = roadies.filter((r) => r.isMinor);
    expect(minors).toHaveLength(2);
    for (const minor of minors) {
      expect(stageName(minor.stage)).toBe("paperworkDone");
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

  it("resets the pretend date, View as and demo practice progress on load", async () => {
    await admin.setDemoMode(true, "DEMO");

    // Set a pretend date and a non-default demo role before loading.
    const set = await admin.setPretendDate([{ day: 20_000n, shift: { pm: null } }]);
    expect("ok" in set).toBe(true);
    const role = await admin.setDemoRole({ storeManager: null }, []);
    expect("ok" in role).toBe(true);

    const before = await admin.getDemoState();
    expect(before.pretendDate).toHaveLength(1);
    expect(before.demoRole).toEqual([{ storeManager: null }]);

    await admin.loadDemoData();

    const after = await admin.getDemoState();
    // The pretend date is cleared and the caller's View as is back to Admin.
    expect(after.pretendDate).toEqual([]);
    expect(after.demoRole).toEqual([{ admin: null }]);

    await admin.setDemoMode(false, "");
  });
});
