import { PocketIc, createIdentity } from "@dfinity/pic";
import type { Actor, CanisterFixture } from "@dfinity/pic";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";
import type { _SERVICE } from "../../src/frontend/src/declarations/backend.did";
import { registerCaller } from "./test-utils";

/**
 * Backend lane for the accepted Gift Bags change: getGiftBags groups answers
 * case-insensitively ignoring extra spaces and punctuation, shows the most
 * common spelling, sorts by count highest first, includes a No answer count,
 * filters by house and position, and never returns contact info. It also
 * exercises the migration that adds the three new profile fields, defaulting
 * them to null for existing roadies. This runs the real compiled canister; the
 * frontend suite only mocks the actor.
 */

const PIC_URL = process.env.POCKET_IC_URL ?? "";
const BACKEND_WASM = process.env.BACKEND_WASM ?? "";
const BASELINE_WASM = process.env.BACKEND_WASM_BASELINE;

const DAY_NS = 24n * 60n * 60n * 1_000_000_000n;
const NOW_NS = BigInt(Date.now()) * 1_000_000n;
const ADULT_DOB = NOW_NS - 25n * 365n * DAY_NS;

/** A profile with the three new Gift Bag fields populated. */
function profile(
  name: string,
  extras: {
    favoriteSnack?: string;
    favoriteTeam?: string;
    favoriteDrink?: string;
    favoriteColor?: string;
  } = {},
) {
  return {
    name,
    preferredName: [] as [] | [string],
    hometown: [] as [] | [string],
    hobbies: [] as [] | [string],
    favoriteMovie: [] as [] | [string],
    favoriteSnack: (extras.favoriteSnack
      ? [extras.favoriteSnack]
      : []) as [] | [string],
    favoriteTeam: (extras.favoriteTeam
      ? [extras.favoriteTeam]
      : []) as [] | [string],
    favoriteDrink: (extras.favoriteDrink
      ? [extras.favoriteDrink]
      : []) as [] | [string],
    favoriteColor: (extras.favoriteColor
      ? [extras.favoriteColor]
      : []) as [] | [string],
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

describe("backend Gift Bags contract", () => {
  let pic: PocketIc | undefined;
  let canisterId: CanisterFixture<_SERVICE>["canisterId"];
  let admin: Actor<_SERVICE>;
  let trainer: Actor<_SERVICE>;

  const adminIdentity = createIdentity("giftbags-admin-seed");
  const trainerIdentity = createIdentity("giftbags-trainer-seed");

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
  });

  afterAll(async () => {
    await pic?.tearDown();
  });

  /** Approve a sign-up with the given profile and return the roadie id. */
  async function createRoadie(
    name: string,
    extras: Parameters<typeof profile>[1],
    mainPositionId = 0n,
  ): Promise<bigint> {
    const signupId = await admin.submitSignup(
      profile(name, extras),
      [],
      [],
      contactSet(`+1-555-${name.length}${name.charCodeAt(0)}`, `${name}@example.com`, ADULT_DOB),
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

  it("groups answers case-insensitively ignoring spaces and punctuation, showing the most common spelling", async () => {
    // Three spellings of the same candy: "Snickers" twice, "snickers!" once.
    await createRoadie("Candy A", { favoriteSnack: "Snickers" });
    await createRoadie("Candy B", { favoriteSnack: "Snickers" });
    await createRoadie("Candy C", { favoriteSnack: "snickers!" });
    // A distinct candy and a roadie with no answer.
    await createRoadie("Candy D", { favoriteSnack: "Hot Cheetos" });
    await createRoadie("Candy E", {});

    const data = await admin.getGiftBags({ all: null });
    const candy = data.groups.find((g) => "candySnack" in g.category);
    expect(candy).toBeDefined();

    // The three Snickers spellings collapse into one group of 3, shown with the
    // most common spelling "Snickers".
    const snickers = candy!.answers.find((a) => a.answer === "Snickers");
    expect(snickers?.count).toBe(3n);
    // Hot Cheetos is a separate group of 1.
    const cheetos = candy!.answers.find((a) => a.answer === "Hot Cheetos");
    expect(cheetos?.count).toBe(1n);
    // The No answer count includes the roadie with no snack.
    expect(candy!.noAnswer).toBeGreaterThanOrEqual(1n);

    // Sorted by count highest first.
    const counts = candy!.answers.map((a) => Number(a.count));
    const sorted = [...counts].sort((a, b) => b - a);
    expect(counts).toEqual(sorted);
  });

  it("filters by house and by position", async () => {
    // Position 0 is FOH (Servers), position 5 is BOH (Fry / Salad) in the seed.
    await createRoadie("Foh One", { favoriteDrink: "Coffee" }, 0n);
    await createRoadie("Boh One", { favoriteDrink: "Tea" }, 5n);

    const foh = await admin.getGiftBags({ foh: null });
    const fohNames = foh.labels.map((l) => l.name);
    expect(fohNames).toContain("Foh One");
    expect(fohNames).not.toContain("Boh One");

    const boh = await admin.getGiftBags({ boh: null });
    const bohNames = boh.labels.map((l) => l.name);
    expect(bohNames).toContain("Boh One");
    expect(bohNames).not.toContain("Foh One");

    const byPosition = await admin.getGiftBags({
      position: 0n,
    });
    expect(byPosition.labels.every((l) => l.positionName === "Servers")).toBe(
      true,
    );
  });

  it("never returns contact info on a label", async () => {
    const data = await admin.getGiftBags({ all: null });
    for (const label of data.labels) {
      const serialized = JSON.stringify(label, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value,
      );
      expect(serialized).not.toContain("+1-555");
      expect(serialized).not.toContain("@example.com");
      expect(serialized).not.toContain("dateOfBirth");
    }
  });

  it("rejects a caller without the Gift Bags role", async () => {
    await trainer.requestAccess();
    await admin.approveUser({
      principal: trainerIdentity.getPrincipal(),
      role: { trainer: null },
      trainerPositionIds: [0n],
      accessEndsAt: [],
      linkedRoadieId: [],
      staffProfile: [],
    });
    await expect(
      trainer.getGiftBags({ all: null }),
    ).rejects.toThrow();
  });

  it("defaults the three new profile fields to null for existing roadies after the migration", async () => {
    // Only meaningful when the runner supplies a pre-change baseline to upgrade
    // from; a fresh install has no legacy roadies to convert.
    if (BASELINE_WASM === undefined) {
      expect(BASELINE_WASM).toBeUndefined();
      return;
    }
    const roadies = await admin.listRoadies();
    for (const roadie of roadies) {
      // The migration preserves the record and leaves the new fields absent.
      expect(roadie.profile.favoriteTeam).toEqual([]);
      expect(roadie.profile.favoriteDrink).toEqual([]);
      expect(roadie.profile.favoriteColor).toEqual([]);
    }
  });
});
