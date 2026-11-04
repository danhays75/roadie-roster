import { renderPageWithActor } from "@/__tests__/router-test-utils";
import type {
  AccessGrant,
  ChecklistItem,
  ContactSet,
  OrientationCheckoff,
  OrientationRoadieRow,
  OrientationSessionOption,
  OrientationSessionView,
  Position,
  Roadie,
  ScheduleEvent,
  StoreInfo,
  UnassignedRoadieRow,
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
import DashboardPage from "@/pages/Dashboard";
import OrientationPage from "@/pages/Orientation";
import RoadieCardPage from "@/pages/RoadieCard";
import RosterPage from "@/pages/Roster";
import type { Principal } from "@icp-sdk/core/principal";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

/**
 * Cover for the orientation / roster-state request. These journeys exercise the
 * accepted observable behavior through the real page components with a typed
 * local actor mock:
 *   - the Roster page opens on an All tab and its Pending and Active tabs
 *     partition non-archived roadies,
 *   - the Orientation screen lists a session's roadies with Present x / y and
 *     marks a roadie Present through the real mutation,
 *   - incomplete paperwork replaces Present with the warning, Archive and
 *     Override actions, and the Override dialog sends the reason,
 *   - the Manager tab's paperwork checkboxes show each applicable item's checked
 *     state, toggle through setPaperworkItems, and report Paperwork n of m plus
 *     a Complete badge,
 *   - the dashboard shows Pending and Active counts and the Hired → Active
 *     funnel.
 * The backend is mocked here; the PocketIC lane covers the real canister.
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
  shirtType: "Polo",
  shirtQty: 2n,
  hatType: "Cap",
  hatQty: 1n,
};

const PRINCIPAL = { toText: () => "aaaaa-aa" } as unknown as Principal;

function managerGrant(): AccessGrant {
  return {
    principal: PRINCIPAL,
    approvedAt: 0n,
    approvedBy: PRINCIPAL,
    role: Role.storeManager,
    trainerPositionIds: [],
  };
}

function roadie(overrides: Partial<Roadie> = {}): Roadie {
  return {
    id: 1n,
    status: RoadieStatus.hired,
    mainPositionId: 0n,
    hiredAt: 0n,
    isMinor: false,
    isDemo: false,
    rosterState: RosterState.pending,
    profile: { name: "Ada Lovelace" },
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
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: managerGrant(),
    })),
    getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(async () => STORE),
    getChecklists: vi.fn<backendInterface["getChecklists"]>(async () => ({
      paperwork: [],
      orientationUniform: [],
    })),
    getOrientationCheckoff: vi.fn<backendInterface["getOrientationCheckoff"]>(
      async () => null,
    ),
  };
}

describe("Roster page All, Pending and Active tabs", () => {
  it("opens on the All tab showing both Pending and Active roadies", async () => {
    renderPageWithActor(
      RosterPage,
      rosterActor([
        roadie({
          id: 1n,
          rosterState: RosterState.pending,
          profile: { name: "Pending Pat" },
        }),
        roadie({
          id: 2n,
          rosterState: RosterState.active,
          profile: { name: "Active Alex" },
        }),
      ]),
      { path: "/roster" },
    );

    // The All tab is selected by default, so both roadies show.
    expect(await screen.findByText("Pending Pat")).toBeInTheDocument();
    expect(screen.getByText("Active Alex")).toBeInTheDocument();
    expect(screen.getByTestId("roster.filter.all.tab")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("partitions non-archived roadies into Pending and Active tabs", async () => {
    const user = userEvent.setup();
    renderPageWithActor(
      RosterPage,
      rosterActor([
        roadie({
          id: 1n,
          rosterState: RosterState.pending,
          profile: { name: "Pending Pat" },
        }),
        roadie({
          id: 2n,
          rosterState: RosterState.active,
          profile: { name: "Active Alex" },
        }),
      ]),
      { path: "/roster" },
    );

    // Both roadies show on the default All tab.
    expect(await screen.findByText("Pending Pat")).toBeInTheDocument();
    expect(screen.getByText("Active Alex")).toBeInTheDocument();

    const pendingTab = await screen.findByTestId("roster.filter.pending.tab");
    await user.click(pendingTab);

    expect(await screen.findByText("Pending Pat")).toBeInTheDocument();
    expect(screen.queryByText("Active Alex")).not.toBeInTheDocument();

    const activeTab = screen.getByTestId("roster.filter.active.tab");
    await user.click(activeTab);

    expect(await screen.findByText("Active Alex")).toBeInTheDocument();
    expect(screen.queryByText("Pending Pat")).not.toBeInTheDocument();
  });

  it("excludes archived roadies from both Pending and Active tabs", async () => {
    const user = userEvent.setup();
    renderPageWithActor(
      RosterPage,
      rosterActor([
        roadie({
          id: 1n,
          rosterState: RosterState.pending,
          profile: { name: "Pending Pat" },
        }),
        roadie({
          id: 2n,
          status: RoadieStatus.archived,
          rosterState: RosterState.active,
          profile: { name: "Former Grace" },
          archivedReason: { __kind__: "noShow", noShow: null },
        }),
      ]),
      { path: "/roster" },
    );

    // Wait for the roadies to load, then switch to the Pending tab.
    await screen.findByTestId("roster.filter.pending.tab");
    await user.click(screen.getByTestId("roster.filter.pending.tab"));
    expect(await screen.findByText("Pending Pat")).toBeInTheDocument();
    // The archived roadie is not in the Pending tab...
    expect(screen.queryByText("Former Grace")).not.toBeInTheDocument();
    // ...and the Pending tab count is 1, not 2.
    expect(screen.getByTestId("roster.filter.pending.tab")).toHaveTextContent(
      "1",
    );
  });
});

/** One orientation session, starting in the future. */
function futureSession(): ScheduleEvent {
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
    paperworkStatus: PaperworkStatus.complete,
    ...overrides,
  };
}

function sessionView(
  roadies: OrientationRoadieRow[],
  presentCount: bigint,
): OrientationSessionView {
  return {
    eventId: 7n,
    name: "Orientation",
    start: futureSession().start,
    roadies,
    assignedCount: BigInt(roadies.length),
    presentCount,
  };
}

/** The actor methods the Orientation page reads. */
function orientationActor(view: OrientationSessionView) {
  return {
    listSchedule: vi.fn<backendInterface["listSchedule"]>(async () => [
      futureSession(),
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
    listOrientationSessions: vi.fn<backendInterface["listOrientationSessions"]>(
      async () => [],
    ),
    listUnassignedPendingRoadies: vi.fn<
      backendInterface["listUnassignedPendingRoadies"]
    >(async () => []),
    moveRoadieToSession: vi.fn<backendInterface["moveRoadieToSession"]>(
      async () => undefined,
    ),
  };
}

describe("Orientation screen", () => {
  it("lists the session's roadies with Present x / y counts", async () => {
    renderPageWithActor(
      OrientationPage,
      orientationActor(
        sessionView(
          [
            orientationRow({ roadieId: 1n, name: "Ada Lovelace" }),
            orientationRow({
              roadieId: 2n,
              name: "Grace Hopper",
              present: true,
            }),
          ],
          1n,
        ),
      ),
      { path: "/orientation" },
    );

    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();
    expect(screen.getByTestId("orientation.present_count")).toHaveTextContent(
      "1 of 2 present",
    );
  });

  it("marks a roadie Present through the real mutation", async () => {
    const user = userEvent.setup();
    const actor = orientationActor(
      sessionView([orientationRow({ roadieId: 1n, name: "Ada Lovelace" })], 0n),
    );
    renderPageWithActor(OrientationPage, actor, { path: "/orientation" });

    const presentButton = await screen.findByTestId(
      "orientation.roadie.present_button.1",
    );
    await user.click(presentButton);

    await waitFor(() =>
      expect(actor.markPresent).toHaveBeenCalledWith(1n, 7n, null),
    );
  });

  it.each([Role.trainingManager, Role.visitingManager])(
    "lets a %s mark a roadie Present",
    async (role) => {
      const user = userEvent.setup();
      const actor = {
        ...orientationActor(
          sessionView(
            [orientationRow({ roadieId: 1n, name: "Ada Lovelace" })],
            0n,
          ),
        ),
        getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
          grant: { ...managerGrant(), role },
        })),
      };
      renderPageWithActor(OrientationPage, actor, { path: "/orientation" });

      const presentButton = await screen.findByTestId(
        "orientation.roadie.present_button.1",
      );
      expect(presentButton).toBeEnabled();
      await user.click(presentButton);

      await waitFor(() =>
        expect(actor.markPresent).toHaveBeenCalledWith(1n, 7n, null),
      );
    },
  );

  it("replaces Present with the paperwork warning and manager actions when paperwork is incomplete", async () => {
    renderPageWithActor(
      OrientationPage,
      orientationActor(
        sessionView(
          [
            orientationRow({
              roadieId: 1n,
              name: "Ada Lovelace",
              paperworkStatus: PaperworkStatus.incomplete,
            }),
          ],
          0n,
        ),
      ),
      { path: "/orientation" },
    );

    // The Present button is gone, replaced by the warning.
    expect(
      await screen.findByTestId("orientation.roadie.paperwork_warning.1"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("orientation.roadie.present_button.1"),
    ).not.toBeInTheDocument();
    // A manager sees the Archive and Override actions.
    expect(
      screen.getByTestId("orientation.roadie.archive_incomplete_button.1"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("orientation.roadie.override_button.1"),
    ).toBeInTheDocument();
  });

  it("shows a red No-Show tag for a pending roadie whose session has passed", async () => {
    renderPageWithActor(
      OrientationPage,
      orientationActor(
        sessionView(
          [
            orientationRow({
              roadieId: 1n,
              name: "Ada Lovelace",
              noShow: true,
            }),
          ],
          0n,
        ),
      ),
      { path: "/orientation" },
    );

    expect(
      await screen.findByTestId("orientation.roadie.no_show.1"),
    ).toHaveTextContent("No-Show");
  });

  it("filters the session list by the search query", async () => {
    const user = userEvent.setup();
    renderPageWithActor(
      OrientationPage,
      orientationActor(
        sessionView(
          [
            orientationRow({ roadieId: 1n, name: "Ada Lovelace" }),
            orientationRow({ roadieId: 2n, name: "Grace Hopper" }),
          ],
          0n,
        ),
      ),
      { path: "/orientation" },
    );

    await screen.findByText("Ada Lovelace");
    await user.type(screen.getByTestId("orientation.search_input"), "grace");

    await waitFor(() =>
      expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();
  });
});

/* ---------------------------------------------------------------------------
   Orientation Unassigned section
--------------------------------------------------------------------------- */

/** Two orientation session options, soonest first. */
function sessionOptions(): OrientationSessionOption[] {
  const now = Date.now();
  return [
    {
      eventId: 7n,
      name: "Orientation",
      start: BigInt(now + 2 * 24 * 60 * 60 * 1000) * 1_000_000n,
    },
    {
      eventId: 8n,
      name: "Makeup Orientation",
      start: BigInt(now + 5 * 24 * 60 * 60 * 1000) * 1_000_000n,
    },
  ];
}

function unassignedRow(
  overrides: Partial<UnassignedRoadieRow> = {},
): UnassignedRoadieRow {
  return {
    roadieId: 1n,
    name: "Ada Lovelace",
    positionId: 0n,
    positionName: "Servers",
    ...overrides,
  };
}

/** The Orientation page actor with an Unassigned list and session options. */
function unassignedActor(rows: UnassignedRoadieRow[]) {
  return {
    ...orientationActor(
      sessionView([orientationRow({ roadieId: 1n, name: "Ada Lovelace" })], 0n),
    ),
    listOrientationSessions: vi.fn<backendInterface["listOrientationSessions"]>(
      async () => sessionOptions(),
    ),
    listUnassignedPendingRoadies: vi.fn<
      backendInterface["listUnassignedPendingRoadies"]
    >(async () => rows),
  };
}

describe("Orientation Unassigned section", () => {
  it("lists pending roadies with no valid session and an Assign control", async () => {
    renderPageWithActor(
      OrientationPage,
      unassignedActor([
        unassignedRow({ roadieId: 1n, name: "Ada Lovelace" }),
        unassignedRow({ roadieId: 2n, name: "Grace Hopper" }),
      ]),
      { path: "/orientation" },
    );

    const section = await screen.findByTestId("orientation.unassigned.section");
    // Wait for the unassigned list to resolve before asserting its rows.
    await within(section).findByTestId("orientation.unassigned.list");
    expect(within(section).getByText("Ada Lovelace")).toBeInTheDocument();
    expect(within(section).getByText("Grace Hopper")).toBeInTheDocument();
    // Each row carries its own Assign control and session picker.
    expect(
      within(section).getByTestId("orientation.unassigned.assign_button.1"),
    ).toBeInTheDocument();
    expect(
      within(section).getByTestId("orientation.unassigned.assign_button.2"),
    ).toBeInTheDocument();
    // The Assign all control is present for a manager.
    expect(
      within(section).getByTestId("orientation.unassigned.assign_all_button"),
    ).toBeInTheDocument();
  });

  it("assigns one roadie to the next upcoming session by default", async () => {
    const user = userEvent.setup();
    const actor = unassignedActor([
      unassignedRow({ roadieId: 1n, name: "Ada Lovelace" }),
    ]);
    renderPageWithActor(OrientationPage, actor, { path: "/orientation" });

    await user.click(
      await screen.findByTestId("orientation.unassigned.assign_button.1"),
    );

    // The default target is the soonest upcoming session (event 7).
    await waitFor(() =>
      expect(actor.moveRoadieToSession).toHaveBeenCalledWith(1n, 7n),
    );
  });

  it("assigns every listed roadie through Assign all", async () => {
    const user = userEvent.setup();
    const actor = unassignedActor([
      unassignedRow({ roadieId: 1n, name: "Ada Lovelace" }),
      unassignedRow({ roadieId: 2n, name: "Grace Hopper" }),
    ]);
    renderPageWithActor(OrientationPage, actor, { path: "/orientation" });

    await user.click(
      await screen.findByTestId("orientation.unassigned.assign_all_button"),
    );

    await waitFor(() =>
      expect(actor.moveRoadieToSession).toHaveBeenCalledWith(1n, 7n),
    );
    expect(actor.moveRoadieToSession).toHaveBeenCalledWith(2n, 7n);
  });

  it("shows the empty state when every pending roadie has a session", async () => {
    renderPageWithActor(OrientationPage, unassignedActor([]), {
      path: "/orientation",
    });

    expect(
      await screen.findByTestId("orientation.unassigned.empty_state"),
    ).toBeInTheDocument();
  });
});

/** The actor the dashboard tree reads. */
function dashboardActor() {
  return {
    getDashboard: vi.fn<backendInterface["getDashboard"]>(async () => ({
      foh: [SERVERS],
      boh: [],
      hired: 5n,
      active: 3n,
      pending: 2n,
      stillNeeded: 60n,
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
        onHand: 5n,
        buildTo: 65n,
        openSpots: 60n,
        active: 3n,
        pending: 2n,
      },
    ]),
    listRoadies: vi.fn<backendInterface["listRoadies"]>(async () => []),
    listAlerts: vi.fn<backendInterface["listAlerts"]>(async () => []),
    getChecklists: vi.fn<backendInterface["getChecklists"]>(async () => ({
      paperwork: [],
      orientationUniform: [],
    })),
    listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
      SERVERS,
    ]),
  };
}

describe("Dashboard Pending and Active counts", () => {
  it("shows Pending and Active tiles and the Hired to Active funnel", async () => {
    renderPageWithActor(DashboardPage, dashboardActor(), {
      path: "/dashboard",
    });

    expect(await screen.findByTestId("dashboard.kpi.active")).toHaveTextContent(
      "3",
    );
    expect(screen.getByTestId("dashboard.kpi.pending")).toHaveTextContent("2");

    const funnel = screen.getByTestId("dashboard.funnel");
    expect(
      within(funnel).getByTestId("dashboard.funnel.hired"),
    ).toHaveTextContent("5");
    expect(
      within(funnel).getByTestId("dashboard.funnel.active"),
    ).toHaveTextContent("3");
  });

  it("shows both Pending and Active counts on a position row", async () => {
    renderPageWithActor(DashboardPage, dashboardActor(), {
      path: "/dashboard",
    });

    const counts = await screen.findByTestId("dashboard.position.counts");
    expect(counts).toHaveTextContent("3");
    expect(counts).toHaveTextContent("2");
  });
});

/** A uniform check-off view with a count item and a checkbox item. */
function uniformView(locked: boolean): UniformCheckoffView {
  return {
    roadieId: 1n,
    locked,
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

describe("Uniform check-off", () => {
  it("locks the check-off until paperwork is complete", async () => {
    const user = userEvent.setup();
    const actor = {
      ...orientationActor(
        sessionView(
          [orientationRow({ roadieId: 1n, name: "Ada Lovelace" })],
          0n,
        ),
      ),
      getUniformCheckoff: vi.fn<backendInterface["getUniformCheckoff"]>(
        async () => uniformView(true),
      ),
    };
    renderPageWithActor(OrientationPage, actor, { path: "/orientation" });

    await user.click(
      await screen.findByTestId("orientation.roadie.open_button.1"),
    );

    expect(
      await screen.findByTestId("orientation.uniform.locked_note"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("orientation.uniform.save_button"),
    ).toBeDisabled();
  });

  it("pre-fills the shirt count from the position default and saves the check-off", async () => {
    const user = userEvent.setup();
    const actor = {
      ...orientationActor(
        sessionView(
          [orientationRow({ roadieId: 1n, name: "Ada Lovelace" })],
          0n,
        ),
      ),
      getUniformCheckoff: vi.fn<backendInterface["getUniformCheckoff"]>(
        async () => uniformView(false),
      ),
      saveUniformCheckoff: vi.fn<backendInterface["saveUniformCheckoff"]>(
        async () => undefined,
      ),
    };
    renderPageWithActor(OrientationPage, actor, { path: "/orientation" });

    await user.click(
      await screen.findByTestId("orientation.roadie.open_button.1"),
    );

    // The count item is pre-filled from the position default (3 shirts).
    const countInput = await screen.findByTestId(
      "orientation.uniform.count_input.1",
    );
    expect(countInput).toHaveValue(3);

    await user.click(screen.getByTestId("orientation.uniform.save_button"));

    await waitFor(() =>
      expect(actor.saveUniformCheckoff).toHaveBeenCalledTimes(1),
    );
    const saved = actor.saveUniformCheckoff.mock.calls[0][0];
    expect(saved).toBe(1n);
    // The save writes only the uniform fields; the count item carries its
    // pre-filled count and the checkbox item is not checked.
    expect(actor.saveUniformCheckoff.mock.calls[0][1]).toEqual([]);
    expect(actor.saveUniformCheckoff.mock.calls[0][2]).toEqual([[1n, 3n]]);
  });
});

/* ---------------------------------------------------------------------------
   Manager tab paperwork checklist
--------------------------------------------------------------------------- */

const PAPERWORK_ITEMS: ChecklistItem[] = [
  {
    id: 1n,
    text: "I-9 form",
    minorOnly: false,
    requiresAlcoholCert: false,
    itemType: UniformItemType.checkbox,
  },
  {
    id: 3n,
    text: "Alcohol certificate",
    minorOnly: false,
    requiresAlcoholCert: true,
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

function checkoff(paperworkItems: string[]): OrientationCheckoff {
  return {
    roadieId: 1n,
    paperworkItems,
    uniformItems: [],
    uniformCounts: [],
    shirtsCount: 0n,
    hatsCount: 0n,
    updatedAt: 0n,
    isDemo: false,
  };
}

/** The actor the roadie card's manager tab reads. */
function managerTabActor(
  role: Role,
  roadie: Roadie,
  stored: OrientationCheckoff | null,
) {
  return {
    getRoadie: vi.fn<backendInterface["getRoadie"]>(async () => roadie),
    listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
      SERVERS,
    ]),
    listCrews: vi.fn<backendInterface["listCrews"]>(async () => []),
    isMinor: vi.fn<backendInterface["isMinor"]>(async () => roadie.isMinor),
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: { ...managerGrant(), role },
    })),
    getContactSet: vi.fn<backendInterface["getContactSet"]>(async () => [
      MANAGER_CONTACT,
    ]),
    getChecklists: vi.fn<backendInterface["getChecklists"]>(async () => ({
      paperwork: PAPERWORK_ITEMS,
      orientationUniform: [],
    })),
    getOrientationCheckoff: vi.fn<backendInterface["getOrientationCheckoff"]>(
      async () => stored,
    ),
    setPaperworkItems: vi.fn<backendInterface["setPaperworkItems"]>(
      async () => undefined,
    ),
    listChangeLog: vi.fn<backendInterface["listChangeLog"]>(async () => []),
    listOrientationSessions: vi.fn<backendInterface["listOrientationSessions"]>(
      async () => sessionOptions(),
    ),
    moveRoadieToSession: vi.fn<backendInterface["moveRoadieToSession"]>(
      async () => undefined,
    ),
  };
}

async function openManagerTab() {
  const user = userEvent.setup();
  await user.click(await screen.findByTestId("roadie.manager.tab"));
  return user;
}

describe("Manager tab paperwork checklist", () => {
  it("shows each applicable item's checked state and reports Paperwork n of m", async () => {
    renderPageWithActor(
      RoadieCardPage,
      managerTabActor(Role.storeManager, managerRoadie(), checkoff(["1"])),
      { path: "/roster/$roadieId", initialEntry: "/roster/1" },
    );

    await openManagerTab();

    const section = await screen.findByTestId("roadie.manager.paperwork");
    // The alcohol item applies (Servers needs an alcohol cert) and the minor
    // item does not (the roadie is not a minor), so two items are applicable.
    expect(within(section).getByText("I-9 form")).toBeInTheDocument();
    expect(
      within(section).getByText("Alcohol certificate"),
    ).toBeInTheDocument();
    expect(
      within(section).queryByText(
        "LA employment certificate (LWC confirmation received)",
      ),
    ).not.toBeInTheDocument();

    // The stored item is checked; the other is not.
    const boxes = within(section).getAllByTestId("roadie.paperwork.checkbox");
    expect(boxes).toHaveLength(2);
    expect(boxes[0]).toBeChecked();
    expect(boxes[1]).not.toBeChecked();

    // The progress line counts the checked applicable items.
    expect(
      within(section).getByTestId("roadie.paperwork.progress"),
    ).toHaveTextContent("Paperwork 1 of 2");
    // Not complete yet, so no Complete badge.
    expect(
      within(section).queryByTestId("roadie.paperwork.complete"),
    ).not.toBeInTheDocument();
  });

  it("toggles an item through setPaperworkItems and shows the Complete badge", async () => {
    const actor = managerTabActor(
      Role.storeManager,
      managerRoadie(),
      checkoff(["1"]),
    );
    renderPageWithActor(RoadieCardPage, actor, {
      path: "/roster/$roadieId",
      initialEntry: "/roster/1",
    });

    const user = await openManagerTab();

    const section = await screen.findByTestId("roadie.manager.paperwork");
    const boxes = within(section).getAllByTestId("roadie.paperwork.checkbox");
    // Check the second applicable item.
    await user.click(boxes[1]);

    await waitFor(() =>
      expect(actor.setPaperworkItems).toHaveBeenCalledWith(1n, ["1", "3"]),
    );
  });

  it("shows the Complete badge when every applicable item is checked", async () => {
    renderPageWithActor(
      RoadieCardPage,
      managerTabActor(Role.storeManager, managerRoadie(), checkoff(["1", "3"])),
      { path: "/roster/$roadieId", initialEntry: "/roster/1" },
    );

    await openManagerTab();

    const section = await screen.findByTestId("roadie.manager.paperwork");
    expect(
      within(section).getByTestId("roadie.paperwork.progress"),
    ).toHaveTextContent("Paperwork 2 of 2");
    expect(
      within(section).getByTestId("roadie.paperwork.complete"),
    ).toBeInTheDocument();
  });

  it("hides the Manager tab from a role that may not edit paperwork", async () => {
    renderPageWithActor(
      RoadieCardPage,
      managerTabActor(Role.trainingManager, managerRoadie(), checkoff([])),
      { path: "/roster/$roadieId", initialEntry: "/roster/1" },
    );

    // The card renders, but a Training Manager has no Manager tab and so no
    // paperwork checkboxes to toggle.
    expect(await screen.findByTestId("roadie.card.tab")).toBeInTheDocument();
    expect(screen.queryByTestId("roadie.manager.tab")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("roadie.paperwork.checkbox"),
    ).not.toBeInTheDocument();
  });
});

describe("Manager tab orientation session", () => {
  it("shows the roadie's current session and moves them through Change", async () => {
    const user = userEvent.setup();
    const actor = managerTabActor(
      Role.storeManager,
      managerRoadie({ orientationEventId: 7n }),
      checkoff([]),
    );
    renderPageWithActor(RoadieCardPage, actor, {
      path: "/roster/$roadieId",
      initialEntry: "/roster/1",
    });

    await openManagerTab();

    const section = await screen.findByTestId("roadie.manager.orientation");
    // The current session name is shown.
    expect(within(section).getByText("Orientation")).toBeInTheDocument();

    await user.click(
      within(section).getByTestId("roadie.orientation.change_button"),
    );
    // The roadie's own session is not offered as a target.
    await user.click(
      await screen.findByTestId("roadie.orientation.session_select"),
    );
    await user.click(
      await screen.findByRole("option", { name: /Makeup Orientation/ }),
    );
    await user.click(screen.getByTestId("roadie.orientation.confirm_button"));

    await waitFor(() =>
      expect(actor.moveRoadieToSession).toHaveBeenCalledWith(1n, 8n),
    );
  });

  it("shows the No session state when the roadie has no valid session", async () => {
    renderPageWithActor(
      RoadieCardPage,
      managerTabActor(Role.storeManager, managerRoadie(), checkoff([])),
      { path: "/roster/$roadieId", initialEntry: "/roster/1" },
    );

    await openManagerTab();

    const section = await screen.findByTestId("roadie.manager.orientation");
    expect(
      within(section).getByTestId("roadie.orientation.no_session"),
    ).toBeInTheDocument();
  });
});

describe("Override dialog sends the reason with markPresent", () => {
  it("calls markPresent with the trimmed override reason", async () => {
    const user = userEvent.setup();
    const actor = orientationActor(
      sessionView(
        [
          orientationRow({
            roadieId: 1n,
            name: "Ada Lovelace",
            paperworkStatus: PaperworkStatus.incomplete,
          }),
        ],
        0n,
      ),
    );
    renderPageWithActor(OrientationPage, actor, { path: "/orientation" });

    await user.click(
      await screen.findByTestId("orientation.roadie.override_button.1"),
    );
    await user.type(
      await screen.findByTestId("orientation.override.reason_input"),
      "  Paperwork on file at the store  ",
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
