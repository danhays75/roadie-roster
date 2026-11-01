import { renderPageWithActor } from "@/__tests__/router-test-utils";
import type { Position, RosterSummary, backendInterface } from "@/backend";
import { House } from "@/backend";
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
  shirtsRequired: 2n,
  hatsRequired: 1n,
  needsAlcoholCert: true,
};

const FRY: Position = {
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
};

/**
 * The actor the dashboard tree reads. `getRosterSummary` is the backend's
 * per-position on-hand/open-spots read; the position's own roster read is
 * empty so the summary is the only source of the counts.
 */
function baseActor() {
  return {
    getDashboard: vi.fn<backendInterface["getDashboard"]>(async () => ({
      foh: [SERVERS],
      boh: [FRY],
      hired: 3n,
      stillNeeded: 78n,
      buildToTotal: 81n,
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
    })),
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => null),
    listRosterForPosition: vi.fn<backendInterface["listRosterForPosition"]>(
      async () => [],
    ),
    getRosterSummary: vi.fn<backendInterface["getRosterSummary"]>(
      async () =>
        [
          {
            positionId: 0n,
            positionName: "Servers",
            onHand: 1n,
            buildTo: 65n,
            openSpots: 64n,
          },
          {
            positionId: 5n,
            positionName: "Fry / Salad",
            onHand: 2n,
            buildTo: 16n,
            openSpots: 14n,
          },
        ] satisfies RosterSummary[],
    ),
  };
}

describe("DashboardPage roster summary", () => {
  it("shows on-hand counts and open spots from the backend summary", async () => {
    renderPageWithActor(DashboardPage, baseActor(), { path: "/dashboard" });

    // Servers: 1 on hand of a 65 build-to, so 64 spots remain open.
    expect(
      await screen.findByText("1 on hand · build to 65"),
    ).toBeInTheDocument();
    expect(screen.getByText("64 needed")).toBeInTheDocument();

    // Fry / Salad: 2 on hand of a 16 build-to, so 14 spots remain open.
    expect(screen.getByText("2 on hand · build to 16")).toBeInTheDocument();
    expect(screen.getByText("14 needed")).toBeInTheDocument();
  });

  it("marks a position filled when the summary reports no open spots", async () => {
    const actor = baseActor();
    actor.getRosterSummary = vi.fn<backendInterface["getRosterSummary"]>(
      async () => [
        {
          positionId: 0n,
          positionName: "Servers",
          onHand: 65n,
          buildTo: 65n,
          openSpots: 0n,
        },
      ],
    );

    renderPageWithActor(DashboardPage, actor, { path: "/dashboard" });

    expect(
      await screen.findByText("65 on hand · build to 65"),
    ).toBeInTheDocument();
    expect(screen.getByText("Filled")).toBeInTheDocument();
  });
});
