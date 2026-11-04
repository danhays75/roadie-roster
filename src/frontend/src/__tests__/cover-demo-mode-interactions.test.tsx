import { renderPageWithActor } from "@/__tests__/router-test-utils";
import { renderWithActor } from "@/__tests__/test-utils";
import type {
  AccessGrant,
  DashboardView,
  DemoStateView,
  StoreInfo,
  backendInterface,
} from "@/backend";
import { DemoRole, DemoShift, House, Role } from "@/backend";
import { DemoBanner } from "@/components/DemoBanner";
import { useDashboard, useRosterSummary } from "@/hooks/useQueries";
import AdminPage from "@/pages/Admin";
import type { Principal } from "@icp-sdk/core/principal";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

/**
 * A sibling screen probe: reads the dashboard and roster-summary queries, which
 * the demo banner does not itself subscribe to. It lets a test observe that a
 * demo mutation refetches every query, not only the banner's own demo state.
 */
function ScreenProbe() {
  useDashboard();
  useRosterSummary();
  return <div data-ocid="probe.screen" />;
}

/**
 * Cover for the accepted Demo mode change: the banner's "View as" and
 * "Pretend it's" pickers actually drive the backend, and the Admin demo data
 * buttons call load/clear. The actor is a typed local mock; no live backend or
 * identity is exercised.
 */

// jsdom does not implement ResizeObserver; the demo banner measures its own
// height through one, so provide a minimal test-only polyfill.
beforeAll(() => {
  if (typeof globalThis.ResizeObserver !== "function") {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

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

const okResult = (state: DemoStateView) =>
  ({ __kind__: "ok" as const, ok: state }) as const;

/** A minimal DashboardView so the sibling probe's dashboard read resolves. */
function emptyDashboard(): DashboardView {
  return {
    boh: [],
    foh: [],
    active: 0n,
    hired: 0n,
    pending: 0n,
    stillNeeded: 0n,
    buildToTotal: 0n,
  };
}

describe("demo banner View as picker drives the backend", () => {
  it("calls setDemoRole with the chosen role", async () => {
    const user = userEvent.setup();
    const setDemoRole = vi.fn<backendInterface["setDemoRole"]>(async () =>
      okResult(demoState({ enabled: true, demoRole: DemoRole.kiosk })),
    );
    renderWithActor(<DemoBanner />, {
      getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
        grant: grant(Role.admin),
      })),
      getDemoState: vi.fn<backendInterface["getDemoState"]>(async () =>
        demoState({ enabled: true }),
      ),
      listPositions: vi.fn<backendInterface["listPositions"]>(async () => []),
      setDemoRole,
    } satisfies Pick<
      backendInterface,
      "getMyAccess" | "getDemoState" | "listPositions" | "setDemoRole"
    >);

    await user.click(await screen.findByTestId("demo.view_as.open_button"));
    await user.click(await screen.findByTestId("demo.view_as.select"));
    await user.click(await screen.findByRole("option", { name: "Kiosk" }));

    await waitFor(() =>
      expect(setDemoRole).toHaveBeenCalledWith(DemoRole.kiosk, []),
    );
  });

  it("offers station checkboxes for a demo NSO Trainer and saves them", async () => {
    const user = userEvent.setup();
    const setDemoRole = vi.fn<backendInterface["setDemoRole"]>(async () =>
      okResult(
        demoState({
          enabled: true,
          demoRole: DemoRole.trainer,
          demoTrainerStations: [3n],
        }),
      ),
    );
    renderWithActor(<DemoBanner />, {
      getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
        grant: grant(Role.admin),
      })),
      getDemoState: vi.fn<backendInterface["getDemoState"]>(async () =>
        demoState({ enabled: true, demoRole: DemoRole.trainer }),
      ),
      listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
        {
          id: 3n,
          name: "Cashier",
          openingBuildTo: 0n,
          afterOpeningBuildTo: 0n,
          house: House.foh,
          minimumAge: 0n,
          code: "CASH",
          shirtsRequired: 0n,
          hatsRequired: 0n,
          needsAlcoholCert: false,
          shirtType: "Polo",
          shirtQty: 2n,
          hatType: "Cap",
          hatQty: 1n,
          defaultShirts: 2n,
          defaultHats: 1n,
        },
      ]),
      setDemoRole,
    } satisfies Pick<
      backendInterface,
      "getMyAccess" | "getDemoState" | "listPositions" | "setDemoRole"
    >);

    await user.click(await screen.findByTestId("demo.view_as.open_button"));
    // The trainer role reveals the station list.
    await user.click(await screen.findByTestId("demo.view_as.station.3"));
    await user.click(
      await screen.findByTestId("demo.view_as.stations.save_button"),
    );

    await waitFor(() =>
      expect(setDemoRole).toHaveBeenCalledWith(DemoRole.trainer, [3n]),
    );
  });
});

describe("demo banner Pretend it's picker drives the backend", () => {
  it("calls setPretendDate with the chosen date and shift", async () => {
    const user = userEvent.setup();
    const setPretendDate = vi.fn<backendInterface["setPretendDate"]>(async () =>
      okResult(demoState({ enabled: true })),
    );
    renderWithActor(<DemoBanner />, {
      getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
        grant: grant(Role.admin),
      })),
      getDemoState: vi.fn<backendInterface["getDemoState"]>(async () =>
        demoState({ enabled: true }),
      ),
      listPositions: vi.fn<backendInterface["listPositions"]>(async () => []),
      setPretendDate,
    } satisfies Pick<
      backendInterface,
      "getMyAccess" | "getDemoState" | "listPositions" | "setPretendDate"
    >);

    await user.click(await screen.findByTestId("demo.pretend.open_button"));
    const dateInput = await screen.findByTestId("demo.pretend.date_input");
    await user.type(dateInput, "2027-03-14");
    await user.click(await screen.findByTestId("demo.pretend.apply_button"));

    await waitFor(() => expect(setPretendDate).toHaveBeenCalledTimes(1));
    const arg = setPretendDate.mock.calls[0]?.[0];
    expect(arg).not.toBeNull();
    expect(arg?.shift).toBe(DemoShift.am);
  });

  it("clears the pretend date with null", async () => {
    const user = userEvent.setup();
    const setPretendDate = vi.fn<backendInterface["setPretendDate"]>(async () =>
      okResult(demoState({ enabled: true })),
    );
    renderWithActor(<DemoBanner />, {
      getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
        grant: grant(Role.admin),
      })),
      getDemoState: vi.fn<backendInterface["getDemoState"]>(async () =>
        demoState({
          enabled: true,
          pretendDate: { day: 20_000n, shift: DemoShift.pm },
        }),
      ),
      listPositions: vi.fn<backendInterface["listPositions"]>(async () => []),
      setPretendDate,
    } satisfies Pick<
      backendInterface,
      "getMyAccess" | "getDemoState" | "listPositions" | "setPretendDate"
    >);

    await user.click(await screen.findByTestId("demo.pretend.open_button"));
    await user.click(await screen.findByTestId("demo.pretend.clear_button"));

    await waitFor(() => expect(setPretendDate).toHaveBeenCalledWith(null));
  });
});

describe("the banner reflects the demo state after a successful mutation", () => {
  it("shows the newly applied pretend date once setPretendDate resolves", async () => {
    const user = userEvent.setup();
    // Until the mutation runs the backend reports no pretend date; afterwards
    // it reports the applied date, so the banner must re-read and show it.
    const applied: DemoStateView = demoState({
      enabled: true,
      pretendDate: { day: 1_800_000_000_000_000_000n, shift: DemoShift.am },
    });
    let mutated = false;
    const getDemoState = vi.fn<backendInterface["getDemoState"]>(async () =>
      mutated ? applied : demoState({ enabled: true }),
    );
    const setPretendDate = vi.fn<backendInterface["setPretendDate"]>(
      async () => {
        mutated = true;
        return okResult(applied);
      },
    );
    renderWithActor(<DemoBanner />, {
      getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
        grant: grant(Role.admin),
      })),
      getDemoState,
      listPositions: vi.fn<backendInterface["listPositions"]>(async () => []),
      setPretendDate,
    } satisfies Pick<
      backendInterface,
      "getMyAccess" | "getDemoState" | "listPositions" | "setPretendDate"
    >);

    const banner = await screen.findByTestId("demo.banner");
    // Before the mutation the banner shows the real clock.
    expect(banner).toHaveTextContent("Now");

    await user.click(await screen.findByTestId("demo.pretend.open_button"));
    await user.type(
      await screen.findByTestId("demo.pretend.date_input"),
      "2027-01-15",
    );
    await user.click(await screen.findByTestId("demo.pretend.apply_button"));

    await waitFor(() => expect(setPretendDate).toHaveBeenCalledTimes(1));
    // The banner re-reads the demo state and shows the applied date, not "Now".
    await waitFor(() =>
      expect(screen.getByTestId("demo.banner")).not.toHaveTextContent("Now"),
    );
    expect(screen.getByTestId("demo.banner")).toHaveTextContent("AM");
  });

  it("hides the banner once setDemoMode(false) resolves", async () => {
    const user = userEvent.setup();
    let mutated = false;
    const getDemoState = vi.fn<backendInterface["getDemoState"]>(async () =>
      mutated ? demoState({ enabled: false }) : demoState({ enabled: true }),
    );
    const setDemoMode = vi.fn<backendInterface["setDemoMode"]>(async () => {
      mutated = true;
      return okResult(demoState({ enabled: false }));
    });
    renderWithActor(<DemoBanner />, {
      getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
        grant: grant(Role.admin),
      })),
      getDemoState,
      setDemoMode,
    } satisfies Pick<
      backendInterface,
      "getMyAccess" | "getDemoState" | "setDemoMode"
    >);

    await screen.findByTestId("demo.banner");
    await user.click(await screen.findByTestId("demo.turn_off_button"));

    await waitFor(() => expect(setDemoMode).toHaveBeenCalledWith(false, ""));
    // The banner re-reads the demo state and unmounts once it is off.
    await waitFor(() =>
      expect(screen.queryByTestId("demo.banner")).not.toBeInTheDocument(),
    );
  });
});

describe("demo mutations invalidate every query, not just the banner's own", () => {
  it("refetches the dashboard and roster queries after setPretendDate resolves", async () => {
    const user = userEvent.setup();
    const getDashboard = vi.fn<backendInterface["getDashboard"]>(async () =>
      emptyDashboard(),
    );
    const getRosterSummary = vi.fn<backendInterface["getRosterSummary"]>(
      async () => [],
    );
    const setPretendDate = vi.fn<backendInterface["setPretendDate"]>(async () =>
      okResult(demoState({ enabled: true })),
    );
    renderWithActor(
      <>
        <DemoBanner />
        <ScreenProbe />
      </>,
      {
        getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
          grant: grant(Role.admin),
        })),
        getDemoState: vi.fn<backendInterface["getDemoState"]>(async () =>
          demoState({ enabled: true }),
        ),
        listPositions: vi.fn<backendInterface["listPositions"]>(async () => []),
        getDashboard,
        getRosterSummary,
        setPretendDate,
      } satisfies Pick<
        backendInterface,
        | "getMyAccess"
        | "getDemoState"
        | "listPositions"
        | "getDashboard"
        | "getRosterSummary"
        | "setPretendDate"
      >,
    );

    // The sibling screen reads both queries once on mount.
    await waitFor(() => expect(getDashboard).toHaveBeenCalledTimes(1));
    expect(getRosterSummary).toHaveBeenCalledTimes(1);

    await user.click(await screen.findByTestId("demo.pretend.open_button"));
    await user.type(
      await screen.findByTestId("demo.pretend.date_input"),
      "2027-03-14",
    );
    await user.click(await screen.findByTestId("demo.pretend.apply_button"));

    await waitFor(() => expect(setPretendDate).toHaveBeenCalledTimes(1));
    // The no-key invalidation refetches the sibling screen's queries too.
    await waitFor(() => expect(getDashboard).toHaveBeenCalledTimes(2));
    expect(getRosterSummary).toHaveBeenCalledTimes(2);
  });

  it("refetches the dashboard and roster queries after setDemoMode resolves", async () => {
    const user = userEvent.setup();
    const getDashboard = vi.fn<backendInterface["getDashboard"]>(async () =>
      emptyDashboard(),
    );
    const getRosterSummary = vi.fn<backendInterface["getRosterSummary"]>(
      async () => [],
    );
    const setDemoMode = vi.fn<backendInterface["setDemoMode"]>(async () =>
      okResult(demoState({ enabled: false })),
    );
    renderWithActor(
      <>
        <DemoBanner />
        <ScreenProbe />
      </>,
      {
        getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
          grant: grant(Role.admin),
        })),
        getDemoState: vi.fn<backendInterface["getDemoState"]>(async () =>
          demoState({ enabled: true }),
        ),
        getDashboard,
        getRosterSummary,
        setDemoMode,
      } satisfies Pick<
        backendInterface,
        | "getMyAccess"
        | "getDemoState"
        | "getDashboard"
        | "getRosterSummary"
        | "setDemoMode"
      >,
    );

    await waitFor(() => expect(getDashboard).toHaveBeenCalledTimes(1));
    expect(getRosterSummary).toHaveBeenCalledTimes(1);

    await user.click(await screen.findByTestId("demo.turn_off_button"));

    await waitFor(() => expect(setDemoMode).toHaveBeenCalledWith(false, ""));
    await waitFor(() => expect(getDashboard).toHaveBeenCalledTimes(2));
    expect(getRosterSummary).toHaveBeenCalledTimes(2);
  });
});

describe("Admin demo data buttons drive the backend", () => {
  function adminActor(state: DemoStateView) {
    return {
      getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
        grant: grant(Role.admin),
      })),
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
      updateStoreInfo: vi.fn<backendInterface["updateStoreInfo"]>(
        async () => {},
      ),
      getDemoState: vi.fn<backendInterface["getDemoState"]>(async () => state),
      getDemoDataSummary: vi.fn<backendInterface["getDemoDataSummary"]>(
        async () => ({
          roadies: 0n,
          leaders: 0n,
          signups: 0n,
          crews: 0n,
          attendance: 0n,
          notes: 0n,
        }),
      ),
      loadDemoData: vi.fn<backendInterface["loadDemoData"]>(async () => ({
        roadies: 40n,
        leaders: 4n,
        signups: 3n,
        crews: 3n,
        attendance: 0n,
        notes: 0n,
      })),
      clearDemoData: vi.fn<backendInterface["clearDemoData"]>(async () => ({
        roadies: 0n,
        leaders: 0n,
        signups: 0n,
        crews: 0n,
        attendance: 0n,
        notes: 0n,
      })),
    };
  }

  it("loads demo data when the Load demo data button is clicked", async () => {
    const user = userEvent.setup();
    const actor = adminActor(demoState({ enabled: true }));
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    await user.click(await screen.findByTestId("admin.demo.load_data_button"));
    await waitFor(() => expect(actor.loadDemoData).toHaveBeenCalledTimes(1));
  });

  it("clears demo data only after the confirmation dialog is confirmed", async () => {
    const user = userEvent.setup();
    const actor = adminActor(demoState({ enabled: true }));
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    await user.click(await screen.findByTestId("admin.demo.clear_data_button"));
    // The confirmation dialog appears and nothing is cleared yet.
    expect(actor.clearDemoData).not.toHaveBeenCalled();

    await user.click(
      await screen.findByTestId("admin.demo.clear_confirm_button"),
    );
    await waitFor(() => expect(actor.clearDemoData).toHaveBeenCalledTimes(1));
  });
});
