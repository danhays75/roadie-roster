import { renderPageWithActor } from "@/__tests__/router-test-utils";
import type {
  AccessGrant,
  OrientationRoadieRow,
  OrientationSessionView,
  Position,
  Roadie,
  ScheduleEvent,
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
import DashboardPage from "@/pages/Dashboard";
import OrientationPage from "@/pages/Orientation";
import RosterPage from "@/pages/Roster";
import type { Principal } from "@icp-sdk/core/principal";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

/**
 * Cover for the orientation / roster-state request. These journeys exercise the
 * accepted observable behavior through the real page components with a typed
 * local actor mock:
 *   - the Roster page's Pending and Active tabs partition non-archived roadies,
 *   - the Orientation screen lists a session's roadies with Present x / y and
 *     marks a roadie Present through the real mutation,
 *   - incomplete paperwork replaces Present with the warning, Archive and
 *     Override actions,
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
  defaultShirts: 3n,
  defaultHats: 2n,
  needsAlcoholCert: true,
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

describe("Roster page Pending and Active tabs", () => {
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

    // The Active tab is selected by default, so only the active roadie shows.
    expect(await screen.findByText("Active Alex")).toBeInTheDocument();
    expect(screen.queryByText("Pending Pat")).not.toBeInTheDocument();

    const pendingTab = await screen.findByTestId("roster.filter.pending.tab");
    await user.click(pendingTab);

    expect(await screen.findByText("Pending Pat")).toBeInTheDocument();
    expect(screen.queryByText("Active Alex")).not.toBeInTheDocument();
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

    await waitFor(() => expect(actor.markPresent).toHaveBeenCalledWith(1n, 7n));
  });

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
    expect(saved.roadieId).toBe(1n);
    expect(saved.shirtsCount).toBe(3n);
  });
});
