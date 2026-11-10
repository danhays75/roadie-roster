import { renderPageWithActor } from "@/__tests__/router-test-utils";
import { renderWithActor } from "@/__tests__/test-utils";
import type {
  AccessGrant,
  MyCrewRoadieRow,
  MyCrewView,
  OrientationRoadieRow,
  OrientationSessionView,
  Position,
  Roadie,
  ScheduleEvent,
  StoreInfo,
  TodayView,
  backendInterface,
} from "@/backend";
import {
  EventKind,
  House,
  PaperworkStatus,
  RoadieStage,
  RoadieStatus,
  Role,
  RosterState,
} from "@/backend";
import {
  READY_FOR_ORIENTATION_SEAL_SRC,
  RoadieTile,
} from "@/components/roadie/RoadieTile";
import { translate } from "@/hooks/useI18n";
import type { Locale } from "@/lib/copy";
import OrientationPage from "@/pages/Orientation";
import RoadieCardPage from "@/pages/RoadieCard";
import RosterPage from "@/pages/Roster";
import TodayPage from "@/pages/Today";
import type { Principal } from "@icp-sdk/core/principal";
import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * Cover for the accepted "Ready for Orientation" seal change, exercised through
 * the real shared RoadieTile, the Orientation page, the Today My crew section
 * and the roadie card header with a typed local actor mock:
 *   - the stage label reads "Ready for Orientation" in English and its Spanish
 *     equivalent, on the Roster tab and in the filters,
 *   - a roster tile for a Ready for Orientation roadie shows the seal image on
 *     the photo instead of the text tag, and the Minor and crew tags still show
 *     below the name,
 *   - the Orientation page rows, the Today crew rows and the roadie card header
 *     show the smaller seal in place of the Ready for Orientation text tag,
 *   - once the stage becomes Oriented the seal is gone and the text tag returns.
 * The backend is mocked here; the PocketIC lane covers the real canister.
 */

const PRINCIPAL = { toText: () => "aaaaa-aa" } as unknown as Principal;

function grant(role: Role): AccessGrant {
  return {
    principal: PRINCIPAL,
    approvedAt: 0n,
    approvedBy: PRINCIPAL,
    role,
    trainerPositionIds: [],
  };
}

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
};

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

function roadie(overrides: Partial<Roadie> = {}): Roadie {
  return {
    id: 1n,
    status: RoadieStatus.hired,
    mainPositionId: 0n,
    hiredAt: 0n,
    isMinor: false,
    isDemo: false,
    rosterState: RosterState.pending,
    profile: { name: "Ada Lovelace" },
    ...overrides,
  };
}

/* ---------------------------------------------------------------------------
   Copy: the stage label reads "Ready for Orientation" in both languages
--------------------------------------------------------------------------- */

describe("Ready for Orientation copy", () => {
  it("reads Ready for Orientation in English on the stage tag and the filter", () => {
    expect(translate("en" as Locale, "roster.stage.paperworkDone")).toBe(
      "Ready for Orientation",
    );
    expect(translate("en" as Locale, "roster.filter.paperworkDone")).toBe(
      "Ready for Orientation",
    );
  });

  it("reads the Spanish equivalent on the stage tag and the filter", () => {
    expect(translate("es" as Locale, "roster.stage.paperworkDone")).toBe(
      "Listo para orientación",
    );
    expect(translate("es" as Locale, "roster.filter.paperworkDone")).toBe(
      "Listo para orientación",
    );
  });
});

/* ---------------------------------------------------------------------------
   Roster tile: the seal replaces the text tag, other tags still show
--------------------------------------------------------------------------- */

function tileActor() {
  return {
    getPhoto: vi.fn<backendInterface["getPhoto"]>(async () => null),
  };
}

describe("RoadieTile Ready for Orientation seal", () => {
  it("shows the seal image on the photo instead of the text tag", async () => {
    renderWithActor(
      <RoadieTile
        roadie={roadie({ stage: RoadieStage.paperworkDone })}
        positionName="Servers"
        onOpen={vi.fn()}
        ocid="tile"
        statusOcid="tile.status"
      />,
      tileActor(),
    );

    const seal = await screen.findByTestId("tile.seal");
    expect(seal).toHaveAttribute("src", READY_FOR_ORIENTATION_SEAL_SRC);
    expect(seal).toHaveAttribute("alt", "Ready for Orientation");
    // The text tag is replaced, not shown alongside the seal.
    expect(screen.queryByTestId("tile.status")).not.toBeInTheDocument();
  });

  it("keeps the Minor and crew tags below the name while the seal shows", async () => {
    renderWithActor(
      <RoadieTile
        roadie={roadie({ stage: RoadieStage.paperworkDone, isMinor: true })}
        positionName="Servers"
        crewName="Jordan's Crew"
        onOpen={vi.fn()}
        ocid="tile"
        statusOcid="tile.status"
      />,
      tileActor(),
    );

    expect(await screen.findByTestId("tile.seal")).toBeInTheDocument();
    expect(screen.getByTestId("tile.minor")).toHaveTextContent("Minor");
    expect(screen.getByTestId("tile.crew")).toHaveTextContent("Jordan's Crew");
  });

  it("shows the text tag and no seal once the stage becomes Oriented", async () => {
    renderWithActor(
      <RoadieTile
        roadie={roadie({ stage: RoadieStage.oriented })}
        positionName="Servers"
        onOpen={vi.fn()}
        ocid="tile"
        statusOcid="tile.status"
      />,
      tileActor(),
    );

    expect(await screen.findByTestId("tile.status")).toHaveTextContent(
      "Oriented",
    );
    expect(screen.queryByTestId("tile.seal")).not.toBeInTheDocument();
  });
});

/* ---------------------------------------------------------------------------
   Roster page: the filter tab reads Ready for Orientation
--------------------------------------------------------------------------- */

function rosterActor(roadies: Roadie[]) {
  return {
    listRoadies: vi.fn<backendInterface["listRoadies"]>(async () => roadies),
    listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
      SERVERS,
    ]),
    listCrews: vi.fn<backendInterface["listCrews"]>(async () => []),
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: grant(Role.storeManager),
    })),
    getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(async () => STORE),
    getChecklists: vi.fn<backendInterface["getChecklists"]>(async () => ({
      paperwork: [],
      orientationUniform: [],
    })),
    getOrientationCheckoff: vi.fn<backendInterface["getOrientationCheckoff"]>(
      async () => null,
    ),
  };
}

describe("Roster page Ready for Orientation filter", () => {
  it("labels the stage filter Ready for Orientation", async () => {
    renderPageWithActor(
      RosterPage,
      rosterActor([roadie({ stage: RoadieStage.paperworkDone })]),
      { path: "/roster" },
    );

    expect(
      await screen.findByTestId("roster.filter.paperworkDone.tab"),
    ).toHaveTextContent("Ready for Orientation");
  });
});

/* ---------------------------------------------------------------------------
   Orientation row: the seal replaces the text tag
--------------------------------------------------------------------------- */

function futureSession(): ScheduleEvent {
  const now = Date.now();
  return {
    id: 7n,
    kind: EventKind.orientation,
    name: "Orientation",
    start: BigInt(now + 2 * 24 * 60 * 60 * 1000) * 1_000_000n,
  };
}

function orientationRow(
  overrides: Partial<OrientationRoadieRow> = {},
): OrientationRoadieRow {
  return {
    roadieId: 1n,
    name: "Ada Lovelace",
    positionId: 0n,
    positionName: "Servers",
    present: false,
    noShow: false,
    rosterState: RosterState.pending,
    paperworkStatus: PaperworkStatus.complete,
    ...overrides,
  };
}

function sessionView(roadies: OrientationRoadieRow[]): OrientationSessionView {
  return {
    eventId: 7n,
    name: "Orientation",
    start: futureSession().start,
    roadies,
    assignedCount: BigInt(roadies.length),
    presentCount: 0n,
  };
}

function orientationActor(view: OrientationSessionView) {
  return {
    listSchedule: vi.fn<backendInterface["listSchedule"]>(async () => [
      futureSession(),
    ]),
    getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(async () => STORE),
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: grant(Role.storeManager),
    })),
    getOrientationSessionView: vi.fn<
      backendInterface["getOrientationSessionView"]
    >(async () => view),
    markPresent: vi.fn<backendInterface["markPresent"]>(async () => undefined),
    undoPresent: vi.fn<backendInterface["undoPresent"]>(async () => undefined),
    archiveNoShows: vi.fn<backendInterface["archiveNoShows"]>(async () => []),
    archiveRoadie: vi.fn<backendInterface["archiveRoadie"]>(
      async () => undefined,
    ),
    getUniformCheckoff: vi.fn<backendInterface["getUniformCheckoff"]>(
      async () => null,
    ),
    listOrientationSessions: vi.fn<backendInterface["listOrientationSessions"]>(
      async () => [],
    ),
    listUnassignedPendingRoadies: vi.fn<
      backendInterface["listUnassignedPendingRoadies"]
    >(async () => []),
    moveRoadieToSession: vi.fn<backendInterface["moveRoadieToSession"]>(
      async () => undefined,
    ),
  };
}

describe("Orientation row Ready for Orientation seal", () => {
  it("shows the seal in place of the text tag for a Ready for Orientation roadie", async () => {
    renderPageWithActor(
      OrientationPage,
      orientationActor(
        sessionView([
          orientationRow({ roadieId: 1n, stage: RoadieStage.paperworkDone }),
        ]),
      ),
      { path: "/orientation" },
    );

    const seal = await screen.findByTestId("orientation.roadie.stage.1");
    expect(seal.tagName).toBe("IMG");
    expect(seal).toHaveAttribute("src", READY_FOR_ORIENTATION_SEAL_SRC);
    expect(seal).toHaveAttribute("alt", "Ready for Orientation");
  });

  it("shows the text tag and no seal once the stage becomes Oriented", async () => {
    renderPageWithActor(
      OrientationPage,
      orientationActor(
        sessionView([
          orientationRow({ roadieId: 1n, stage: RoadieStage.oriented }),
        ]),
      ),
      { path: "/orientation" },
    );

    const status = await screen.findByTestId("orientation.roadie.stage.1");
    expect(status).toHaveTextContent("Oriented");
    expect(status.tagName).not.toBe("IMG");
  });
});

/* ---------------------------------------------------------------------------
   Today My crew row: the seal replaces the text tag
--------------------------------------------------------------------------- */

function crewRow(
  roadieId: bigint,
  name: string,
  overrides: Partial<MyCrewRoadieRow> = {},
): MyCrewRoadieRow {
  return {
    roadieId,
    name,
    positionName: "Servers",
    positionId: 0n,
    rosterState: RosterState.active,
    paperworkDone: 2n,
    paperworkTotal: 3n,
    absentToday: false,
    paperworkOverdue: false,
    ...overrides,
  };
}

function myCrew(roadies: MyCrewRoadieRow[]): MyCrewView {
  return { crewId: 0n, crewName: "Jordan's Crew", roadies };
}

function todayView(crew: MyCrewView): TodayView {
  return {
    role: Role.storeManager,
    absentAlerts: [],
    shiftSummaries: [],
    myCrew: crew,
  };
}

function todayActor(crew: MyCrewView) {
  return {
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: grant(Role.storeManager),
    })),
    getToday: vi.fn<backendInterface["getToday"]>(async () => todayView(crew)),
    listAbsentAlerts: vi.fn<backendInterface["listAbsentAlerts"]>(
      async () => [],
    ),
    getMyCrew: vi.fn<backendInterface["getMyCrew"]>(async () => crew),
    listRoadies: vi.fn<backendInterface["listRoadies"]>(async () => []),
    getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(async () => STORE),
    listCrews: vi.fn<backendInterface["listCrews"]>(async () => []),
    getDemoState: vi.fn<backendInterface["getDemoState"]>(async () => ({
      enabled: false,
      demoTrainerStations: [],
    })),
    getPhoto: vi.fn<backendInterface["getPhoto"]>(async () => null),
  };
}

describe("Today My crew row Ready for Orientation seal", () => {
  it("shows the seal in place of the text tag for a Ready for Orientation roadie", async () => {
    renderPageWithActor(
      TodayPage,
      todayActor(
        myCrew([
          crewRow(1n, "Ada Roadie", { stage: RoadieStage.paperworkDone }),
        ]),
      ),
      { path: "/today" },
    );

    const section = await screen.findByTestId("today.myCrew.section");
    const seal = await within(section).findByTestId(
      "today.myCrew.item.0.status",
    );
    expect(seal.tagName).toBe("IMG");
    expect(seal).toHaveAttribute("src", READY_FOR_ORIENTATION_SEAL_SRC);
    expect(seal).toHaveAttribute("alt", "Ready for Orientation");
  });

  it("shows the text tag and no seal once the stage becomes Oriented", async () => {
    renderPageWithActor(
      TodayPage,
      todayActor(
        myCrew([crewRow(1n, "Ada Roadie", { stage: RoadieStage.oriented })]),
      ),
      { path: "/today" },
    );

    const section = await screen.findByTestId("today.myCrew.section");
    const status = await within(section).findByTestId(
      "today.myCrew.item.0.status",
    );
    expect(status).toHaveTextContent("Oriented");
    expect(status.tagName).not.toBe("IMG");
  });
});

/* ---------------------------------------------------------------------------
   Roadie card header: the seal replaces the text tag
--------------------------------------------------------------------------- */

function cardActor(roadieValue: Roadie) {
  return {
    getRoadie: vi.fn<backendInterface["getRoadie"]>(async () => roadieValue),
    listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
      SERVERS,
    ]),
    listCrews: vi.fn<backendInterface["listCrews"]>(async () => []),
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: grant(Role.storeManager),
    })),
    getPhoto: vi.fn<backendInterface["getPhoto"]>(async () => null),
  };
}

describe("Roadie card header Ready for Orientation seal", () => {
  it("shows the seal in place of the text tag for a Ready for Orientation roadie", async () => {
    renderPageWithActor(
      RoadieCardPage,
      cardActor(roadie({ stage: RoadieStage.paperworkDone })),
      { path: "/roster/$roadieId", initialEntry: "/roster/1" },
    );

    const seal = await screen.findByTestId("roadie.status");
    expect(seal.tagName).toBe("IMG");
    expect(seal).toHaveAttribute("src", READY_FOR_ORIENTATION_SEAL_SRC);
    expect(seal).toHaveAttribute("alt", "Ready for Orientation");
  });

  it("shows the text tag and no seal once the stage becomes Oriented", async () => {
    renderPageWithActor(
      RoadieCardPage,
      cardActor(roadie({ stage: RoadieStage.oriented })),
      { path: "/roster/$roadieId", initialEntry: "/roster/1" },
    );

    const status = await screen.findByTestId("roadie.status");
    expect(status).toHaveTextContent("Oriented");
    expect(status.tagName).not.toBe("IMG");
  });
});
