import { renderPageWithActor } from "@/__tests__/router-test-utils";
import type {
  Position,
  RosterSummary,
  ScheduleEvent,
  backendInterface,
} from "@/backend";
import { EventKind, House } from "@/backend";
import DashboardPage from "@/pages/Dashboard";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * The fresh-install seed: 18 positions totalling 218 opening build-to, split
 * across the two houses. Mirrors migrations/00000000_000000.mo.
 */
const SEEDED_POSITIONS: Position[] = [
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
  },
  {
    id: 1n,
    name: "Cashiers",
    code: "CSH",
    house: House.foh,
    openingBuildTo: 30n,
    afterOpeningBuildTo: 30n,
    minimumAge: 16n,
    shirtsRequired: 2n,
    hatsRequired: 1n,
    needsAlcoholCert: false,
  },
  {
    id: 2n,
    name: "Bartenders",
    code: "BAR",
    house: House.foh,
    openingBuildTo: 12n,
    afterOpeningBuildTo: 12n,
    minimumAge: 21n,
    shirtsRequired: 2n,
    hatsRequired: 1n,
    needsAlcoholCert: true,
  },
  {
    id: 3n,
    name: "Hosts",
    code: "HST",
    house: House.foh,
    openingBuildTo: 10n,
    afterOpeningBuildTo: 10n,
    minimumAge: 16n,
    shirtsRequired: 2n,
    hatsRequired: 1n,
    needsAlcoholCert: false,
  },
  {
    id: 4n,
    name: "To-Go",
    code: "TG",
    house: House.foh,
    openingBuildTo: 8n,
    afterOpeningBuildTo: 8n,
    minimumAge: 16n,
    shirtsRequired: 2n,
    hatsRequired: 1n,
    needsAlcoholCert: false,
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
  },
  {
    id: 6n,
    name: "Grill",
    code: "GRL",
    house: House.boh,
    openingBuildTo: 14n,
    afterOpeningBuildTo: 14n,
    minimumAge: 18n,
    shirtsRequired: 2n,
    hatsRequired: 1n,
    needsAlcoholCert: false,
  },
  {
    id: 7n,
    name: "Prep",
    code: "PRP",
    house: House.boh,
    openingBuildTo: 12n,
    afterOpeningBuildTo: 12n,
    minimumAge: 16n,
    shirtsRequired: 2n,
    hatsRequired: 1n,
    needsAlcoholCert: false,
  },
  {
    id: 8n,
    name: "Dish",
    code: "DSH",
    house: House.boh,
    openingBuildTo: 10n,
    afterOpeningBuildTo: 10n,
    minimumAge: 16n,
    shirtsRequired: 2n,
    hatsRequired: 1n,
    needsAlcoholCert: false,
  },
  {
    id: 9n,
    name: "Busser",
    code: "BSR",
    house: House.boh,
    openingBuildTo: 8n,
    afterOpeningBuildTo: 8n,
    minimumAge: 16n,
    shirtsRequired: 2n,
    hatsRequired: 1n,
    needsAlcoholCert: false,
  },
  {
    id: 10n,
    name: "Baker",
    code: "BKR",
    house: House.boh,
    openingBuildTo: 6n,
    afterOpeningBuildTo: 6n,
    minimumAge: 18n,
    shirtsRequired: 2n,
    hatsRequired: 1n,
    needsAlcoholCert: false,
  },
  {
    id: 11n,
    name: "Expo",
    code: "EXP",
    house: House.boh,
    openingBuildTo: 6n,
    afterOpeningBuildTo: 6n,
    minimumAge: 16n,
    shirtsRequired: 2n,
    hatsRequired: 1n,
    needsAlcoholCert: false,
  },
  {
    id: 12n,
    name: "Trainer",
    code: "TRN",
    house: House.foh,
    openingBuildTo: 5n,
    afterOpeningBuildTo: 5n,
    minimumAge: 18n,
    shirtsRequired: 2n,
    hatsRequired: 1n,
    needsAlcoholCert: false,
  },
  {
    id: 13n,
    name: "Shift Lead",
    code: "SL",
    house: House.foh,
    openingBuildTo: 4n,
    afterOpeningBuildTo: 4n,
    minimumAge: 18n,
    shirtsRequired: 2n,
    hatsRequired: 1n,
    needsAlcoholCert: false,
  },
  {
    id: 14n,
    name: "Drive Thru",
    code: "DT",
    house: House.foh,
    openingBuildTo: 4n,
    afterOpeningBuildTo: 4n,
    minimumAge: 16n,
    shirtsRequired: 2n,
    hatsRequired: 1n,
    needsAlcoholCert: false,
  },
  {
    id: 15n,
    name: "Curbside",
    code: "CUR",
    house: House.foh,
    openingBuildTo: 3n,
    afterOpeningBuildTo: 3n,
    minimumAge: 16n,
    shirtsRequired: 2n,
    hatsRequired: 1n,
    needsAlcoholCert: false,
  },
  {
    id: 16n,
    name: "Janitorial",
    code: "JAN",
    house: House.boh,
    openingBuildTo: 3n,
    afterOpeningBuildTo: 3n,
    minimumAge: 16n,
    shirtsRequired: 2n,
    hatsRequired: 1n,
    needsAlcoholCert: false,
  },
  {
    id: 17n,
    name: "Maintenance",
    code: "MNT",
    house: House.boh,
    openingBuildTo: 2n,
    afterOpeningBuildTo: 2n,
    minimumAge: 18n,
    shirtsRequired: 2n,
    hatsRequired: 1n,
    needsAlcoholCert: false,
  },
];

/** The 12 seeded opening-schedule events. */
const SEEDED_SCHEDULE: ScheduleEvent[] = Array.from({ length: 12 }, (_, i) => ({
  id: BigInt(i),
  kind: i === 11 ? EventKind.openingDay : EventKind.deadline,
  name: `Seeded event ${i + 1}`,
  start: 1_801_202_400_000_000_000n + BigInt(i) * 86_400_000_000_000n,
}));

const SEEDED_SUMMARY: RosterSummary[] = SEEDED_POSITIONS.map((position) => ({
  positionId: position.id,
  positionName: position.name,
  onHand: 0n,
  buildTo: position.openingBuildTo,
  openSpots: position.openingBuildTo,
}));

/** The actor the dashboard tree reads for a freshly seeded store. */
function seededActor() {
  const foh = SEEDED_POSITIONS.filter((p) => p.house === House.foh);
  const boh = SEEDED_POSITIONS.filter((p) => p.house === House.boh);
  const buildToTotal = SEEDED_POSITIONS.reduce(
    (sum, p) => sum + p.openingBuildTo,
    0n,
  );
  return {
    getDashboard: vi.fn<backendInterface["getDashboard"]>(async () => ({
      foh,
      boh,
      hired: 0n,
      stillNeeded: buildToTotal,
      buildToTotal,
    })),
    listSchedule: vi.fn<backendInterface["listSchedule"]>(
      async () => SEEDED_SCHEDULE,
    ),
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
      async () => SEEDED_SUMMARY,
    ),
  };
}

describe("DashboardPage fresh-install seed", () => {
  it("renders all 18 seeded positions across both houses", async () => {
    renderPageWithActor(DashboardPage, seededActor(), { path: "/dashboard" });

    expect(
      await screen.findByTestId("dashboard.foh.section"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("dashboard.boh.section")).toBeInTheDocument();
    // Every seeded position name is rendered exactly once.
    for (const position of SEEDED_POSITIONS) {
      expect(screen.getByText(position.name)).toBeInTheDocument();
    }
  });

  it("shows the 218 build-to total and the still-needed KPI", async () => {
    renderPageWithActor(DashboardPage, seededActor(), { path: "/dashboard" });

    expect(
      await screen.findByTestId("dashboard.kpi.build_to"),
    ).toHaveTextContent("218");
    expect(screen.getByTestId("dashboard.kpi.still_needed")).toHaveTextContent(
      "218",
    );
  });

  it("renders all 12 seeded opening-schedule events on the timeline", async () => {
    renderPageWithActor(DashboardPage, seededActor(), { path: "/dashboard" });

    expect(
      await screen.findByTestId("dashboard.timeline.list"),
    ).toBeInTheDocument();
    for (let i = 1; i <= 12; i += 1) {
      expect(
        screen.getByTestId(`dashboard.timeline.item.${i}`),
      ).toBeInTheDocument();
    }
    expect(screen.getByText("Seeded event 12")).toBeInTheDocument();
  });
});
