import App from "@/App";
import { setActorForTest, setIdentityForTest } from "@/__tests__/setup";
import type { AccessGrant, StoreInfo, backendInterface } from "@/backend";
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

function grant(role: Role): AccessGrant {
  return {
    principal: PRINCIPAL,
    role,
    approvedAt: 0n,
    approvedBy: PRINCIPAL,
    trainerPositionIds: [],
  };
}

/**
 * The actor methods the app shell reads. Every read a Kiosk login would trap on
 * is present so a regression that renders the dashboard for a Kiosk login
 * surfaces as a rendered dashboard rather than a swallowed rejection.
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

describe("Kiosk deep-route redirect", () => {
  it("redirects a Kiosk login that opens /dashboard to the sign-up welcome screen", async () => {
    window.history.pushState({}, "", "/dashboard");
    renderApp(actorFor(Role.kiosk));

    expect(await screen.findByTestId("kiosk.welcome")).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard.page")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("dashboard.foh.section"),
    ).not.toBeInTheDocument();
  });

  it("redirects a Kiosk login that opens /roster without rendering the roster", async () => {
    window.history.pushState({}, "", "/roster");
    renderApp(actorFor(Role.kiosk));

    expect(await screen.findByTestId("kiosk.welcome")).toBeInTheDocument();
    // The roster surface must never render for a Kiosk login: its reads trap.
    expect(screen.queryByTestId("roster.page")).not.toBeInTheDocument();
    expect(screen.queryByTestId("roster.list")).not.toBeInTheDocument();
  });

  it("keeps a Store Manager on the dashboard rather than redirecting to the kiosk", async () => {
    window.history.pushState({}, "", "/dashboard");
    renderApp(actorFor(Role.storeManager));

    expect(await screen.findByTestId("dashboard.page")).toBeInTheDocument();
    expect(screen.queryByTestId("kiosk.welcome")).not.toBeInTheDocument();
  });
});
