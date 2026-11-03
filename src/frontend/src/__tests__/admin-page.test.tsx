import { renderPageWithActor } from "@/__tests__/router-test-utils";
import type {
  Checklists,
  Position,
  RetentionSettings,
  ScheduleEvent,
  StoreInfo,
  backendInterface,
} from "@/backend";
import { EventKind, House, UniformItemType } from "@/backend";
import AdminPage from "@/pages/Admin";
import { screen } from "@testing-library/react";
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
