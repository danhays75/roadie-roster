import { renderPageWithActor, t } from "@/__tests__/router-test-utils";
import type {
  DemoStateView,
  Position,
  RosterSummary,
  ScheduleEvent,
  StoreInfo,
  backendInterface,
} from "@/backend";
import { DemoShift, EventKind, House } from "@/backend";
import DashboardPage from "@/pages/Dashboard";
import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Cover for the accepted Dashboard summary rework: one hiring progress bar
 * reading "Hired X of Y", always-shown HIRED and STILL NEEDED tiles, a SHOWED
 * UP tile gated on the orientation window, a CERTIFIED tile gated on the final
 * sign-off date, and one-line per-position rows. The window dates come from the
 * schedule and the store's paperwork due date, and follow the demo "Pretend
 * it's" date. The actor is a typed local mock; no live backend is exercised.
 */

const CASHIER: Position = {
  id: 10n,
  name: "Cashier",
  code: "CSH",
  house: House.foh,
  openingBuildTo: 4n,
  afterOpeningBuildTo: 2n,
  minimumAge: 16n,
  needsAlcoholCert: false,
  shirtType: "Polo",
  shirtQty: 2n,
  hatType: "Cap",
  hatQty: 1n,
  defaultShirts: 2n,
  defaultHats: 1n,
};

/** A fixed "now" the tests place relative to the schedule dates. */
const NOW = Date.UTC(2026, 0, 15, 12, 0, 0);
const DAY = 86_400_000;

/** A DateOnly (UTC midnight nanoseconds) for a day offset from NOW. */
function dateOnly(offsetDays: number): bigint {
  const day = new Date(NOW + offsetDays * DAY);
  return (
    BigInt(
      Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()),
    ) * 1_000_000n
  );
}

/** A DateTime (nanoseconds) for an instant offset from NOW. */
function dateTime(offsetDays: number): bigint {
  return BigInt(NOW + offsetDays * DAY) * 1_000_000n;
}

function storeInfo(overrides: Partial<StoreInfo> = {}): StoreInfo {
  return {
    storeNumber: "975",
    appName: "Roadie Roster",
    locationName: "Bubba's 33",
    address: "1 Main St",
    storePhone: "+1-555-0100",
    timeZone: "America/Chicago",
    openingDate: dateOnly(30),
    amShiftStart: 600n,
    amShiftEnd: 900n,
    pmShiftStart: 960n,
    pmShiftEnd: 1320n,
    trainingGroupSize: 4n,
    leaderTalkName: "Leader talk",
    leaderTalkSize: 4n,
    ...overrides,
  };
}

function scheduleEvent(
  kind: EventKind,
  offsetDays: number,
  id: bigint,
): ScheduleEvent {
  return {
    id,
    kind,
    name: kind,
    start: dateTime(offsetDays),
  };
}

/**
 * The schedule's "Paperwork due" deadline event, the single source of the
 * paperwork due date. The orientation window opens on this event's start.
 */
function paperworkDueEvent(offsetDays: number, id: bigint): ScheduleEvent {
  return {
    id,
    kind: EventKind.deadline,
    name: "Paperwork due",
    start: dateTime(offsetDays),
  };
}

function demoState(overrides: Partial<DemoStateView> = {}): DemoStateView {
  return {
    enabled: false,
    demoRole: undefined,
    demoTrainerStations: [],
    pretendDate: undefined,
    turnedOnAt: undefined,
    autoOffAt: undefined,
    ...overrides,
  };
}

/** The actor methods the dashboard tree reads. */
function baseActor(
  options: {
    schedule?: ScheduleEvent[];
    store?: StoreInfo;
    demo?: DemoStateView;
    summary?: RosterSummary[];
  } = {},
) {
  return {
    getDashboard: vi.fn<backendInterface["getDashboard"]>(async () => ({
      foh: [CASHIER],
      boh: [],
      hired: 3n,
      active: 2n,
      pending: 1n,
      certified: 1n,
      stillNeeded: 1n,
      buildToTotal: 4n,
    })),
    listSchedule: vi.fn<backendInterface["listSchedule"]>(
      async () => options.schedule ?? [],
    ),
    getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(
      async () => options.store ?? storeInfo(),
    ),
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: undefined,
    })),
    listRosterForPosition: vi.fn<backendInterface["listRosterForPosition"]>(
      async () => [],
    ),
    getRosterSummary: vi.fn<backendInterface["getRosterSummary"]>(
      async () =>
        options.summary ?? [
          {
            positionId: 10n,
            positionName: "Cashier",
            onHand: 3n,
            buildTo: 4n,
            openSpots: 1n,
            active: 2n,
            pending: 1n,
          },
        ],
    ),
    listRoadies: vi.fn<backendInterface["listRoadies"]>(async () => []),
    listAlerts: vi.fn<backendInterface["listAlerts"]>(async () => []),
    getChecklists: vi.fn<backendInterface["getChecklists"]>(async () => ({
      paperwork: [],
      orientationUniform: [],
    })),
    getDemoState: vi.fn<backendInterface["getDemoState"]>(
      async () => options.demo ?? demoState(),
    ),
  };
}

/** Freeze the clock at NOW so the orientation window is deterministic. */
function freezeNow() {
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  vi.setSystemTime(NOW);
}

afterEach(() => {
  vi.useRealTimers();
});

describe("DashboardPage states", () => {
  it("renders the dashboard shell on the default route without a blank screen", async () => {
    freezeNow();
    renderPageWithActor(DashboardPage, baseActor(), { path: "/" });

    expect(await screen.findByTestId("dashboard.page")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: t("dashboard.title") }),
    ).toBeInTheDocument();
  });

  it("shows the empty state when no positions are configured", async () => {
    freezeNow();
    const actor = baseActor();
    actor.getDashboard = vi.fn<backendInterface["getDashboard"]>(async () => ({
      foh: [],
      boh: [],
      hired: 0n,
      active: 0n,
      pending: 0n,
      certified: 0n,
      stillNeeded: 0n,
      buildToTotal: 0n,
    }));

    renderPageWithActor(DashboardPage, actor, { path: "/dashboard" });

    expect(await screen.findByText(t("dashboard.empty"))).toBeInTheDocument();
  });

  it("shows the error state when the dashboard read fails", async () => {
    freezeNow();
    const actor = baseActor();
    actor.getDashboard = vi.fn<backendInterface["getDashboard"]>(async () => {
      throw new Error("boom");
    });

    renderPageWithActor(DashboardPage, actor, { path: "/dashboard" });

    expect(await screen.findByTestId("page.error_state")).toBeInTheDocument();
    expect(screen.getByText(t("dashboard.error"))).toBeInTheDocument();
  });
});

describe("Dashboard hiring summary", () => {
  it("shows exactly one hiring progress bar reading Hired X of Y", async () => {
    freezeNow();
    renderPageWithActor(DashboardPage, baseActor(), { path: "/dashboard" });

    const progress = await screen.findByTestId("dashboard.progress");
    expect(within(progress).getByText("Hired 3 of 4")).toBeInTheDocument();

    const bars = screen.getAllByRole("progressbar");
    // One summary bar plus the per-position bar.
    expect(bars).toHaveLength(2);
    expect(progress.querySelector('[role="progressbar"]')).toHaveAttribute(
      "aria-valuenow",
      "75",
    );
  });

  it("always shows HIRED and STILL NEEDED, and no removed tiles", async () => {
    freezeNow();
    renderPageWithActor(DashboardPage, baseActor(), { path: "/dashboard" });

    const hired = await screen.findByTestId("dashboard.kpi.hired");
    expect(hired).toHaveTextContent("3");

    const stillNeeded = screen.getByTestId("dashboard.kpi.still_needed");
    expect(stillNeeded).toHaveTextContent("1");
    expect(stillNeeded).toHaveTextContent("to reach 4");

    // The removed tiles and the top-bar legend are gone.
    expect(
      screen.queryByTestId("dashboard.kpi.pending"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("dashboard.kpi.showed_at_orientation"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("dashboard.kpi.build_to_total"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("dashboard.funnel")).not.toBeInTheDocument();
  });

  it("hides SHOWED UP before the paperwork due date", async () => {
    freezeNow();
    // The window opens on the paperwork due date, five days from now.
    const actor = baseActor({
      schedule: [paperworkDueEvent(5, 1n)],
    });
    renderPageWithActor(DashboardPage, actor, { path: "/dashboard" });

    await screen.findByTestId("dashboard.kpi.hired");
    expect(
      screen.queryByTestId("dashboard.kpi.showed_up"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("dashboard.kpi.certified"),
    ).not.toBeInTheDocument();
  });

  it("shows SHOWED UP as active of hired during the orientation window", async () => {
    freezeNow();
    // Due five days ago, orientation tomorrow, sign-off in ten days.
    const actor = baseActor({
      schedule: [
        paperworkDueEvent(-5, 3n),
        scheduleEvent(EventKind.orientation, 1, 1n),
        scheduleEvent(EventKind.signOff, 10, 2n),
      ],
    });
    renderPageWithActor(DashboardPage, actor, { path: "/dashboard" });

    const showedUp = await screen.findByTestId("dashboard.kpi.showed_up");
    expect(showedUp).toHaveTextContent("2 of 3");
    // Before the orientation date there is no no-shows link yet.
    expect(
      screen.queryByTestId("dashboard.kpi.showed_up.link"),
    ).not.toBeInTheDocument();
    // The HIRED tile carries the showed-up/waiting split during the window.
    expect(screen.getByTestId("dashboard.kpi.hired.detail")).toHaveTextContent(
      "2 showed up · 1 waiting",
    );
  });

  it("shows the no-shows link after the orientation date", async () => {
    freezeNow();
    const actor = baseActor({
      schedule: [
        paperworkDueEvent(-5, 3n),
        scheduleEvent(EventKind.orientation, -1, 1n),
        scheduleEvent(EventKind.signOff, 10, 2n),
      ],
    });
    renderPageWithActor(DashboardPage, actor, { path: "/dashboard" });

    const link = await screen.findByTestId("dashboard.kpi.showed_up.link");
    expect(link).toHaveTextContent("1 no-shows");
    expect(link).toHaveAttribute("href", "/orientation");
  });

  it("hides CERTIFIED before the final sign-off date and shows it after", async () => {
    freezeNow();
    const before = baseActor({
      schedule: [
        paperworkDueEvent(-5, 3n),
        scheduleEvent(EventKind.orientation, -1, 1n),
        scheduleEvent(EventKind.signOff, 10, 2n),
      ],
    });
    const { unmount } = renderPageWithActor(DashboardPage, before, {
      path: "/dashboard",
    });
    await screen.findByTestId("dashboard.kpi.showed_up");
    expect(
      screen.queryByTestId("dashboard.kpi.certified"),
    ).not.toBeInTheDocument();
    unmount();

    const after = baseActor({
      schedule: [
        paperworkDueEvent(-5, 3n),
        scheduleEvent(EventKind.orientation, -1, 1n),
        scheduleEvent(EventKind.signOff, -1, 2n),
      ],
    });
    renderPageWithActor(DashboardPage, after, { path: "/dashboard" });

    const certified = await screen.findByTestId("dashboard.kpi.certified");
    expect(certified).toHaveTextContent("1 of 3 certified");
  });
});

describe("Dashboard per-position rows", () => {
  it("shows one hired/need line with the NEEDED badge and no split outside the window", async () => {
    freezeNow();
    const actor = baseActor({
      schedule: [paperworkDueEvent(5, 1n)],
    });
    renderPageWithActor(DashboardPage, actor, { path: "/dashboard" });

    const row = await screen.findByTestId("dashboard.position.item");
    expect(row).toHaveTextContent("3 hired · need 1");
    expect(screen.getByTestId("dashboard.position.needed")).toHaveTextContent(
      "1 needed",
    );
    expect(
      screen.queryByTestId("dashboard.position.counts"),
    ).not.toBeInTheDocument();
  });

  it("shows the pending/active split only during the orientation window", async () => {
    freezeNow();
    const actor = baseActor({
      schedule: [
        paperworkDueEvent(-5, 3n),
        scheduleEvent(EventKind.orientation, 1, 1n),
        scheduleEvent(EventKind.signOff, 10, 2n),
      ],
    });
    renderPageWithActor(DashboardPage, actor, { path: "/dashboard" });

    const counts = await screen.findByTestId("dashboard.position.counts");
    expect(counts).toHaveTextContent("2 active");
    expect(counts).toHaveTextContent("1 pending");
  });
});

describe("Dashboard demo pretend date", () => {
  it("opens the SHOWED UP tile when the pretend date is inside the window", async () => {
    freezeNow();
    // Real now is before the window; the pretend date is inside it.
    const actor = baseActor({
      schedule: [
        paperworkDueEvent(5, 3n),
        scheduleEvent(EventKind.orientation, 6, 1n),
        scheduleEvent(EventKind.signOff, 7, 2n),
      ],
      demo: demoState({
        enabled: true,
        pretendDate: { day: dateOnly(6), shift: DemoShift.pm },
      }),
    });
    renderPageWithActor(DashboardPage, actor, { path: "/dashboard" });

    expect(
      await screen.findByTestId("dashboard.kpi.showed_up"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("dashboard.kpi.certified"),
    ).not.toBeInTheDocument();
  });

  it("shows the CERTIFIED tile when the pretend date is after sign-off", async () => {
    freezeNow();
    const actor = baseActor({
      schedule: [
        paperworkDueEvent(5, 3n),
        scheduleEvent(EventKind.orientation, 6, 1n),
        scheduleEvent(EventKind.signOff, 7, 2n),
      ],
      demo: demoState({
        enabled: true,
        pretendDate: { day: dateOnly(10), shift: DemoShift.pm },
      }),
    });
    renderPageWithActor(DashboardPage, actor, { path: "/dashboard" });

    expect(
      await screen.findByTestId("dashboard.kpi.certified"),
    ).toBeInTheDocument();
  });
});

describe("Dashboard preserved surfaces", () => {
  it("still renders the countdown card and the opening timeline", async () => {
    freezeNow();
    const actor = baseActor({
      schedule: [scheduleEvent(EventKind.openingDay, 30, 1n)],
    });
    renderPageWithActor(DashboardPage, actor, { path: "/dashboard" });

    expect(
      await screen.findByTestId("dashboard.countdown.card"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("dashboard.countdown.timer")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard.timeline.region")).toBeInTheDocument();
  });
});
