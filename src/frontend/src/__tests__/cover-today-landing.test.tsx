import App from "@/App";
import { setActorForTest, setIdentityForTest } from "@/__tests__/setup";
import type {
  AccessGrant,
  StaffProfile,
  StoreInfo,
  TodayView,
  backendInterface,
} from "@/backend";
import { Role } from "@/backend";
import type { InternetIdentityContext } from "@caffeineai/core-infrastructure";
import type { Principal } from "@icp-sdk/core/principal";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const PRINCIPAL = { toText: () => "aaaaa-aa" } as unknown as Principal;

/** A signed-in (non-anonymous) identity for the app shell. */
const IDENTITY = {
  getPrincipal: () => ({ isAnonymous: () => false, toText: () => "aaaaa-aa" }),
} as unknown as NonNullable<InternetIdentityContext["identity"]>;

const STORE: StoreInfo = {
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
};

/** A completed staff profile so the approval gate renders the routed page. */
const PROFILE: StaffProfile = {
  title: "Manager",
  fullName: "Ada Manager",
  trainerPositionIds: [],
  homeStoreNumber: "975",
  homeStoreCity: "Lake Charles",
  requestedRole: Role.admin,
};

function grant(role: Role): AccessGrant {
  return {
    principal: PRINCIPAL,
    role,
    approvedAt: 0n,
    approvedBy: PRINCIPAL,
    trainerPositionIds: [],
    staffProfile: PROFILE,
  };
}

function today(role: Role): TodayView {
  return { role, shiftSummaries: [], absentAlerts: [] };
}

/**
 * The actor methods the app shell reads on the default route. Every read the
 * Today page performs is present so a regression that lands a role elsewhere
 * surfaces as a rendered surface rather than a swallowed rejection.
 */
function actorFor(role: Role) {
  return {
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: grant(role),
    })),
    requestAccess: vi.fn<backendInterface["requestAccess"]>(async () => false),
    bootstrapAdmin: vi.fn<backendInterface["bootstrapAdmin"]>(
      async () => false,
    ),
    listPendingUsers: vi.fn<backendInterface["listPendingUsers"]>(
      async () => [],
    ),
    getToday: vi.fn<backendInterface["getToday"]>(async () => today(role)),
    listAbsentAlerts: vi.fn<backendInterface["listAbsentAlerts"]>(
      async () => [],
    ),
    getMyGroup: vi.fn<backendInterface["getMyGroup"]>(async () => null),
    listGroupChangeNotices: vi.fn<backendInterface["listGroupChangeNotices"]>(
      async () => [],
    ),
    getDashboard: vi.fn<backendInterface["getDashboard"]>(async () => ({
      foh: [],
      boh: [],
      hired: 0n,
      stillNeeded: 0n,
      buildToTotal: 0n,
      active: 0n,
      pending: 0n,
    })),
    listSchedule: vi.fn<backendInterface["listSchedule"]>(async () => []),
    getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(async () => STORE),
    getDemoState: vi.fn<backendInterface["getDemoState"]>(async () => ({
      enabled: false,
      demoTrainerStations: [],
    })),
    submitSignup: vi.fn<backendInterface["submitSignup"]>(async () => 1n),
  };
}

function renderApp(actor: ReturnType<typeof actorFor>) {
  setIdentityForTest({ identity: IDENTITY });
  setActorForTest(actor);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  window.history.pushState({}, "", "/");
});

/**
 * The post-sign-in landing page is Today for every role except Kiosk. The actor
 * is mocked, so this proves the routing contract, not real sign-in or backend
 * authorization.
 */
describe("Today is the post-sign-in landing page", () => {
  it.each([
    Role.admin,
    Role.storeManager,
    Role.trainingManager,
    Role.trainer,
    Role.visitingManager,
    Role.leadership,
  ])("lands a %s on Today at the default route", async (role) => {
    window.history.pushState({}, "", "/");
    renderApp(actorFor(role));

    expect(await screen.findByTestId("today.page")).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard.page")).not.toBeInTheDocument();
  });

  it("lands a Kiosk login on the sign-up welcome screen, not Today", async () => {
    window.history.pushState({}, "", "/");
    renderApp(actorFor(Role.kiosk));

    expect(await screen.findByTestId("kiosk.welcome")).toBeInTheDocument();
    expect(screen.queryByTestId("today.page")).not.toBeInTheDocument();
  });
});
