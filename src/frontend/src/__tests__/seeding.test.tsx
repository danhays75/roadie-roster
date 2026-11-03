import { renderPageWithActor } from "@/__tests__/router-test-utils";
import type { AccessGrant, Position, backendInterface } from "@/backend";
import { House, Role } from "@/backend";
import AdminPage from "@/pages/Admin";
import DashboardPage from "@/pages/Dashboard";
import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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
  defaultShirts: 3n,
  defaultHats: 2n,
};

const STORE = {
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
  paperworkDueDate: 1_800_000_000_000_000_000n,
};

/** An Admin grant: only an Admin may seed, so the seeding hook needs one. */
const ADMIN_GRANT: AccessGrant = {
  principal: { toText: () => "aaaaa-aa" } as never,
  role: Role.admin,
  approvedAt: 0n,
  approvedBy: { toText: () => "aaaaa-aa" } as never,
  trainerPositionIds: [],
};

/** The actor methods the dashboard tree reads, with an empty store. */
function emptyDashboardActor() {
  return {
    getDashboard: vi.fn<backendInterface["getDashboard"]>(async () => ({
      foh: [],
      boh: [],
      active: 0n,
      hired: 0n,
      pending: 0n,
      stillNeeded: 0n,
      buildToTotal: 0n,
    })),
    listSchedule: vi.fn<backendInterface["listSchedule"]>(async () => []),
    getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(async () => STORE),
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: ADMIN_GRANT,
    })),
    listRosterForPosition: vi.fn<backendInterface["listRosterForPosition"]>(
      async () => [],
    ),
    getRosterSummary: vi.fn<backendInterface["getRosterSummary"]>(
      async () => [],
    ),
    ensureSeeded: vi.fn<backendInterface["ensureSeeded"]>(async () => true),
  };
}

/** The actor methods the admin page tree reads, with no positions yet. */
function emptyAdminActor() {
  return {
    getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(async () => STORE),
    listPositions: vi.fn<backendInterface["listPositions"]>(async () => []),
    listSchedule: vi.fn<backendInterface["listSchedule"]>(async () => []),
    getChecklists: vi.fn<backendInterface["getChecklists"]>(async () => ({
      orientationUniform: [],
      paperwork: [],
    })),
    getRetentionSettings: vi.fn<backendInterface["getRetentionSettings"]>(
      async () => ({
        archivedContactSetDays: 90n,
        notesDays: 365n,
        archivedPhotoDays: 365n,
        changeLogDays: 730n,
      }),
    ),
    listAccessGrants: vi.fn<backendInterface["listAccessGrants"]>(
      async () => [],
    ),
    adminCount: vi.fn<backendInterface["adminCount"]>(async () => 1n),
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: ADMIN_GRANT,
    })),
    ensureSeeded: vi.fn<backendInterface["ensureSeeded"]>(async () => true),
  };
}

describe("Seeding when the store has no positions", () => {
  it("re-seeds from the dashboard when no positions are configured", async () => {
    const actor = emptyDashboardActor();
    renderPageWithActor(DashboardPage, actor, { path: "/dashboard" });

    await screen.findByTestId("dashboard.page");
    await waitFor(() => expect(actor.ensureSeeded).toHaveBeenCalledTimes(1));
  });

  it("re-seeds from the admin page when no positions are configured", async () => {
    const actor = emptyAdminActor();
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    await screen.findByTestId("admin.page");
    await waitFor(() => expect(actor.ensureSeeded).toHaveBeenCalledTimes(1));
  });

  it("does not re-seed the dashboard when positions already exist", async () => {
    const actor = emptyDashboardActor();
    actor.getDashboard = vi.fn<backendInterface["getDashboard"]>(async () => ({
      foh: [SERVERS],
      boh: [],
      active: 0n,
      hired: 0n,
      pending: 0n,
      stillNeeded: 65n,
      buildToTotal: 65n,
    }));

    renderPageWithActor(DashboardPage, actor, { path: "/dashboard" });

    expect(await screen.findByText("Servers")).toBeInTheDocument();
    expect(actor.ensureSeeded).not.toHaveBeenCalled();
  });
});
