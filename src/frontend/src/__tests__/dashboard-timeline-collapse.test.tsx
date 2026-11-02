import { renderPageWithActor, t } from "@/__tests__/router-test-utils";
import type { ScheduleEvent, backendInterface } from "@/backend";
import { EventKind } from "@/backend";
import DashboardPage from "@/pages/Dashboard";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Cover for the collapsible milestone list in the Countdown to Opening card.
 * The list is hidden by default, revealed by either the header row or the
 * full-width bottom toggle, and the open/closed state is remembered on the
 * device through localStorage.
 */

const STORAGE_KEY = "roadie-roster.dashboard.schedule-expanded";

/** A fixed opening date far enough in the future to keep the countdown positive. */
const OPENING_DATE = 1_802_066_400_000_000_000n; // 2027-02-09T00:00:00Z

/** A milestone in the past and one in the future, relative to the real clock. */
const PAST_START = 1_600_000_000_000_000_000n; // 2020-09-13
const FUTURE_START = 1_900_000_000_000_000_000n; // 2030-03-15

const SCHEDULE: ScheduleEvent[] = [
  {
    id: 1n,
    kind: EventKind.orientation,
    name: "Orientation day",
    start: PAST_START,
  },
  {
    id: 2n,
    kind: EventKind.openingDay,
    name: "Grand opening",
    start: FUTURE_START,
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
    })),
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => null),
    listRosterForPosition: vi.fn<backendInterface["listRosterForPosition"]>(
      async () => [],
    ),
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe("Countdown to Opening collapsible milestone list", () => {
  it("hides the milestone list by default and shows it when the bottom toggle is activated", async () => {
    const user = userEvent.setup();
    renderPageWithActor(DashboardPage, baseActor(), { path: "/dashboard" });

    const toggle = await screen.findByTestId("dashboard.timeline.toggle");
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    // The list element exists in the DOM but is collapsed (zero-height row).
    const region = screen.getByTestId("dashboard.timeline.region");
    expect(region.className).toContain("grid-rows-[0fr]");

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(region.className).toContain("grid-rows-[1fr]");
    expect(
      within(screen.getByTestId("dashboard.timeline.list")).getByText(
        "Grand opening",
      ),
    ).toBeInTheDocument();
  });

  it("toggles the schedule from the header row as well", async () => {
    const user = userEvent.setup();
    renderPageWithActor(DashboardPage, baseActor(), { path: "/dashboard" });

    const header = await screen.findByTestId(
      "dashboard.countdown.header_toggle",
    );
    expect(header).toHaveAttribute("aria-expanded", "false");

    await user.click(header);

    expect(header).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("dashboard.timeline.region").className).toContain(
      "grid-rows-[1fr]",
    );
  });

  it("exposes a button with aria-expanded and aria-controls pointing at the region", async () => {
    renderPageWithActor(DashboardPage, baseActor(), { path: "/dashboard" });

    const toggle = await screen.findByTestId("dashboard.timeline.toggle");
    expect(toggle.tagName).toBe("BUTTON");
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    const region = screen.getByTestId("dashboard.timeline.region");
    expect(toggle.getAttribute("aria-controls")).toBe(region.id);
    expect(region.id).not.toBe("");
  });

  it("shows a compact next-milestone line while collapsed and hides it when expanded", async () => {
    const user = userEvent.setup();
    renderPageWithActor(DashboardPage, baseActor(), { path: "/dashboard" });

    const next = await screen.findByTestId("dashboard.timeline.next");
    expect(within(next).getByText("Grand opening")).toBeInTheDocument();
    // The past milestone is not the "next" one.
    expect(within(next).queryByText("Orientation day")).toBeNull();

    await user.click(screen.getByTestId("dashboard.timeline.toggle"));

    expect(screen.queryByTestId("dashboard.timeline.next")).toBeNull();
  });

  it("remembers the expanded state on the device and survives a remount", async () => {
    const user = userEvent.setup();
    const first = renderPageWithActor(DashboardPage, baseActor(), {
      path: "/dashboard",
    });

    await user.click(await screen.findByTestId("dashboard.timeline.toggle"));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("true");

    first.unmount();

    renderPageWithActor(DashboardPage, baseActor(), { path: "/dashboard" });
    const toggle = await screen.findByTestId("dashboard.timeline.toggle");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("dashboard.timeline.region").className).toContain(
      "grid-rows-[1fr]",
    );
  });

  it("defaults to collapsed when storage is unavailable", async () => {
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("storage unavailable");
      });

    try {
      renderPageWithActor(DashboardPage, baseActor(), { path: "/dashboard" });
      const toggle = await screen.findByTestId("dashboard.timeline.toggle");
      expect(toggle).toHaveAttribute("aria-expanded", "false");
    } finally {
      getItem.mockRestore();
    }
  });

  it("keeps the countdown card essentials visible while collapsed", async () => {
    renderPageWithActor(DashboardPage, baseActor(), { path: "/dashboard" });

    const card = await screen.findByTestId("dashboard.countdown.card");
    expect(
      within(card).getByText(t("dashboard.countdown.label")),
    ).toBeInTheDocument();
    expect(
      within(card).getByTestId("dashboard.countdown.timer"),
    ).toBeInTheDocument();
    expect(card.querySelector("svg.lucide-flag")).not.toBeNull();
  });
});
