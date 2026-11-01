import { PocketIc, createIdentity } from "@dfinity/pic";
import type { Actor, CanisterFixture } from "@dfinity/pic";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";
import type { _SERVICE } from "../../src/frontend/src/declarations/backend.did";
import { registerCaller } from "./test-utils";

const PIC_URL = process.env.POCKET_IC_URL ?? "";
const BACKEND_WASM = process.env.BACKEND_WASM ?? "";
const BASELINE_WASM = process.env.BACKEND_WASM_BASELINE;

const DAY_NS = 24n * 60n * 60n * 1_000_000_000n;
const NOW_NS = BigInt(Date.now()) * 1_000_000n;

/**
 * A date of birth that makes the roadie a clear adult today. The age gate
 * compares real calendar age in store time, so this is well past 21 to clear
 * every seeded position's minimum age (the highest is 21 for Bartenders).
 */
const ADULT_DOB = NOW_NS - 25n * 365n * DAY_NS;
/**
 * A date of birth that makes the roadie a minor today but old enough for the
 * 16+ positions (Hosts), so a move into a 21+ position is the only block.
 */
const MINOR_DOB = NOW_NS - 16n * 365n * DAY_NS - 180n * DAY_NS;

function profile(name: string) {
  return {
    name,
    preferredName: [] as [] | [string],
    hometown: [] as [] | [string],
    hobbies: [] as [] | [string],
    favoriteMovie: [] as [] | [string],
    favoriteSnack: [] as [] | [string],
    funFact: [] as [] | [string],
    goalHere: [] as [] | [string],
    positionAppliedFor: [] as [] | [string],
    shirtSize: [] as [] | [string],
    hatSize: [] as [] | [string],
    shiftsWantedPerWeek: [] as [] | [bigint],
    weekdayLunch: [] as [] | [boolean],
  };
}

/** A SignatureRef is a byte vector, not a string. */
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
    // The manager's approval signature is stored separately from the roadie's
    // own availability signature; both are optional on a fresh submission.
    managerSignature: [] as [] | [Uint8Array],
    managerSignedAt: [] as [] | [bigint],
    managerSignedBy: [] as [] | [unknown],
  };
}

describe("backend access, signup and export contract", () => {
  let pic: PocketIc | undefined;
  let canisterId: CanisterFixture<_SERVICE>["canisterId"];
  let admin: Actor<_SERVICE>;
  let kiosk: Actor<_SERVICE>;
  let trainer: Actor<_SERVICE>;

  const adminIdentity = createIdentity("admin-seed");
  const kioskIdentity = createIdentity("kiosk-seed");
  const trainerIdentity = createIdentity("trainer-seed");

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

    // The first caller to initialize access control becomes the Admin.
    admin = await registerCaller(
      pic.createActor<_SERVICE>(idlFactory, canisterId),
      adminIdentity,
    );
    kiosk = await registerCaller(
      pic.createActor<_SERVICE>(idlFactory, canisterId),
      kioskIdentity,
    );
    trainer = await registerCaller(
      pic.createActor<_SERVICE>(idlFactory, canisterId),
      trainerIdentity,
    );
  });

  afterAll(async () => {
    await pic?.tearDown();
  });

  it("makes the first caller an admin", async () => {
    const grant = await admin.getMyAccess();
    expect(grant[0]?.role).toEqual({ admin: null });
  });

  it("rejects every read for a Kiosk login but allows a sign-up", async () => {
    // approveUser only acts on a principal that is actually pending, so the
    // caller must register through the public requestAccess flow first.
    await kiosk.requestAccess();
    await admin.approveUser({
      principal: kioskIdentity.getPrincipal(),
      role: { kiosk: null },
      trainerPositionIds: [],
      accessEndsAt: [],
      linkedRoadieId: [],
    });

    const signupId = await kiosk.submitSignup(
      profile("Kiosk Signup"),
      [],
      [],
      contactSet("+1-555-0001", "kiosk@example.com", ADULT_DOB),
    );
    expect(signupId).toBe(0n);

    await expect(kiosk.listRoadies()).rejects.toThrow();
    await expect(kiosk.listPositions()).rejects.toThrow();
    await expect(kiosk.getStoreInfo()).rejects.toThrow();
  });

  it("never returns contact-set fields to a non-manager role", async () => {
    await trainer.requestAccess();
    // Give the trainer a station so it can read the roadie card at all; a
    // trainer with no stations sees no roadies (covered separately).
    await admin.approveUser({
      principal: trainerIdentity.getPrincipal(),
      role: { trainer: null },
      trainerPositionIds: [0n],
      accessEndsAt: [],
      linkedRoadieId: [],
    });

    const signupId = await admin.submitSignup(
      profile("Redaction Target"),
      [],
      [],
      contactSet("+1-555-0002", "redact@example.com", ADULT_DOB),
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

    const asAdmin = await admin.getRoadie(roadieId);
    expect(asAdmin[0]?.contactSet[0]?.phone).toBe("+1-555-0002");

    // A non-manager's roadie card carries no contact set at all (the optional
    // decodes to an empty array), while the dedicated getContactSet read
    // returns an empty array too.
    const asTrainer = await trainer.getRoadie(roadieId);
    expect(asTrainer[0]?.contactSet).toEqual([]);

    const listAsTrainer = await trainer.listRoadies();
    for (const roadie of listAsTrainer) {
      expect(roadie.contactSet).toEqual([]);
    }
  });

  it("blocks assigning a minor to a position with a higher minimum age", async () => {
    const signupId = await admin.submitSignup(
      profile("Minor Applicant"),
      [],
      [],
      contactSet("+1-555-0003", "minor@example.com", MINOR_DOB),
    );
    // Position 2 (Bartenders) has minimumAge 21.
    await expect(
      admin.approveSignup(
        signupId,
        {
          mainPositionId: 2n,
          secondPositionId: [],
          crewId: [],
          orientationEventId: [],
          startDate: [],
        },
        sig("sig"),
      ),
    ).rejects.toThrow();
  });

  it("flags a duplicate phone or email against an existing card", async () => {
    const signupId = await admin.submitSignup(
      profile("Duplicate Applicant"),
      [],
      [],
      contactSet("+1-555-0002", "redact@example.com", ADULT_DOB),
    );
    const matches = await admin.findDuplicates(signupId);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].matchedOn).toBe("phone");
  });

  it("increases on hand by exactly 1 on approve and moves it on archive/rehire", async () => {
    const before = await admin.getDashboard();
    const signupId = await admin.submitSignup(
      profile("On Hand Target"),
      [],
      [],
      contactSet("+1-555-0004", "onhand@example.com", ADULT_DOB),
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
    const afterApprove = await admin.getDashboard();
    expect(afterApprove.hired).toBe(before.hired + 1n);

    await admin.archiveRoadie(roadieId, { other: "test" });
    const afterArchive = await admin.getDashboard();
    expect(afterArchive.hired).toBe(before.hired);

    // A rehire always requires a non-blank reason.
    await admin.rehireRoadie(roadieId, ["Rehired for the season"]);
    const afterRehire = await admin.getDashboard();
    expect(afterRehire.hired).toBe(before.hired + 1n);
  });

  it("protects the last admin and enforces at least 2 admins", async () => {
    const adminPrincipal = adminIdentity.getPrincipal();
    await expect(admin.removeUser(adminPrincipal)).rejects.toThrow();
    await expect(
      admin.updateUserRole(adminPrincipal, { trainer: null }),
    ).rejects.toThrow();
  });

  it("omits contact-set fields from the Shareable export and logs the Full export", async () => {
    const shareable = await admin.buildShareableExport();
    for (const [, rows] of shareable.groups) {
      for (const row of rows) {
        expect(row.phone).toEqual([]);
      }
    }

    const full = await admin.buildFullExport();
    const fullPhones = full.groups.flatMap(([, rows]) =>
      rows.map((r) => r.phone),
    );
    expect(fullPhones.some((p) => p.length > 0)).toBe(true);

    const log = await admin.listChangeLog();
    expect(log.some((entry) => entry.action === "buildFullExport")).toBe(true);
  });

  it("rejects the Full export for a non-manager role", async () => {
    await expect(trainer.buildFullExport()).rejects.toThrow();
  });

  it("hides contact-set change-log entries from a non-manager role", async () => {
    const signupId = await admin.submitSignup(
      profile("Change Log Target"),
      [],
      [],
      contactSet("+1-555-0005", "changelog@example.com", ADULT_DOB),
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
    // A contact-set-touching entry, recorded for managers only.
    await admin.updateContactSet(roadieId, contactSet("+1-555-0006", "changed@example.com", ADULT_DOB));

    const asAdmin = await admin.listChangeLog();
    expect(
      asAdmin.some((entry) => entry.action === "updateContactSet"),
    ).toBe(true);

    const asTrainer = await trainer.listChangeLog();
    // Contact-set-touching entries are hidden from a non-manager...
    expect(
      asTrainer.some((entry) => entry.action === "updateContactSet"),
    ).toBe(false);
    // ...but a non-contact entry about a roadie in the trainer's station stays
    // visible.
    expect(asTrainer.some((entry) => entry.action === "approveSignup")).toBe(true);
  });

  it("moves on hand on changePosition and blocks a minor from a higher-age position", async () => {
    const before = await admin.getDashboard();
    const signupId = await admin.submitSignup(
      profile("Change Position Target"),
      [],
      [],
      contactSet("+1-555-0007", "changepos@example.com", ADULT_DOB),
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
    const afterApprove = await admin.getDashboard();
    expect(afterApprove.hired).toBe(before.hired + 1n);

    // Moving to another position keeps the roadie on hand.
    await admin.changePosition(roadieId, 1n, [], []);
    const afterChange = await admin.getDashboard();
    expect(afterChange.hired).toBe(before.hired + 1n);

    // A minor cannot be moved into a 21+ position. The age gate uses the
    // canister's own clock, which can differ from the host clock, so anchor the
    // date of birth to a timestamp the canister itself reported.
    const clockProbeId = await admin.submitSignup(
      profile("Clock Probe"),
      [],
      [],
      contactSet("+1-555-0099", "clockprobe@example.com", ADULT_DOB),
    );
    const clockProbe = await admin.getSignup(clockProbeId);
    const canisterNow = clockProbe[0]!.submittedAt;
    const minorDob = canisterNow - 16n * 365n * DAY_NS - 200n * DAY_NS;
    const minorSignupId = await admin.submitSignup(
      profile("Minor Change Position"),
      [],
      [],
      contactSet("+1-555-0008", "minorchangepos@example.com", minorDob),
    );
    // Position 1 (Hosts) has minimumAge 16, so a minor can be approved there.
    const minorRoadieId = await admin.approveSignup(
      minorSignupId,
      {
        mainPositionId: 1n,
        secondPositionId: [],
        crewId: [],
        orientationEventId: [],
        startDate: [],
      },
      sig("sig"),
    );
    // Position 2 (Bartenders) has minimumAge 21, so the move is blocked.
    await expect(admin.changePosition(minorRoadieId, 2n, [], [])).rejects.toThrow();
  });

  it("returns the contact set as a one-element array to a manager and an empty array to a non-manager", async () => {
    const signupId = await admin.submitSignup(
      profile("Contact Array Target"),
      [],
      [],
      contactSet("+1-555-0010", "contactarray@example.com", ADULT_DOB),
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

    // Admin: a one-element array carrying the real contact set.
    const asAdmin = await admin.getContactSet(roadieId);
    expect(asAdmin).toHaveLength(1);
    expect(asAdmin[0]?.phone).toBe("+1-555-0010");

    // Trainer: an empty array, never a trap and never undefined.
    const asTrainer = await trainer.getContactSet(roadieId);
    expect(asTrainer).toEqual([]);
  });

  it("re-seeds an empty store once and reports the seeded positions", async () => {
    // A fresh install already seeded 18 positions, so ensureSeeded is a no-op
    // and reports false without overwriting the store.
    const applied = await admin.ensureSeeded();
    expect(applied).toBe(false);

    const positions = await admin.listPositions();
    expect(positions).toHaveLength(18);
    const buildToTotal = positions.reduce(
      (sum, p) => sum + p.openingBuildTo,
      0n,
    );
    expect(buildToTotal).toBe(218n);
  });

  it("summarizes on-hand and open spots per position", async () => {
    const summary = await admin.getRosterSummary();
    expect(summary).toHaveLength(18);

    const servers = summary.find((row) => row.positionId === 0n);
    expect(servers?.positionName).toBe("Servers");
    expect(servers?.buildTo).toBe(65n);
    // Open spots is the build-to target minus on-hand, clamped at zero.
    expect(servers?.openSpots).toBe(servers!.buildTo - servers!.onHand);
  });

  it("does not let one caller read or modify another caller's records", async () => {
    // A second manager, so the isolation check is between two privileged callers.
    const managerIdentity = createIdentity("manager-seed");
    const manager = await registerCaller(
      pic!.createActor<_SERVICE>(idlFactory, canisterId),
      managerIdentity,
    );
    await manager.requestAccess();
    await admin.approveUser({
      principal: managerIdentity.getPrincipal(),
      role: { storeManager: null },
      trainerPositionIds: [],
      accessEndsAt: [],
      linkedRoadieId: [],
    });

    const signupId = await admin.submitSignup(
      profile("Isolation Target"),
      [],
      [],
      contactSet("+1-555-0009", "isolation@example.com", ADULT_DOB),
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

    // A manager can read the record, but a Kiosk login cannot read it at all.
    const asManager = await manager.getRoadie(roadieId);
    expect(asManager[0]?.profile.name).toBe("Isolation Target");
    await expect(kiosk.getRoadie(roadieId)).rejects.toThrow();

    // A Kiosk login cannot modify the record either.
    await expect(
      kiosk.updateRoadieDetails(roadieId, profile("Hijacked")),
    ).rejects.toThrow();
    const unchanged = await admin.getRoadie(roadieId);
    expect(unchanged[0]?.profile.name).toBe("Isolation Target");
  });

  it("stores the manager's approval signature separately from the roadie's own", async () => {
    const signupId = await admin.submitSignup(
      profile("Signature Target"),
      [],
      [],
      contactSet("+1-555-0011", "signature@example.com", ADULT_DOB),
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
      sig("manager-signature-bytes"),
    );

    const roadie = await admin.getRoadie(roadieId);
    const contact = roadie[0]?.contactSet[0];
    // The manager's drawn signature is stored in its own field, with the
    // signing principal recorded, and never overwrites the roadie's signature.
    expect(contact?.managerSignature[0]).toEqual(sig("manager-signature-bytes"));
    expect(contact?.managerSignedAt[0]).toBeGreaterThan(0n);
    expect(contact?.managerSignedBy[0]?.toText()).toBe(
      adminIdentity.getPrincipal().toText(),
    );
    expect(contact?.availabilitySignature).toEqual([]);
  });

  it("builds an access end date of 11:59:59 PM America/Chicago on the chosen day", async () => {
    // 2027-02-08 is CST (UTC-6), so 23:59:59 local is 2027-02-09T05:59:59Z.
    const day = BigInt(Date.UTC(2027, 1, 8)) * 1_000_000n;
    const endsAt = await admin.accessEndForDay(day);
    expect(endsAt).toBe(
      BigInt(Date.UTC(2027, 1, 9, 5, 59, 59)) * 1_000_000n,
    );
  });

  it("refuses to archive or unarchive through updateRoadieStatus", async () => {
    const signupId = await admin.submitSignup(
      profile("Status Target"),
      [],
      [],
      contactSet("+1-555-0012", "status@example.com", ADULT_DOB),
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

    // updateRoadieStatus may move between active statuses...
    await admin.updateRoadieStatus(roadieId, { paperworkDone: null });
    const updated = await admin.getRoadie(roadieId);
    expect(updated[0]?.status).toEqual({ paperworkDone: null });

    // ...but it can never archive a roadie.
    await expect(
      admin.updateRoadieStatus(roadieId, { archived: null }),
    ).rejects.toThrow();

    // Archiving requires the dedicated path, and a rehire requires a reason.
    await admin.archiveRoadie(roadieId, { other: "test" });
    await expect(admin.rehireRoadie(roadieId, [])).rejects.toThrow();
    await expect(admin.rehireRoadie(roadieId, ["   "])).rejects.toThrow();
    await admin.rehireRoadie(roadieId, ["Rehired for the season"]);
    const rehired = await admin.getRoadie(roadieId);
    expect(rehired[0]?.status).toEqual({ hired: null });
  });
});
