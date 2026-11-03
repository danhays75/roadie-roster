import { renderPageWithActor, t } from "@/__tests__/router-test-utils";
import type { Position, backendInterface } from "@/backend";
import { House } from "@/backend";
import DashboardPage from "@/pages/Dashboard";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const CASHIER: Position = {
  id: 10n,
  name: "Cashier",
  code: "CSH",
  house: House.foh,
  openingBuildTo: 4n,
  afterOpeningBuildTo: 2n,
  minimumAge: 16n,
  shirtsRequired: 2n,
  hatsRequired: 1n,
  needsAlcoholCert: false,
  defaultShirts: 3n,
  defaultHats: 2n,
};

/** A dashboard payload with no configured positions. */
function emptyDashboard() {
  return {
    foh: [] as Position[],
    boh: [] as Position[],
    hired: 0n,
    stillNeeded: 0n,
    buildToTotal: 0n,
    active: 0n,
    pending: 0n,
  };
}

/** The actor methods the dashboard tree reads. */
function baseActor() {
  return {
    getDashboard: vi.fn<backendInterface["getDashboard"]>(async () =>
      emptyDashboard(),
    ),
    listSchedule: vi.fn<backendInterface["listSchedule"]>(async () => []),
    getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(async () => ({
      storeNumber: "975",
      appName: "Roadie Roster",
      locationName: "Bubba's 33",
      address: "1 Main St",
      storePhone: "+1-555-0100",
      timeZone: "America/Chicago",
      openingDate: 0n,
      amShiftStart: 0n,
      amShiftEnd: 0n,
      pmShiftStart: 0n,
      pmShiftEnd: 0n,
      trainingGroupSize: 4n,
      leaderTalkName: "Leader talk",
      leaderTalkSize: 4n,
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

describe("DashboardPage states", () => {
  it("renders the dashboard shell on the default route without a blank screen", async () => {
    renderPageWithActor(DashboardPage, baseActor(), { path: "/" });

    expect(await screen.findByTestId("dashboard.page")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: t("dashboard.title") }),
    ).toBeInTheDocument();
  });

  it("shows the empty state when no positions are configured", async () => {
    renderPageWithActor(DashboardPage, baseActor(), { path: "/dashboard" });

    expect(await screen.findByText(t("dashboard.empty"))).toBeInTheDocument();
  });

  it("shows the error state when the dashboard read fails", async () => {
    const actor = baseActor();
    actor.getDashboard = vi.fn<backendInterface["getDashboard"]>(async () => {
      throw new Error("boom");
    });

    renderPageWithActor(DashboardPage, actor, { path: "/dashboard" });

    expect(await screen.findByTestId("page.error_state")).toBeInTheDocument();
    expect(screen.getByText(t("dashboard.error"))).toBeInTheDocument();
  });

  it("renders position progress and open spots for a configured position", async () => {
    const actor = baseActor();
    actor.getDashboard = vi.fn<backendInterface["getDashboard"]>(async () => ({
      foh: [CASHIER],
      boh: [],
      hired: 1n,
      stillNeeded: 3n,
      buildToTotal: 4n,
      active: 1n,
      pending: 0n,
    }));

    renderPageWithActor(DashboardPage, actor, { path: "/dashboard" });

    expect(await screen.findByText("Cashier")).toBeInTheDocument();
    // The position row counts on-hand roadies from its own roster read (empty
    // here), so a build-to of 4 shows 4 open spots. The dashboard resolves this
    // key from its own local copy, not the shared dictionary.
    expect(screen.getByText("4 needed")).toBeInTheDocument();
  });
});
