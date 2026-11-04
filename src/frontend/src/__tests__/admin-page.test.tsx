import { renderPageWithActor } from "@/__tests__/router-test-utils";
import type {
  AccessGrant,
  Checklists,
  OrientationSessionOption,
  Position,
  RetentionSettings,
  ScheduleEvent,
  StoreInfo,
  backendInterface,
} from "@/backend";
import { EventKind, House, Role, UniformItemType } from "@/backend";
import AdminPage from "@/pages/Admin";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

/** The seeded store identity a fresh install carries. */
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

/** Two of the 18 seeded positions, one per house. */
const POSITIONS: Position[] = [
  {
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
    defaultShirts: 3n,
    defaultHats: 2n,
    shirtType: "Polo",
    shirtQty: 2n,
    hatType: "Cap",
    hatQty: 1n,
  },
  {
    id: 5n,
    name: "Fry / Salad",
    code: "FS",
    house: House.boh,
    openingBuildTo: 16n,
    afterOpeningBuildTo: 16n,
    minimumAge: 16n,
    shirtsRequired: 2n,
    hatsRequired: 1n,
    needsAlcoholCert: false,
    defaultShirts: 3n,
    defaultHats: 2n,
    shirtType: "Polo",
    shirtQty: 2n,
    hatType: "Cap",
    hatQty: 1n,
  },
];

/** Two of the 12 seeded opening-schedule events. */
const SCHEDULE: ScheduleEvent[] = [
  {
    id: 0n,
    kind: EventKind.deadline,
    name: "Paperwork due",
    start: 1_801_202_400_000_000_000n,
  },
  {
    id: 10n,
    kind: EventKind.openingDay,
    name: "Opening day",
    start: 1_802_066_400_000_000_000n,
  },
];

const CHECKLISTS: Checklists = {
  orientationUniform: [
    {
      id: 0n,
      text: "Non-slip shoes",
      requiresAlcoholCert: false,
      minorOnly: false,
      itemType: UniformItemType.checkbox,
    },
  ],
  paperwork: [
    {
      id: 0n,
      text: "Onboarding",
      requiresAlcoholCert: false,
      minorOnly: false,
      itemType: UniformItemType.checkbox,
    },
  ],
};

const RETENTION: RetentionSettings = {
  archivedContactSetDays: 90n,
  notesDays: 365n,
  archivedPhotoDays: 365n,
  changeLogDays: 730n,
};

/** The actor methods the admin page tree reads across its tabs. */
function baseActor() {
  return {
    getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(async () => STORE),
    listPositions: vi.fn<backendInterface["listPositions"]>(
      async () => POSITIONS,
    ),
    listSchedule: vi.fn<backendInterface["listSchedule"]>(async () => SCHEDULE),
    getChecklists: vi.fn<backendInterface["getChecklists"]>(
      async () => CHECKLISTS,
    ),
    getRetentionSettings: vi.fn<backendInterface["getRetentionSettings"]>(
      async () => RETENTION,
    ),
    listAccessGrants: vi.fn<backendInterface["listAccessGrants"]>(
      async () => [],
    ),
    adminCount: vi.fn<backendInterface["adminCount"]>(async () => 1n),
  };
}

const PRINCIPAL = { toText: () => "aaaaa-aa" } as never;

function grant(role: Role): AccessGrant {
  return {
    principal: PRINCIPAL,
    approvedAt: 0n,
    approvedBy: PRINCIPAL,
    role,
    trainerPositionIds: [],
  };
}

/** Two orientation sessions, soonest first, for the Move everyone dialog. */
function orientationOptions(): OrientationSessionOption[] {
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

/** The Admin schedule actor with two orientation sessions. */
function scheduleActor(role: Role) {
  const now = Date.now();
  const schedule: ScheduleEvent[] = [
    {
      id: 7n,
      kind: EventKind.orientation,
      name: "Orientation",
      start: BigInt(now + 2 * 24 * 60 * 60 * 1000) * 1_000_000n,
    },
    {
      id: 8n,
      kind: EventKind.orientation,
      name: "Makeup Orientation",
      start: BigInt(now + 5 * 24 * 60 * 60 * 1000) * 1_000_000n,
    },
  ];
  return {
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: grant(role),
    })),
    listPositions: vi.fn<backendInterface["listPositions"]>(
      async () => POSITIONS,
    ),
    listSchedule: vi.fn<backendInterface["listSchedule"]>(async () => schedule),
    getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(async () => STORE),
    getChecklists: vi.fn<backendInterface["getChecklists"]>(
      async () => CHECKLISTS,
    ),
    getRetentionSettings: vi.fn<backendInterface["getRetentionSettings"]>(
      async () => RETENTION,
    ),
    listAccessGrants: vi.fn<backendInterface["listAccessGrants"]>(
      async () => [],
    ),
    adminCount: vi.fn<backendInterface["adminCount"]>(async () => 1n),
    getDemoState: vi.fn<backendInterface["getDemoState"]>(async () => ({
      enabled: false,
      demoTrainerStations: [],
    })),
    listOrientationSessions: vi.fn<backendInterface["listOrientationSessions"]>(
      async () => orientationOptions(),
    ),
    moveAllRoadiesToSession: vi.fn<backendInterface["moveAllRoadiesToSession"]>(
      async () => 3n,
    ),
  };
}

describe("Admin > Schedule Move everyone", () => {
  it("moves every roadie to the chosen session and reports the count", async () => {
    const user = userEvent.setup();
    const actor = scheduleActor(Role.admin);
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    await user.click(await screen.findByTestId("admin.schedule.tab"));

    // Each orientation session offers a Move everyone control.
    const moveButtons = await screen.findAllByTestId(
      "admin.schedule.move_everyone_button",
    );
    expect(moveButtons).toHaveLength(2);

    await user.click(moveButtons[0]);

    const dialog = await screen.findByTestId(
      "admin.schedule.move_everyone.target_select",
    );
    await user.click(dialog);
    await user.click(
      await screen.findByRole("option", { name: /Makeup Orientation/ }),
    );
    await user.click(
      screen.getByTestId("admin.schedule.move_everyone.confirm_button"),
    );

    await waitFor(() =>
      expect(actor.moveAllRoadiesToSession).toHaveBeenCalledWith(7n, 8n),
    );
    // The confirmation reports the affected count returned by the backend.
    expect(
      await screen.findByTestId("admin.schedule.move_everyone.success_state"),
    ).toHaveTextContent("Moved 3 roadies.");
  });

  it("hides the Move everyone control from a role that may not move roadies", async () => {
    const user = userEvent.setup();
    renderPageWithActor(AdminPage, scheduleActor(Role.trainingManager), {
      path: "/admin",
    });

    await user.click(await screen.findByTestId("admin.schedule.tab"));

    // The schedule list renders, but no Move everyone control is offered.
    expect(
      await screen.findByTestId("admin.schedule.list"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("admin.schedule.move_everyone_button"),
    ).not.toBeInTheDocument();
  });
});

describe("AdminPage seeded configuration", () => {
  it("renders every admin section tab", async () => {
    renderPageWithActor(AdminPage, baseActor(), { path: "/admin" });

    expect(await screen.findByTestId("admin.page")).toBeInTheDocument();
    for (const key of [
      "store",
      "positions",
      "schedule",
      "checklists",
      "template",
      "access",
    ]) {
      expect(screen.getByTestId(`admin.${key}.tab`)).toBeInTheDocument();
    }
  });

  it("shows the seeded store info on the default tab", async () => {
    renderPageWithActor(AdminPage, baseActor(), { path: "/admin" });

    // The panel initializes its draft from the loaded record, so wait for the
    // populated form rather than the section shell.
    expect(await screen.findByTestId("admin.store.app_name.input")).toHaveValue(
      "Roadie Roster",
    );
    expect(screen.getByTestId("admin.store.store_number.input")).toHaveValue(
      "975",
    );
    expect(screen.getByTestId("admin.store.location.input")).toHaveValue(
      "Lake Charles",
    );
  });

  it("lists the seeded positions with their build-to targets", async () => {
    const user = userEvent.setup();
    renderPageWithActor(AdminPage, baseActor(), { path: "/admin" });

    await user.click(await screen.findByTestId("admin.positions.tab"));

    expect(
      await screen.findByTestId("admin.positions.list"),
    ).toBeInTheDocument();
    expect(screen.getByText("Servers")).toBeInTheDocument();
    expect(screen.getByText("Fry / Salad")).toBeInTheDocument();
    // The seeded build-to line is rendered for the Servers position.
    expect(
      screen.getByText("Build-to 65 opening · 65 after · age 18+"),
    ).toBeInTheDocument();
  });

  it("lists the seeded opening schedule events", async () => {
    const user = userEvent.setup();
    renderPageWithActor(AdminPage, baseActor(), { path: "/admin" });

    await user.click(await screen.findByTestId("admin.schedule.tab"));

    expect(
      await screen.findByTestId("admin.schedule.list"),
    ).toBeInTheDocument();
    expect(screen.getByText("Paperwork due")).toBeInTheDocument();
    // "Opening day" is both the event name and its kind badge.
    expect(screen.getAllByText("Opening day").length).toBeGreaterThan(0);
  });

  it("shows the seeded checklists and retention settings", async () => {
    const user = userEvent.setup();
    renderPageWithActor(AdminPage, baseActor(), { path: "/admin" });

    await user.click(await screen.findByTestId("admin.checklists.tab"));

    expect(
      await screen.findByTestId("admin.checklists.section"),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Non-slip shoes")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Onboarding")).toBeInTheDocument();

    expect(
      await screen.findByTestId("admin.retention.section"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("admin.retention.contact_days.input"),
    ).toHaveValue(90);
    expect(
      screen.getByTestId("admin.retention.change_log_days.input"),
    ).toHaveValue(730);
  });
});
