import { renderPageWithActor } from "@/__tests__/router-test-utils";
import type {
  AbsentAlertView,
  NextEventView,
  ShiftCheckInSummary,
  StoreInfo,
  TodayView,
  backendInterface,
} from "@/backend";
import { Role, Shift } from "@/backend";
import TodayPage from "@/pages/Today";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const STORE: StoreInfo = {
  storeNumber: "975",
  appName: "Roadie Roster",
  locationName: "Lake Charles",
  address: "1400 W Prien Lake Rd",
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

function summary(
  overrides: Partial<ShiftCheckInSummary> = {},
): ShiftCheckInSummary {
  return {
    eventId: 1n,
    shift: Shift.am,
    shiftLabel: "Training Day 1 · AM",
    present: 2n,
    late: 1n,
    absent: 1n,
    total: 4n,
    ...overrides,
  };
}

function alert(overrides: Partial<AbsentAlertView> = {}): AbsentAlertView {
  return {
    id: 7n,
    eventId: 1n,
    roadieId: 1n,
    name: "Ada Roadie",
    createdAt: 0n,
    shift: Shift.am,
    shiftLabel: "Training Day 1 · AM",
    archived: false,
    ...overrides,
  };
}

function nextEvent(overrides: Partial<NextEventView> = {}): NextEventView {
  return {
    eventId: 2n,
    name: "Training Day 2",
    start: 1_900_000_000_000_000_000n,
    startsInMs: 90n * 60_000n,
    ...overrides,
  };
}

function today(overrides: Partial<TodayView> = {}): TodayView {
  return {
    role: Role.admin,
    shiftSummaries: [],
    absentAlerts: [],
    ...overrides,
  };
}

function actor(
  role: Role,
  options: {
    today?: TodayView;
    alerts?: AbsentAlertView[];
  } = {},
) {
  return {
    getMyAccess: vi.fn(async () => ({
      grant: {
        principal: { toText: () => "aaaaa-aa" } as never,
        role,
        approvedAt: 0n,
        approvedBy: { toText: () => "aaaaa-aa" } as never,
        trainerPositionIds: [],
      },
    })),
    getToday: vi.fn(async () => options.today ?? today()),
    listAbsentAlerts: vi.fn(async () => options.alerts ?? []),
    getStoreInfo: vi.fn(async () => STORE),
    getDemoState: vi.fn(async () => ({
      enabled: false,
      demoTrainerStations: [],
    })),
    excuseAbsentAlert: vi.fn(async () => undefined),
    archiveAbsentAlert: vi.fn(async () => undefined),
    moveAbsentRoadieToOtherShift: vi.fn(async () => undefined),
    getPhoto: vi.fn<backendInterface["getPhoto"]>(
      async () => new Uint8Array([1, 2, 3, 4]),
    ),
  };
}

/**
 * The manager and read-only Today views plus the absent alerts list. The actor
 * is mocked, so this proves the component contract and the role gating the
 * frontend applies, not the real canister's authorization.
 */
describe("Today manager and read-only views", () => {
  it("shows per-shift check-in counts to an Admin", async () => {
    const a = actor(Role.admin, {
      today: today({ shiftSummaries: [summary()] }),
    });
    renderPageWithActor(TodayPage, a, { path: "/today" });

    const row = await screen.findByTestId("today.shifts.item.0");
    expect(within(row).getByText("Training Day 1 · AM")).toBeInTheDocument();
    expect(
      within(row).getByTestId("today.shifts.item.0.count"),
    ).toHaveTextContent("3 / 4 checked in");
  });

  it("shows the read-only attendance summary to a Visiting Manager", async () => {
    const a = actor(Role.visitingManager, {
      today: today({ shiftSummaries: [summary()] }),
    });
    renderPageWithActor(TodayPage, a, { path: "/today" });

    const row = await screen.findByTestId("today.shifts.item.0");
    expect(
      within(row).getByTestId("today.shifts.item.0.read_only"),
    ).toHaveTextContent("Read only");
    expect(
      within(row).getByTestId("today.shifts.item.0.summary"),
    ).toHaveTextContent("2 present · 1 late · 1 absent");
  });

  it("shows the next event and countdown when no shift is today", async () => {
    const a = actor(Role.admin, {
      today: today({ nextEvent: nextEvent() }),
    });
    renderPageWithActor(TodayPage, a, { path: "/today" });

    expect(
      await screen.findByTestId("today.nextEvent.card"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("today.nextEvent.name")).toHaveTextContent(
      "Training Day 2",
    );
    expect(screen.getByTestId("today.nextEvent.countdown")).toHaveTextContent(
      "Starts in 1h 30m",
    );
  });

  it("shows the empty state when no shift is today and no event is upcoming", async () => {
    const a = actor(Role.admin, { today: today() });
    renderPageWithActor(TodayPage, a, { path: "/today" });

    expect(
      await screen.findByTestId("today.shifts.empty_state"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("today.nextEvent.card"),
    ).not.toBeInTheDocument();
  });
});

describe("Today absent alerts", () => {
  it("shows an absent alert to an Admin with Call and Text links", async () => {
    const a = actor(Role.admin, {
      alerts: [alert({ phone: "+1-555-0100" })],
    });
    renderPageWithActor(TodayPage, a, { path: "/today" });

    const item = await screen.findByTestId("alerts.item.0");
    expect(within(item).getByText("Ada Roadie")).toBeInTheDocument();
    expect(
      within(item).getByTestId("alerts.item.0.call_button"),
    ).toHaveAttribute("href", "tel:+1-555-0100");
    expect(
      within(item).getByTestId("alerts.item.0.text_button"),
    ).toHaveAttribute("href", "sms:+1-555-0100");
  });

  it("hides Call and Text from a Training Manager", async () => {
    const a = actor(Role.trainingManager, {
      alerts: [alert({ phone: "+1-555-0100" })],
    });
    renderPageWithActor(TodayPage, a, { path: "/today" });

    const item = await screen.findByTestId("alerts.item.0");
    expect(
      within(item).queryByTestId("alerts.item.0.call_button"),
    ).not.toBeInTheDocument();
    expect(
      within(item).queryByTestId("alerts.item.0.text_button"),
    ).not.toBeInTheDocument();
    // The alert actions remain available to the Training Manager.
    expect(
      within(item).getByTestId("alerts.item.0.excuse_button"),
    ).toBeInTheDocument();
  });

  it("requires a reason before excusing an alert", async () => {
    const a = actor(Role.admin, { alerts: [alert()] });
    const user = userEvent.setup();
    renderPageWithActor(TodayPage, a, { path: "/today" });

    const item = await screen.findByTestId("alerts.item.0");
    await user.click(within(item).getByTestId("alerts.item.0.excuse_button"));

    const dialog = await screen.findByTestId("alerts.excuse.dialog");
    await user.click(
      within(dialog).getByTestId("alerts.excuse.confirm_button"),
    );

    expect(
      within(dialog).getByTestId("alerts.excuse.validation_error"),
    ).toBeInTheDocument();
    expect(a.excuseAbsentAlert).not.toHaveBeenCalled();
  });

  it("saves an excuse with the entered reason", async () => {
    const a = actor(Role.admin, { alerts: [alert()] });
    const user = userEvent.setup();
    renderPageWithActor(TodayPage, a, { path: "/today" });

    const item = await screen.findByTestId("alerts.item.0");
    await user.click(within(item).getByTestId("alerts.item.0.excuse_button"));

    const dialog = await screen.findByTestId("alerts.excuse.dialog");
    await user.type(
      within(dialog).getByTestId("alerts.excuse.reason_input"),
      "Called in sick",
    );
    await user.click(
      within(dialog).getByTestId("alerts.excuse.confirm_button"),
    );

    expect(a.excuseAbsentAlert).toHaveBeenCalledWith(7n, "Called in sick");
  });

  it("opens the archive dialog from the Archive action", async () => {
    const a = actor(Role.admin, { alerts: [alert()] });
    const user = userEvent.setup();
    renderPageWithActor(TodayPage, a, { path: "/today" });

    const item = await screen.findByTestId("alerts.item.0");
    await user.click(within(item).getByTestId("alerts.item.0.archive_button"));

    expect(
      await screen.findByTestId("alerts.archive.dialog"),
    ).toBeInTheDocument();
  });

  it("shows the empty state when there are no absent alerts", async () => {
    const a = actor(Role.admin, { alerts: [] });
    renderPageWithActor(TodayPage, a, { path: "/today" });

    expect(await screen.findByTestId("alerts.empty_state")).toBeInTheDocument();
  });

  it("shows the demo photo URL on an alert when no stored photo exists", async () => {
    const DEMO_PHOTO_URL = "https://cdn.example.test/demo/alert.webp";
    const a = actor(Role.admin, {
      alerts: [alert({ demoPhotoUrl: DEMO_PHOTO_URL })],
    });
    // No stored photo, so the demo URL is the only photo source.
    a.getPhoto.mockImplementation(async () => null);
    renderPageWithActor(TodayPage, a, { path: "/today" });

    const photo = await screen.findByTestId("alerts.item.0.photo");
    const img = within(photo).getByRole("img", { name: "Ada Roadie" });
    expect(img).toHaveAttribute("src", DEMO_PHOTO_URL);
  });

  it("prefers a stored photo over the demo photo URL on an alert", async () => {
    const DEMO_PHOTO_URL = "https://cdn.example.test/demo/alert.webp";
    const a = actor(Role.admin, {
      alerts: [alert({ demoPhotoUrl: DEMO_PHOTO_URL })],
    });
    renderPageWithActor(TodayPage, a, { path: "/today" });

    const photo = await screen.findByTestId("alerts.item.0.photo");
    const img = within(photo).getByRole("img", { name: "Ada Roadie" });
    expect(img).toHaveAttribute("src", expect.stringContaining("data:image/"));
    expect(img).not.toHaveAttribute("src", DEMO_PHOTO_URL);
  });
});
