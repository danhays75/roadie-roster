import { renderWithActor } from "@/__tests__/test-utils";
import type {
  AccessGrant,
  Checklists,
  DemoStateView,
  Position,
  RetentionSettings,
  StoreInfo,
  backendInterface,
} from "@/backend";
import { DemoRole, House, Role, UniformItemType } from "@/backend";
import { AccessPanel } from "@/components/admin/AccessPanel";
import { ChecklistsPanel } from "@/components/admin/ChecklistsPanel";
import { PositionsPanel } from "@/components/admin/PositionsPanel";
import { SchedulePanel } from "@/components/admin/SchedulePanel";
import { TemplatePanel } from "@/components/admin/TemplatePanel";
import type { Principal } from "@icp-sdk/core/principal";
import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * Cover for the accepted Demo mode change at the panel level: while demo mode
 * is on, each real-settings panel hides its own edit controls and shows the
 * "Turn off demo mode to change real settings." note. The Admin page also hides
 * the tabs, but the panels' internal guards are the actual edit-control
 * contract, so they are asserted directly. The actor is a typed local mock; no
 * live backend or identity is exercised.
 */

const PRINCIPAL = { toText: () => "aaaaa-aa" } as unknown as Principal;

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

const SERVERS: Position = {
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
  shirtType: "Polo",
  shirtQty: 2n,
  hatType: "Cap",
  hatQty: 1n,
};

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
    enabled: true,
    demoRole: DemoRole.admin,
    demoTrainerStations: [],
    pretendDate: undefined,
    turnedOnAt: undefined,
    autoOffAt: undefined,
    ...overrides,
  };
}

/** The actor methods the real-settings panels read while demo mode is on. */
function panelActor(demo: DemoStateView) {
  return {
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: grant(Role.admin),
    })),
    getDemoState: vi.fn<backendInterface["getDemoState"]>(async () => demo),
    getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(async () => STORE),
    listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
      SERVERS,
    ]),
    listSchedule: vi.fn<backendInterface["listSchedule"]>(async () => []),
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
    hasKioskPin: vi.fn<backendInterface["hasKioskPin"]>(async () => false),
  };
}

const NOTE = "Turn off demo mode to change real settings.";

describe("real-settings panels hide their edit controls while demo is on", () => {
  it("hides the Positions add and edit controls and shows the note", async () => {
    const actor = panelActor(demoState());
    renderWithActor(<PositionsPanel />, actor);

    // The list stays readable while demo mode is on.
    expect(await screen.findByText("Servers")).toBeInTheDocument();
    expect(
      screen.queryByTestId("admin.positions.add_button"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("admin.positions.edit_button"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("admin.positions.delete_button"),
    ).not.toBeInTheDocument();
    expect(await screen.findByTestId("demo.settings_note")).toHaveTextContent(
      NOTE,
    );
  });

  it("hides the Schedule add control and shows the note", async () => {
    const actor = panelActor(demoState());
    renderWithActor(<SchedulePanel />, actor);

    await waitFor(() =>
      expect(
        screen.queryByTestId("admin.schedule.add_button"),
      ).not.toBeInTheDocument(),
    );
    expect(await screen.findByTestId("demo.settings_note")).toHaveTextContent(
      NOTE,
    );
  });

  it("hides the Checklists and Retention save controls and shows the note", async () => {
    const actor = panelActor(demoState());
    renderWithActor(<ChecklistsPanel />, actor);

    await waitFor(() =>
      expect(
        screen.queryByTestId("admin.checklists.save_button"),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByTestId("admin.retention.save_button"),
    ).not.toBeInTheDocument();
    // Both sections carry the note while demo mode is on.
    expect(await screen.findAllByTestId("demo.settings_note")).toHaveLength(2);
  });

  it("hides the Store template save, download and load controls and shows the note", async () => {
    const actor = panelActor(demoState());
    renderWithActor(<TemplatePanel />, actor);

    await waitFor(() =>
      expect(
        screen.queryByTestId("admin.template.save_button"),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByTestId("admin.template.download_button"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("admin.template.upload_button"),
    ).not.toBeInTheDocument();
    expect(await screen.findByTestId("demo.settings_note")).toHaveTextContent(
      NOTE,
    );
  });

  it("hides the Access grants and Kiosk PIN controls and shows the note", async () => {
    const actor = panelActor(demoState());
    renderWithActor(<AccessPanel />, actor);

    await waitFor(() =>
      expect(
        screen.queryByTestId("admin.kiosk_pin.section"),
      ).not.toBeInTheDocument(),
    );
    expect(screen.queryByTestId("admin.access.list")).not.toBeInTheDocument();
    expect(await screen.findByTestId("demo.settings_note")).toHaveTextContent(
      NOTE,
    );
  });
});
