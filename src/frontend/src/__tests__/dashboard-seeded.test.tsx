import { renderPageWithActor } from "@/__tests__/router-test-utils";
import type { Position, Roadie, backendInterface } from "@/backend";
import { House, RoadieStatus, RosterState } from "@/backend";
import DashboardPage from "@/pages/Dashboard";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/** Two of the 18 seeded positions, one per house. */
const SERVERS: Position = {
  id: 0n,
  name: "Servers",
  code: "SRV",
  house: House.foh,
  openingBuildTo: 65n,
  afterOpeningBuildTo: 65n,
  minimumAge: 18n,
  needsAlcoholCert: true,
  shirtType: "Polo",
  shirtQty: 2n,
  hatType: "Cap",
  hatQty: 1n,
  defaultShirts: 2n,
  defaultHats: 1n,
};

const FRY: Position = {
  id: 5n,
  name: "Fry / Salad",
  code: "FS",
  house: House.boh,
  openingBuildTo: 16n,
  afterOpeningBuildTo: 16n,
  minimumAge: 16n,
  needsAlcoholCert: false,
  shirtType: "Polo",
  shirtQty: 2n,
  hatType: "Cap",
  hatQty: 1n,
  defaultShirts: 2n,
  defaultHats: 1n,
};

function roadie(id: bigint, status: RoadieStatus): Roadie {
  return {
    id,
    status,
    mainPositionId: 0n,
    hiredAt: 0n,
    isMinor: false,
    isDemo: false,
    profile: { name: `Roadie ${id}` },
    rosterState: RosterState.pending,
  };
}

/** The actor methods the dashboard tree reads. */
function baseActor() {
  return {
    getDashboard: vi.fn<backendInterface["getDashboard"]>(async () => ({
      foh: [SERVERS],
      boh: [FRY],
      hired: 1n,
      stillNeeded: 80n,
      buildToTotal: 81n,
      active: 0n,
      pending: 1n,
    })),
    listSchedule: vi.fn<backendInterface["listSchedule"]>(async () => []),
    getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(async () => ({
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
    })),
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: undefined,
    })),
    listRosterForPosition: vi.fn<backendInterface["listRosterForPosition"]>(
      async () => [],
    ),
  };
}

describe("DashboardPage seeded positions", () => {
  it("renders both house panels with the seeded positions", async () => {
    renderPageWithActor(DashboardPage, baseActor(), { path: "/dashboard" });

    expect(
      await screen.findByTestId("dashboard.foh.section"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("dashboard.boh.section")).toBeInTheDocument();
    expect(screen.getByText("Servers")).toBeInTheDocument();
    expect(screen.getByText("Fry / Salad")).toBeInTheDocument();
  });

  it("shows the build-to total in the hiring progress bar and the still-needed KPI", async () => {
    renderPageWithActor(DashboardPage, baseActor(), { path: "/dashboard" });

    // The accepted rework replaces the separate build-to tile with one hiring
    // progress bar reading "Hired X of Y", where Y is the build-to total.
    expect(await screen.findByTestId("dashboard.progress")).toHaveTextContent(
      "Hired 1 of 81",
    );
    expect(screen.getByTestId("dashboard.kpi.still_needed")).toHaveTextContent(
      "80",
    );
  });

  it("counts on-hand roadies and open spots from the position roster", async () => {
    const actor = baseActor();
    // Servers has one active roadie and one archived one; only the active
    // roadie counts toward on-hand, so 64 of 65 spots remain open.
    actor.listRosterForPosition = vi.fn<
      backendInterface["listRosterForPosition"]
    >(async () => [
      roadie(1n, RoadieStatus.hired),
      roadie(2n, RoadieStatus.archived),
    ]);

    renderPageWithActor(DashboardPage, actor, { path: "/dashboard" });

    // The accepted rework shows one "N hired · need M" line per position row.
    expect(await screen.findByText("1 hired · need 64")).toBeInTheDocument();
    expect(screen.getByText("64 needed")).toBeInTheDocument();
  });

  it("shows the empty state when no positions are configured", async () => {
    const actor = baseActor();
    actor.getDashboard = vi.fn<backendInterface["getDashboard"]>(async () => ({
      foh: [],
      boh: [],
      hired: 0n,
      stillNeeded: 0n,
      buildToTotal: 0n,
      active: 0n,
      pending: 0n,
    }));

    renderPageWithActor(DashboardPage, actor, { path: "/dashboard" });

    expect(
      await screen.findByText("No positions have been configured yet."),
    ).toBeInTheDocument();
  });
});
