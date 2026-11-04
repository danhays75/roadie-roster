import { renderPageWithActor } from "@/__tests__/router-test-utils";
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
import AdminPage from "@/pages/Admin";
import type { Principal } from "@icp-sdk/core/principal";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

/**
 * Characterization baseline for the real-settings admin controls the Demo mode
 * change will hide *while demo mode is on*. Demo mode is OFF here, so these
 * tests protect the behavior that must survive: with demo mode off, an Admin
 * still sees and can use the Access grants, Store template, Positions,
 * Schedule, Checklists and Kiosk PIN controls. They deliberately do not assert
 * the demo-on state, which the change intentionally alters.
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
  defaultShirts: 2n,
  defaultHats: 1n,
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
    enabled: false,
    demoRole: DemoRole.admin,
    demoTrainerStations: [],
    pretendDate: undefined,
    turnedOnAt: undefined,
    autoOffAt: undefined,
    ...overrides,
  };
}

/** The actor methods the admin page tree reads across its tabs, demo off. */
function adminActor() {
  return {
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: grant(Role.admin),
    })),
    getDemoState: vi.fn<backendInterface["getDemoState"]>(async () =>
      demoState(),
    ),
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
    setKioskPin: vi.fn<backendInterface["setKioskPin"]>(async () => {}),
    saveStoreTemplate: vi.fn<backendInterface["saveStoreTemplate"]>(
      async () => {},
    ),
    downloadStoreTemplate: vi.fn<backendInterface["downloadStoreTemplate"]>(
      async () => ({
        version: 1n,
        leaderTalkName: "10 Minutes with Dan",
        leaderTalkSize: 10n,
        trainingGroupSize: 5n,
        positions: [],
        schedule: [],
        checklists: { orientationUniform: [], paperwork: [] },
      }),
    ),
    updateChecklists: vi.fn<backendInterface["updateChecklists"]>(
      async () => {},
    ),
    adjustBuildTo: vi.fn<backendInterface["adjustBuildTo"]>(async () => {}),
  };
}

describe("real-settings admin controls are present while demo mode is off", () => {
  it("shows the Access grants tab with the Kiosk PIN section and role controls", async () => {
    const user = userEvent.setup();
    const actor = adminActor();
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    await user.click(await screen.findByTestId("admin.access.tab"));

    // The Kiosk PIN control and the access-grants section are both present.
    expect(
      await screen.findByTestId("admin.kiosk_pin.section"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("admin.kiosk_pin.input")).toBeInTheDocument();
    expect(screen.getByTestId("admin.access.section")).toBeInTheDocument();
  });

  it("saves a Kiosk PIN through setKioskPin while demo mode is off", async () => {
    const user = userEvent.setup();
    const actor = adminActor();
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    await user.click(await screen.findByTestId("admin.access.tab"));
    await user.type(await screen.findByTestId("admin.kiosk_pin.input"), "1234");
    await user.type(
      screen.getByTestId("admin.kiosk_pin.confirm_input"),
      "1234",
    );
    await user.click(screen.getByTestId("admin.kiosk_pin.save_button"));

    await waitFor(() => expect(actor.setKioskPin).toHaveBeenCalledWith("1234"));
  });

  it("shows the Store template save and download controls", async () => {
    const user = userEvent.setup();
    const actor = adminActor();
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    await user.click(await screen.findByTestId("admin.template.tab"));

    expect(
      await screen.findByTestId("admin.template.save_button"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("admin.template.download_button"),
    ).toBeInTheDocument();
    // The Admin-only load section is present while demo mode is off.
    expect(
      screen.getByTestId("admin.template.upload_button"),
    ).toBeInTheDocument();
  });

  it("shows the Positions edit controls and the Schedule add control", async () => {
    const user = userEvent.setup();
    const actor = adminActor();
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    await user.click(await screen.findByTestId("admin.positions.tab"));
    expect(
      await screen.findByTestId("admin.positions.edit_button"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("admin.positions.add_button"),
    ).toBeInTheDocument();

    await user.click(screen.getByTestId("admin.schedule.tab"));
    expect(
      await screen.findByTestId("admin.schedule.add_button"),
    ).toBeInTheDocument();
  });

  it("shows the Checklists save control and saves the draft", async () => {
    const user = userEvent.setup();
    const actor = adminActor();
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    await user.click(await screen.findByTestId("admin.checklists.tab"));
    await screen.findByDisplayValue("Non-slip shoes");

    await user.click(screen.getByTestId("admin.checklists.save_button"));
    await waitFor(() =>
      expect(actor.updateChecklists).toHaveBeenCalledTimes(1),
    );
  });
});
