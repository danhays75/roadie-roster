import { renderPageWithActor, t } from "@/__tests__/router-test-utils";
import { renderWithActor } from "@/__tests__/test-utils";
import type {
  AbsentAlertView,
  AccessGrant,
  Crew,
  DemoStateView,
  LeaderSummary,
  MyCrewRoadieRow,
  MyCrewView,
  Position,
  Roadie,
  StaffProfile,
  StoreInfo,
  TodayView,
  backendInterface,
} from "@/backend";
import {
  DemoRole,
  House,
  RoadieStatus,
  Role,
  RosterState,
  Shift,
} from "@/backend";
import { DemoBanner } from "@/components/DemoBanner";
import { I18nContext, translate } from "@/hooks/useI18n";
import type { Locale } from "@/lib/copy";
import RosterPage from "@/pages/Roster";
import TodayPage from "@/pages/Today";
import type { Principal } from "@icp-sdk/core/principal";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

/**
 * Cover for the accepted crew-ownership surfaces: the Today "My crew" section,
 * the Roster Crew filter and "My crew" chip, and the demo banner "Manager:"
 * picker. The actor is a typed local mock; no live backend, identity or storage
 * is exercised. The backend lane is the only place the real canister runs.
 */

function fakePrincipal(text: string): Principal {
  return {
    toText: () => text,
    toString: () => text,
  } as unknown as Principal;
}

const ADMIN_PRINCIPAL = fakePrincipal("aaaaa-aa");
const JORDAN_PRINCIPAL = fakePrincipal("jordan-aa");
const SAM_PRINCIPAL = fakePrincipal("sam-aa");

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

function grant(
  role: Role,
  principal: Principal = ADMIN_PRINCIPAL,
): AccessGrant {
  return {
    principal,
    role,
    approvedAt: 0n,
    approvedBy: ADMIN_PRINCIPAL,
    trainerPositionIds: [],
  };
}

function roadie(
  id: bigint,
  name: string,
  crewId: bigint | undefined,
  rosterState: RosterState,
): Roadie {
  return {
    id,
    status: RoadieStatus.active,
    mainPositionId: 0n,
    crewId,
    isMinor: false,
    hiredAt: 0n,
    isDemo: false,
    profile: { name },
    rosterState,
  };
}

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

function absentAlert(): AbsentAlertView {
  return {
    id: 1n,
    eventId: 1n,
    roadieId: 9n,
    name: "Absent Roadie",
    createdAt: 0n,
    shift: Shift.am,
    shiftLabel: "Training Day 1 · AM",
    archived: false,
  };
}

function todayView(crew: MyCrewView | null): TodayView {
  return {
    role: Role.storeManager,
    absentAlerts: [absentAlert()],
    shiftSummaries: [],
    myCrew: crew ?? undefined,
  };
}

/** The actor the manager Today tree reads, with the caller's own crew. */
function todayActor(crew: MyCrewView | null, roadies: Roadie[]) {
  return {
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: grant(Role.storeManager, JORDAN_PRINCIPAL),
    })),
    getToday: vi.fn<backendInterface["getToday"]>(async () => todayView(crew)),
    listAbsentAlerts: vi.fn<backendInterface["listAbsentAlerts"]>(async () => [
      absentAlert(),
    ]),
    getMyCrew: vi.fn<backendInterface["getMyCrew"]>(async () => crew),
    listRoadies: vi.fn<backendInterface["listRoadies"]>(async () => roadies),
    getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(async () => STORE),
    listCrews: vi.fn<backendInterface["listCrews"]>(async () => []),
    getDemoState: vi.fn<backendInterface["getDemoState"]>(async () => ({
      enabled: false,
      demoTrainerStations: [],
    })),
    getPhoto: vi.fn<backendInterface["getPhoto"]>(async () => null),
  };
}

describe("Today My crew section", () => {
  it("shows the crew heading and one row per roadie with status and paperwork", async () => {
    const crew = myCrew([
      crewRow(1n, "Ada Roadie", { rosterState: RosterState.pending }),
      crewRow(2n, "Bea Roadie", {
        rosterState: RosterState.active,
        paperworkDone: 1n,
        paperworkTotal: 4n,
      }),
    ]);
    renderPageWithActor(
      TodayPage,
      todayActor(crew, [
        roadie(1n, "Ada Roadie", 0n, RosterState.pending),
        roadie(2n, "Bea Roadie", 0n, RosterState.active),
      ]),
      { path: "/today" },
    );

    const section = await screen.findByTestId("today.myCrew.section");
    expect(
      await within(section).findByText("My crew · 2 roadies"),
    ).toBeInTheDocument();

    const first = within(section).getByTestId("today.myCrew.item.0");
    expect(within(first).getByText("Ada Roadie")).toBeInTheDocument();
    expect(within(first).getByText("Servers")).toBeInTheDocument();
    expect(
      within(first).getByTestId("today.myCrew.item.0.status"),
    ).toHaveTextContent(t("roster.filter.pending"));
    expect(
      within(first).getByTestId("today.myCrew.item.0.paperwork"),
    ).toHaveTextContent("2 of 3");

    const second = within(section).getByTestId("today.myCrew.item.1");
    expect(
      within(second).getByTestId("today.myCrew.item.1.status"),
    ).toHaveTextContent(t("roster.filter.active"));
    expect(
      within(second).getByTestId("today.myCrew.item.1.paperwork"),
    ).toHaveTextContent("1 of 4");
  });

  it("shows the red Absent today and Paperwork overdue tags where applicable", async () => {
    const crew = myCrew([
      crewRow(1n, "Ada Roadie", { absentToday: true, paperworkOverdue: true }),
    ]);
    renderPageWithActor(
      TodayPage,
      todayActor(crew, [roadie(1n, "Ada Roadie", 0n, RosterState.active)]),
      { path: "/today" },
    );

    const row = await screen.findByTestId("today.myCrew.item.0");
    expect(
      within(row).getByTestId("today.myCrew.item.0.absent"),
    ).toHaveTextContent("Absent today");
    expect(
      within(row).getByTestId("today.myCrew.item.0.overdue"),
    ).toHaveTextContent("Paperwork overdue");
  });

  it("renders the My crew section above the alerts list", async () => {
    const crew = myCrew([crewRow(1n, "Ada Roadie")]);
    renderPageWithActor(
      TodayPage,
      todayActor(crew, [roadie(1n, "Ada Roadie", 0n, RosterState.active)]),
      { path: "/today" },
    );

    const section = await screen.findByTestId("today.myCrew.section");
    const alerts = await screen.findByTestId("alerts.section");
    // The crew section precedes the alerts list in document order.
    expect(
      section.compareDocumentPosition(alerts) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("opens the roadie card pop-up when a crew row is tapped", async () => {
    const user = userEvent.setup();
    const crew = myCrew([crewRow(1n, "Ada Roadie")]);
    renderPageWithActor(
      TodayPage,
      todayActor(crew, [roadie(1n, "Ada Roadie", 0n, RosterState.active)]),
      { path: "/today" },
    );

    await user.click(await screen.findByTestId("today.myCrew.item.0.link"));
    const modal = await screen.findByTestId("roadie.card_modal");
    expect(within(modal).getByTestId("roadie.flip_card")).toBeInTheDocument();
  });

  it("renders no My crew section for a caller who owns no crew", async () => {
    renderPageWithActor(TodayPage, todayActor(null, []), { path: "/today" });

    await screen.findByTestId("alerts.section");
    // The crew query resolves to null, so the section unmounts.
    await waitFor(() =>
      expect(
        screen.queryByTestId("today.myCrew.section"),
      ).not.toBeInTheDocument(),
    );
  });
});

/** The actor the Roster page reads, with crews and the caller's own crew. */
function rosterActor(
  roadies: Roadie[],
  crews: Crew[],
  myCrewView: MyCrewView | null,
) {
  return {
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: grant(Role.storeManager, JORDAN_PRINCIPAL),
    })),
    listRoadies: vi.fn<backendInterface["listRoadies"]>(async () => roadies),
    listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
      SERVERS,
    ]),
    listCrews: vi.fn<backendInterface["listCrews"]>(async () => crews),
    getMyCrew: vi.fn<backendInterface["getMyCrew"]>(async () => myCrewView),
    getDemoState: vi.fn<backendInterface["getDemoState"]>(async () => ({
      enabled: false,
      demoTrainerStations: [],
    })),
    getPhoto: vi.fn<backendInterface["getPhoto"]>(async () => null),
  };
}

describe("Roster Crew filter and My crew chip", () => {
  const CREWS: Crew[] = [
    {
      id: 0n,
      name: "Jordan's Crew",
      leaderPrincipal: JORDAN_PRINCIPAL,
      isDemo: false,
    },
    {
      id: 1n,
      name: "Sam's Crew",
      leaderPrincipal: SAM_PRINCIPAL,
      isDemo: false,
    },
  ];

  it("filters the roster to a chosen crew", async () => {
    const user = userEvent.setup();
    const roadies = [
      roadie(1n, "Ada Roadie", 0n, RosterState.active),
      roadie(2n, "Bea Roadie", 1n, RosterState.active),
    ];
    renderPageWithActor(RosterPage, rosterActor(roadies, CREWS, null), {
      path: "/roster",
    });

    await screen.findByText("Ada Roadie");
    expect(screen.getByText("Bea Roadie")).toBeInTheDocument();

    await user.click(screen.getByTestId("roster.crew.select"));
    await user.click(await screen.findByRole("option", { name: "Sam's Crew" }));

    await waitFor(() =>
      expect(screen.queryByText("Ada Roadie")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Bea Roadie")).toBeInTheDocument();
  });

  it("filters the roster to roadies with no crew", async () => {
    const user = userEvent.setup();
    const roadies = [
      roadie(1n, "Ada Roadie", 0n, RosterState.active),
      roadie(2n, "No Crew Roadie", undefined, RosterState.active),
    ];
    renderPageWithActor(RosterPage, rosterActor(roadies, CREWS, null), {
      path: "/roster",
    });

    await screen.findByText("Ada Roadie");
    await user.click(screen.getByTestId("roster.crew.select"));
    await user.click(await screen.findByRole("option", { name: "No crew" }));

    await waitFor(() =>
      expect(screen.queryByText("Ada Roadie")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("No Crew Roadie")).toBeInTheDocument();
  });

  it("shows the My crew chip only for a caller who owns a crew", async () => {
    const roadies = [roadie(1n, "Ada Roadie", 0n, RosterState.active)];
    const { unmount } = renderPageWithActor(
      RosterPage,
      rosterActor(roadies, CREWS, myCrew([crewRow(1n, "Ada Roadie")])),
      { path: "/roster" },
    );

    expect(
      await screen.findByTestId("roster.crew.my_crew.toggle"),
    ).toBeInTheDocument();
    unmount();

    renderPageWithActor(RosterPage, rosterActor(roadies, CREWS, null), {
      path: "/roster",
    });
    await screen.findByText("Ada Roadie");
    expect(
      screen.queryByTestId("roster.crew.my_crew.toggle"),
    ).not.toBeInTheDocument();
  });

  it("filters to the caller's own crew when the My crew chip is tapped", async () => {
    const user = userEvent.setup();
    const roadies = [
      roadie(1n, "Ada Roadie", 0n, RosterState.active),
      roadie(2n, "Bea Roadie", 1n, RosterState.active),
    ];
    renderPageWithActor(
      RosterPage,
      rosterActor(roadies, CREWS, myCrew([crewRow(1n, "Ada Roadie")])),
      { path: "/roster" },
    );

    await screen.findByText("Ada Roadie");
    await user.click(screen.getByTestId("roster.crew.my_crew.toggle"));

    await waitFor(() =>
      expect(screen.queryByText("Bea Roadie")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Ada Roadie")).toBeInTheDocument();
  });
});

/** The demo banner's Manager picker. */
function staffProfile(fullName: string): StaffProfile {
  return {
    fullName,
    title: "Manager",
    requestedRole: Role.storeManager,
    homeStoreNumber: "975",
    homeStoreCity: "Lake Charles",
    trainerPositionIds: [],
  };
}

function leader(
  principal: Principal,
  role: Role,
  fullName: string,
): LeaderSummary {
  return {
    principal,
    role,
    title: "Manager",
    staffProfile: staffProfile(fullName),
    trainerPositionIds: [],
  };
}

function demoState(overrides: Partial<DemoStateView> = {}): DemoStateView {
  return {
    enabled: true,
    demoTrainerStations: [],
    ...overrides,
  };
}

function bannerActor(state: DemoStateView, leaders: LeaderSummary[]) {
  return {
    getDemoState: vi.fn<backendInterface["getDemoState"]>(async () => state),
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: grant(Role.admin),
    })),
    listLeaders: vi.fn<backendInterface["listLeaders"]>(async () => leaders),
    listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
      SERVERS,
    ]),
    setDemoRole: vi.fn<backendInterface["setDemoRole"]>(async () => ({
      __kind__: "ok",
      ok: state,
    })),
    setDemoManagerAs: vi.fn<backendInterface["setDemoManagerAs"]>(async () => ({
      __kind__: "ok",
      ok: state,
    })),
    setDemoTrainerAs: vi.fn<backendInterface["setDemoTrainerAs"]>(async () => ({
      __kind__: "ok",
      ok: state,
    })),
    setPretendDate: vi.fn<backendInterface["setPretendDate"]>(async () => ({
      __kind__: "ok",
      ok: state,
    })),
  };
}

function renderBanner(actor: ReturnType<typeof bannerActor>) {
  return renderWithActor(
    <I18nContext.Provider
      value={{
        locale: "en",
        setLocale: vi.fn(),
        t: (key: string, vars?: Record<string, string | number>) =>
          translate("en" as Locale, key, vars),
      }}
    >
      <DemoBanner />
    </I18nContext.Provider>,
    actor,
  );
}

describe("Demo banner Manager picker", () => {
  const MANAGERS = [
    leader(JORDAN_PRINCIPAL, Role.storeManager, "Jordan Rivera"),
    leader(SAM_PRINCIPAL, Role.trainingManager, "Sam Lee"),
  ];

  it("shows the Manager picker for the Store Manager demo role and defaults to the first", async () => {
    const user = userEvent.setup();
    const actor = bannerActor(
      demoState({ demoRole: DemoRole.storeManager }),
      MANAGERS,
    );
    renderBanner(actor);

    await user.click(await screen.findByTestId("demo.view_as.open_button"));

    const managerSelect = await screen.findByTestId(
      "demo.view_as.manager_select",
    );
    expect(managerSelect).toHaveTextContent("Jordan Rivera");
    await waitFor(() =>
      expect(actor.setDemoManagerAs).toHaveBeenCalledWith(JORDAN_PRINCIPAL),
    );
  });

  it("shows the Manager picker for the Training Manager demo role", async () => {
    const user = userEvent.setup();
    renderBanner(
      bannerActor(demoState({ demoRole: DemoRole.trainingManager }), MANAGERS),
    );

    await user.click(await screen.findByTestId("demo.view_as.open_button"));
    expect(
      await screen.findByTestId("demo.view_as.manager_select"),
    ).toBeInTheDocument();
  });

  it("does not show the Manager picker for a non-manager demo role", async () => {
    const user = userEvent.setup();
    renderBanner(
      bannerActor(demoState({ demoRole: DemoRole.trainer }), MANAGERS),
    );

    await user.click(await screen.findByTestId("demo.view_as.open_button"));
    expect(
      screen.queryByTestId("demo.view_as.manager_select"),
    ).not.toBeInTheDocument();
  });

  it("stores the chosen manager per caller", async () => {
    const user = userEvent.setup();
    const actor = bannerActor(
      demoState({ demoRole: DemoRole.storeManager }),
      MANAGERS,
    );
    renderBanner(actor);

    await user.click(await screen.findByTestId("demo.view_as.open_button"));
    const managerSelect = await screen.findByTestId(
      "demo.view_as.manager_select",
    );
    await user.click(managerSelect);
    await user.click(
      await screen.findByRole("option", { name: "Sam Lee · Manager" }),
    );

    await waitFor(() =>
      expect(actor.setDemoManagerAs).toHaveBeenCalledWith(SAM_PRINCIPAL),
    );
  });
});
