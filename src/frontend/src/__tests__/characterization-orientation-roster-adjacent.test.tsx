import { renderPageWithActor } from "@/__tests__/router-test-utils";
import type {
  AccessGrant,
  ChecklistItem,
  ContactSet,
  OrientationRoadieRow,
  OrientationSessionView,
  Position,
  Roadie,
  ScheduleEvent,
  SignupSubmission,
  StoreInfo,
  UniformCheckoffView,
  backendInterface,
} from "@/backend";
import {
  EventKind,
  House,
  PaperworkStatus,
  RoadieStatus,
  Role,
  RosterState,
  UniformItemType,
} from "@/backend";
import ApprovalsPage from "@/pages/Approvals";
import DashboardPage from "@/pages/Dashboard";
import OrientationPage from "@/pages/Orientation";
import RoadieCardPage from "@/pages/RoadieCard";
import RosterPage from "@/pages/Roster";
import type { Principal } from "@icp-sdk/core/principal";
import { screen, waitFor, within } from "@testing-library/react";
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

/**
 * Adjacent behavior for the paperwork / uniform / override request. The request
 * intentionally changes four things: saveUniformCheckoff stops writing
 * paperworkItems, a new setPaperworkItems endpoint toggles paperwork, markPresent
 * gains a paperwork gate plus an override reason and rejects archived roadies,
 * and the orientation methods accept Training Manager and Visiting Manager. This
 * block deliberately does NOT assert the old "uniform save clears paperwork"
 * behavior, the disabled paperwork checkboxes, or the old manager-only role set.
 * It protects what must survive:
 *   - the Manager tab still renders each applicable paperwork item with its
 *     Minor tag and a checkbox,
 *   - the Override dialog still refuses to call markPresent with a blank reason,
 *   - the orientation session view still excludes archived roadies.
 */

const PAPERWORK_ITEMS: ChecklistItem[] = [
  {
    id: 1n,
    text: "I-9 form",
    minorOnly: false,
    requiresAlcoholCert: false,
    itemType: UniformItemType.checkbox,
  },
  {
    id: 4n,
    text: "LA employment certificate (LWC confirmation received)",
    minorOnly: true,
    requiresAlcoholCert: false,
    itemType: UniformItemType.checkbox,
  },
];

const MANAGER_CONTACT: ContactSet = {
  phone: "+1-555-0100",
  email: "ada@example.com",
  emergencyContactName: "Grace",
  emergencyContactPhone: "+1-555-0101",
  dateOfBirth: 0n,
  availability: [],
  availabilityResignPending: false,
};

function managerRoadie(overrides: Partial<Roadie> = {}): Roadie {
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

/** The actor the roadie card's manager tab reads. */
function managerTabActor(roadie: Roadie = managerRoadie()) {
  return {
    getRoadie: vi.fn<backendInterface["getRoadie"]>(async () => roadie),
    listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
      SERVERS,
    ]),
    listCrews: vi.fn<backendInterface["listCrews"]>(async () => []),
    isMinor: vi.fn<backendInterface["isMinor"]>(async () => roadie.isMinor),
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: managerGrant(),
    })),
    getContactSet: vi.fn<backendInterface["getContactSet"]>(async () => [
      MANAGER_CONTACT,
    ]),
    getChecklists: vi.fn<backendInterface["getChecklists"]>(async () => ({
      paperwork: PAPERWORK_ITEMS,
      orientationUniform: [],
    })),
    getOrientationCheckoff: vi.fn<backendInterface["getOrientationCheckoff"]>(
      async () => null,
    ),
    listChangeLog: vi.fn<backendInterface["listChangeLog"]>(async () => []),
  };
}

describe("Manager tab keeps rendering the paperwork checklist", () => {
  it("lists each applicable paperwork item with its Minor tag and a checkbox", async () => {
    const user = userEvent.setup();
    // A minor roadie: both the general item and the minor-only item apply.
    renderPageWithActor(
      RoadieCardPage,
      managerTabActor(managerRoadie({ isMinor: true })),
      {
        path: "/roster/$roadieId",
        initialEntry: "/roster/1",
      },
    );

    await user.click(await screen.findByTestId("roadie.manager.tab"));

    const section = await screen.findByTestId("roadie.manager.paperwork");
    expect(within(section).getByText("I-9 form")).toBeInTheDocument();
    expect(
      within(section).getByText(
        "LA employment certificate (LWC confirmation received)",
      ),
    ).toBeInTheDocument();
    // The minor-only item keeps its Minor tag.
    expect(within(section).getByText("Minor")).toBeInTheDocument();
    // Both items render a checkbox.
    expect(
      within(section).getAllByTestId("roadie.paperwork.checkbox"),
    ).toHaveLength(2);
  });

  it("hides the minor-only item from a non-minor roadie", async () => {
    const user = userEvent.setup();
    renderPageWithActor(RoadieCardPage, managerTabActor(), {
      path: "/roster/$roadieId",
      initialEntry: "/roster/1",
    });

    await user.click(await screen.findByTestId("roadie.manager.tab"));

    const section = await screen.findByTestId("roadie.manager.paperwork");
    expect(within(section).getByText("I-9 form")).toBeInTheDocument();
    expect(
      within(section).queryByText(
        "LA employment certificate (LWC confirmation received)",
      ),
    ).not.toBeInTheDocument();
    expect(
      within(section).getAllByTestId("roadie.paperwork.checkbox"),
    ).toHaveLength(1);
  });
});

/** One orientation session, starting in the future. */
function futureOrientationSession(): ScheduleEvent {
  const now = Date.now();
  return {
    id: 7n,
    kind: EventKind.orientation,
    name: "Orientation",
    start: BigInt(now + 2 * 24 * 60 * 60 * 1000) * 1_000_000n,
  };
}

function orientationRow(
  overrides: Partial<OrientationRoadieRow> = {},
): OrientationRoadieRow {
  return {
    roadieId: 1n,
    name: "Ada Lovelace",
    positionId: 0n,
    positionName: "Servers",
    present: false,
    noShow: false,
    rosterState: RosterState.pending,
    paperworkStatus: PaperworkStatus.incomplete,
    ...overrides,
  };
}

function orientationView(
  roadies: OrientationRoadieRow[],
): OrientationSessionView {
  return {
    eventId: 7n,
    name: "Orientation",
    start: futureOrientationSession().start,
    roadies,
    assignedCount: BigInt(roadies.length),
    presentCount: 0n,
  };
}

/** The actor the Orientation page reads for the override journey. */
function overrideActor(view: OrientationSessionView) {
  return {
    listSchedule: vi.fn<backendInterface["listSchedule"]>(async () => [
      futureOrientationSession(),
    ]),
    getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(async () => STORE),
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: managerGrant(),
    })),
    getOrientationSessionView: vi.fn<
      backendInterface["getOrientationSessionView"]
    >(async () => view),
    markPresent: vi.fn<backendInterface["markPresent"]>(async () => undefined),
    undoPresent: vi.fn<backendInterface["undoPresent"]>(async () => undefined),
    archiveNoShows: vi.fn<backendInterface["archiveNoShows"]>(async () => []),
    archiveRoadie: vi.fn<backendInterface["archiveRoadie"]>(
      async () => undefined,
    ),
    getUniformCheckoff: vi.fn<backendInterface["getUniformCheckoff"]>(
      async () => null,
    ),
  };
}

describe("Override dialog keeps requiring a reason", () => {
  it("refuses to mark Present with a blank reason and calls through once a reason is entered", async () => {
    const user = userEvent.setup();
    const actor = overrideActor(
      orientationView([orientationRow({ roadieId: 1n, name: "Ada Lovelace" })]),
    );
    renderPageWithActor(OrientationPage, actor, { path: "/orientation" });

    await user.click(
      await screen.findByTestId("orientation.roadie.override_button.1"),
    );

    // A blank reason is rejected client-side: no mutation is sent.
    await user.click(
      await screen.findByTestId("orientation.override.confirm_button"),
    );
    expect(
      await screen.findByTestId("orientation.override.validation_error"),
    ).toBeInTheDocument();
    expect(actor.markPresent).not.toHaveBeenCalled();

    // A non-empty reason lets the override through.
    await user.type(
      screen.getByTestId("orientation.override.reason_input"),
      "Paperwork on file at the store",
    );
    await user.click(screen.getByTestId("orientation.override.confirm_button"));

    await waitFor(() =>
      expect(actor.markPresent).toHaveBeenCalledWith(
        1n,
        7n,
        "Paperwork on file at the store",
      ),
    );
  });
});

describe("Orientation session view keeps excluding archived roadies", () => {
  it("does not render an archived roadie even when the view lists one", async () => {
    // The backend already filters archived roadies out of the session view; the
    // request adds a markPresent rejection for them. This protects the read
    // contract: an archived row is never presented as checkable.
    renderPageWithActor(
      OrientationPage,
      overrideActor(
        orientationView([
          orientationRow({ roadieId: 1n, name: "Ada Lovelace" }),
        ]),
      ),
      { path: "/orientation" },
    );

    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.queryByText("Former Grace")).not.toBeInTheDocument();
  });
});

/**
 * Adjacent behavior for the uniform check-off dialog. The request changes what
 * `saveUniformCheckoff` writes (it stops clearing paperwork) and adds a
 * `setPaperworkItems` endpoint, but the dialog's local editing UI must survive:
 * the count steppers and checkbox toggle update the draft, and the status line
 * reports "Uniform complete" once every item is satisfied. This block
 * deliberately does NOT assert the saved `paperworkItems` payload.
 */
function uniformCheckoffView(): UniformCheckoffView {
  return {
    roadieId: 1n,
    locked: false,
    complete: false,
    missing: ["Non-slip shoes"],
    items: [
      {
        itemId: 1n,
        text: "Shirts given",
        itemType: UniformItemType.count,
        checked: false,
        count: 3n,
      },
      {
        itemId: 2n,
        text: "Non-slip shoes",
        itemType: UniformItemType.checkbox,
        checked: false,
        count: 0n,
      },
    ],
  };
}

/** The actor the Orientation page reads for the uniform dialog journey. */
function uniformActor(view: UniformCheckoffView) {
  return {
    ...overrideActor(
      orientationView([orientationRow({ roadieId: 1n, name: "Ada Lovelace" })]),
    ),
    getUniformCheckoff: vi.fn<backendInterface["getUniformCheckoff"]>(
      async () => view,
    ),
    saveUniformCheckoff: vi.fn<backendInterface["saveUniformCheckoff"]>(
      async () => undefined,
    ),
  };
}

describe("Uniform check-off dialog keeps its local editing", () => {
  it("steps the count item up and down and toggles the checkbox item", async () => {
    const user = userEvent.setup();
    renderPageWithActor(OrientationPage, uniformActor(uniformCheckoffView()), {
      path: "/orientation",
    });

    await user.click(
      await screen.findByTestId("orientation.roadie.open_button.1"),
    );

    const countInput = await screen.findByTestId(
      "orientation.uniform.count_input.1",
    );
    expect(countInput).toHaveValue(3);

    await user.click(
      screen.getByTestId("orientation.uniform.increase_button.1"),
    );
    expect(countInput).toHaveValue(4);
    await user.click(
      screen.getByTestId("orientation.uniform.decrease_button.1"),
    );
    expect(countInput).toHaveValue(3);

    // The checkbox item starts unchecked and can be toggled on.
    const checkbox = screen.getByTestId("orientation.uniform.checkbox.2");
    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it("reports Uniform complete once every item is satisfied", async () => {
    const user = userEvent.setup();
    renderPageWithActor(OrientationPage, uniformActor(uniformCheckoffView()), {
      path: "/orientation",
    });

    await user.click(
      await screen.findByTestId("orientation.roadie.open_button.1"),
    );

    // The count item is already satisfied (3 shirts); the checkbox is not.
    expect(
      await screen.findByTestId("orientation.uniform.status"),
    ).toHaveTextContent("Missing: Non-slip shoes");

    await user.click(screen.getByTestId("orientation.uniform.checkbox.2"));

    expect(screen.getByTestId("orientation.uniform.status")).toHaveTextContent(
      "Uniform complete",
    );
  });
});

describe("Override dialog cancel keeps the roadie unmarked", () => {
  it("closes without calling markPresent when cancelled", async () => {
    const user = userEvent.setup();
    const actor = overrideActor(
      orientationView([orientationRow({ roadieId: 1n, name: "Ada Lovelace" })]),
    );
    renderPageWithActor(OrientationPage, actor, { path: "/orientation" });

    await user.click(
      await screen.findByTestId("orientation.roadie.override_button.1"),
    );
    await user.type(
      await screen.findByTestId("orientation.override.reason_input"),
      "Paperwork on file at the store",
    );
    await user.click(screen.getByTestId("orientation.override.cancel_button"));

    await waitFor(() =>
      expect(
        screen.queryByTestId("orientation.override.dialog"),
      ).not.toBeInTheDocument(),
    );
    expect(actor.markPresent).not.toHaveBeenCalled();
  });
});

describe("Orientation session select keeps listing the sessions", () => {
  it("offers every scheduled orientation session in the select", async () => {
    const user = userEvent.setup();
    const actor = {
      ...overrideActor(
        orientationView([
          orientationRow({ roadieId: 1n, name: "Ada Lovelace" }),
        ]),
      ),
      listSchedule: vi.fn<backendInterface["listSchedule"]>(async () => [
        futureOrientationSession(),
        {
          id: 8n,
          kind: EventKind.orientation,
          name: "Makeup Orientation",
          start: BigInt(Date.now() + 5 * 24 * 60 * 60 * 1000) * 1_000_000n,
        },
      ]),
    };
    renderPageWithActor(OrientationPage, actor, { path: "/orientation" });

    await user.click(await screen.findByTestId("orientation.session.select"));

    expect(
      await screen.findByRole("option", { name: /^Orientation ·/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /Makeup Orientation/ }),
    ).toBeInTheDocument();
  });
});
