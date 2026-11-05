import { PocketIc, createIdentity } from "@dfinity/pic";
import type { Actor, CanisterFixture } from "@dfinity/pic";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";
import type {
  _SERVICE,
  Principal,
  StaffProfile,
} from "../../src/frontend/src/declarations/backend.did";
import { registerCaller } from "./test-utils";

/**
 * Cover lane for the accepted real-mode trainer-eligibility change:
 *   - real-mode `eligibleTrainers` (used by `autoFillShiftBoard` on a new board)
 *     returns only grants whose role is `#trainer` and who are not demo leaders,
 *     so an admin no longer gets an auto-fill column;
 *   - real-mode `trainerAllowed` rejects a demo leader, so a demo leader can
 *     never be saved onto a real board, while a manager may still be added
 *     manually as a trainer.
 * It runs the real compiled canister; the frontend suite only mocks the actor.
 */

const PIC_URL = process.env.POCKET_IC_URL ?? "";
const BACKEND_WASM = process.env.BACKEND_WASM ?? "";
const BASELINE_WASM = process.env.BACKEND_WASM_BASELINE;

const DAY_NS = 24n * 60n * 60n * 1_000_000_000n;
const NOW_NS = BigInt(Date.now()) * 1_000_000n;

function staffProfile(
  fullName: string,
  requestedRole: StaffProfile["requestedRole"],
  workEmail: [] | [string],
): StaffProfile {
  return {
    fullName,
    requestedRole,
    title: "NSO Trainer",
    homeStoreNumber: "Store 512",
    homeStoreCity: "Lake Charles",
    preferredName: [],
    workPhone: [],
    workEmail,
    photo: [],
    demoPhotoUrl: [],
    trainerPositionIds: [],
    arrivalDate: [],
    departureDate: [],
    hometown: [],
    hobbies: [],
    favoriteTeam: [],
    favoriteSnack: [],
    favoriteDrink: [],
    favoriteColor: [],
    funFact: [],
    goalHere: [],
    shirtSize: [],
    hatSize: [],
  };
}

describe("backend real-mode shift-board trainer eligibility", () => {
  let pic: PocketIc | undefined;
  let canisterId: CanisterFixture<_SERVICE>["canisterId"];
  let admin: Actor<_SERVICE>;
  /** Demo-leader principals captured while demo mode is on, before it is off. */
  let demoLeaderPrincipals: Principal[] = [];

  const adminIdentity = createIdentity("real-trainer-eligibility-admin-seed");
  const trainerIdentity = createIdentity("real-trainer-eligibility-trainer-seed");
  const managerIdentity = createIdentity("real-trainer-eligibility-manager-seed");

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

    // A real NSO Trainer: role #trainer, no demo-leader sentinel email.
    const trainerActor = pic.createActor<_SERVICE>(idlFactory, canisterId);
    trainerActor.setIdentity(trainerIdentity);
    await trainerActor.requestAccess();
    await trainerActor.submitStaffProfile(
      staffProfile("Real Trainer", { trainer: null }, []),
    );
    await admin.approveUser({
      principal: trainerIdentity.getPrincipal(),
      role: { trainer: null },
      trainerPositionIds: [],
      accessEndsAt: [],
      linkedRoadieId: [],
      staffProfile: [staffProfile("Real Trainer", { trainer: null }, [])],
    });

    // A real Store Manager, to prove a manager can still be added as a trainer.
    const managerActor = pic.createActor<_SERVICE>(idlFactory, canisterId);
    managerActor.setIdentity(managerIdentity);
    await managerActor.requestAccess();
    await managerActor.submitStaffProfile(
      staffProfile("Real Manager", { storeManager: null }, []),
    );
    await admin.approveUser({
      principal: managerIdentity.getPrincipal(),
      role: { storeManager: null },
      trainerPositionIds: [],
      accessEndsAt: [],
      linkedRoadieId: [],
      staffProfile: [staffProfile("Real Manager", { storeManager: null }, [])],
    });

    // Seed demo leaders (role #trainer, workEmail "DEMO"). Capture their
    // principals while demo mode is on (listLeaders hides them once it is off),
    // then turn demo mode off. The demo grants persist in the access map, so
    // real-mode eligibility must exclude them.
    await admin.setDemoMode(true, "DEMO");
    await admin.loadDemoData();
    const demoLeaders = await admin.listLeaders();
    demoLeaderPrincipals = demoLeaders
      .filter((l) => "trainer" in l.role && l.trainerPositionIds.length > 0)
      .map((l) => l.principal);
    await admin.setDemoMode(false, "");
  });

  afterAll(async () => {
    await pic?.tearDown();
  });

  /** Create a training-day event `daysAhead` from now and return its id. */
  async function addTrainingDay(name: string, daysAhead: number) {
    return admin.createScheduleEvent({
      id: 0n,
      kind: { trainingDay: null },
      name,
      start: NOW_NS + BigInt(daysAhead) * DAY_NS,
      end: [],
    });
  }

  it("auto-fills a new real board with only the real trainer, not the admin or demo leaders", async () => {
    const eventId = await addTrainingDay("Real Eligibility Day", 60);

    // No board stored yet: auto-fill must start one from real-mode eligible
    // trainers only.
    await admin.autoFillShiftBoard(eventId, { am: null });

    const view = await admin.getShiftBoard(eventId, { am: null });
    expect(view).toHaveLength(1);
    const board = view[0];
    expect(board.isDemo).toBe(false);

    const trainerPrincipals = board.groups.map((g) =>
      g.trainerPrincipal.toText(),
    );
    // The real NSO Trainer gets a column.
    expect(trainerPrincipals).toContain(trainerIdentity.getPrincipal().toText());
    // The admin does not, even though #admin is trainer-capable.
    expect(trainerPrincipals).not.toContain(adminIdentity.getPrincipal().toText());
    // No demo leader gets a column in real mode.
    expect(demoLeaderPrincipals.length).toBeGreaterThan(0);
    for (const principal of demoLeaderPrincipals) {
      expect(trainerPrincipals).not.toContain(principal.toText());
    }
  });

  it("rejects a demo leader as a trainer on a real board", async () => {
    const eventId = await addTrainingDay("Real Reject Demo Leader Day", 61);

    // A seeded demo leader: role #trainer with the DEMO sentinel email.
    expect(demoLeaderPrincipals.length).toBeGreaterThan(0);
    const demoLeaderPrincipal = demoLeaderPrincipals[0];

    await expect(
      admin.saveShiftBoard({
        eventId,
        shift: { am: null },
        groups: [
          {
            trainerPrincipal: demoLeaderPrincipal,
            capacity: 4n,
            roadieIds: [],
          },
        ],
        offRoadieIds: [],
        isDemo: false,
        editedAt: 0n,
      }),
    ).rejects.toThrow(/Trainer is not eligible to lead a group/);
  });

  it("still allows a manager to be added manually as a trainer on a real board", async () => {
    const eventId = await addTrainingDay("Real Manager As Trainer Day", 62);

    await admin.saveShiftBoard({
      eventId,
      shift: { am: null },
      groups: [
        {
          trainerPrincipal: managerIdentity.getPrincipal(),
          capacity: 4n,
          roadieIds: [],
        },
      ],
      offRoadieIds: [],
      isDemo: false,
      editedAt: 0n,
    });

    const view = await admin.getShiftBoard(eventId, { am: null });
    expect(view).toHaveLength(1);
    const trainerPrincipals = view[0].groups.map((g) =>
      g.trainerPrincipal.toText(),
    );
    expect(trainerPrincipals).toContain(managerIdentity.getPrincipal().toText());
  });
});
