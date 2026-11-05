import { renderPageWithActor } from "@/__tests__/router-test-utils";
import type {
  EventId,
  GroupChangeNotice,
  LeaderSummary,
  Position,
  Roadie,
  ScheduleEvent,
  ShiftBoardRoadie,
  ShiftBoardView,
  backendInterface,
} from "@/backend";
import {
  EventKind,
  House,
  RoadieStatus,
  Role,
  RosterState,
  Shift,
} from "@/backend";
import GroupsPage from "@/pages/Groups";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const DAY_NS = 24n * 60n * 60n * 1_000_000_000n;
const NOW_NS = BigInt(Date.now()) * 1_000_000n;

/** A training day starting tomorrow, so it is the current-or-next shift. */
function trainingDay(id: bigint, name: string, start: bigint): ScheduleEvent {
  return { id, name, kind: EventKind.trainingDay, start };
}

function friendsAndFamily(
  id: bigint,
  name: string,
  start: bigint,
): ScheduleEvent {
  return { id, name, kind: EventKind.friendsAndFamily, start };
}

function chip(
  roadieId: bigint,
  name: string,
  positionCode: string,
  markedUnavailable = false,
): ShiftBoardRoadie {
  return {
    roadieId,
    name,
    positionCode,
    positionId: 0n,
    markedUnavailable,
  };
}

function position(id: bigint, name: string, code: string): Position {
  return {
    id,
    name,
    code,
    house: House.foh,
    openingBuildTo: 0n,
    afterOpeningBuildTo: 0n,
    minimumAge: 16n,
    shirtQty: 0n,
    shirtType: "",
    hatType: "",
    hatQty: 0n,
    needsAlcoholCert: false,
    defaultShirts: 0n,
    defaultHats: 0n,
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

/**
 * A principal mock that answers both `toText()` (used by the page) and
 * `toString()` (used by the board editor), so the trainer column's ocid is the
 * principal text rather than "[object Object]".
 */
function principal(principalText: string) {
  return {
    toText: () => principalText,
    toString: () => principalText,
  } as never;
}

function leader(principalText: string, name: string): LeaderSummary {
  return {
    principal: principal(principalText),
    title: "NSO Trainer",
    role: Role.trainer,
    trainerPositionIds: [0n],
    staffProfile: {
      fullName: name,
      title: "NSO Trainer",
      homeStoreNumber: "1",
      homeStoreCity: "Town",
      requestedRole: Role.trainer,
      trainerPositionIds: [0n],
    },
  };
}

const TRAINER_A = "aaaaa-aa";
const TRAINER_B = "bbbbb-bb";

const EVENT_1 = 1n;
const EVENT_2 = 2n;
const EVENT_FF = 3n;

const SCHEDULE: ScheduleEvent[] = [
  trainingDay(EVENT_1, "Training Day One", NOW_NS + DAY_NS),
  trainingDay(EVENT_2, "Training Day Two", NOW_NS + 2n * DAY_NS),
  friendsAndFamily(EVENT_FF, "Friends & Family Night", NOW_NS + 3n * DAY_NS),
];

function boardView(
  eventId: EventId,
  shift: Shift,
  overrides: Partial<ShiftBoardView> = {},
): ShiftBoardView {
  return {
    eventId,
    shift,
    isDemo: false,
    editedAt: 0n,
    groups: [
      {
        trainerPrincipal: principal(TRAINER_A),
        capacity: 4n,
        roadies: [chip(1n, "Ada Roadie", "SRV")],
      },
    ],
    offThisShift: [],
    unassigned: [chip(2n, "Bea Roadie", "HST")],
    ...overrides,
  };
}

function notice(id: bigint): GroupChangeNotice {
  return {
    id,
    eventId: EVENT_1,
    shift: Shift.am,
    shiftLabel: "Training Day 1 · AM",
    addedNames: ["Ada Roadie"],
    removedNames: [],
    editorName: "Manager One",
    createdAt: 0n,
    dismissed: false,
    isDemo: false,
    trainerPrincipal: principal(TRAINER_A),
  };
}

/**
 * A typed actor for the Groups page. Every method the page reads is supplied;
 * the board read returns the same view for any shift so the picker can switch
 * without a per-shift fixture.
 */
function actor(role: Role, options: { notices?: GroupChangeNotice[] } = {}) {
  const board = vi.fn<() => Promise<ShiftBoardView | null>>(async () =>
    boardView(EVENT_1, Shift.am),
  );
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
    listSchedule: vi.fn(async () => SCHEDULE),
    getStoreInfo: vi.fn(async () => ({
      amShiftEnd: 0n,
      pmShiftStart: 0n,
      storeNumber: "1",
      leaderTalkName: "Leader Talk",
      appName: "Roadie Roster",
      leaderTalkSize: 0n,
      amShiftStart: 0n,
      openingDate: 0n,
      pmShiftEnd: 0n,
      trainingGroupSize: 4n,
      address: "1 Main St",
      locationName: "Town",
      paperworkDueDate: 0n,
      timeZone: "America/Chicago",
      storePhone: "+1-555-0000",
    })),
    listPositions: vi.fn(async () => [position(0n, "Servers", "SRV")]),
    listRoadies: vi.fn(async () => [
      roadie(1n, "Ada Roadie"),
      roadie(2n, "Bea Roadie"),
    ]),
    listLeaders: vi.fn(async () => [
      leader(TRAINER_A, "Trainer A"),
      leader(TRAINER_B, "Trainer B"),
    ]),
    listGroupChangeNotices: vi.fn(async () => options.notices ?? []),
    getShiftBoard: board,
    saveShiftBoard: vi.fn<backendInterface["saveShiftBoard"]>(
      async () => undefined,
    ),
    copyShiftBoard: vi.fn(async () => undefined),
    autoFillShiftBoard: vi.fn(async () => undefined),
    clearShiftBoard: vi.fn(async () => undefined),
    dismissGroupChangeNotice: vi.fn(async () => undefined),
    getDemoState: vi.fn(async () => ({
      enabled: false,
      demoTrainerStations: [],
    })),
  };
}

describe("Groups page", () => {
  it("opens on the current or next shift and shows the board", async () => {
    const a = actor(Role.admin);
    renderPageWithActor(GroupsPage, a, { path: "/groups" });

    // The page header and the board render.
    expect(await screen.findByTestId("groups.page")).toBeInTheDocument();
    expect(await screen.findByTestId("groups.board")).toBeInTheDocument();

    // The default shift is the earliest upcoming one: Training Day 1 · AM.
    expect(a.getShiftBoard).toHaveBeenCalledWith(EVENT_1, Shift.am);
  });

  it("switches shifts through the picker between training days and F&F nights", async () => {
    const a = actor(Role.admin);
    const user = userEvent.setup();
    renderPageWithActor(GroupsPage, a, { path: "/groups" });

    await screen.findByTestId("groups.board");

    // The picker lists both training days and the F&F night.
    expect(
      screen.getByTestId(`groups.shift.day.${EVENT_1}`),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`groups.shift.day.${EVENT_2}`),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`groups.shift.day.${EVENT_FF}`),
    ).toBeInTheDocument();

    // Selecting Training Day 2 reads that event's board.
    await user.click(screen.getByTestId(`groups.shift.day.${EVENT_2}`));
    expect(a.getShiftBoard).toHaveBeenCalledWith(EVENT_2, Shift.am);

    // F&F nights are PM only: the AM toggle is disabled once F&F is selected.
    await user.click(screen.getByTestId(`groups.shift.day.${EVENT_FF}`));
    expect(a.getShiftBoard).toHaveBeenCalledWith(EVENT_FF, Shift.pm);
    expect(screen.getByTestId("groups.shift.am")).toBeDisabled();
    expect(screen.getByTestId("groups.shift.pm")).not.toBeDisabled();
  });

  it("shows the warnings banner for unassigned roadies and over-capacity trainers", async () => {
    const a = actor(Role.admin);
    a.getShiftBoard.mockResolvedValue(
      boardView(EVENT_1, Shift.am, {
        groups: [
          {
            trainerPrincipal: principal(TRAINER_A),
            capacity: 1n,
            roadies: [
              chip(1n, "Ada Roadie", "SRV"),
              chip(3n, "Cy Roadie", "SRV"),
            ],
          },
        ],
        unassigned: [chip(2n, "Bea Roadie", "HST")],
      }),
    );
    renderPageWithActor(GroupsPage, a, { path: "/groups" });

    const banner = await screen.findByTestId("groups.warnings.banner");
    expect(
      within(banner).getByTestId("groups.warnings.unassigned"),
    ).toBeInTheDocument();
    expect(
      within(banner).getByTestId("groups.warnings.over_capacity"),
    ).toBeInTheDocument();
  });

  it("shows a read-only note to a viewer who may not edit", async () => {
    const a = actor(Role.trainer);
    renderPageWithActor(GroupsPage, a, { path: "/groups" });

    expect(await screen.findByTestId("groups.read_only")).toBeInTheDocument();
    // A non-editor sees no board tools.
    expect(screen.queryByTestId("groups.toolbar")).not.toBeInTheDocument();
  });

  it("shows the board tools to an editor", async () => {
    const a = actor(Role.trainingManager);
    renderPageWithActor(GroupsPage, a, { path: "/groups" });

    expect(await screen.findByTestId("groups.toolbar")).toBeInTheDocument();
    expect(screen.queryByTestId("groups.read_only")).not.toBeInTheDocument();
  });

  it("renders the dismissible group-change notice card", async () => {
    const a = actor(Role.trainer, { notices: [notice(7n)] });
    const user = userEvent.setup();
    renderPageWithActor(GroupsPage, a, { path: "/groups" });

    const card = await screen.findByTestId("groups.notice.card");
    expect(within(card).getByText("Your group changed")).toBeInTheDocument();
    expect(within(card).getByText("Added: Ada Roadie")).toBeInTheDocument();

    await user.click(within(card).getByTestId("groups.notice.dismiss_button"));
    expect(a.dismissGroupChangeNotice).toHaveBeenCalledWith(7n);
  });

  it("shows a roadie chip's photo, name, position code and unavailable dot", async () => {
    const a = actor(Role.admin);
    a.getShiftBoard.mockResolvedValue(
      boardView(EVENT_1, Shift.am, {
        groups: [
          {
            trainerPrincipal: principal(TRAINER_A),
            capacity: 4n,
            roadies: [chip(1n, "Ada Roadie", "SRV", true)],
          },
        ],
        unassigned: [],
      }),
    );
    renderPageWithActor(GroupsPage, a, { path: "/groups" });

    const column = await screen.findByTestId(
      `groups.board.trainer.${TRAINER_A}`,
    );
    expect(within(column).getByText("Ada Roadie")).toBeInTheDocument();
    expect(within(column).getByText("SRV")).toBeInTheDocument();
    // The yellow dot carries the "Marked unavailable" tooltip.
    const dot = within(column).getByTestId(
      `groups.board.trainer.${TRAINER_A}.roadie.1.unavailable`,
    );
    expect(dot).toHaveAttribute("title", "Marked unavailable");
  });

  it("shows the demo photo URL on a roadie chip when no stored photo exists", async () => {
    const DEMO_PHOTO_URL = "https://cdn.example.test/demo/chip.webp";
    const a = actor(Role.admin);
    a.getShiftBoard.mockResolvedValue(
      boardView(EVENT_1, Shift.am, {
        groups: [
          {
            trainerPrincipal: principal(TRAINER_A),
            capacity: 4n,
            roadies: [
              {
                ...chip(1n, "Ada Roadie", "SRV"),
                demoPhotoUrl: DEMO_PHOTO_URL,
              },
            ],
          },
        ],
        unassigned: [],
      }),
    );
    renderPageWithActor(GroupsPage, a, { path: "/groups" });

    const column = await screen.findByTestId(
      `groups.board.trainer.${TRAINER_A}`,
    );
    const img = within(column).getByRole("img", { name: "Roadie photo" });
    expect(img).toHaveAttribute("src", DEMO_PHOTO_URL);
  });

  it("prefers a stored photo over the demo photo URL on a roadie chip", async () => {
    const DEMO_PHOTO_URL = "https://cdn.example.test/demo/chip.webp";
    const a = actor(Role.admin);
    a.getShiftBoard.mockResolvedValue(
      boardView(EVENT_1, Shift.am, {
        groups: [
          {
            trainerPrincipal: principal(TRAINER_A),
            capacity: 4n,
            roadies: [
              {
                ...chip(1n, "Ada Roadie", "SRV"),
                demoPhotoUrl: DEMO_PHOTO_URL,
                photo: new Uint8Array([1, 2, 3, 4]),
              },
            ],
          },
        ],
        unassigned: [],
      }),
    );
    renderPageWithActor(GroupsPage, a, { path: "/groups" });

    const column = await screen.findByTestId(
      `groups.board.trainer.${TRAINER_A}`,
    );
    const img = within(column).getByRole("img", { name: "Roadie photo" });
    expect(img).toHaveAttribute("src", expect.stringContaining("data:image/"));
    expect(img).not.toHaveAttribute("src", DEMO_PHOTO_URL);
  });

  it("moves a roadie between columns and trays by drag and drop", async () => {
    const a = actor(Role.admin);
    renderPageWithActor(GroupsPage, a, { path: "/groups" });

    const column = await screen.findByTestId(
      `groups.board.trainer.${TRAINER_A}`,
    );
    // Ada starts in Trainer A's column; Bea is unassigned.
    expect(within(column).getByText("Ada Roadie")).toBeInTheDocument();

    // Drop Bea (id 2) onto Trainer A's column.
    const dataTransfer = {
      effectAllowed: "",
      dropEffect: "",
      setData: vi.fn(),
      getData: () => "2",
    };
    fireEvent.drop(column, { dataTransfer });

    // The board is now dirty and the save button is enabled.
    expect(
      await screen.findByTestId("groups.board.unsaved"),
    ).toBeInTheDocument();
    const save = screen.getByTestId("groups.board.save_button");
    expect(save).not.toBeDisabled();

    await userEvent.setup().click(save);
    await waitFor(() => expect(a.saveShiftBoard).toHaveBeenCalledTimes(1));
    const saved = a.saveShiftBoard.mock.calls[0][0];
    const group = saved.groups.find(
      (candidate) => candidate.trainerPrincipal.toString() === TRAINER_A,
    );
    expect(group?.roadieIds).toContain(2n);
  });

  it("moves a roadie through the keyboard Move to… path", async () => {
    const a = actor(Role.admin);
    const user = userEvent.setup();
    renderPageWithActor(GroupsPage, a, { path: "/groups" });

    const column = await screen.findByTestId(
      `groups.board.trainer.${TRAINER_A}`,
    );
    // Select Ada, then open the Move to… dialog.
    await user.click(
      within(column).getByTestId(
        `groups.board.trainer.${TRAINER_A}.roadie.1.select_button`,
      ),
    );
    await user.click(screen.getByTestId("groups.board.move_selected_button"));

    const dialog = await screen.findByTestId("groups.move.dialog");
    // Off this shift is offered as a destination.
    await user.click(within(dialog).getByTestId("groups.move.off"));
    await user.click(within(dialog).getByTestId("groups.move.confirm_button"));

    // The move marks the board dirty; saving sends Ada to the Off list.
    await user.click(await screen.findByTestId("groups.board.save_button"));
    await waitFor(() => expect(a.saveShiftBoard).toHaveBeenCalledTimes(1));
    const saved = a.saveShiftBoard.mock.calls[0][0];
    expect(saved.offRoadieIds).toContain(1n);
  });

  it("renders the phone list grouped by trainer with a Move to… bar", async () => {
    const a = actor(Role.admin);
    const user = userEvent.setup();
    // A phone-width viewport selects the grouped list instead of the board.
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 500,
    });
    try {
      renderPageWithActor(GroupsPage, a, { path: "/groups" });

      const phone = await screen.findByTestId("groups.phone");
      // The trainer group and the Unassigned section render.
      expect(
        within(phone).getByTestId(`groups.phone.group.${TRAINER_A}`),
      ).toBeInTheDocument();
      expect(
        within(phone).getByTestId("groups.phone.group.unassigned"),
      ).toBeInTheDocument();

      // Tapping a roadie reveals the Move to… bar.
      await user.click(
        within(phone).getByTestId(
          `groups.phone.group.${TRAINER_A}.roadie.1.select_button`,
        ),
      );
      expect(
        await screen.findByTestId("groups.phone.move_bar"),
      ).toBeInTheDocument();
    } finally {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: originalWidth,
      });
    }
  });

  it("copies another shift's board after confirmation", async () => {
    const a = actor(Role.admin);
    const user = userEvent.setup();
    renderPageWithActor(GroupsPage, a, { path: "/groups" });

    await screen.findByTestId("groups.board");
    await user.click(screen.getByTestId("groups.toolbar.copy_button"));

    const dialog = await screen.findByTestId("groups.toolbar.copy_dialog");
    // The confirm button is disabled until a source shift is chosen.
    expect(
      within(dialog).getByTestId("groups.toolbar.copy_confirm_button"),
    ).toBeDisabled();

    // Choose Training Day 2 as the source. Its label now carries the short
    // date (the accepted change), and both AM and PM options share that day
    // label, so pick the first matching option.
    await user.click(
      within(dialog).getByTestId("groups.toolbar.copy_source_select"),
    );
    const dayTwoOptions = await screen.findAllByRole("option", {
      name: /^Training Day 2 · /,
    });
    await user.click(dayTwoOptions[0]);
    await user.click(
      within(dialog).getByTestId("groups.toolbar.copy_confirm_button"),
    );

    await waitFor(() => expect(a.copyShiftBoard).toHaveBeenCalledTimes(1));
    expect(a.copyShiftBoard).toHaveBeenCalledWith(
      EVENT_1,
      Shift.am,
      EVENT_2,
      Shift.am,
    );
  });

  it("makes groups for me and clears the board from the toolbar", async () => {
    const a = actor(Role.admin);
    const user = userEvent.setup();
    renderPageWithActor(GroupsPage, a, { path: "/groups" });

    await screen.findByTestId("groups.board");
    await user.click(screen.getByTestId("groups.toolbar.auto_fill_button"));
    await waitFor(() => expect(a.autoFillShiftBoard).toHaveBeenCalledTimes(1));
    expect(a.autoFillShiftBoard).toHaveBeenCalledWith(EVENT_1, Shift.am);

    // Clear board asks for confirmation first.
    await user.click(screen.getByTestId("groups.toolbar.clear_button"));
    const dialog = await screen.findByTestId("groups.toolbar.clear_dialog");
    await user.click(
      within(dialog).getByTestId("groups.toolbar.clear_confirm_button"),
    );
    await waitFor(() => expect(a.clearShiftBoard).toHaveBeenCalledTimes(1));
    expect(a.clearShiftBoard).toHaveBeenCalledWith(EVENT_1, Shift.am);
  });

  it("lists roadies scheduled while unavailable in the warnings banner", async () => {
    const a = actor(Role.admin);
    a.getShiftBoard.mockResolvedValue(
      boardView(EVENT_1, Shift.am, {
        groups: [
          {
            trainerPrincipal: principal(TRAINER_A),
            capacity: 4n,
            roadies: [chip(1n, "Ada Roadie", "SRV", true)],
          },
        ],
        unassigned: [],
      }),
    );
    renderPageWithActor(GroupsPage, a, { path: "/groups" });

    const banner = await screen.findByTestId("groups.warnings.banner");
    expect(
      within(banner).getByTestId("groups.warnings.unavailable"),
    ).toBeInTheDocument();
  });

  it("refreshes the board after Make groups for me fills the empty seats", async () => {
    const a = actor(Role.admin);
    const user = userEvent.setup();
    // The first read has an empty group; the refetch after auto-fill has it
    // filled from the Unassigned pool.
    a.getShiftBoard
      .mockResolvedValueOnce(
        boardView(EVENT_1, Shift.am, {
          groups: [
            {
              trainerPrincipal: principal(TRAINER_A),
              capacity: 2n,
              roadies: [],
            },
          ],
          unassigned: [chip(2n, "Bea Roadie", "HST")],
        }),
      )
      .mockResolvedValue(
        boardView(EVENT_1, Shift.am, {
          groups: [
            {
              trainerPrincipal: principal(TRAINER_A),
              capacity: 2n,
              roadies: [chip(2n, "Bea Roadie", "HST")],
            },
          ],
          unassigned: [],
        }),
      );
    renderPageWithActor(GroupsPage, a, { path: "/groups" });

    const column = await screen.findByTestId(
      `groups.board.trainer.${TRAINER_A}`,
    );
    expect(within(column).queryByText("Bea Roadie")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("groups.toolbar.auto_fill_button"));
    await waitFor(() => expect(a.autoFillShiftBoard).toHaveBeenCalledTimes(1));

    // The board refetches and the filled group renders.
    await waitFor(() =>
      expect(
        within(
          screen.getByTestId(`groups.board.trainer.${TRAINER_A}`),
        ).getByText("Bea Roadie"),
      ).toBeInTheDocument(),
    );
  });

  it("empties the board after Clear board is confirmed", async () => {
    const a = actor(Role.admin);
    const user = userEvent.setup();
    a.getShiftBoard
      .mockResolvedValueOnce(boardView(EVENT_1, Shift.am))
      .mockResolvedValue(
        boardView(EVENT_1, Shift.am, { groups: [], unassigned: [] }),
      );
    renderPageWithActor(GroupsPage, a, { path: "/groups" });

    const column = await screen.findByTestId(
      `groups.board.trainer.${TRAINER_A}`,
    );
    expect(within(column).getByText("Ada Roadie")).toBeInTheDocument();

    await user.click(screen.getByTestId("groups.toolbar.clear_button"));
    const dialog = await screen.findByTestId("groups.toolbar.clear_dialog");
    await user.click(
      within(dialog).getByTestId("groups.toolbar.clear_confirm_button"),
    );
    await waitFor(() => expect(a.clearShiftBoard).toHaveBeenCalledTimes(1));

    // The refetched board has no trainer columns.
    await waitFor(() =>
      expect(
        screen.queryByTestId(`groups.board.trainer.${TRAINER_A}`),
      ).not.toBeInTheDocument(),
    );
  });

  it("replaces the board with the copied shift's groups after Copy from…", async () => {
    const a = actor(Role.admin);
    const user = userEvent.setup();
    a.getShiftBoard
      .mockResolvedValueOnce(boardView(EVENT_1, Shift.am))
      .mockResolvedValue(
        boardView(EVENT_1, Shift.am, {
          groups: [
            {
              trainerPrincipal: principal(TRAINER_B),
              capacity: 3n,
              roadies: [chip(3n, "Cy Roadie", "SRV")],
            },
          ],
          unassigned: [],
        }),
      );
    renderPageWithActor(GroupsPage, a, { path: "/groups" });

    await screen.findByTestId(`groups.board.trainer.${TRAINER_A}`);
    await user.click(screen.getByTestId("groups.toolbar.copy_button"));
    const dialog = await screen.findByTestId("groups.toolbar.copy_dialog");
    await user.click(
      within(dialog).getByTestId("groups.toolbar.copy_source_select"),
    );
    const dayTwoOptions = await screen.findAllByRole("option", {
      name: /^Training Day 2 · /,
    });
    await user.click(dayTwoOptions[0]);
    await user.click(
      within(dialog).getByTestId("groups.toolbar.copy_confirm_button"),
    );
    await waitFor(() => expect(a.copyShiftBoard).toHaveBeenCalledTimes(1));

    // The refetched board shows the copied trainer's group.
    await waitFor(() =>
      expect(
        screen.getByTestId(`groups.board.trainer.${TRAINER_B}`),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByTestId(`groups.board.trainer.${TRAINER_A}`),
    ).not.toBeInTheDocument();
  });

  it("adds a trainer to the shift from the Add trainer dialog", async () => {
    const a = actor(Role.admin);
    const user = userEvent.setup();
    renderPageWithActor(GroupsPage, a, { path: "/groups" });

    await screen.findByTestId("groups.board");
    await user.click(screen.getByTestId("groups.board.add_trainer_button"));

    const dialog = await screen.findByTestId("groups.add_trainer.dialog");
    // Trainer B is not yet on the shift, so they are offered.
    await user.click(
      within(dialog).getByTestId(`groups.add_trainer.option.${TRAINER_B}`),
    );
    await user.click(
      within(dialog).getByTestId("groups.add_trainer.confirm_button"),
    );

    // The new empty group appears and the board is dirty.
    expect(
      await screen.findByTestId(`groups.board.trainer.${TRAINER_B}`),
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId("groups.board.unsaved"),
    ).toBeInTheDocument();
  });

  it("still shows the empty state when the board read returns null", async () => {
    // Adjacent behavior: a null board read (no stored board and no matching
    // event) still renders the empty state rather than a board.
    const a = actor(Role.admin);
    a.getShiftBoard.mockResolvedValue(null);
    renderPageWithActor(GroupsPage, a, { path: "/groups" });

    expect(await screen.findByTestId("page.empty_state")).toBeInTheDocument();
    expect(screen.queryByTestId("groups.board")).not.toBeInTheDocument();
    expect(screen.queryByTestId("groups.toolbar")).not.toBeInTheDocument();
  });

  it("still numbers training days chronologically and ignores other event kinds", async () => {
    // Adjacent behavior: the picker's day chips renumber by start time and a
    // non-shift event kind contributes no chip.
    const a = actor(Role.admin);
    const other: ScheduleEvent = {
      id: 9n,
      name: "Opening Day",
      kind: EventKind.openingDay,
      start: NOW_NS + DAY_NS,
    };
    a.listSchedule.mockResolvedValue([
      trainingDay(EVENT_2, "Training Day Two", NOW_NS + 2n * DAY_NS),
      other,
      trainingDay(EVENT_1, "Training Day One", NOW_NS + DAY_NS),
    ]);
    renderPageWithActor(GroupsPage, a, { path: "/groups" });

    await screen.findByTestId("groups.board");
    // The earlier training day is numbered 1 even though it is listed second.
    expect(screen.getByTestId(`groups.shift.day.${EVENT_1}`)).toHaveTextContent(
      "Training Day 1",
    );
    expect(screen.getByTestId(`groups.shift.day.${EVENT_2}`)).toHaveTextContent(
      "Training Day 2",
    );
    // The opening-day event contributes no chip.
    expect(screen.queryByTestId("groups.shift.day.9")).not.toBeInTheDocument();
  });

  it("still disables the AM toggle for a Friends & Family night", async () => {
    // Adjacent behavior: F&F nights are PM only, so their chip disables AM.
    const a = actor(Role.admin);
    const user = userEvent.setup();
    renderPageWithActor(GroupsPage, a, { path: "/groups" });

    await screen.findByTestId("groups.board");
    await user.click(screen.getByTestId(`groups.shift.day.${EVENT_FF}`));

    expect(screen.getByTestId("groups.shift.am")).toBeDisabled();
    expect(screen.getByTestId("groups.shift.pm")).not.toBeDisabled();
  });

  it("shows the board and toolbar for an unsaved empty view instead of the empty state", async () => {
    // Accepted change: when no board is stored but the event exists, the read
    // returns an unsaved empty view (no trainer columns, every active roadie in
    // Unassigned, Off empty, editedAt 0). The page must render the board and
    // toolbar for editors, not the empty state.
    const a = actor(Role.admin);
    a.getShiftBoard.mockResolvedValue(
      boardView(EVENT_1, Shift.am, {
        groups: [],
        offThisShift: [],
        unassigned: [
          chip(1n, "Ada Roadie", "SRV"),
          chip(2n, "Bea Roadie", "HST"),
        ],
        editedAt: 0n,
      }),
    );
    renderPageWithActor(GroupsPage, a, { path: "/groups" });

    // The board and its toolbar render; the empty state does not.
    expect(await screen.findByTestId("groups.board")).toBeInTheDocument();
    expect(screen.getByTestId("groups.toolbar")).toBeInTheDocument();
    expect(screen.queryByTestId("page.empty_state")).not.toBeInTheDocument();

    // No trainer columns yet, and both active roadies sit in Unassigned.
    expect(
      screen.queryByTestId(`groups.board.trainer.${TRAINER_A}`),
    ).not.toBeInTheDocument();
    const unassigned = screen.getByTestId("groups.board.unassigned");
    expect(within(unassigned).getByText("Ada Roadie")).toBeInTheDocument();
    expect(within(unassigned).getByText("Bea Roadie")).toBeInTheDocument();
    // Off this shift is empty.
    expect(
      within(screen.getByTestId("groups.board.off")).queryByText("Ada Roadie"),
    ).not.toBeInTheDocument();
  });

  it("saves a brand-new unsaved board, creating it", async () => {
    // Accepted change: saving the unsaved view creates the board.
    const a = actor(Role.admin);
    a.getShiftBoard.mockResolvedValue(
      boardView(EVENT_1, Shift.am, {
        groups: [],
        offThisShift: [],
        unassigned: [chip(1n, "Ada Roadie", "SRV")],
        editedAt: 0n,
      }),
    );
    const user = userEvent.setup();
    renderPageWithActor(GroupsPage, a, { path: "/groups" });

    await screen.findByTestId("groups.board");
    // Add a trainer so the board is dirty, then save it.
    await user.click(screen.getByTestId("groups.board.add_trainer_button"));
    const dialog = await screen.findByTestId("groups.add_trainer.dialog");
    await user.click(
      within(dialog).getByTestId(`groups.add_trainer.option.${TRAINER_A}`),
    );
    await user.click(
      within(dialog).getByTestId("groups.add_trainer.confirm_button"),
    );

    await user.click(await screen.findByTestId("groups.board.save_button"));
    await waitFor(() => expect(a.saveShiftBoard).toHaveBeenCalledTimes(1));
    const saved = a.saveShiftBoard.mock.calls[0][0];
    expect(saved.eventId).toBe(EVENT_1);
    expect(saved.shift).toBe(Shift.am);
    expect(
      saved.groups.some(
        (group) => group.trainerPrincipal.toString() === TRAINER_A,
      ),
    ).toBe(true);
  });

  it("creates trainer columns from eligible trainers and fills round-robin on auto-fill", async () => {
    // Accepted change: auto-fill on a brand-new board starts columns for every
    // eligible trainer and fills roadies round-robin. The first read is the
    // unsaved empty view; the refetch after auto-fill has the filled columns.
    const a = actor(Role.admin);
    a.getShiftBoard
      .mockResolvedValueOnce(
        boardView(EVENT_1, Shift.am, {
          groups: [],
          offThisShift: [],
          unassigned: [
            chip(1n, "Ada Roadie", "SRV"),
            chip(2n, "Bea Roadie", "HST"),
          ],
          editedAt: 0n,
        }),
      )
      .mockResolvedValue(
        boardView(EVENT_1, Shift.am, {
          groups: [
            {
              trainerPrincipal: principal(TRAINER_A),
              capacity: 4n,
              roadies: [chip(1n, "Ada Roadie", "SRV")],
            },
            {
              trainerPrincipal: principal(TRAINER_B),
              capacity: 4n,
              roadies: [chip(2n, "Bea Roadie", "HST")],
            },
          ],
          offThisShift: [],
          unassigned: [],
        }),
      );
    const user = userEvent.setup();
    renderPageWithActor(GroupsPage, a, { path: "/groups" });

    await screen.findByTestId("groups.board");
    await user.click(screen.getByTestId("groups.toolbar.auto_fill_button"));
    await waitFor(() => expect(a.autoFillShiftBoard).toHaveBeenCalledTimes(1));
    expect(a.autoFillShiftBoard).toHaveBeenCalledWith(EVENT_1, Shift.am);

    // Both eligible trainers get a column, each with one roadie.
    const columnA = await screen.findByTestId(
      `groups.board.trainer.${TRAINER_A}`,
    );
    const columnB = await screen.findByTestId(
      `groups.board.trainer.${TRAINER_B}`,
    );
    expect(within(columnA).getByText("Ada Roadie")).toBeInTheDocument();
    expect(within(columnB).getByText("Bea Roadie")).toBeInTheDocument();
  });

  it("adds the short date to shift tabs when two events share a label", async () => {
    // Accepted change: two Friends & Family nights share the day label, so each
    // tab includes the short date to tell them apart.
    const a = actor(Role.admin);
    const ff1 = friendsAndFamily(
      3n,
      "Friends & Family Night",
      NOW_NS + 3n * DAY_NS,
    );
    const ff2 = friendsAndFamily(
      4n,
      "Friends & Family Night",
      NOW_NS + 4n * DAY_NS,
    );
    a.listSchedule.mockResolvedValue([
      trainingDay(EVENT_1, "Training Day One", NOW_NS + DAY_NS),
      ff1,
      ff2,
    ]);
    renderPageWithActor(GroupsPage, a, { path: "/groups" });

    await screen.findByTestId("groups.board");
    const tab1 = screen.getByTestId("groups.shift.day.3");
    const tab2 = screen.getByTestId("groups.shift.day.4");
    // Both carry the shared label plus a distinct short date.
    expect(tab1).toHaveTextContent("Friends & Family ·");
    expect(tab2).toHaveTextContent("Friends & Family ·");
    expect(tab1.textContent).not.toEqual(tab2.textContent);
  });

  it("offers a trainer, Off this shift and the other shift in the phone Move to… dialog", async () => {
    const a = actor(Role.admin);
    const user = userEvent.setup();
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 500,
    });
    try {
      renderPageWithActor(GroupsPage, a, { path: "/groups" });

      const phone = await screen.findByTestId("groups.phone");
      await user.click(
        within(phone).getByTestId(
          `groups.phone.group.${TRAINER_A}.roadie.1.select_button`,
        ),
      );
      await user.click(await screen.findByTestId("groups.phone.move_button"));

      const dialog = await screen.findByTestId("groups.move.dialog");
      // The trainer, Off this shift and the same day's other shift are offered.
      expect(
        within(dialog).getByTestId(`groups.move.trainer.${TRAINER_A}`),
      ).toBeInTheDocument();
      expect(within(dialog).getByTestId("groups.move.off")).toBeInTheDocument();
      expect(
        within(dialog).getByTestId(`groups.move.shift.${EVENT_1}:pm`),
      ).toBeInTheDocument();
    } finally {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: originalWidth,
      });
    }
  });
});
