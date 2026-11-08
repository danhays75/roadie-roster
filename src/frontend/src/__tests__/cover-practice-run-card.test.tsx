import { renderPageWithActor, t } from "@/__tests__/router-test-utils";
import { renderWithActor } from "@/__tests__/test-utils";
import type {
  AbsentAlertView,
  AccessGrant,
  CheckInBoardView,
  Crew,
  DemoDataSummary,
  DemoStateView,
  Roadie,
  ScheduleEvent,
  ShiftBoardView,
  backendInterface,
} from "@/backend";
import {
  DemoRole,
  DemoShift,
  EventKind,
  RoadieStage,
  Role,
  RosterState,
  Shift,
} from "@/backend";
import { PracticeRunCard } from "@/components/demo/PracticeRunCard";
import { I18nContext, translate } from "@/hooks/useI18n";
import { DEMO_DATA_LOADED_KEY } from "@/hooks/useQueries";
import type { Locale } from "@/lib/copy";
import RosterPage from "@/pages/Roster";
import TodayPage from "@/pages/Today";
import type { Principal } from "@icp-sdk/core/principal";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

/**
 * Cover for the accepted demo-mode "Practice run" card: it appears at the top
 * of Today only for the real Admin while demo mode is on, shows a progress line
 * and a Hide link, derives each step's done state from demo data, and its
 * "Take me there" buttons drive the existing demo setters before navigating.
 * The actor is a typed local mock; no live backend or identity is exercised.
 */

const PRINCIPAL = { toText: () => "aaaaa-aa" } as unknown as Principal;

/** A non-null wrapper so the card can be mounted inside a real router. */
function PracticeRunPage() {
  return <PracticeRunCard />;
}

function principal(text: string): Principal {
  return {
    toText: () => text,
    toString: () => text,
  } as unknown as Principal;
}

function grant(role: Role): AccessGrant {
  return {
    principal: PRINCIPAL,
    role,
    approvedAt: 0n,
    approvedBy: PRINCIPAL,
    trainerPositionIds: [],
  };
}

function demoState(overrides: Partial<DemoStateView> = {}): DemoStateView {
  return {
    enabled: false,
    demoRole: DemoRole.admin,
    demoTrainerStations: [],
    pretendDate: undefined,
    turnedOnAt: undefined,
    autoOffAt: undefined,
    ...overrides,
  };
}

const okResult = (state: DemoStateView) =>
  ({ __kind__: "ok" as const, ok: state }) as const;

function summary(overrides: Partial<DemoDataSummary> = {}): DemoDataSummary {
  return {
    roadies: 0n,
    leaders: 0n,
    // The seed baseline is 3 pending sign-ups, so step 1 starts not-done.
    signups: 3n,
    crews: 0n,
    attendance: 0n,
    notes: 0n,
    ...overrides,
  };
}

/** A demo roadie at the given stage, with the fields the card reads. */
function roadie(id: bigint, stage: RoadieStage, crewId?: bigint): Roadie {
  return {
    id,
    status: "active" as Roadie["status"],
    mainPositionId: 1n,
    isDemo: true,
    rosterState: RosterState.active,
    isMinor: false,
    hiredAt: 0n,
    stage,
    crewId,
    profile: { name: `Roadie ${id} Demo` },
  };
}

/** The demo Orientation and Training Day 1 events the card reads. */
function schedule(): ScheduleEvent[] {
  return [
    {
      id: 10n,
      kind: EventKind.orientation,
      name: "Orientation",
      start: 1_800_000_000_000_000_000n,
    },
    {
      id: 20n,
      kind: EventKind.trainingDay,
      name: "Training Day 1",
      start: 1_800_100_000_000_000_000n,
    },
  ];
}

function emptyBoard(eventId: bigint): ShiftBoardView {
  return {
    eventId,
    shift: Shift.am,
    groups: [],
    unassigned: [],
    offThisShift: [],
    isDemo: true,
    editedAt: 0n,
  };
}

function emptyCheckIn(eventId: bigint): CheckInBoardView {
  return {
    eventId,
    shift: Shift.am,
    roadies: [],
    checkedInCount: 0n,
    totalCount: 0n,
    locked: false,
    shiftLabel: "AM",
  };
}

/**
 * The actor methods the practice card reads. Every read resolves to an empty
 * demo set by default, so the card starts at step 1 with nothing done.
 */
function cardActor(
  overrides: {
    role?: Role;
    state?: DemoStateView;
    summary?: DemoDataSummary;
    roadies?: Roadie[];
    schedule?: ScheduleEvent[];
    crews?: Crew[];
    alerts?: AbsentAlertView[];
    board?: ShiftBoardView | null;
    checkIn?: CheckInBoardView | null;
  } = {},
) {
  const state = overrides.state ?? demoState({ enabled: true });
  const events = overrides.schedule ?? schedule();
  const trainingDay = events.find((e) => e.kind === EventKind.trainingDay);
  return {
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: grant(overrides.role ?? Role.admin),
    })),
    getDemoState: vi.fn<backendInterface["getDemoState"]>(async () => state),
    getDemoDataSummary: vi.fn<backendInterface["getDemoDataSummary"]>(
      async () => overrides.summary ?? summary(),
    ),
    listRoadies: vi.fn<backendInterface["listRoadies"]>(
      async () => overrides.roadies ?? [],
    ),
    listSchedule: vi.fn<backendInterface["listSchedule"]>(async () => events),
    listCrews: vi.fn<backendInterface["listCrews"]>(
      async () => overrides.crews ?? [],
    ),
    listAbsentAlerts: vi.fn<backendInterface["listAbsentAlerts"]>(
      async () => overrides.alerts ?? [],
    ),
    getShiftBoard: vi.fn<backendInterface["getShiftBoard"]>(async () =>
      overrides.board === undefined
        ? trainingDay
          ? emptyBoard(trainingDay.id)
          : null
        : overrides.board,
    ),
    getCheckInBoard: vi.fn<backendInterface["getCheckInBoard"]>(async () =>
      overrides.checkIn === undefined
        ? trainingDay
          ? emptyCheckIn(trainingDay.id)
          : null
        : overrides.checkIn,
    ),
    setDemoRole: vi.fn<backendInterface["setDemoRole"]>(async () =>
      okResult(state),
    ),
    setDemoTrainerAs: vi.fn<backendInterface["setDemoTrainerAs"]>(async () =>
      okResult(state),
    ),
    setDemoManagerAs: vi.fn<backendInterface["setDemoManagerAs"]>(async () =>
      okResult(state),
    ),
    setPretendDate: vi.fn<backendInterface["setPretendDate"]>(async () =>
      okResult(state),
    ),
  };
}

describe("Practice run card visibility", () => {
  it("appears at the top of Today for the real Admin while demo mode is on", async () => {
    const actor = cardActor();
    renderPageWithActor(TodayPage, actor, { path: "/today" });

    const card = await screen.findByTestId("today.practice.card");
    expect(card).toBeInTheDocument();
    // The card is the first section inside the Today page container.
    const page = screen.getByTestId("today.page");
    expect(page.firstElementChild?.nextElementSibling).toBe(card);
  });

  it("is not shown when demo mode is off", async () => {
    const actor = cardActor({ state: demoState({ enabled: false }) });
    renderPageWithActor(TodayPage, actor, { path: "/today" });

    // The manager Today content still renders, but no practice card appears.
    await screen.findByTestId("today.page");
    await waitFor(() =>
      expect(
        screen.queryByTestId("today.practice.card"),
      ).not.toBeInTheDocument(),
    );
  });

  it("is not shown to a non-Admin real user even while demo mode is on", async () => {
    const actor = cardActor({ role: Role.storeManager });
    renderPageWithActor(TodayPage, actor, { path: "/today" });

    await screen.findByTestId("today.page");
    await waitFor(() =>
      expect(
        screen.queryByTestId("today.practice.card"),
      ).not.toBeInTheDocument(),
    );
  });

  it("is shown to the real Admin regardless of the current View as role", async () => {
    const actor = cardActor({
      state: demoState({ enabled: true, demoRole: DemoRole.kiosk }),
    });
    renderPageWithActor(TodayPage, actor, { path: "/today" });

    expect(
      await screen.findByTestId("today.practice.card"),
    ).toBeInTheDocument();
  });
});

describe("Practice run card content", () => {
  it("shows the progress line, Hide link and every step row", async () => {
    const actor = cardActor();
    renderPageWithActor(PracticeRunPage, actor, { path: "/today" });

    const card = await screen.findByTestId("today.practice.card");
    expect(card).toHaveTextContent(t("today.practice.title"));
    expect(screen.getByTestId("today.practice.progress")).toHaveTextContent(
      "Step 1 of 6",
    );
    expect(screen.getByTestId("today.practice.hide_button")).toHaveTextContent(
      "Hide",
    );

    for (let step = 1; step <= 6; step += 1) {
      const row = screen.getByTestId(`today.practice.step.${step}`);
      expect(row).toHaveTextContent(t(`today.practice.step${step}.title`));
      expect(row).toHaveTextContent(t(`today.practice.step${step}.body`));
      expect(
        screen.getByTestId(`today.practice.step.${step}.take_me_there_button`),
      ).toHaveTextContent("Take me there");
    }
  });

  it("hides the card for the session when Hide is clicked", async () => {
    const user = userEvent.setup();
    const actor = cardActor();
    renderPageWithActor(PracticeRunPage, actor, { path: "/today" });

    await user.click(await screen.findByTestId("today.practice.hide_button"));
    await waitFor(() =>
      expect(
        screen.queryByTestId("today.practice.card"),
      ).not.toBeInTheDocument(),
    );
  });

  it("shows the completion message once every step is done", async () => {
    // Step 1 done: fewer pending sign-ups than the seed baseline.
    // Step 2 done: more roadies at Paperwork Done than the seed baseline.
    // Step 3 done: at least 10 roadies Oriented.
    // Step 4 done: a board group with at least one roadie.
    // Step 5 done: every roadie in the first trainer's group is checked in.
    // Step 6 done: an absent alert is excused.
    const trainer = principal("ttttt-tt");
    const roadies: Roadie[] = [
      ...Array.from({ length: 19 }, (_, i) =>
        roadie(BigInt(i + 1), RoadieStage.paperworkDone),
      ),
      ...Array.from({ length: 10 }, (_, i) =>
        roadie(BigInt(i + 100), RoadieStage.oriented),
      ),
    ];
    const board: ShiftBoardView = {
      eventId: 20n,
      shift: Shift.am,
      groups: [
        {
          trainerPrincipal: trainer,
          capacity: 4n,
          roadies: [
            {
              roadieId: 100n,
              name: "Roadie 100",
              positionCode: "CASH",
              positionId: 1n,
              markedUnavailable: false,
            },
          ],
        },
      ],
      unassigned: [],
      offThisShift: [],
      isDemo: true,
      editedAt: 0n,
    };
    const checkIn: CheckInBoardView = {
      eventId: 20n,
      shift: Shift.am,
      roadies: [
        { roadieId: 100n, name: "Roadie 100", state: "present" as never },
      ],
      checkedInCount: 1n,
      totalCount: 1n,
      locked: false,
      shiftLabel: "AM",
    };
    const alerts: AbsentAlertView[] = [
      {
        id: 1n,
        eventId: 20n,
        roadieId: 100n,
        name: "Roadie 100",
        createdAt: 0n,
        shift: Shift.am,
        shiftLabel: "AM",
        excused: "Called in",
        archived: false,
      },
    ];
    const actor = cardActor({
      summary: summary({ signups: 2n }),
      roadies,
      board,
      checkIn,
      alerts,
    });
    renderPageWithActor(PracticeRunPage, actor, { path: "/today" });

    await waitFor(() =>
      expect(screen.getByTestId("today.practice.progress")).toHaveTextContent(
        t("today.practice.complete"),
      ),
    );
  });
});

describe("Practice run step completion is derived from demo data", () => {
  it("advances the progress line to the first not-done step", async () => {
    // Step 1 done (2 pending sign-ups < 3 seed baseline), step 2 not done.
    const actor = cardActor({ summary: summary({ signups: 2n }) });
    renderPageWithActor(PracticeRunPage, actor, { path: "/today" });

    await waitFor(() =>
      expect(screen.getByTestId("today.practice.progress")).toHaveTextContent(
        "Step 2 of 6",
      ),
    );
  });

  it("marks step 3 done when at least 10 demo roadies are Oriented", async () => {
    const roadies = Array.from({ length: 10 }, (_, i) =>
      roadie(BigInt(i + 1), RoadieStage.oriented),
    );
    const actor = cardActor({ roadies });
    renderPageWithActor(PracticeRunPage, actor, { path: "/today" });

    // Steps 1 and 2 are not done, so the progress line stays at step 1, but
    // step 3's row shows its green check.
    await waitFor(() =>
      expect(screen.getByTestId("today.practice.progress")).toHaveTextContent(
        "Step 1 of 6",
      ),
    );
    const step3 = screen.getByTestId("today.practice.step.3");
    expect(step3.querySelector("svg")).not.toBeNull();
  });

  it("shows a green check on a done step row and the number on a not-done row", async () => {
    // Step 1 done (2 pending sign-ups < 3 seed baseline); step 2 not done.
    const actor = cardActor({ summary: summary({ signups: 2n }) });
    renderPageWithActor(PracticeRunPage, actor, { path: "/today" });

    await waitFor(() =>
      expect(screen.getByTestId("today.practice.progress")).toHaveTextContent(
        "Step 2 of 6",
      ),
    );
    // The done step row shows a check icon instead of its number.
    const step1 = screen.getByTestId("today.practice.step.1");
    expect(step1.querySelector("svg")).not.toBeNull();
    // The first not-done step row still shows its number.
    const step2 = screen.getByTestId("today.practice.step.2");
    expect(step2).toHaveTextContent("2");
  });
});

describe("Practice run Take me there drives the demo setters", () => {
  it("step 1 sets View as Admin, clears the pretend date and opens Approve New Hires", async () => {
    const user = userEvent.setup();
    const actor = cardActor();
    renderPageWithActor(PracticeRunPage, actor, { path: "/today" });

    await user.click(
      await screen.findByTestId("today.practice.step.1.take_me_there_button"),
    );

    await waitFor(() =>
      expect(actor.setDemoRole).toHaveBeenCalledWith(DemoRole.admin, []),
    );
    expect(actor.setPretendDate).toHaveBeenCalledWith(null);
  });

  it("step 2 sets View as Admin and opens the Roster on the Hired tab", async () => {
    const user = userEvent.setup();
    const actor = cardActor();
    renderPageWithActor(PracticeRunPage, actor, { path: "/today" });

    await user.click(
      await screen.findByTestId("today.practice.step.2.take_me_there_button"),
    );

    await waitFor(() =>
      expect(actor.setDemoRole).toHaveBeenCalledWith(DemoRole.admin, []),
    );
  });

  it("step 4 sets the pretend date to Training Day 1 AM and View as Admin", async () => {
    const user = userEvent.setup();
    const actor = cardActor();
    renderPageWithActor(PracticeRunPage, actor, { path: "/today" });

    await user.click(
      await screen.findByTestId("today.practice.step.4.take_me_there_button"),
    );

    await waitFor(() =>
      expect(actor.setDemoRole).toHaveBeenCalledWith(DemoRole.admin, []),
    );
    const pretend = actor.setPretendDate.mock.calls[0]?.[0];
    expect(pretend?.shift).toBe(DemoShift.am);
  });

  it("step 3 sets the pretend date to the demo Orientation date AM and View as Admin", async () => {
    const user = userEvent.setup();
    const actor = cardActor();
    renderPageWithActor(PracticeRunPage, actor, { path: "/today" });

    await user.click(
      await screen.findByTestId("today.practice.step.3.take_me_there_button"),
    );

    await waitFor(() =>
      expect(actor.setDemoRole).toHaveBeenCalledWith(DemoRole.admin, []),
    );
    const pretend = actor.setPretendDate.mock.calls[0]?.[0];
    expect(pretend?.shift).toBe(DemoShift.am);
  });

  it("step 5 sets View as NSO Trainer and picks the first trainer who leads a group", async () => {
    const user = userEvent.setup();
    const trainer = principal("ttttt-tt");
    const board: ShiftBoardView = {
      eventId: 20n,
      shift: Shift.am,
      groups: [
        {
          trainerPrincipal: trainer,
          capacity: 4n,
          roadies: [
            {
              roadieId: 100n,
              name: "Roadie 100",
              positionCode: "CASH",
              positionId: 1n,
              markedUnavailable: false,
            },
          ],
        },
      ],
      unassigned: [],
      offThisShift: [],
      isDemo: true,
      editedAt: 0n,
    };
    const actor = cardActor({ board });
    renderPageWithActor(PracticeRunPage, actor, { path: "/today" });

    await user.click(
      await screen.findByTestId("today.practice.step.5.take_me_there_button"),
    );

    await waitFor(() =>
      expect(actor.setDemoRole).toHaveBeenCalledWith(DemoRole.trainer, []),
    );
    await waitFor(() =>
      expect(actor.setDemoTrainerAs).toHaveBeenCalledWith(trainer),
    );
  });

  it("step 6 sets View as Store Manager with the crew owner of the absent roadie", async () => {
    const user = userEvent.setup();
    const owner = principal("oooooo-oo");
    const crews: Crew[] = [
      { id: 5n, name: "Owner's Crew", isDemo: true, leaderPrincipal: owner },
    ];
    const alerts: AbsentAlertView[] = [
      {
        id: 1n,
        eventId: 20n,
        roadieId: 100n,
        name: "Roadie 100",
        createdAt: 0n,
        shift: Shift.am,
        shiftLabel: "AM",
        archived: false,
      },
    ];
    const actor = cardActor({
      crews,
      alerts,
      roadies: [roadie(100n, RoadieStage.oriented, 5n)],
    });
    renderPageWithActor(PracticeRunPage, actor, { path: "/today" });

    await user.click(
      await screen.findByTestId("today.practice.step.6.take_me_there_button"),
    );

    await waitFor(() =>
      expect(actor.setDemoRole).toHaveBeenCalledWith(DemoRole.storeManager, []),
    );
    await waitFor(() =>
      expect(actor.setDemoManagerAs).toHaveBeenCalledWith(owner),
    );
  });
});

/**
 * Step 2's "Take me there" opens the Roster on the Hired tab. The Roster route
 * accepts an optional `tab` search param and still defaults to All when it is
 * absent or unknown, so the card's deep link lands on the right tab.
 */
describe("Roster tab search param", () => {
  const rosterActor = {
    listRoadies: vi.fn<backendInterface["listRoadies"]>(async () => [
      roadie(1n, RoadieStage.hired),
      roadie(2n, RoadieStage.certified),
    ]),
    listPositions: vi.fn<backendInterface["listPositions"]>(async () => []),
    listCrews: vi.fn<backendInterface["listCrews"]>(async () => []),
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: grant(Role.admin),
    })),
  };

  /** Render the Roster at a URL whose route declares the optional tab param. */
  function renderRosterAt(entry: string) {
    const rootRoute = createRootRoute({ component: () => <Outlet /> });
    const rosterRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/roster",
      validateSearch: (search: Record<string, unknown>): { tab?: string } => ({
        tab: typeof search.tab === "string" ? search.tab : undefined,
      }),
      component: RosterPage,
    });
    const router = createRouter({
      routeTree: rootRoute.addChildren([rosterRoute]),
      history: createMemoryHistory({ initialEntries: [entry] }),
    });
    return renderWithActor(
      <I18nContext.Provider
        value={{
          locale: "en" as Locale,
          setLocale: vi.fn(),
          t: (key: string, vars?: Record<string, string | number>) =>
            translate("en" as Locale, key, vars),
        }}
      >
        <RouterProvider router={router} />
      </I18nContext.Provider>,
      rosterActor,
    );
  }

  it("opens on the Hired tab when the tab search param is hired", async () => {
    renderRosterAt("/roster?tab=hired");

    await waitFor(() =>
      expect(screen.getByTestId("roster.filter.hired.tab")).toHaveAttribute(
        "aria-selected",
        "true",
      ),
    );
    expect(screen.getByTestId("roster.filter.all.tab")).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("defaults to the All tab when the tab search param is absent or unknown", async () => {
    renderRosterAt("/roster?tab=not-a-tab");

    await waitFor(() =>
      expect(screen.getByTestId("roster.filter.all.tab")).toHaveAttribute(
        "aria-selected",
        "true",
      ),
    );
    expect(screen.getByTestId("roster.filter.hired.tab")).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });
});

/**
 * Load demo data resets the practice run: the card reappears after Hide and the
 * progress line restarts at step 1. The reset is keyed to the Load demo data
 * action itself (the shared `demoDataLoadedAt` marker bumped on every load), not
 * to the demo record counts, because the seed is idempotent and a redundant load
 * leaves the counts unchanged.
 */
describe("Practice run resets when demo data is loaded", () => {
  it("shows the card again and restarts at step 1 after Load demo data bumps the marker", async () => {
    const user = userEvent.setup();
    const actor = cardActor();
    const { queryClient } = renderPageWithActor(PracticeRunPage, actor, {
      path: "/today",
    });

    // Hide the card for the session.
    await user.click(await screen.findByTestId("today.practice.hide_button"));
    await waitFor(() =>
      expect(
        screen.queryByTestId("today.practice.card"),
      ).not.toBeInTheDocument(),
    );

    // Load demo data bumps the shared marker, exactly as useLoadDemoData does.
    queryClient.setQueryData(DEMO_DATA_LOADED_KEY, Date.now());

    // The card reappears and its progress line restarts at step 1 once the
    // demo summary read resolves (the seed baseline keeps step 1 not-done).
    await waitFor(() =>
      expect(screen.getByTestId("today.practice.card")).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.getByTestId("today.practice.progress")).toHaveTextContent(
        "Step 1 of 6",
      ),
    );
  });
});
