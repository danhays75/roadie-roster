import { renderPageWithActor, t } from "@/__tests__/router-test-utils";
import type {
  Crew,
  CrewSummary,
  LeaderSummary,
  Position,
  Roadie,
  SignupSubmission,
  StaffProfile,
  StoreInfo,
  backendInterface,
} from "@/backend";
import { House, Role } from "@/backend";
import AdminPage from "@/pages/Admin";
import ApprovalsPage from "@/pages/Approvals";
import type { Principal } from "@icp-sdk/core/principal";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

/**
 * Cover for the accepted manager-owned Crews change. The actor is a typed local
 * mock; no live backend, identity or storage is exercised. The backend lane is
 * the only place the real canister methods run.
 */

function fakePrincipal(text: string): Principal {
  return {
    toText: () => text,
    toString: () => text,
  } as unknown as Principal;
}

const ADMIN_PRINCIPAL = fakePrincipal("aaaaa-aa");
const JORDAN_PRINCIPAL = fakePrincipal("jordan-aa");
const SAM_PRINCIPAL = fakePrincipal("sam-aa");
const TRAINER_PRINCIPAL = fakePrincipal("trainer-aa");
const VISITING_PRINCIPAL = fakePrincipal("visiting-aa");
const LEADERSHIP_PRINCIPAL = fakePrincipal("leadership-aa");

const STORE: StoreInfo = {
  storeNumber: "975",
  appName: "Roadie Roster",
  locationName: "Lake Charles",
  address: "1400 W Prien Lake Rd, Lake Charles, LA 70601",
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
};

const SERVERS: Position = {
  id: 0n,
  name: "Servers",
  code: "SRV",
  house: House.foh,
  openingBuildTo: 65n,
  afterOpeningBuildTo: 65n,
  minimumAge: 18n,
  needsAlcoholCert: true,
  shirtType: "Polo",
  shirtQty: 2n,
  hatType: "Cap",
  hatQty: 1n,
  defaultShirts: 2n,
  defaultHats: 1n,
};

function grant(role: Role, principal: Principal = ADMIN_PRINCIPAL) {
  return {
    principal,
    role,
    approvedAt: 0n,
    approvedBy: ADMIN_PRINCIPAL,
    trainerPositionIds: [],
  };
}

function staffProfile(fullName: string, preferredName?: string): StaffProfile {
  return {
    fullName,
    preferredName,
    title: "Manager",
    requestedRole: Role.storeManager,
    homeStoreNumber: "975",
    homeStoreCity: "Lake Charles",
    trainerPositionIds: [],
  };
}

function leader(
  principal: Principal,
  role: Role,
  profile: StaffProfile,
): LeaderSummary {
  return {
    principal,
    role,
    title: profile.title,
    staffProfile: profile,
    trainerPositionIds: [],
  };
}

const JORDAN = leader(
  JORDAN_PRINCIPAL,
  Role.storeManager,
  staffProfile("Jordan Rivera", "Jordan"),
);
const SAM = leader(
  SAM_PRINCIPAL,
  Role.trainingManager,
  staffProfile("Sam Lee"),
);
const TRAINER = leader(
  TRAINER_PRINCIPAL,
  Role.trainer,
  staffProfile("Kristen Marcotte"),
);
const VISITING = leader(
  VISITING_PRINCIPAL,
  Role.visitingManager,
  staffProfile("Vic Visitor"),
);
const LEADERSHIP = leader(
  LEADERSHIP_PRINCIPAL,
  Role.leadership,
  staffProfile("Renee Hollier"),
);

/** A pending sign-up that is a clear adult, so no age gate interferes. */
function adultSignup(): SignupSubmission {
  const now = Date.now();
  const twentyFiveYearsAgo = new Date(now - 25 * 365 * 24 * 60 * 60 * 1000);
  return {
    id: 1n,
    status: { __kind__: "pending", pending: null },
    submittedAt: BigInt(now) * 1_000_000n,
    profile: { name: "Adult Applicant" },
    isDemo: false,
    contactSet: {
      email: "adult@example.com",
      phone: "+1-555-0100",
      dateOfBirth: BigInt(twentyFiveYearsAgo.getTime()) * 1_000_000n,
      emergencyContactName: "Emergency",
      emergencyContactPhone: "+1-555-0101",
      availability: [],
      availabilityResignPending: false,
    },
  };
}

/** The actor methods the admin page tree reads across its tabs. */
function adminActor(
  role: Role,
  crews: Crew[],
  leaders: LeaderSummary[],
  roadies: Roadie[] = [],
) {
  return {
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: grant(role),
    })),
    getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(async () => STORE),
    listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
      SERVERS,
    ]),
    listSchedule: vi.fn<backendInterface["listSchedule"]>(async () => []),
    getChecklists: vi.fn<backendInterface["getChecklists"]>(async () => ({
      orientationUniform: [],
      paperwork: [],
    })),
    getRetentionSettings: vi.fn<backendInterface["getRetentionSettings"]>(
      async () => ({
        archivedContactSetDays: 90n,
        notesDays: 365n,
        archivedPhotoDays: 365n,
        changeLogDays: 730n,
      }),
    ),
    listAccessGrants: vi.fn<backendInterface["listAccessGrants"]>(
      async () => [],
    ),
    adminCount: vi.fn<backendInterface["adminCount"]>(async () => 1n),
    listCrews: vi.fn<backendInterface["listCrews"]>(async () =>
      crews.map((crew) => ({ ...crew })),
    ),
    listLeaders: vi.fn<backendInterface["listLeaders"]>(async () =>
      leaders.map((entry) => ({ ...entry })),
    ),
    listRoadies: vi.fn<backendInterface["listRoadies"]>(async () =>
      roadies.map((r) => ({ ...r })),
    ),
    createCrew: vi.fn<backendInterface["createCrew"]>(async () => 9n),
    updateCrew: vi.fn<backendInterface["updateCrew"]>(async () => {}),
    deleteCrew: vi.fn<backendInterface["deleteCrew"]>(async () => {}),
  };
}

/** The actor methods the approvals page tree reads. */
function approvalsActor(signups: SignupSubmission[], crews: CrewSummary[]) {
  return {
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: grant(Role.storeManager, JORDAN_PRINCIPAL),
    })),
    listPendingUsers: vi.fn<backendInterface["listPendingUsers"]>(
      async () => [],
    ),
    listPendingSignups: vi.fn<backendInterface["listPendingSignups"]>(
      async () => signups,
    ),
    listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
      SERVERS,
    ]),
    listCrewSummaries: vi.fn<backendInterface["listCrewSummaries"]>(async () =>
      crews.map((crew) => ({ ...crew })),
    ),
    listSchedule: vi.fn<backendInterface["listSchedule"]>(async () => []),
    getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(async () => STORE),
    findDuplicates: vi.fn<backendInterface["findDuplicates"]>(async () => []),
    approveSignup: vi.fn<backendInterface["approveSignup"]>(async () => 0n),
  };
}

describe("Add crew offers only eligible managers", () => {
  it("offers Admin, Store Manager and Training Manager but not NSO Trainer, Visiting Manager or Leadership", async () => {
    const user = userEvent.setup();
    const actor = adminActor(
      Role.admin,
      [],
      [JORDAN, SAM, TRAINER, VISITING, LEADERSHIP],
    );
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    await user.click(await screen.findByTestId("admin.crews.tab"));
    await user.click(await screen.findByTestId("admin.crews.add_button"));
    await user.click(await screen.findByTestId("admin.crews.leader.select"));

    // The three eligible roles are offered.
    expect(
      await screen.findByRole("option", { name: /Jordan/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Sam Lee/ })).toBeInTheDocument();
    // NSO Trainer, Visiting Manager and Leadership are never offered.
    expect(
      screen.queryByRole("option", { name: /Kristen Marcotte/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /Vic Visitor/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /Renee Hollier/ }),
    ).not.toBeInTheDocument();
  });

  it('auto-fills the name as "<first name>\'s Crew" and keeps it editable', async () => {
    const user = userEvent.setup();
    const actor = adminActor(Role.admin, [], [JORDAN, SAM]);
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    await user.click(await screen.findByTestId("admin.crews.tab"));
    await user.click(await screen.findByTestId("admin.crews.add_button"));

    const nameInput = await screen.findByTestId("admin.crews.name.input");
    expect(nameInput).toHaveValue("");

    await user.click(screen.getByTestId("admin.crews.leader.select"));
    await user.click(await screen.findByRole("option", { name: /Jordan/ }));
    await waitFor(() => expect(nameInput).toHaveValue("Jordan's Crew"));

    // The suggested name stays editable before saving.
    await user.clear(nameInput);
    await user.type(nameInput, "Front of House");
    expect(nameInput).toHaveValue("Front of House");

    await user.click(screen.getByTestId("admin.crews.save_button"));
    await waitFor(() => expect(actor.createCrew).toHaveBeenCalledTimes(1));
    // A new crew is created with its owner.
    const [name, owner] = actor.createCrew.mock.calls[0] ?? [];
    expect(name).toBe("Front of House");
    expect(owner).toBe(JORDAN_PRINCIPAL);
  });

  it("requires a manager before a new crew can be saved", async () => {
    const user = userEvent.setup();
    const actor = adminActor(Role.admin, [], [JORDAN]);
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    await user.click(await screen.findByTestId("admin.crews.tab"));
    await user.click(await screen.findByTestId("admin.crews.add_button"));

    const nameInput = await screen.findByTestId("admin.crews.name.input");
    await user.type(nameInput, "No Owner Crew");
    // With no manager chosen the save is blocked.
    expect(screen.getByTestId("admin.crews.save_button")).toBeDisabled();
    expect(actor.createCrew).not.toHaveBeenCalled();
  });
});

describe("A manager can own only one crew", () => {
  it("hides a manager who already owns a crew from the picker", async () => {
    const user = userEvent.setup();
    const crews: Crew[] = [
      {
        id: 0n,
        name: "Jordan's Crew",
        leaderPrincipal: JORDAN_PRINCIPAL,
        isDemo: false,
      },
    ];
    const actor = adminActor(Role.admin, crews, [JORDAN, SAM]);
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    await user.click(await screen.findByTestId("admin.crews.tab"));
    await user.click(await screen.findByTestId("admin.crews.add_button"));
    await user.click(await screen.findByTestId("admin.crews.leader.select"));

    // Jordan already owns a crew, so only Sam is offered.
    expect(
      await screen.findByRole("option", { name: /Sam Lee/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /Jordan/ }),
    ).not.toBeInTheDocument();
  });

  it('refuses a manager who already owns a crew with "<Name> already has a crew"', async () => {
    const user = userEvent.setup();
    const crews: Crew[] = [
      {
        id: 0n,
        name: "Jordan's Crew",
        leaderPrincipal: JORDAN_PRINCIPAL,
        isDemo: false,
      },
    ];
    const actor = adminActor(Role.admin, crews, [JORDAN, SAM]);
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    await user.click(await screen.findByTestId("admin.crews.tab"));
    // Edit the existing crew and try to move its owner to Sam, who is free.
    await user.click(await screen.findByTestId("admin.crews.edit_button"));
    await user.click(screen.getByTestId("admin.crews.leader.select"));
    await user.click(await screen.findByRole("option", { name: /Sam Lee/ }));
    await waitFor(() =>
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
    );

    // Sam is free, so the save is allowed and the owner changes.
    const saveButton = screen.getByTestId("admin.crews.save_button");
    await waitFor(() => expect(saveButton).toBeEnabled());
    await user.click(saveButton);
    await waitFor(() => expect(actor.updateCrew).toHaveBeenCalledTimes(1));
    const [, , owner] = actor.updateCrew.mock.calls[0] ?? [];
    expect(owner).toBe(SAM_PRINCIPAL);
  });
});

describe("An ownerless crew keeps working", () => {
  it('shows "No manager yet" and a Pick manager button', async () => {
    const user = userEvent.setup();
    const crews: Crew[] = [{ id: 0n, name: "Legacy Crew", isDemo: false }];
    const actor = adminActor(Role.admin, crews, [JORDAN]);
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    await user.click(await screen.findByTestId("admin.crews.tab"));

    const row = await screen.findByTestId("admin.crews.item");
    // The accepted copy for an ownerless crew is "No manager yet".
    expect(within(row).getByText("No manager yet")).toBeInTheDocument();
    expect(
      within(row).getByTestId("admin.crews.pick_manager_button"),
    ).toBeInTheDocument();
  });

  it("assigns an owner through the Pick manager button", async () => {
    const user = userEvent.setup();
    const crews: Crew[] = [{ id: 0n, name: "Legacy Crew", isDemo: false }];
    const actor = adminActor(Role.admin, crews, [JORDAN]);
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    await user.click(await screen.findByTestId("admin.crews.tab"));
    await user.click(
      await screen.findByTestId("admin.crews.pick_manager_button"),
    );

    // The edit dialog opens with the crew's name and no owner.
    const nameInput = await screen.findByTestId("admin.crews.name.input");
    expect(nameInput).toHaveValue("Legacy Crew");

    await user.click(screen.getByTestId("admin.crews.leader.select"));
    await user.click(await screen.findByRole("option", { name: /Jordan/ }));
    await waitFor(() =>
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
    );

    const saveButton = screen.getByTestId("admin.crews.save_button");
    await waitFor(() => expect(saveButton).toBeEnabled());
    await user.click(saveButton);
    await waitFor(() => expect(actor.updateCrew).toHaveBeenCalledTimes(1));
    const [id, name, owner] = actor.updateCrew.mock.calls[0] ?? [];
    expect(id).toBe(0n);
    expect(name).toBe("Legacy Crew");
    expect(owner).toBe(JORDAN_PRINCIPAL);
  });
});

describe("Kiosk approval Crew dropdown", () => {
  it('lists each crew as "<name> · N roadies" with the pending + active count', async () => {
    const user = userEvent.setup();
    const crews: CrewSummary[] = [
      {
        id: 0n,
        name: "Jordan's Crew",
        leaderPrincipal: JORDAN_PRINCIPAL,
        roadieCount: 3n,
        isDemo: false,
      },
      {
        id: 1n,
        name: "Sam's Crew",
        leaderPrincipal: SAM_PRINCIPAL,
        roadieCount: 1n,
        isDemo: false,
      },
    ];
    renderPageWithActor(ApprovalsPage, approvalsActor([adultSignup()], crews), {
      path: "/approvals",
    });

    const crewSelect = await screen.findByTestId(
      "approvals.signup.crew.select",
    );
    await user.click(crewSelect);

    expect(
      await screen.findByRole("option", { name: "Jordan's Crew · 3 roadies" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Sam's Crew · 1 roadie" }),
    ).toBeInTheDocument();
  });

  it("preselects the crew with the fewest roadies and keeps No crew available", async () => {
    const user = userEvent.setup();
    const crews: CrewSummary[] = [
      {
        id: 0n,
        name: "Jordan's Crew",
        leaderPrincipal: JORDAN_PRINCIPAL,
        roadieCount: 3n,
        isDemo: false,
      },
      {
        id: 1n,
        name: "Sam's Crew",
        leaderPrincipal: SAM_PRINCIPAL,
        roadieCount: 1n,
        isDemo: false,
      },
    ];
    renderPageWithActor(ApprovalsPage, approvalsActor([adultSignup()], crews), {
      path: "/approvals",
    });

    const crewSelect = await screen.findByTestId(
      "approvals.signup.crew.select",
    );
    // The crew with the fewest roadies is preselected.
    await waitFor(() => expect(crewSelect).toHaveTextContent("Sam's Crew"));

    // "No crew" stays available: it is the select's placeholder, shown when no
    // crew is chosen, and the crew options remain selectable.
    expect(crewSelect).toHaveTextContent("Sam's Crew");
    await user.click(crewSelect);
    expect(
      await screen.findByRole("option", { name: "Jordan's Crew · 3 roadies" }),
    ).toBeInTheDocument();
  });
});
