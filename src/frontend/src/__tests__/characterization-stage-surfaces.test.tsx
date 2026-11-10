import { renderPageWithActor, t } from "@/__tests__/router-test-utils";
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
  ShiftBoardRoadie,
  ShiftBoardView,
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
  Shift,
} from "@/backend";
import { RoadieChip } from "@/components/groups/RoadieChip";
import { RoadieTile } from "@/components/roadie/RoadieTile";
import OrientationPage from "@/pages/Orientation";
import RoadieCardPage from "@/pages/RoadieCard";
import RosterPage from "@/pages/Roster";
import TodayPage from "@/pages/Today";
import type { Principal } from "@icp-sdk/core/principal";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

/**
 * Characterization baseline for the computed roadie stage as it renders today.
 *
 * The "computed roadie stage" request derives one stage per roadie on every
 * view and replaces the separate Pending/Active tag. The existing
 * characterization file deliberately avoids asserting the new stage tag, so
 * this file protects the stage surfaces that must keep working:
 *   - the roster tile's single stage tag (and Former for an archived roadie),
 *   - the roadie card header's stage tag,
 *   - the orientation row's stage tag,
 *   - the Today My crew row's stage tag,
 *   - the group chip's stage tag,
 *   - the roster's All/Hired/Paperwork Done/Oriented/In Training/Certified
 *     tabs with their counts, and the Show former toggle.
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
   Roster tile stage tag
--------------------------------------------------------------------------- */

describe("RoadieTile shows one stage tag", () => {
  it("renders the Certified stage label for a certified roadie", async () => {
    renderWithActor(
      <RoadieTile
        roadie={roadie({ stage: RoadieStage.certified })}
        positionName="Servers"
        onOpen={vi.fn()}
        ocid="tile"
        statusOcid="tile.status"
      />,
      { getPhoto: vi.fn<backendInterface["getPhoto"]>(async () => null) },
    );

    expect(await screen.findByTestId("tile.status")).toHaveTextContent(
      "Certified",
    );
  });

  it("renders the In Training stage label for a roadie in training", async () => {
    renderWithActor(
      <RoadieTile
        roadie={roadie({ stage: RoadieStage.inTraining })}
        positionName="Servers"
        onOpen={vi.fn()}
        ocid="tile"
        statusOcid="tile.status"
      />,
      { getPhoto: vi.fn<backendInterface["getPhoto"]>(async () => null) },
    );

    expect(await screen.findByTestId("tile.status")).toHaveTextContent(
      "In Training",
    );
  });

  it("renders Former and no stage tag for an archived roadie", async () => {
    renderWithActor(
      <RoadieTile
        roadie={roadie({
          status: RoadieStatus.archived,
          stage: undefined,
          archivedReason: { __kind__: "noShow", noShow: null },
        })}
        positionName="Servers"
        onOpen={vi.fn()}
        ocid="tile"
        statusOcid="tile.status"
      />,
      { getPhoto: vi.fn<backendInterface["getPhoto"]>(async () => null) },
    );

    const status = await screen.findByTestId("tile.status");
    expect(status).toHaveTextContent("Former");
    expect(status).not.toHaveTextContent("Certified");
    expect(status).not.toHaveTextContent("Hired");
  });
});

/* ---------------------------------------------------------------------------
   Roster page stage tabs and counts
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

describe("Roster page stage tabs", () => {
  it("shows the six stage tabs with their counts", async () => {
    renderPageWithActor(
      RosterPage,
      rosterActor([
        roadie({ id: 1n, stage: RoadieStage.hired }),
        roadie({ id: 2n, stage: RoadieStage.hired }),
        roadie({ id: 3n, stage: RoadieStage.paperworkDone }),
        roadie({ id: 4n, stage: RoadieStage.oriented }),
        roadie({ id: 5n, stage: RoadieStage.inTraining }),
        roadie({ id: 6n, stage: RoadieStage.certified }),
      ]),
      { path: "/roster" },
    );

    expect(
      await screen.findByTestId("roster.filter.all.tab"),
    ).toHaveTextContent("All");
    expect(screen.getByTestId("roster.filter.hired.tab")).toHaveTextContent(
      "Hired",
    );
    expect(
      screen.getByTestId("roster.filter.paperworkDone.tab"),
    ).toHaveTextContent("Ready for Orientation");
    expect(screen.getByTestId("roster.filter.oriented.tab")).toHaveTextContent(
      "Oriented",
    );
    expect(
      screen.getByTestId("roster.filter.inTraining.tab"),
    ).toHaveTextContent("In Training");
    expect(screen.getByTestId("roster.filter.certified.tab")).toHaveTextContent(
      "Certified",
    );

    // The All tab counts every live roadie; each stage tab counts its stage.
    // Wait for the roadies to load before reading the counts.
    await waitFor(() =>
      expect(screen.getByTestId("roster.filter.all.tab")).toHaveTextContent(
        "6",
      ),
    );
    expect(screen.getByTestId("roster.filter.hired.tab")).toHaveTextContent(
      "2",
    );
    expect(
      screen.getByTestId("roster.filter.paperworkDone.tab"),
    ).toHaveTextContent("1");
    expect(screen.getByTestId("roster.filter.oriented.tab")).toHaveTextContent(
      "1",
    );
    expect(
      screen.getByTestId("roster.filter.inTraining.tab"),
    ).toHaveTextContent("1");
    expect(screen.getByTestId("roster.filter.certified.tab")).toHaveTextContent(
      "1",
    );
  });

  it("filters the list to the selected stage tab", async () => {
    const user = userEvent.setup();
    renderPageWithActor(
      RosterPage,
      rosterActor([
        roadie({
          id: 1n,
          stage: RoadieStage.hired,
          profile: { name: "Hired Hank" },
        }),
        roadie({
          id: 2n,
          stage: RoadieStage.certified,
          profile: { name: "Certified Cara" },
        }),
      ]),
      { path: "/roster" },
    );

    expect(await screen.findByText("Hired Hank")).toBeInTheDocument();
    expect(screen.getByText("Certified Cara")).toBeInTheDocument();

    await user.click(screen.getByTestId("roster.filter.certified.tab"));

    expect(await screen.findByText("Certified Cara")).toBeInTheDocument();
    expect(screen.queryByText("Hired Hank")).not.toBeInTheDocument();
  });

  it("keeps the Show former toggle revealing archived roadies", async () => {
    const user = userEvent.setup();
    renderPageWithActor(
      RosterPage,
      rosterActor([
        roadie({ id: 1n, stage: RoadieStage.hired }),
        roadie({
          id: 9n,
          status: RoadieStatus.archived,
          stage: undefined,
          profile: { name: "Archived Ada" },
          archivedReason: { __kind__: "noShow", noShow: null },
        }),
      ]),
      { path: "/roster" },
    );

    const toggle = await screen.findByTestId("roster.former.toggle");
    expect(toggle).toHaveTextContent("Show former (1)");
    await user.click(toggle);

    const formerList = await screen.findByTestId("roster.former.list");
    expect(
      within(formerList).getByTestId("roster.former.item.status"),
    ).toHaveTextContent("Former");
  });
});

/* ---------------------------------------------------------------------------
   Roadie card header stage tag
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

describe("Roadie card header stage tag", () => {
  it("shows the Certified stage tag in the card header", async () => {
    renderPageWithActor(
      RoadieCardPage,
      cardActor(roadie({ stage: RoadieStage.certified })),
      { path: "/roster/$roadieId", initialEntry: "/roster/1" },
    );

    expect(await screen.findByTestId("roadie.status")).toHaveTextContent(
      "Certified",
    );
  });

  it("shows the Ready for Orientation seal in the card header", async () => {
    renderPageWithActor(
      RoadieCardPage,
      cardActor(roadie({ stage: RoadieStage.paperworkDone })),
      { path: "/roster/$roadieId", initialEntry: "/roster/1" },
    );

    const status = await screen.findByTestId("roadie.status");
    expect(status.tagName).toBe("IMG");
    expect(status).toHaveAttribute("alt", "Ready for Orientation");
  });
});

/* ---------------------------------------------------------------------------
   Orientation row stage tag
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

describe("Orientation row stage tag", () => {
  it("shows the Oriented stage tag on an orientation row", async () => {
    renderPageWithActor(
      OrientationPage,
      orientationActor(
        sessionView([
          orientationRow({ roadieId: 1n, stage: RoadieStage.oriented }),
        ]),
      ),
      { path: "/orientation" },
    );

    expect(
      await screen.findByTestId("orientation.roadie.stage.1"),
    ).toHaveTextContent("Oriented");
  });

  it("shows the In Training stage tag on an orientation row", async () => {
    renderPageWithActor(
      OrientationPage,
      orientationActor(
        sessionView([
          orientationRow({ roadieId: 1n, stage: RoadieStage.inTraining }),
        ]),
      ),
      { path: "/orientation" },
    );

    expect(
      await screen.findByTestId("orientation.roadie.stage.1"),
    ).toHaveTextContent("In Training");
  });
});

/* ---------------------------------------------------------------------------
   Today My crew row stage tag
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

describe("Today My crew row stage tag", () => {
  it("shows the Certified stage tag on a crew row", async () => {
    renderPageWithActor(
      TodayPage,
      todayActor(
        myCrew([crewRow(1n, "Ada Roadie", { stage: RoadieStage.certified })]),
      ),
      { path: "/today" },
    );

    const section = await screen.findByTestId("today.myCrew.section");
    expect(
      await within(section).findByTestId("today.myCrew.item.0.status"),
    ).toHaveTextContent("Certified");
  });

  it("shows the In Training stage tag on a crew row", async () => {
    renderPageWithActor(
      TodayPage,
      todayActor(
        myCrew([crewRow(1n, "Ada Roadie", { stage: RoadieStage.inTraining })]),
      ),
      { path: "/today" },
    );

    const section = await screen.findByTestId("today.myCrew.section");
    expect(
      await within(section).findByTestId("today.myCrew.item.0.status"),
    ).toHaveTextContent("In Training");
  });
});

/* ---------------------------------------------------------------------------
   Group chip stage tag
--------------------------------------------------------------------------- */

function chip(
  roadieId: bigint,
  name: string,
  stage: RoadieStage,
): ShiftBoardRoadie {
  return {
    roadieId,
    name,
    positionCode: "SRV",
    positionId: 0n,
    markedUnavailable: false,
    stage,
  };
}

describe("RoadieChip shows the stage tag", () => {
  it("renders the Certified stage label on a group chip", async () => {
    renderWithActor(
      <RoadieChip
        roadie={chip(1n, "Ada Roadie", RoadieStage.certified)}
        selected={false}
        draggable={false}
        onOpenCard={vi.fn()}
        onToggleSelect={vi.fn()}
        ocid="chip"
      />,
      { getPhoto: vi.fn<backendInterface["getPhoto"]>(async () => null) },
    );

    expect(await screen.findByTestId("chip.stage")).toHaveTextContent(
      "Certified",
    );
  });

  it("renders the Oriented stage label on a group chip", async () => {
    renderWithActor(
      <RoadieChip
        roadie={chip(1n, "Ada Roadie", RoadieStage.oriented)}
        selected={false}
        draggable={false}
        onOpenCard={vi.fn()}
        onToggleSelect={vi.fn()}
        ocid="chip"
      />,
      { getPhoto: vi.fn<backendInterface["getPhoto"]>(async () => null) },
    );

    expect(await screen.findByTestId("chip.stage")).toHaveTextContent(
      "Oriented",
    );
  });
});
