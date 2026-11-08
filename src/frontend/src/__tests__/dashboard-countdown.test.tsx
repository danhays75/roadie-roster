import { renderPageWithActor, t } from "@/__tests__/router-test-utils";
import type {
  AccessGrant,
  DemoStateView,
  OrientationCheckoff,
  Roadie,
  ScheduleEvent,
  backendInterface,
} from "@/backend";
import {
  DemoRole,
  DemoShift,
  EventKind,
  RoadieStatus,
  Role,
  RosterState,
} from "@/backend";
import DashboardPage from "@/pages/Dashboard";
import type { Principal } from "@icp-sdk/core/principal";
import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * Characterization baseline for the Countdown to Opening card. The accepted
 * change makes the milestone list collapsible, so this file deliberately does
 * NOT assert that the list is always visible. It protects the parts of the card
 * that must stay visible regardless of the collapse state: the flag icon, the
 * COUNTDOWN TO OPENING label, the opening date and the Days/Hours/Min boxes.
 */

/** A fixed opening date far enough in the future to keep the countdown positive. */
const OPENING_DATE = 1_802_066_400_000_000_000n; // 2027-02-09T00:00:00Z

const SCHEDULE: ScheduleEvent[] = [
  {
    id: 1n,
    kind: EventKind.orientation,
    name: "Orientation day",
    start: 1_801_202_400_000_000_000n,
  },
  {
    id: 2n,
    kind: EventKind.openingDay,
    name: "Grand opening",
    start: OPENING_DATE,
  },
];

function baseActor() {
  return {
    getDashboard: vi.fn<backendInterface["getDashboard"]>(async () => ({
      foh: [],
      boh: [],
      hired: 0n,
      stillNeeded: 0n,
      buildToTotal: 0n,
      active: 0n,
      pending: 0n,
    })),
    listSchedule: vi.fn<backendInterface["listSchedule"]>(async () => SCHEDULE),
    getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(async () => ({
      storeNumber: "975",
      appName: "Roadie Roster",
      locationName: "Lake Charles",
      address: "1400 W Prien Lake Rd",
      storePhone: "",
      timeZone: "America/Chicago",
      openingDate: OPENING_DATE,
      amShiftStart: 600n,
      amShiftEnd: 900n,
      pmShiftStart: 960n,
      pmShiftEnd: 1320n,
      trainingGroupSize: 5n,
      leaderTalkName: "10 Minutes with Dan",
      leaderTalkSize: 10n,
      paperworkDueDate: 1_800_000_000_000_000_000n,
    })),
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: undefined,
    })),
    listRosterForPosition: vi.fn<backendInterface["listRosterForPosition"]>(
      async () => [],
    ),
  };
}

describe("Countdown to Opening card baseline", () => {
  it("keeps the flag icon, label, opening date and Days/Hours/Min boxes visible", async () => {
    renderPageWithActor(DashboardPage, baseActor(), { path: "/dashboard" });

    const card = await screen.findByTestId("dashboard.countdown.card");
    expect(card).toBeInTheDocument();

    // The COUNTDOWN TO OPENING label is always present.
    expect(
      within(card).getByText(t("dashboard.countdown.label")),
    ).toBeInTheDocument();

    // The opening date is rendered in long form (UTC), independent of collapse.
    expect(
      within(card).getByText(
        new Date(Number(OPENING_DATE / 1_000_000n)).toLocaleDateString(
          undefined,
          { dateStyle: "long", timeZone: "UTC" },
        ),
      ),
    ).toBeInTheDocument();

    // The three countdown unit boxes stay visible with their labels.
    const timer = within(card).getByTestId("dashboard.countdown.timer");
    expect(
      within(timer).getByText(t("dashboard.countdown.days")),
    ).toBeInTheDocument();
    expect(
      within(timer).getByText(t("dashboard.countdown.hours")),
    ).toBeInTheDocument();
    expect(
      within(timer).getByText(t("dashboard.countdown.minutes")),
    ).toBeInTheDocument();

    // The flag icon is decorative and rendered inside the card header.
    const flag = card.querySelector("svg.lucide-flag");
    expect(flag).not.toBeNull();
  });

  it("renders the milestone list content when the schedule has events", async () => {
    renderPageWithActor(DashboardPage, baseActor(), { path: "/dashboard" });

    // The list may be collapsed by default after the accepted change, so assert
    // on the list element itself rather than on visibility.
    const list = await screen.findByTestId("dashboard.timeline.list");
    expect(list).toBeInTheDocument();
    expect(within(list).getByText("Orientation day")).toBeInTheDocument();
    expect(within(list).getByText("Grand opening")).toBeInTheDocument();
    expect(within(list).getByText("Orientation")).toBeInTheDocument();
    expect(within(list).getByText("Opening day")).toBeInTheDocument();
  });

  it("shows the empty schedule message when there are no events", async () => {
    const actor = baseActor();
    actor.listSchedule = vi.fn<backendInterface["listSchedule"]>(
      async () => [],
    );

    renderPageWithActor(DashboardPage, actor, { path: "/dashboard" });

    expect(
      await screen.findByText(t("dashboard.timeline.empty")),
    ).toBeInTheDocument();
  });

  it("renders every milestone in chronological order with its kind label", async () => {
    // The accepted change reworks which milestone is highlighted, but the list
    // itself must keep showing every event in start order with its kind label,
    // whatever order the schedule arrives in.
    const actor = baseActor();
    actor.listSchedule = vi.fn<backendInterface["listSchedule"]>(async () => [
      {
        id: 3n,
        kind: EventKind.signOff,
        name: "Final sign-off",
        start: 1_803_000_000_000_000_000n,
      },
      {
        id: 1n,
        kind: EventKind.orientation,
        name: "Orientation day",
        start: 1_801_202_400_000_000_000n,
      },
      {
        id: 2n,
        kind: EventKind.openingDay,
        name: "Grand opening",
        start: OPENING_DATE,
      },
    ]);

    renderPageWithActor(DashboardPage, actor, { path: "/dashboard" });

    const list = await screen.findByTestId("dashboard.timeline.list");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Orientation day");
    expect(items[1]).toHaveTextContent("Grand opening");
    expect(items[2]).toHaveTextContent("Final sign-off");
    // Each row keeps its human kind label.
    expect(within(list).getByText("Orientation")).toBeInTheDocument();
    expect(within(list).getByText("Opening day")).toBeInTheDocument();
    expect(within(list).getByText("Sign-off")).toBeInTheDocument();
  });
});

/* ---------------------------------------------------------------------------
   Accepted change: the highlighted event is the one whose store-local date is
   today, or the next upcoming event; past events show a muted Done label, a
   past deadline shows Past due only while an active roadie still has incomplete
   paperwork, and NOW appears only on today's event.
--------------------------------------------------------------------------- */

const PRINCIPAL = { toText: () => "aaaaa-aa" } as unknown as Principal;

/** A UTC-midnight DateOnly for a calendar date, as the backend stores it. */
function dateOnly(year: number, month: number, day: number): bigint {
  return BigInt(Date.UTC(year, month - 1, day)) * 1_000_000n;
}

/**
 * A schedule event start whose store-local calendar date (America/Chicago) is
 * the given date. 18:00 UTC is midday in the store zone, so the store-local
 * date is unambiguous across the CST/CDT offset.
 */
function storeLocalStart(year: number, month: number, day: number): bigint {
  return BigInt(Date.UTC(year, month - 1, day, 18, 0, 0)) * 1_000_000n;
}

/** A schedule event starting at a UTC instant. */
function event(
  id: bigint,
  kind: EventKind,
  name: string,
  start: bigint,
): ScheduleEvent {
  return { id, kind, name, start };
}

function adminGrant(): AccessGrant {
  return {
    principal: PRINCIPAL,
    approvedAt: 0n,
    approvedBy: PRINCIPAL,
    role: Role.admin,
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

function checkoff(
  roadieId: bigint,
  paperworkItems: string[],
): OrientationCheckoff {
  return {
    roadieId,
    paperworkItems,
    uniformItems: [],
    uniformCounts: [],
    shirtsCount: 0n,
    hatsCount: 0n,
    updatedAt: 0n,
    isDemo: false,
  };
}

/**
 * An actor for the timeline's highlight/label behavior. The pretend date drives
 * the effective now; the paperwork path is enabled by an Admin grant so a past
 * deadline can turn into Past due.
 */
function timelineActor(options: {
  schedule: ScheduleEvent[];
  pretendDate?: { day: bigint; shift: DemoShift };
  roadies?: Roadie[];
  checkoffs?: Map<string, OrientationCheckoff>;
  paperworkItems?: { id: bigint; text: string }[];
}) {
  const demoState: DemoStateView = {
    enabled: options.pretendDate !== undefined,
    demoRole: DemoRole.admin,
    demoTrainerStations: [],
    pretendDate: options.pretendDate,
  };
  const checkoffs = options.checkoffs ?? new Map();
  return {
    getDashboard: vi.fn<backendInterface["getDashboard"]>(async () => ({
      foh: [],
      boh: [],
      hired: 0n,
      stillNeeded: 0n,
      buildToTotal: 0n,
      active: 0n,
      pending: 0n,
    })),
    listSchedule: vi.fn<backendInterface["listSchedule"]>(
      async () => options.schedule,
    ),
    getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(async () => ({
      storeNumber: "975",
      appName: "Roadie Roster",
      locationName: "Lake Charles",
      address: "1400 W Prien Lake Rd",
      storePhone: "",
      timeZone: "America/Chicago",
      openingDate: OPENING_DATE,
      amShiftStart: 600n,
      amShiftEnd: 900n,
      pmShiftStart: 960n,
      pmShiftEnd: 1320n,
      trainingGroupSize: 5n,
      leaderTalkName: "10 Minutes with Dan",
      leaderTalkSize: 10n,
      paperworkDueDate: 1_800_000_000_000_000_000n,
    })),
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: adminGrant(),
    })),
    getDemoState: vi.fn<backendInterface["getDemoState"]>(
      async () => demoState,
    ),
    listRoadies: vi.fn<backendInterface["listRoadies"]>(
      async () => options.roadies ?? [],
    ),
    listPositions: vi.fn<backendInterface["listPositions"]>(async () => []),
    getChecklists: vi.fn<backendInterface["getChecklists"]>(async () => ({
      paperwork: (options.paperworkItems ?? []).map((item) => ({
        id: item.id,
        text: item.text,
        requiresAlcoholCert: false,
        minorOnly: false,
        itemType: { checkbox: null } as never,
      })),
      orientationUniform: [],
    })),
    getOrientationCheckoff: vi.fn<backendInterface["getOrientationCheckoff"]>(
      async (id: bigint) => checkoffs.get(id.toString()) ?? null,
    ),
    listRosterForPosition: vi.fn<backendInterface["listRosterForPosition"]>(
      async () => [],
    ),
  };
}

/** The timeline item at a 1-based index, as the component renders it. */
async function timelineItem(index: number): Promise<HTMLElement> {
  return screen.findByTestId(`dashboard.timeline.item.${index}`);
}

// The dashboard-local copy keys resolve through useDashboardCopy, not the
// shared dictionary, so assert on the rendered English labels directly.
const NOW_LABEL = "Now";
const DONE_LABEL = "Done";
const PAST_DUE_LABEL = "Past due";

describe("Opening timeline highlight and status labels", () => {
  it("highlights the event whose store-local date is today and shows NOW on it", async () => {
    // The pretend date is 2027-02-09; the orientation event starts that same
    // store-local calendar day, so it is today's event.
    const actor = timelineActor({
      schedule: [
        event(
          1n,
          EventKind.orientation,
          "Orientation day",
          storeLocalStart(2027, 2, 9),
        ),
        event(
          2n,
          EventKind.openingDay,
          "Grand opening",
          storeLocalStart(2027, 2, 20),
        ),
      ],
      pretendDate: { day: dateOnly(2027, 2, 9), shift: DemoShift.am },
    });

    renderPageWithActor(DashboardPage, actor, { path: "/dashboard" });

    const today = await timelineItem(1);
    expect(within(today).getByText(NOW_LABEL)).toBeInTheDocument();
    // The future event is not today, so it shows no NOW.
    const future = await timelineItem(2);
    expect(within(future).queryByText(NOW_LABEL)).not.toBeInTheDocument();
  });

  it("highlights the next upcoming event and shows no NOW when no event is today", async () => {
    // The pretend date falls between the two events, so the next upcoming one
    // (the opening day) is highlighted and no event is today.
    const actor = timelineActor({
      schedule: [
        event(
          1n,
          EventKind.orientation,
          "Orientation day",
          storeLocalStart(2027, 2, 5),
        ),
        event(
          2n,
          EventKind.openingDay,
          "Grand opening",
          storeLocalStart(2027, 2, 20),
        ),
      ],
      pretendDate: { day: dateOnly(2027, 2, 9), shift: DemoShift.am },
    });

    renderPageWithActor(DashboardPage, actor, { path: "/dashboard" });

    const past = await timelineItem(1);
    const upcoming = await timelineItem(2);
    // No event is today, so NOW appears nowhere.
    expect(within(past).queryByText(NOW_LABEL)).not.toBeInTheDocument();
    expect(within(upcoming).queryByText(NOW_LABEL)).not.toBeInTheDocument();
    // The past event is Done; the upcoming one is neither Done nor Past due.
    expect(within(past).getByText(DONE_LABEL)).toBeInTheDocument();
    expect(within(upcoming).queryByText(DONE_LABEL)).not.toBeInTheDocument();
  });

  it("shows a muted Done label on a past event and never NOW", async () => {
    const actor = timelineActor({
      schedule: [
        event(
          1n,
          EventKind.orientation,
          "Orientation day",
          storeLocalStart(2027, 2, 1),
        ),
        event(
          2n,
          EventKind.openingDay,
          "Grand opening",
          storeLocalStart(2027, 2, 20),
        ),
      ],
      pretendDate: { day: dateOnly(2027, 2, 9), shift: DemoShift.am },
    });

    renderPageWithActor(DashboardPage, actor, { path: "/dashboard" });

    const past = await timelineItem(1);
    expect(within(past).getByText(DONE_LABEL)).toBeInTheDocument();
    expect(within(past).queryByText(NOW_LABEL)).not.toBeInTheDocument();
  });

  it("shows Past due on a past deadline while an active roadie still has incomplete paperwork", async () => {
    // The deadline is in the past; one active roadie has an applicable item
    // unchecked, so the deadline is Past due rather than Done. The deadline is
    // also before the real clock, because the paperwork-overdue read uses the
    // real now rather than the pretend date.
    const actor = timelineActor({
      schedule: [
        event(
          1n,
          EventKind.deadline,
          "Paperwork due",
          storeLocalStart(2020, 2, 1),
        ),
        event(
          2n,
          EventKind.openingDay,
          "Grand opening",
          storeLocalStart(2027, 2, 20),
        ),
      ],
      pretendDate: { day: dateOnly(2027, 2, 9), shift: DemoShift.am },
      roadies: [roadie({ id: 1n, status: RoadieStatus.active })],
      checkoffs: new Map([["1", checkoff(1n, [])]]),
      paperworkItems: [{ id: 0n, text: "Onboarding" }],
    });

    renderPageWithActor(DashboardPage, actor, { path: "/dashboard" });

    const deadline = await timelineItem(1);
    expect(within(deadline).getByText(PAST_DUE_LABEL)).toBeInTheDocument();
    expect(within(deadline).queryByText(DONE_LABEL)).not.toBeInTheDocument();
  });

  it("shows Done on a past deadline once every active roadie's paperwork is complete", async () => {
    const actor = timelineActor({
      schedule: [
        event(
          1n,
          EventKind.deadline,
          "Paperwork due",
          storeLocalStart(2020, 2, 1),
        ),
        event(
          2n,
          EventKind.openingDay,
          "Grand opening",
          storeLocalStart(2027, 2, 20),
        ),
      ],
      pretendDate: { day: dateOnly(2027, 2, 9), shift: DemoShift.am },
      roadies: [roadie({ id: 1n, status: RoadieStatus.active })],
      checkoffs: new Map([["1", checkoff(1n, ["0"])]]),
      paperworkItems: [{ id: 0n, text: "Onboarding" }],
    });

    renderPageWithActor(DashboardPage, actor, { path: "/dashboard" });

    const deadline = await timelineItem(1);
    expect(within(deadline).getByText(DONE_LABEL)).toBeInTheDocument();
    expect(
      within(deadline).queryByText(PAST_DUE_LABEL),
    ).not.toBeInTheDocument();
  });
});
