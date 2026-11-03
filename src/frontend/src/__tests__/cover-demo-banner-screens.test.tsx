import { renderPageWithActor } from "@/__tests__/router-test-utils";
import { renderWithActor } from "@/__tests__/test-utils";
import type {
  AccessGrant,
  DemoStateView,
  StoreInfo,
  backendInterface,
} from "@/backend";
import { DemoRole, DemoShift, Role } from "@/backend";
import { ApprovalGate } from "@/components/ApprovalGate";
import { Layout } from "@/components/Layout";
import { OpeningTimeline } from "@/components/dashboard/OpeningTimeline";
import KioskPage from "@/pages/Kiosk";
import type { Principal } from "@icp-sdk/core/principal";
import { screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Cover for the accepted Demo mode change on the surfaces the banner must reach:
 * the app shell, the kiosk, the sign-in screen and the waiting screen all show
 * the sticky orange banner while demo mode is on, and the "Pretend it's" date
 * overrides the opening-day countdown. The actor is a typed local mock; no live
 * backend or identity is exercised.
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

const BANNER_LABEL = "DEMO MODE · fake data · not for real hires";

describe("the demo banner reaches every screen while demo mode is on", () => {
  it("shows the banner in the app shell", async () => {
    function Shell() {
      return (
        <Layout>
          <p>content</p>
        </Layout>
      );
    }
    renderPageWithActor(
      Shell,
      {
        getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () =>
          grant(Role.admin),
        ),
        getDemoState: vi.fn<backendInterface["getDemoState"]>(async () =>
          demoState({ enabled: true }),
        ),
        getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(
          async () => STORE,
        ),
      } satisfies Pick<
        backendInterface,
        "getMyAccess" | "getDemoState" | "getStoreInfo"
      >,
      { path: "/" },
    );

    const banner = await screen.findByTestId("demo.banner");
    expect(banner).toHaveTextContent(BANNER_LABEL);
  });

  it("shows the banner on the kiosk screen", async () => {
    // The kiosk route is wrapped by ApprovalGate, which mounts the banner above
    // the kiosk's own chrome-free screen.
    renderWithActor(
      <ApprovalGate>
        <KioskPage />
      </ApprovalGate>,
      {
        getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () =>
          grant(Role.kiosk),
        ),
        getDemoState: vi.fn<backendInterface["getDemoState"]>(async () =>
          demoState({ enabled: true }),
        ),
      } satisfies Pick<backendInterface, "getMyAccess" | "getDemoState">,
    );

    expect(await screen.findByTestId("demo.banner")).toHaveTextContent(
      BANNER_LABEL,
    );
    // The kiosk welcome screen renders below the banner.
    expect(await screen.findByTestId("kiosk.welcome")).toBeInTheDocument();
  });

  it("shows the banner on the waiting screen for an unapproved caller", async () => {
    renderWithActor(
      <ApprovalGate>
        <p>app chrome</p>
      </ApprovalGate>,
      {
        getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => null),
        getDemoState: vi.fn<backendInterface["getDemoState"]>(async () =>
          demoState({ enabled: true }),
        ),
        getMyPendingRequest: vi.fn<backendInterface["getMyPendingRequest"]>(
          async () => null,
        ),
        requestAccess: vi.fn<backendInterface["requestAccess"]>(
          async () => true,
        ),
        bootstrapAdmin: vi.fn<backendInterface["bootstrapAdmin"]>(
          async () => true,
        ),
      } satisfies Pick<
        backendInterface,
        | "getMyAccess"
        | "getDemoState"
        | "getMyPendingRequest"
        | "requestAccess"
        | "bootstrapAdmin"
      >,
    );

    // The waiting screen renders and the banner sits above it.
    expect(await screen.findByTestId("demo.banner")).toHaveTextContent(
      BANNER_LABEL,
    );
  });

  it("renders no banner while demo mode is off", async () => {
    function Shell() {
      return (
        <Layout>
          <p>content</p>
        </Layout>
      );
    }
    renderPageWithActor(
      Shell,
      {
        getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () =>
          grant(Role.admin),
        ),
        getDemoState: vi.fn<backendInterface["getDemoState"]>(async () =>
          demoState(),
        ),
        getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(
          async () => STORE,
        ),
      } satisfies Pick<
        backendInterface,
        "getMyAccess" | "getDemoState" | "getStoreInfo"
      >,
      { path: "/" },
    );

    await waitFor(() =>
      expect(screen.queryByTestId("demo.banner")).not.toBeInTheDocument(),
    );
  });
});

describe("the Pretend it's date overrides the opening-day countdown", () => {
  const OPENING: StoreInfo["openingDate"] = 1_802_066_400_000_000_000n;

  it("counts down to opening from the pretend date instead of the real clock", async () => {
    // The pretend date is 10 days before opening at 09:00 UTC, so the countdown
    // reads 9 days (10 days minus the 9 hours into the pretend day) regardless
    // of the real clock.
    const openingMs = Number(OPENING / 1_000_000n);
    const pretendDay = BigInt(openingMs - 10 * 86_400_000) * 1_000_000n;

    renderWithActor(<OpeningTimeline events={[]} openingDate={OPENING} />, {
      getDemoState: vi.fn<backendInterface["getDemoState"]>(async () =>
        demoState({
          enabled: true,
          pretendDate: { day: pretendDay, shift: DemoShift.am },
        }),
      ),
      getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(async () => STORE),
    } satisfies Pick<backendInterface, "getDemoState" | "getStoreInfo">);

    // The days unit is the first countdown box; it reads 9 from the pretend
    // date, not the real clock's much larger value.
    await waitFor(() =>
      expect(screen.getByTestId("dashboard.countdown.timer")).toHaveTextContent(
        "9",
      ),
    );
  });

  it("uses the real clock for the countdown while demo mode is off", async () => {
    renderWithActor(<OpeningTimeline events={[]} openingDate={OPENING} />, {
      getDemoState: vi.fn<backendInterface["getDemoState"]>(async () =>
        demoState(),
      ),
      getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(async () => STORE),
    } satisfies Pick<backendInterface, "getDemoState" | "getStoreInfo">);

    // The countdown still renders from the real clock; the pretend date is not
    // applied while demo mode is off.
    expect(
      await screen.findByTestId("dashboard.countdown.timer"),
    ).toBeInTheDocument();
  });
});
