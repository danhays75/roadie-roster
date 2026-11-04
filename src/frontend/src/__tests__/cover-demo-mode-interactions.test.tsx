import { renderPageWithActor } from "@/__tests__/router-test-utils";
import { renderWithActor } from "@/__tests__/test-utils";
import type {
  AccessGrant,
  DemoStateView,
  StoreInfo,
  backendInterface,
} from "@/backend";
import { DemoRole, DemoShift, House, Role } from "@/backend";
import { DemoBanner } from "@/components/DemoBanner";
import AdminPage from "@/pages/Admin";
import type { Principal } from "@icp-sdk/core/principal";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

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
          defaultShirts: 3n,
          defaultHats: 2n,
          shirtType: "Polo",
          shirtQty: 2n,
          hatType: "Cap",
          hatQty: 1n,
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
