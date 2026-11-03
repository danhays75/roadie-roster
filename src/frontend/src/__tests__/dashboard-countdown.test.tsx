import { renderPageWithActor, t } from "@/__tests__/router-test-utils";
import type { ScheduleEvent, backendInterface } from "@/backend";
import { EventKind } from "@/backend";
import DashboardPage from "@/pages/Dashboard";
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
});
