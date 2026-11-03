import { renderPageWithActor } from "@/__tests__/router-test-utils";
import type {
  AccessGrant,
  Position,
  Roadie,
  ScheduleEvent,
  SignupSubmission,
  StoreInfo,
  backendInterface,
} from "@/backend";
import { EventKind, House, RoadieStatus, Role, RosterState } from "@/backend";
import ApprovalsPage from "@/pages/Approvals";
import DashboardPage from "@/pages/Dashboard";
import RosterPage from "@/pages/Roster";
import type { Principal } from "@icp-sdk/core/principal";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

/**
 * Characterization baseline for the surfaces the orientation / roster-state
 * request touches. The request intentionally changes four things: the seeded
 * Orientation BOH and FOH events become a single default session; the Approvals
 * orientation default stops matching events by house name; the Roster page
 * gains Pending and Active tabs; and the dashboard counts gain Pending/Active
 * breakdowns. This file deliberately does NOT assert the old two-orientation
 * seed, the house-name orientation default, a single active roster list, or the
 * current hired/build-to tile shape. It protects the adjacent behavior that must
 * survive:
 *   - the Roster page's search, Show former toggle and archived section,
 *   - the Approvals orientation select listing the upcoming sessions and the
 *     crew default round-trip,
 *   - the dashboard KPI tiles and the manager adjust-mode toggle.
 */

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
  paperworkDueDate: 1_800_000_000_000_000_000n,
};

const SERVERS: Position = {
  id: 0n,
  name: "Servers",
  code: "SRV",
  house: House.foh,
  openingBuildTo: 65n,
  afterOpeningBuildTo: 65n,
  minimumAge: 18n,
  shirtsRequired: 2n,
  hatsRequired: 1n,
  needsAlcoholCert: true,
  defaultShirts: 3n,
  defaultHats: 2n,
};

function roadie(overrides: Partial<Roadie> = {}): Roadie {
  return {
    id: 1n,
    status: RoadieStatus.hired,
    mainPositionId: 0n,
    hiredAt: 0n,
    isMinor: false,
    isDemo: false,
    profile: { name: "Ada Lovelace" },
    rosterState: RosterState.pending,
    ...overrides,
  };
}

/** The actor methods the Roster page reads. */
function rosterActor(roadies: Roadie[]) {
  return {
    listRoadies: vi.fn<backendInterface["listRoadies"]>(async () => roadies),
    listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
      SERVERS,
    ]),
    listCrews: vi.fn<backendInterface["listCrews"]>(async () => []),
  };
}

describe("Roster page keeps its search and former section", () => {
  it("reveals archived roadies in a separate section behind the Show former toggle", async () => {
    const user = userEvent.setup();
    renderPageWithActor(
      RosterPage,
      rosterActor([
        roadie({ id: 1n, profile: { name: "Ada Lovelace" } }),
        roadie({
          id: 2n,
          status: RoadieStatus.archived,
          profile: { name: "Former Grace" },
          archivedReason: { __kind__: "noShow", noShow: null },
        }),
      ]),
      { path: "/roster" },
    );

    // The active roadie renders; the archived one is hidden until the toggle.
    await screen.findByText("Ada Lovelace");
    expect(screen.queryByText("Former Grace")).not.toBeInTheDocument();

    const toggle = await screen.findByTestId("roster.former.toggle");
    await user.click(toggle);

    expect(await screen.findByText("Former Grace")).toBeInTheDocument();
    expect(screen.getByTestId("roster.former.section")).toBeInTheDocument();
  });

  it("filters both the active and former lists by the search query", async () => {
    const user = userEvent.setup();
    renderPageWithActor(
      RosterPage,
      rosterActor([
        roadie({ id: 1n, profile: { name: "Ada Lovelace" } }),
        roadie({
          id: 2n,
          status: RoadieStatus.archived,
          profile: { name: "Former Grace" },
          archivedReason: { __kind__: "noShow", noShow: null },
        }),
      ]),
      { path: "/roster" },
    );

    await screen.findByText("Ada Lovelace");
    await user.click(await screen.findByTestId("roster.former.toggle"));
    await screen.findByText("Former Grace");

    await user.type(screen.getByTestId("roster.search_input"), "grace");

    await waitFor(() =>
      expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Former Grace")).toBeInTheDocument();
  });
});

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

/** Two upcoming orientation sessions, soonest first. */
function upcomingSessions(): ScheduleEvent[] {
  const now = Date.now();
  return [
    {
      id: 1n,
      kind: EventKind.orientation,
      name: "Orientation BOH",
      start: BigInt(now + 2 * 24 * 60 * 60 * 1000) * 1_000_000n,
    },
    {
      id: 2n,
      kind: EventKind.orientation,
      name: "Orientation FOH",
      start: BigInt(now + 4 * 24 * 60 * 60 * 1000) * 1_000_000n,
    },
  ];
}

/** The actor methods the approvals page tree reads. */
function approvalsActor(signup: SignupSubmission) {
  return {
    listPendingUsers: vi.fn<backendInterface["listPendingUsers"]>(
      async () => [],
    ),
    listPendingSignups: vi.fn<backendInterface["listPendingSignups"]>(
      async () => [signup],
    ),
    listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
      SERVERS,
    ]),
    listCrews: vi.fn<backendInterface["listCrews"]>(async () => []),
    listSchedule: vi.fn<backendInterface["listSchedule"]>(async () =>
      upcomingSessions(),
    ),
    getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(async () => STORE),
    findDuplicates: vi.fn<backendInterface["findDuplicates"]>(async () => []),
    approveSignup: vi.fn<backendInterface["approveSignup"]>(async () => 0n),
  };
}

describe("Approvals orientation select keeps listing the upcoming sessions", () => {
  it("offers every upcoming orientation session in the select", async () => {
    const user = userEvent.setup();
    renderPageWithActor(ApprovalsPage, approvalsActor(adultSignup()), {
      path: "/approvals",
    });

    const select = await screen.findByTestId(
      "approvals.signup.orientation.select",
    );
    await user.click(select);

    expect(
      await screen.findByRole("option", { name: /Orientation BOH/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /Orientation FOH/ }),
    ).toBeInTheDocument();
  });

  it("keeps the orientation field changeable after a session is chosen", async () => {
    const user = userEvent.setup();
    renderPageWithActor(ApprovalsPage, approvalsActor(adultSignup()), {
      path: "/approvals",
    });

    const select = await screen.findByTestId(
      "approvals.signup.orientation.select",
    );
    await user.click(select);
    await user.click(
      await screen.findByRole("option", { name: /Orientation FOH/ }),
    );
    await waitFor(() => expect(select).toHaveTextContent(/Orientation FOH/));
  });
});

const PRINCIPAL = { toText: () => "aaaaa-aa" } as unknown as Principal;

/** A manager grant, so the dashboard's adjust-mode toggle is available. */
function managerGrant(): AccessGrant {
  return {
    principal: PRINCIPAL,
    approvedAt: 0n,
    approvedBy: PRINCIPAL,
    role: Role.storeManager,
    trainerPositionIds: [],
  };
}

/** The actor the dashboard tree reads. */
function dashboardActor() {
  return {
    getDashboard: vi.fn<backendInterface["getDashboard"]>(async () => ({
      foh: [SERVERS],
      boh: [],
      active: 3n,
      hired: 3n,
      pending: 0n,
      stillNeeded: 62n,
      buildToTotal: 65n,
    })),
    listSchedule: vi.fn<backendInterface["listSchedule"]>(async () => []),
    getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(async () => STORE),
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: managerGrant(),
    })),
    listRosterForPosition: vi.fn<backendInterface["listRosterForPosition"]>(
      async () => [],
    ),
    getRosterSummary: vi.fn<backendInterface["getRosterSummary"]>(async () => [
      {
        positionId: 0n,
        positionName: "Servers",
        onHand: 3n,
        buildTo: 65n,
        openSpots: 62n,
        active: 3n,
        pending: 0n,
      },
    ]),
  };
}

describe("Dashboard keeps its KPI tiles and adjust-mode toggle", () => {
  it("renders the hired, build-to and still-needed tiles from the dashboard read", async () => {
    renderPageWithActor(DashboardPage, dashboardActor(), {
      path: "/dashboard",
    });

    expect(await screen.findByTestId("dashboard.kpi.hired")).toHaveTextContent(
      "3",
    );
    expect(screen.getByTestId("dashboard.kpi.build_to")).toHaveTextContent(
      "65",
    );
    expect(screen.getByTestId("dashboard.kpi.still_needed")).toHaveTextContent(
      "62",
    );
  });

  it("shows the adjust-mode toggle and reveals the per-position steppers", async () => {
    const user = userEvent.setup();
    renderPageWithActor(DashboardPage, dashboardActor(), {
      path: "/dashboard",
    });

    const toggle = await screen.findByTestId("dashboard.adjust.toggle");
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(
      await screen.findByTestId("dashboard.adjust.panel"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("dashboard.adjust.opening.plus_button"),
    ).toBeInTheDocument();
  });
});
