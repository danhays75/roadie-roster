import { PocketIc, createIdentity } from "@dfinity/pic";
import type { Actor, CanisterFixture } from "@dfinity/pic";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";
import type { _SERVICE } from "../../src/frontend/src/declarations/backend.did";
import { registerCaller } from "./test-utils";

/**
 * Backend lane for the accepted shift-board partition and validation change,
 * exercised against the real compiled canister:
 *   - a demo board and a real board for the same event and shift are stored and
 *     read independently (the demo:/real: key partition),
 *   - saveShiftBoard rejects an unknown roadie, an archived roadie, a roadie
 *     from the other partition, and a trainer without an allowed role,
 *   - autoFillShiftBoard spreads candidates round-robin across groups with open
 *     capacity instead of filling one group first.
 * The frontend suite only mocks the actor, so this is the only place the real
 * rejection and distribution are exercised.
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

describe("backend shift-board partition and validation", () => {
  let pic: PocketIc | undefined;
  let canisterId: CanisterFixture<_SERVICE>["canisterId"];
  let admin: Actor<_SERVICE>;
  let trainer: Actor<_SERVICE>;
  let leadership: Actor<_SERVICE>;

  const adminIdentity = createIdentity("board-partition-admin-seed");
  const trainerIdentity = createIdentity("board-partition-trainer-seed");
  const leadershipIdentity = createIdentity("board-partition-leadership-seed");

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

    // A Leadership caller holds a real grant but is not a trainer-capable role.
    // A plain actor (no _initialize_access_control) keeps the platform owner
    // state untouched; the caller still registers through the public API.
    leadership = pic.createActor<_SERVICE>(idlFactory, canisterId);
    leadership.setIdentity(leadershipIdentity);
    await leadership.requestAccess();
    await admin.approveUser({
      principal: leadershipIdentity.getPrincipal(),
      role: { leadership: null },
      trainerPositionIds: [],
      accessEndsAt: [],
      linkedRoadieId: [],
      staffProfile: [],
    });
  });

  afterAll(async () => {
    await pic?.tearDown();
  });

  // Each test starts from a known partition: demo mode off. A failure in one
  // test must not leave demo mode on and change the next test's trainer rules.
  beforeEach(async () => {
    await admin.setDemoMode(false, "");
  });

  /** Approve a sign-up into position 0 and return the created roadie id. */
  async function approveRoadie(
    name: string,
    phone: string,
    email: string,
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
        mainPositionId: 0n,
        secondPositionId: [],
        crewId: [],
        orientationEventId: [],
        startDate: [],
      },
      sig("sig"),
    );
  }

  /** A board for event 1, AM shift, with the given groups and Off list. */
  function board(
    groups: Array<{
      trainerPrincipal: ReturnType<typeof trainerIdentity.getPrincipal>;
      capacity: bigint;
      roadieIds: bigint[];
    }>,
    offRoadieIds: bigint[],
    isDemo = false,
  ) {
    return {
      eventId: 1n,
      shift: { am: null } as const,
      groups,
      offRoadieIds,
      isDemo,
      editedAt: 0n,
    };
  }

  it("stores a demo board and a real board for the same event and shift independently", async () => {
    const realRoadie = await approveRoadie(
      "Partition Real",
      "+1-555-0800",
      "partition-real@example.com",
    );
    const trainerPrincipal = trainerIdentity.getPrincipal();

    // A real board for event 1, AM.
    await admin.saveShiftBoard(
      board(
        [{ trainerPrincipal, capacity: 4n, roadieIds: [realRoadie] }],
        [],
        false,
      ),
    );

    // Turn demo mode on and seed the demo set, then save a demo board for the
    // same event and shift with a different roadie. In demo mode a group's
    // trainer must be a seeded demo leader, so pick one from the demo leaders.
    await admin.setDemoMode(true, "DEMO");
    await admin.loadDemoData();
    const demoLeaders = await admin.listLeaders();
    const demoLeader = demoLeaders.find((l) => "trainer" in l.role);
    expect(demoLeader).toBeDefined();
    const demoRoadies = await admin.listRoadies();
    const demoRoadie = demoRoadies.find(
      (r) => r.isDemo && r.status !== "archived",
    );
    expect(demoRoadie).toBeDefined();

    await admin.saveShiftBoard(
      board(
        [
          {
            trainerPrincipal: demoLeader!.principal,
            capacity: 4n,
            roadieIds: [demoRoadie!.id],
          },
        ],
        [],
        true,
      ),
    );

    // While demo mode is on, the read returns the demo board only.
    const demoView = await admin.getShiftBoard(1n, { am: null });
    expect(demoView).toHaveLength(1);
    expect(demoView[0].isDemo).toBe(true);
    expect(demoView[0].groups[0].roadies.map((r) => r.roadieId)).toEqual([
      demoRoadie!.id,
    ]);

    // Turn demo mode off: the real board is intact and the demo board invisible.
    await admin.setDemoMode(false, "");
    const realView = await admin.getShiftBoard(1n, { am: null });
    expect(realView).toHaveLength(1);
    expect(realView[0].isDemo).toBe(false);
    expect(realView[0].groups[0].roadies.map((r) => r.roadieId)).toEqual([
      realRoadie,
    ]);
  });

  it("rejects a board naming an unknown roadie", async () => {
    const trainerPrincipal = trainerIdentity.getPrincipal();
    await expect(
      admin.saveShiftBoard(
        board([{ trainerPrincipal, capacity: 4n, roadieIds: [999_999n] }], []),
      ),
    ).rejects.toThrow(/Roadie not found on this board/);
  });

  it("rejects a board naming an archived roadie", async () => {
    const roadieId = await approveRoadie(
      "Archived Board Roadie",
      "+1-555-0801",
      "archived-board@example.com",
    );
    await admin.archiveRoadie(roadieId, { other: "test archive" });
    const trainerPrincipal = trainerIdentity.getPrincipal();

    await expect(
      admin.saveShiftBoard(
        board([{ trainerPrincipal, capacity: 4n, roadieIds: [roadieId] }], []),
      ),
    ).rejects.toThrow(/Roadie is archived/);
  });

  it("rejects a board naming a roadie from the other partition", async () => {
    // A real roadie exists while demo mode is off.
    const realRoadie = await approveRoadie(
      "Wrong Partition Roadie",
      "+1-555-0802",
      "wrong-partition@example.com",
    );

    // While demo mode is on, a board may not name the real roadie. The group's
    // trainer must be a seeded demo leader so the roadie check is the one that
    // rejects the board.
    await admin.setDemoMode(true, "DEMO");
    await admin.loadDemoData();
    const demoLeader = (await admin.listLeaders()).find(
      (l) => "trainer" in l.role,
    );
    expect(demoLeader).toBeDefined();
    await expect(
      admin.saveShiftBoard(
        board(
          [
            {
              trainerPrincipal: demoLeader!.principal,
              capacity: 4n,
              roadieIds: [realRoadie],
            },
          ],
          [],
          true,
        ),
      ),
    ).rejects.toThrow(/Roadie belongs to the other partition/);
    await admin.setDemoMode(false, "");
  });

  it("rejects a board whose trainer holds no trainer-capable role", async () => {
    const roadieId = await approveRoadie(
      "Trainer Role Roadie",
      "+1-555-0803",
      "trainer-role@example.com",
    );
    const leadershipPrincipal = leadershipIdentity.getPrincipal();

    await expect(
      admin.saveShiftBoard(
        board(
          [{ trainerPrincipal: leadershipPrincipal, capacity: 4n, roadieIds: [roadieId] }],
          [],
        ),
      ),
    ).rejects.toThrow(/Trainer is not eligible to lead a group/);
  });

  it("spreads auto-fill candidates round-robin across groups with open capacity", async () => {
    // Four active roadies in the pool, two groups of capacity 2 each.
    const pool: bigint[] = [];
    for (let i = 0; i < 4; i += 1) {
      const id = await approveRoadie(
        `Round Robin ${i}`,
        `+1-555-081${i}`,
        `round-robin-${i}@example.com`,
      );
      // Auto-fill only draws from active roadies; a fresh sign-up is pending.
      await admin.markPresent(id, 1n, ["test override"]);
      pool.push(id);
    }
    const trainerPrincipal = trainerIdentity.getPrincipal();

    // Two empty groups, each with capacity 2, on a fresh event/shift.
    await admin.saveShiftBoard({
      eventId: 2n,
      shift: { am: null } as const,
      groups: [
        { trainerPrincipal, capacity: 2n, roadieIds: [] },
        { trainerPrincipal, capacity: 2n, roadieIds: [] },
      ],
      offRoadieIds: [],
      isDemo: false,
      editedAt: 0n,
    });

    await admin.autoFillShiftBoard(2n, { am: null });

    const view = await admin.getShiftBoard(2n, { am: null });
    expect(view).toHaveLength(1);
    const groups = view[0].groups;
    expect(groups).toHaveLength(2);
    // Round-robin: each group gets one before either gets a second, so both
    // groups end with exactly two and neither is filled to capacity first.
    expect(groups[0].roadies).toHaveLength(2);
    expect(groups[1].roadies).toHaveLength(2);
    const allIds = groups.flatMap((g) => g.roadies.map((r) => r.roadieId));
    expect(new Set(allIds).size).toBe(4);
  });
});
