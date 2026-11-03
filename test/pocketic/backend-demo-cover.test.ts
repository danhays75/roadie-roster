import { PocketIc, createIdentity } from "@dfinity/pic";
import type { Actor, CanisterFixture } from "@dfinity/pic";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";
import type { _SERVICE } from "../../src/frontend/src/declarations/backend.did";
import { registerCaller } from "./test-utils";

/**
 * Cover for the accepted Demo mode change, run against the real compiled
 * canister. It exercises the per-caller demo role, the anonymous-caller rule,
 * the real-settings write guard, the demo-only access reads, the getMyAccess
 * shape and the real-Admin-only demo controls. The frontend suite mocks the
 * actor, so only this lane proves the backend guard.
 */

const PIC_URL = process.env.POCKET_IC_URL ?? "";
const BACKEND_WASM = process.env.BACKEND_WASM ?? "";
const BASELINE_WASM = process.env.BACKEND_WASM_BASELINE;

const DEMO_GUARD = "Turn off demo mode to change real settings";

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

function scheduleEvent(name: string) {
  return {
    id: 0n,
    kind: { trainingDay: null } as const,
    name,
    start: 1_802_066_400_000_000_000n,
    end: [] as [] | [bigint],
  };
}

function checklists() {
  return {
    orientationUniform: [
      {
        id: 0n,
        text: "Non-slip shoes",
        requiresAlcoholCert: false,
        minorOnly: false,
        itemType: { checkbox: null } as const,
      },
    ],
    paperwork: [
      {
        id: 0n,
        text: "Onboarding",
        requiresAlcoholCert: false,
        minorOnly: false,
        itemType: { checkbox: null } as const,
      },
    ],
  };
}

function retention() {
  return {
    archivedContactSetDays: 90n,
    notesDays: 365n,
    archivedPhotoDays: 365n,
    changeLogDays: 730n,
  };
}

function templateFile() {
  return {
    version: 1n,
    leaderTalkName: "10 Minutes with Dan",
    leaderTalkSize: 10n,
    trainingGroupSize: 5n,
    positions: [
      {
        name: "Servers",
        code: "SRV",
        house: { foh: null } as const,
        openingBuildTo: 5n,
        afterOpeningBuildTo: 5n,
        minimumAge: 18n,
        needsAlcoholCert: false,
        defaultShirts: 3n,
        defaultHats: 2n,
      },
    ],
    schedule: [],
    checklists: { orientationUniform: [], paperwork: [] },
  };
}

describe("backend demo mode: per-caller roles and the real-settings guard", () => {
  let pic: PocketIc | undefined;
  let canisterId: CanisterFixture<_SERVICE>["canisterId"];
  let admin: Actor<_SERVICE>;

  const adminIdentity = createIdentity("demo-cover-admin-seed");
  const aliceIdentity = createIdentity("demo-cover-alice-seed");
  const bobIdentity = createIdentity("demo-cover-bob-seed");

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

  it("gives an anonymous caller no demo role even while demo mode is on", async () => {
    await admin.setDemoMode(true, "DEMO");

    // A freshly created actor calls as the anonymous principal.
    const guest = pic!.createActor<_SERVICE>(idlFactory, canisterId);
    const view = await guest.getMyAccess();
    expect(view.grant).toEqual([]);
    expect(view.demoRole).toEqual([]);

    // An anonymous caller cannot choose a demo role either.
    const chosen = await guest.setDemoRole({ admin: null }, []);
    expect("err" in chosen).toBe(true);

    await admin.setDemoMode(false, "");
  });

  it("stores each caller's demo role separately and defaults an unchosen caller to demo Admin", async () => {
    await admin.setDemoMode(true, "DEMO");

    const alice = pic!.createActor<_SERVICE>(idlFactory, canisterId);
    alice.setIdentity(aliceIdentity);
    const bob = pic!.createActor<_SERVICE>(idlFactory, canisterId);
    bob.setIdentity(bobIdentity);

    // Alice chooses Store Manager; Bob has not chosen, so he defaults to Admin.
    const aliceSet = await alice.setDemoRole({ storeManager: null }, []);
    expect("ok" in aliceSet).toBe(true);

    const aliceView = await alice.getMyAccess();
    const bobView = await bob.getMyAccess();
    expect(aliceView.demoRole).toEqual([{ storeManager: null }]);
    expect(bobView.demoRole).toEqual([{ admin: null }]);

    // Bob's choice does not change Alice's view.
    await bob.setDemoRole({ kiosk: null }, []);
    expect((await alice.getMyAccess()).demoRole).toEqual([
      { storeManager: null },
    ]);
    expect((await bob.getMyAccess()).demoRole).toEqual([{ kiosk: null }]);

    await admin.setDemoMode(false, "");
  });

  it("clears every caller's stored demo role when demo mode turns off", async () => {
    await admin.setDemoMode(true, "DEMO");
    const alice = pic!.createActor<_SERVICE>(idlFactory, canisterId);
    alice.setIdentity(aliceIdentity);
    await alice.setDemoRole({ storeManager: null }, []);
    expect((await alice.getMyAccess()).demoRole).toEqual([
      { storeManager: null },
    ]);

    await admin.setDemoMode(false, "");

    // Demo mode is off, so no caller carries a demo role.
    expect((await alice.getMyAccess()).demoRole).toEqual([]);
  });

  it("returns the caller's real grant plus a separate demoRole, and never reports a grantless caller as approved", async () => {
    await admin.setDemoMode(true, "DEMO");

    // The real Admin keeps their real grant while demo mode is on.
    const adminView = await admin.getMyAccess();
    expect(adminView.grant).toHaveLength(1);
    expect(adminView.grant[0]?.role).toEqual({ admin: null });
    expect(adminView.demoRole).toEqual([{ admin: null }]);

    // A signed-in caller with no real grant is not reported as approved.
    const alice = pic!.createActor<_SERVICE>(idlFactory, canisterId);
    alice.setIdentity(aliceIdentity);
    const aliceView = await alice.getMyAccess();
    expect(aliceView.grant).toEqual([]);
    expect(aliceView.demoRole).toEqual([{ admin: null }]);

    await admin.setDemoMode(false, "");
  });

  it("refuses every real-settings write with the demo guard while demo mode is on", async () => {
    // Seed a real position and schedule event while demo mode is off, so the
    // update/delete calls have real ids to target.
    const created = await admin.createPosition(position("Real Position"));
    const eventId = await admin.createScheduleEvent(scheduleEvent("Real Event"));

    await admin.setDemoMode(true, "DEMO");

    const writes: Array<[string, () => Promise<unknown>]> = [
      ["updateStoreInfo", () => admin.updateStoreInfo(storeInfo())],
      ["createPosition", () => admin.createPosition(position("Another"))],
      ["updatePosition", () => admin.updatePosition(position("Updated"))],
      ["deletePosition", () => admin.deletePosition(created)],
      ["adjustBuildTo", () => admin.adjustBuildTo(created, 1n, 0n)],
      ["createScheduleEvent", () => admin.createScheduleEvent(scheduleEvent("E"))],
      ["updateScheduleEvent", () => admin.updateScheduleEvent(scheduleEvent("E"))],
      ["deleteScheduleEvent", () => admin.deleteScheduleEvent(eventId)],
      ["updateChecklists", () => admin.updateChecklists(checklists())],
      ["updateRetentionSettings", () => admin.updateRetentionSettings(retention())],
      ["setKioskPin", () => admin.setKioskPin("1234")],
      ["saveStoreTemplate", () => admin.saveStoreTemplate("tpl")],
      ["downloadStoreTemplate", () => admin.downloadStoreTemplate()],
      ["loadStoreTemplate", () => admin.loadStoreTemplate(templateFile())],
    ];

    for (const [name, call] of writes) {
      await expect(call(), name).rejects.toThrow(DEMO_GUARD);
    }

    await admin.setDemoMode(false, "");
  });

  it("refuses the access-grant writes with the demo guard while demo mode is on", async () => {
    await admin.setDemoMode(true, "DEMO");

    const alice = pic!.createActor<_SERVICE>(idlFactory, canisterId);
    alice.setIdentity(aliceIdentity);
    await alice.requestAccess();

    const writes: Array<[string, () => Promise<unknown>]> = [
      [
        "approveUser",
        () =>
          admin.approveUser({
            principal: aliceIdentity.getPrincipal(),
            role: { storeManager: null },
            trainerPositionIds: [],
            accessEndsAt: [],
            linkedRoadieId: [],
            staffProfile: [],
          }),
      ],
      [
        "updateUserRole",
        () => admin.updateUserRole(adminIdentity.getPrincipal(), { admin: null }),
      ],
      [
        "updateTrainerStations",
        () => admin.updateTrainerStations(adminIdentity.getPrincipal(), []),
      ],
      [
        "updateAccessEnd",
        () => admin.updateAccessEnd(adminIdentity.getPrincipal(), []),
      ],
      ["removeUser", () => admin.removeUser(adminIdentity.getPrincipal())],
    ];

    for (const [name, call] of writes) {
      await expect(call(), name).rejects.toThrow(DEMO_GUARD);
    }

    await admin.setDemoMode(false, "");
  });

  it("still allows reading positions, schedule and store info while demo mode is on", async () => {
    await admin.setDemoMode(true, "DEMO");

    await expect(admin.listPositions()).resolves.toBeInstanceOf(Array);
    await expect(admin.listSchedule()).resolves.toBeInstanceOf(Array);
    await expect(admin.getChecklists()).resolves.toBeDefined();
    await expect(admin.getRetentionSettings()).resolves.toBeDefined();
    const store = await admin.getStoreInfo();
    expect(typeof store.storeNumber).toBe("string");

    await admin.setDemoMode(false, "");
  });

  it("returns only demo records from listAccessGrants and listPendingUsers while demo mode is on", async () => {
    // Seed a real pending request and a real grant before demo mode is on.
    const alice = pic!.createActor<_SERVICE>(idlFactory, canisterId);
    alice.setIdentity(aliceIdentity);
    await alice.requestAccess();
    const realPending = await admin.listPendingUsers();
    expect(realPending.some((p) => p.principal.toText() === aliceIdentity.getPrincipal().toText())).toBe(true);

    await admin.setDemoMode(true, "DEMO");
    await admin.loadDemoData();

    // Real pending requests are never exposed while demo is on.
    const demoPending = await admin.listPendingUsers();
    expect(
      demoPending.some(
        (p) => p.principal.toText() === aliceIdentity.getPrincipal().toText(),
      ),
    ).toBe(false);

    // Real grants are never exposed while demo is on; only demo leaders are.
    const demoGrants = await admin.listAccessGrants();
    expect(
      demoGrants.some(
        (g) => g.principal.toText() === adminIdentity.getPrincipal().toText(),
      ),
    ).toBe(false);
    expect(demoGrants.length).toBeGreaterThan(0);

    await admin.clearDemoData();
    await admin.setDemoMode(false, "");

    // With demo off, the real pending request is visible again.
    const realAgain = await admin.listPendingUsers();
    expect(
      realAgain.some(
        (p) => p.principal.toText() === aliceIdentity.getPrincipal().toText(),
      ),
    ).toBe(true);
  });

  it("requires a real Admin to turn demo mode on or off and refuses extending while it is on", async () => {
    // A non-admin caller cannot turn demo mode on.
    const alice = pic!.createActor<_SERVICE>(idlFactory, canisterId);
    alice.setIdentity(aliceIdentity);
    await expect(alice.setDemoMode(true, "DEMO")).rejects.toThrow();

    // The real Admin can turn it on.
    const on = await admin.setDemoMode(true, "DEMO");
    expect("ok" in on).toBe(true);

    // Turning it on again is refused, so the 8-hour window cannot be extended.
    const again = await admin.setDemoMode(true, "DEMO");
    expect("err" in again).toBe(true);

    // A non-admin caller cannot turn it off.
    await expect(alice.setDemoMode(false, "")).rejects.toThrow();

    // The real Admin can turn it off.
    const off = await admin.setDemoMode(false, "");
    expect("ok" in off).toBe(true);
  });
});

/** A minimal valid store info payload for the updateStoreInfo guard test. */
function storeInfo() {
  return {
    storeNumber: "975",
    appName: "Roadie Roster",
    locationName: "Lake Charles",
    address: "1400 W Prien Lake Rd",
    storePhone: "",
    timeZone: "America/Chicago",
    openingDate: 1_802_066_400_000_000_000n,
    amShiftStart: 600n,
    amShiftEnd: 900n,
    pmShiftStart: 960n,
    pmShiftEnd: 1320n,
    trainingGroupSize: 5n,
    leaderTalkName: "10 Minutes with Dan",
    leaderTalkSize: 10n,
    logo: [] as [] | [Uint8Array],
    secondaryLogo: [] as [] | [Uint8Array],
    paperworkDueDate: 1_800_000_000_000_000_000n,
  };
}
