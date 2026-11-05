import { PocketIc, createIdentity } from "@dfinity/pic";
import type { Actor, CanisterFixture } from "@dfinity/pic";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";
import type { _SERVICE } from "../../src/frontend/src/declarations/backend.did";
import { registerCaller } from "./test-utils";

/**
 * Backend lane for the accepted "start a brand-new shift board" change. It runs
 * the real compiled canister and exercises the parts of the contract the change
 * intentionally alters:
 *   - getShiftBoard returns an unsaved empty view (no groups, every active
 *     roadie in Unassigned, Off empty, editedAt 0) when no board is stored but
 *     the event exists, and null only when the event does not exist,
 *   - autoFillShiftBoard starts a board whose trainer columns are every
 *     trainer-eligible leader and then fills roadies round-robin,
 *   - copyShiftBoard is unchanged.
 * The frontend suite only mocks the actor, so this is the only place the real
 * canister behavior is exercised.
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

function contactSet(phone: string, email: string) {
  return {
    phone,
    email,
    emergencyContactName: "Emergency",
    emergencyContactPhone: "+1-555-9999",
    dateOfBirth: ADULT_DOB,
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

describe("backend shift-board unsaved view and auto-fill", () => {
  let pic: PocketIc | undefined;
  let canisterId: CanisterFixture<_SERVICE>["canisterId"];
  let admin: Actor<_SERVICE>;
  let trainer: Actor<_SERVICE>;

  const adminIdentity = createIdentity("board-unsaved-admin-seed");
  const trainerIdentity = createIdentity("board-unsaved-trainer-seed");

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
    trainer = await registerCaller(
      pic.createActor<_SERVICE>(idlFactory, canisterId),
      trainerIdentity,
    );
    await trainer.requestAccess();
    await admin.approveUser({
      principal: trainerIdentity.getPrincipal(),
      role: { trainer: null },
      trainerPositionIds: [0n],
      accessEndsAt: [],
      linkedRoadieId: [],
      staffProfile: [],
    });
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

  /** Approve a sign-up into the given position and return the roadie id. */
  async function approveRoadie(
    name: string,
    phone: string,
    email: string,
    mainPositionId = 0n,
  ): Promise<bigint> {
    const signupId = await admin.submitSignup(
      profile(name),
      [],
      [],
      contactSet(phone, email),
    );
    return admin.approveSignup(
      signupId,
      {
        mainPositionId,
        secondPositionId: [],
        crewId: [],
        orientationEventId: [],
        startDate: [],
      },
      sig("sig"),
    );
  }

  it("returns an unsaved empty view when the event exists but no board is stored", async () => {
    const eventId = await addTrainingDay("Unsaved Empty Day", 40);

    const view = await admin.getShiftBoard(eventId, { am: null });
    // The read is a present option, not null.
    expect(view).toHaveLength(1);
    const board = view[0];
    // No trainer columns, Off empty, editedAt 0.
    expect(board.groups).toEqual([]);
    expect(board.offThisShift).toEqual([]);
    expect(board.editedAt).toBe(0n);
    expect(board.eventId).toBe(eventId);
    expect(board.shift).toEqual({ am: null });
  });

  it("returns null when the event does not exist", async () => {
    // Event id 9999 was never created.
    await expect(admin.getShiftBoard(9999n, { am: null })).resolves.toEqual([]);
  });

  it("starts a board from every eligible trainer and fills roadies round-robin", async () => {
    const eventId = await addTrainingDay("Auto-fill Day", 41);
    // A second position that is not the trainer's station (position 0), so the
    // candidates do not match any trainer's station and the any-candidate
    // round-robin pass decides the placement.
    const otherPositionId = await admin.createPosition({
      id: 0n,
      name: "Host",
      code: "HST",
      house: { foh: null } as const,
      openingBuildTo: 0n,
      afterOpeningBuildTo: 0n,
      minimumAge: 16n,
      shirtQty: 0n,
      shirtType: "",
      hatType: "",
      hatQty: 0n,
      needsAlcoholCert: false,
      defaultShirts: 0n,
      defaultHats: 0n,
    });
    // Two active roadies in the pool, both in the non-station position.
    const first = await approveRoadie(
      "Auto First",
      "+1-555-0800",
      "auto-first@example.com",
      otherPositionId,
    );
    const second = await approveRoadie(
      "Auto Second",
      "+1-555-0801",
      "auto-second@example.com",
      otherPositionId,
    );
    await admin.markPresent(first, eventId, ["test override"]);
    await admin.markPresent(second, eventId, ["test override"]);

    // No board stored yet: auto-fill must start one from the eligible trainers.
    await admin.autoFillShiftBoard(eventId, { am: null });

    const view = await admin.getShiftBoard(eventId, { am: null });
    expect(view).toHaveLength(1);
    const board = view[0];
    // The admin and the trainer are both trainer-eligible, so both get a column.
    expect(board.groups.length).toBeGreaterThanOrEqual(2);
    const trainerPrincipals = board.groups.map((g) =>
      g.trainerPrincipal.toText(),
    );
    expect(trainerPrincipals).toContain(adminIdentity.getPrincipal().toText());
    expect(trainerPrincipals).toContain(
      trainerIdentity.getPrincipal().toText(),
    );

    // Round-robin: the two roadies land in different columns, one each.
    const placed = board.groups.flatMap((g) =>
      g.roadies.map((r) => r.roadieId),
    );
    expect(placed).toContain(first);
    expect(placed).toContain(second);
    const columnsWithRoadies = board.groups.filter(
      (g) => g.roadies.length > 0,
    );
    expect(columnsWithRoadies).toHaveLength(2);
  });

  it("copies another shift's groups, capacities and Off onto this shift", async () => {
    const roadieId = await approveRoadie(
      "Copy Unchanged",
      "+1-555-0802",
      "copy-unchanged@example.com",
    );
    const trainerPrincipal = trainerIdentity.getPrincipal();

    // Seed a source board (event 1, PM) with a group.
    await admin.saveShiftBoard({
      eventId: 1n,
      shift: { pm: null } as const,
      groups: [{ trainerPrincipal, capacity: 3n, roadieIds: [roadieId] }],
      offRoadieIds: [],
      isDemo: false,
      editedAt: 0n,
    });

    // Copy it onto event 2, AM.
    await admin.copyShiftBoard(2n, { am: null }, 1n, { pm: null });

    const view = await admin.getShiftBoard(2n, { am: null });
    expect(view).toHaveLength(1);
    expect(view[0].groups).toHaveLength(1);
    expect(view[0].groups[0].capacity).toBe(3n);
    expect(view[0].groups[0].roadies.map((r) => r.roadieId)).toEqual([
      roadieId,
    ]);
  });
});
