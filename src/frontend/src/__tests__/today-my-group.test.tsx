import { renderPageWithActor } from "@/__tests__/router-test-utils";
import type {
  CheckInBoardView,
  GroupChangeNotice,
  MyGroupView,
  Position,
  Roadie,
  ShiftBoardRoadie,
  StoreInfo,
  backendInterface,
} from "@/backend";
import {
  CheckInState,
  DemoShift,
  House,
  RoadieStatus,
  Role,
  RosterState,
  Shift,
} from "@/backend";
import { pretendDateToInstant } from "@/lib/format";
import TodayPage from "@/pages/Today";
import { screen, waitFor, within } from "@testing-library/react";
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

/** A check-in board for the trainer's own group on the current shift. */
function checkInBoard(
  overrides: Partial<CheckInBoardView> = {},
): CheckInBoardView {
  return {
    eventId: 1n,
    shift: Shift.am,
    shiftLabel: "Training Day 1 · AM",
    locked: false,
    checkedInCount: 0n,
    totalCount: 2n,
    roadies: [
      { roadieId: 1n, name: "Ada Roadie" },
      { roadieId: 2n, name: "Bea Roadie" },
    ],
    ...overrides,
  };
}

const POSITION: Position = {
  id: 0n,
  name: "Server",
  code: "SRV",
  house: House.foh,
  openingBuildTo: 2n,
  afterOpeningBuildTo: 1n,
  minimumAge: 16n,
  needsAlcoholCert: false,
  shirtType: "Polo",
  shirtQty: 2n,
  hatType: "Cap",
  hatQty: 1n,
  defaultShirts: 2n,
  defaultHats: 1n,
};

function chip(
  roadieId: bigint,
  name: string,
  positionCode: string,
): ShiftBoardRoadie {
  return {
    roadieId,
    name,
    positionCode,
    positionId: 0n,
    markedUnavailable: false,
  };
}

function roadie(id: bigint, name: string): Roadie {
  return {
    id,
    status: RoadieStatus.active,
    mainPositionId: 0n,
    isDemo: false,
    rosterState: RosterState.active,
    isMinor: false,
    hiredAt: 0n,
    profile: {
      name,
    },
  };
}

function myGroup(): MyGroupView {
  return {
    eventId: 1n,
    shift: Shift.am,
    shiftLabel: "Training Day 1 · AM",
    capacity: 4n,
    roadies: [chip(1n, "Ada Roadie", "SRV"), chip(2n, "Bea Roadie", "HST")],
  };
}

function notice(id: bigint): GroupChangeNotice {
  return {
    id,
    eventId: 1n,
    shift: Shift.am,
    shiftLabel: "Training Day 1 · AM",
    addedNames: ["Ada Roadie"],
    removedNames: ["Cy Roadie"],
    editorName: "Manager One",
    createdAt: 0n,
    dismissed: false,
    isDemo: false,
    trainerPrincipal: { toText: () => "aaaaa-aa" } as never,
  };
}

function actor(
  role: Role,
  options: {
    group?: MyGroupView | null;
    notices?: GroupChangeNotice[];
    board?: CheckInBoardView | null;
    demo?: {
      enabled: boolean;
      pretendDate?: { day: bigint; shift: DemoShift };
    };
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
    getMyGroup: vi.fn(async () => options.group ?? null),
    listGroupChangeNotices: vi.fn(async () => options.notices ?? []),
    listRoadies: vi.fn(async () => [
      roadie(1n, "Ada Roadie"),
      roadie(2n, "Bea Roadie"),
    ]),
    dismissGroupChangeNotice: vi.fn(async () => undefined),
    getDemoState: vi.fn(async () => ({
      enabled: options.demo?.enabled ?? false,
      demoTrainerStations: [],
      pretendDate: options.demo?.pretendDate,
    })),
    listPositions: vi.fn(async () => [POSITION]),
    listCrews: vi.fn(async () => []),
    getPhoto: vi.fn<backendInterface["getPhoto"]>(
      async () => new Uint8Array([1, 2, 3, 4]),
    ),
    getStoreInfo: vi.fn(async () => STORE),
    getCheckInBoard: vi.fn(async () => options.board ?? checkInBoard()),
    recordCheckIn: vi.fn<backendInterface["recordCheckIn"]>(
      async () => undefined,
    ),
  };
}

describe("Today page trainer My group", () => {
  it("shows the trainer's group with their roadies and a link to all groups", async () => {
    const a = actor(Role.trainer, { group: myGroup() });
    renderPageWithActor(TodayPage, a, { path: "/today" });

    const section = await screen.findByTestId("today.myGroup.section");
    expect(
      within(section).getByText("My group · Training Day 1 · AM"),
    ).toBeInTheDocument();
    expect(within(section).getByText("Ada Roadie")).toBeInTheDocument();
    expect(within(section).getByText("Bea Roadie")).toBeInTheDocument();

    const link = within(section).getByTestId("today.myGroup.view_all_link");
    expect(link).toHaveAttribute("href", "/groups");
  });

  it("shows the placeholder when the trainer has no group", async () => {
    const a = actor(Role.trainer, { group: null });
    renderPageWithActor(TodayPage, a, { path: "/today" });

    expect(await screen.findByTestId("today.placeholder")).toBeInTheDocument();
    expect(
      screen.queryByTestId("today.myGroup.section"),
    ).not.toBeInTheDocument();
  });

  it("shows the placeholder to a role that may not read groups", async () => {
    const a = actor(Role.kiosk, { group: myGroup() });
    renderPageWithActor(TodayPage, a, { path: "/today" });

    expect(await screen.findByTestId("today.placeholder")).toBeInTheDocument();
    // The group read never runs for a role the backend would reject.
    expect(a.getMyGroup).not.toHaveBeenCalled();
  });

  it("shows and dismisses the group-change notice card", async () => {
    const a = actor(Role.trainer, { group: myGroup(), notices: [notice(9n)] });
    const user = userEvent.setup();
    renderPageWithActor(TodayPage, a, { path: "/today" });

    const card = await screen.findByTestId("today.notice.card");
    expect(within(card).getByText("Your group changed")).toBeInTheDocument();
    expect(within(card).getByText("Added: Ada Roadie")).toBeInTheDocument();
    expect(within(card).getByText("Removed: Cy Roadie")).toBeInTheDocument();

    await user.click(within(card).getByTestId("today.notice.dismiss_button"));
    expect(a.dismissGroupChangeNotice).toHaveBeenCalledWith(9n);
  });

  it("opens the shared card pop-up when a group roadie is tapped", async () => {
    const a = actor(Role.trainer, { group: myGroup() });
    const user = userEvent.setup();
    renderPageWithActor(TodayPage, a, { path: "/today" });

    const item = await screen.findByTestId("today.myGroup.item.0.link");
    await user.click(item);

    const modal = await screen.findByTestId("roadie.card_modal");
    expect(within(modal).getByTestId("roadie.flip_card")).toBeInTheDocument();
  });

  it("shows a loading state while the trainer's group is being read", async () => {
    const a = actor(Role.trainer, { group: myGroup() });
    // Hold the group read open so the loading branch is observable.
    a.getMyGroup.mockImplementation(() => new Promise(() => {}));
    renderPageWithActor(TodayPage, a, { path: "/today" });

    expect(
      await screen.findByTestId("today.myGroup.loading_state"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("today.placeholder")).not.toBeInTheDocument();
  });

  it("redirects a Kiosk login away from Today to the kiosk surface", async () => {
    const a = actor(Role.kiosk, { group: myGroup() });
    renderPageWithActor(TodayPage, a, { path: "/today" });

    // The kiosk role never renders the Today content; the group read is skipped.
    await waitFor(() => expect(a.getMyGroup).not.toHaveBeenCalled());
    expect(
      screen.queryByTestId("today.myGroup.section"),
    ).not.toBeInTheDocument();
  });
});

/**
 * The trainer check-in board on Today: one row per roadie in the trainer's own
 * group with Present / Late / Absent, the checked-in count, and the locked
 * read-only state. The actor is mocked, so this proves the component contract,
 * not the real canister's group and lock enforcement.
 */
describe("Today trainer check-in board", () => {
  it("records Present for a roadie in the trainer's own group", async () => {
    const a = actor(Role.trainer, { group: myGroup() });
    const user = userEvent.setup();
    renderPageWithActor(TodayPage, a, { path: "/today" });

    const row = await screen.findByTestId("today.checkIn.row.0");
    await user.click(
      within(row).getByTestId("today.checkIn.row.0.present_button"),
    );

    expect(a.recordCheckIn).toHaveBeenCalledWith(
      1n,
      Shift.am,
      1n,
      CheckInState.present,
      null,
      null,
    );
  });

  it("records Absent for a roadie in the trainer's own group", async () => {
    const a = actor(Role.trainer, { group: myGroup() });
    const user = userEvent.setup();
    renderPageWithActor(TodayPage, a, { path: "/today" });

    const row = await screen.findByTestId("today.checkIn.row.1");
    await user.click(
      within(row).getByTestId("today.checkIn.row.1.absent_button"),
    );

    expect(a.recordCheckIn).toHaveBeenCalledWith(
      1n,
      Shift.am,
      2n,
      CheckInState.absent,
      null,
      null,
    );
  });

  it("records Late with the tap time for a roadie in the trainer's own group", async () => {
    const a = actor(Role.trainer, { group: myGroup() });
    const user = userEvent.setup();
    renderPageWithActor(TodayPage, a, { path: "/today" });

    const row = await screen.findByTestId("today.checkIn.row.0");
    await user.click(
      within(row).getByTestId("today.checkIn.row.0.late_button"),
    );

    // The tap time is recorded automatically as a nanosecond timestamp.
    expect(a.recordCheckIn).toHaveBeenCalledTimes(1);
    const call = a.recordCheckIn.mock.calls[0];
    expect(call[3]).toBe(CheckInState.late);
    expect(typeof call[4]).toBe("bigint");
  });

  it("records Late with the pretend time, not the real clock, in demo mode", async () => {
    // The pretend date is 2026-07-15 AM. The recorded tap time must be the
    // pretend instant the banner resolves, not the real clock.
    const pretendDay = BigInt(Date.UTC(2026, 6, 15)) * 1_000_000n;
    const pretendDate = { day: pretendDay, shift: DemoShift.am };
    const a = actor(Role.trainer, {
      group: myGroup(),
      demo: { enabled: true, pretendDate },
    });
    const user = userEvent.setup();
    renderPageWithActor(TodayPage, a, { path: "/today" });

    const row = await screen.findByTestId("today.checkIn.row.0");
    await user.click(
      within(row).getByTestId("today.checkIn.row.0.late_button"),
    );

    expect(a.recordCheckIn).toHaveBeenCalledTimes(1);
    const call = a.recordCheckIn.mock.calls[0];
    expect(call[3]).toBe(CheckInState.late);
    // The recorded tap time is the pretend instant, not the real clock.
    const expected = pretendDateToInstant(pretendDate);
    expect(expected).not.toBeNull();
    expect(call[4]).toBe(BigInt(expected!.getTime()) * 1_000_000n);
  });

  it("shows the editable late time for a roadie already marked late", async () => {
    const a = actor(Role.trainer, {
      group: myGroup(),
      board: checkInBoard({
        checkedInCount: 1n,
        roadies: [
          {
            roadieId: 1n,
            name: "Ada Roadie",
            state: CheckInState.late,
            lateAt: 1_900_000_000_000_000_000n,
          },
          { roadieId: 2n, name: "Bea Roadie" },
        ],
      }),
    });
    renderPageWithActor(TodayPage, a, { path: "/today" });

    expect(
      await screen.findByTestId("today.checkIn.row.0.late_time_input"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("today.checkIn.row.0.late_time_save_button"),
    ).toBeInTheDocument();
  });

  it("shows the checked-in count from the board", async () => {
    const a = actor(Role.trainer, {
      group: myGroup(),
      board: checkInBoard({ checkedInCount: 1n, totalCount: 2n }),
    });
    renderPageWithActor(TodayPage, a, { path: "/today" });

    expect(
      await screen.findByTestId("today.checkIn.progress"),
    ).toHaveTextContent("1 of 2 checked in");
  });

  it("renders the board read-only and disables the buttons when locked", async () => {
    const a = actor(Role.trainer, {
      group: myGroup(),
      board: checkInBoard({ locked: true }),
    });
    renderPageWithActor(TodayPage, a, { path: "/today" });

    expect(await screen.findByTestId("today.checkIn.locked")).toHaveTextContent(
      "Locked: ask a manager to change.",
    );
    expect(
      screen.getByTestId("today.checkIn.row.0.present_button"),
    ).toBeDisabled();
    expect(
      screen.getByTestId("today.checkIn.row.0.late_button"),
    ).toBeDisabled();
    expect(
      screen.getByTestId("today.checkIn.row.0.absent_button"),
    ).toBeDisabled();
  });

  it("does not render the check-in board for a role that may not check in", async () => {
    // A Visiting Manager reaches Today read-only; the board is not mounted.
    const a = actor(Role.visitingManager, { group: myGroup() });
    renderPageWithActor(TodayPage, a, { path: "/today" });

    await screen.findByTestId("today.shifts.section");
    expect(
      screen.queryByTestId("today.checkIn.section"),
    ).not.toBeInTheDocument();
  });

  it("shows the demo photo URL on a check-in row when no stored photo exists", async () => {
    const DEMO_PHOTO_URL = "https://cdn.example.test/demo/checkin.webp";
    const a = actor(Role.trainer, {
      group: myGroup(),
      board: checkInBoard({
        roadies: [
          { roadieId: 1n, name: "Ada Roadie", demoPhotoUrl: DEMO_PHOTO_URL },
          { roadieId: 2n, name: "Bea Roadie" },
        ],
      }),
    });
    // No stored photo, so the demo URL is the only photo source.
    a.getPhoto.mockImplementation(async () => null);
    renderPageWithActor(TodayPage, a, { path: "/today" });

    const photo = await screen.findByTestId("today.checkIn.row.0.photo");
    const img = within(photo).getByRole("img", { name: "Ada Roadie" });
    expect(img).toHaveAttribute("src", DEMO_PHOTO_URL);
  });

  it("prefers a stored photo over the demo photo URL on a check-in row", async () => {
    const DEMO_PHOTO_URL = "https://cdn.example.test/demo/checkin.webp";
    const a = actor(Role.trainer, {
      group: myGroup(),
      board: checkInBoard({
        roadies: [
          { roadieId: 1n, name: "Ada Roadie", demoPhotoUrl: DEMO_PHOTO_URL },
          { roadieId: 2n, name: "Bea Roadie" },
        ],
      }),
    });
    renderPageWithActor(TodayPage, a, { path: "/today" });

    const photo = await screen.findByTestId("today.checkIn.row.0.photo");
    const img = within(photo).getByRole("img", { name: "Ada Roadie" });
    expect(img).toHaveAttribute("src", expect.stringContaining("data:image/"));
    expect(img).not.toHaveAttribute("src", DEMO_PHOTO_URL);
  });
});
