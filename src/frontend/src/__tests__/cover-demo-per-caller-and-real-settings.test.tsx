import { renderPageWithActor } from "@/__tests__/router-test-utils";
import { setIdentityForTest } from "@/__tests__/setup";
import { renderWithActor } from "@/__tests__/test-utils";
import type {
  AccessGrant,
  Checklists,
  DemoStateView,
  MyAccessView,
  Position,
  RetentionSettings,
  StoreInfo,
  backendInterface,
} from "@/backend";
import { DemoRole, House, Role } from "@/backend";
import { DemoSettingsNote } from "@/components/DemoBanner";
import { useAccessState } from "@/hooks/useAccess";
import AdminPage from "@/pages/Admin";
import type { Principal } from "@icp-sdk/core/principal";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * Cover for the accepted Demo mode change: while demo mode is on the real
 * settings controls are hidden with the explanatory note, and the demo switch
 * stays reachable. The frontend suite mocks the actor, so these tests prove the
 * UI contract, not the backend guard.
 */

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

const CHECKLISTS: Checklists = {
  orientationUniform: [
    {
      id: 0n,
      text: "Non-slip shoes",
      requiresAlcoholCert: false,
      minorOnly: false,
    },
  ],
  paperwork: [
    {
      id: 0n,
      text: "Onboarding",
      requiresAlcoholCert: false,
      minorOnly: false,
    },
  ],
};

const RETENTION: RetentionSettings = {
  archivedContactSetDays: 90n,
  notesDays: 365n,
  archivedPhotoDays: 365n,
  changeLogDays: 730n,
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
    enabled: true,
    demoRole: DemoRole.admin,
    demoTrainerStations: [],
    pretendDate: undefined,
    turnedOnAt: undefined,
    autoOffAt: undefined,
    ...overrides,
  };
}

/** The actor methods the admin page tree reads across its tabs. */
function adminActor(
  overrides: {
    myAccess?: MyAccessView;
    demo?: DemoStateView;
  } = {},
) {
  return {
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(
      async () => overrides.myAccess ?? { grant: grant(Role.admin) },
    ),
    getDemoState: vi.fn<backendInterface["getDemoState"]>(
      async () => overrides.demo ?? demoState(),
    ),
    getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(async () => STORE),
    listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
      SERVERS,
    ]),
    listSchedule: vi.fn<backendInterface["listSchedule"]>(async () => []),
    getChecklists: vi.fn<backendInterface["getChecklists"]>(
      async () => CHECKLISTS,
    ),
    getRetentionSettings: vi.fn<backendInterface["getRetentionSettings"]>(
      async () => RETENTION,
    ),
    listAccessGrants: vi.fn<backendInterface["listAccessGrants"]>(
      async () => [],
    ),
    adminCount: vi.fn<backendInterface["adminCount"]>(async () => 1n),
    hasKioskPin: vi.fn<backendInterface["hasKioskPin"]>(async () => false),
    setKioskPin: vi.fn<backendInterface["setKioskPin"]>(async () => {}),
    saveStoreTemplate: vi.fn<backendInterface["saveStoreTemplate"]>(
      async () => {},
    ),
    downloadStoreTemplate: vi.fn<backendInterface["downloadStoreTemplate"]>(
      async () => ({
        version: 1n,
        leaderTalkName: "10 Minutes with Dan",
        leaderTalkSize: 10n,
        trainingGroupSize: 5n,
        positions: [],
        schedule: [],
        checklists: { orientationUniform: [], paperwork: [] },
      }),
    ),
    updateChecklists: vi.fn<backendInterface["updateChecklists"]>(
      async () => {},
    ),
    adjustBuildTo: vi.fn<backendInterface["adjustBuildTo"]>(async () => {}),
  };
}

describe("demo mode hides the real-settings controls", () => {
  it("hides the Access grants, Store template, Positions, Schedule and Checklists tabs while demo is on", async () => {
    const actor = adminActor();
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    // The demo switch stays reachable on the Store tab so an Admin can turn
    // demo mode off.
    expect(await screen.findByTestId("admin.demo.section")).toBeInTheDocument();
    expect(await screen.findByTestId("admin.store.tab")).toBeInTheDocument();

    // The real-settings tabs are gone while demo is on.
    expect(screen.queryByTestId("admin.access.tab")).not.toBeInTheDocument();
    expect(screen.queryByTestId("admin.template.tab")).not.toBeInTheDocument();
    expect(screen.queryByTestId("admin.positions.tab")).not.toBeInTheDocument();
    expect(screen.queryByTestId("admin.schedule.tab")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("admin.checklists.tab"),
    ).not.toBeInTheDocument();
    // The Kiosk PIN lives in the Access panel, which is not mounted.
    expect(
      screen.queryByTestId("admin.kiosk_pin.section"),
    ).not.toBeInTheDocument();
  });

  it("shows the real-settings tabs again once demo mode is off", async () => {
    const actor = adminActor({ demo: demoState({ enabled: false }) });
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    expect(await screen.findByTestId("admin.access.tab")).toBeInTheDocument();
    expect(screen.getByTestId("admin.template.tab")).toBeInTheDocument();
    expect(screen.getByTestId("admin.positions.tab")).toBeInTheDocument();
    expect(screen.getByTestId("admin.schedule.tab")).toBeInTheDocument();
    expect(screen.getByTestId("admin.checklists.tab")).toBeInTheDocument();
  });
});

describe("the demo switch is gated on the real grant", () => {
  it("does not show the demo switch to a caller with no real grant", async () => {
    const actor = adminActor({
      myAccess: { demoRole: DemoRole.admin },
      demo: demoState({ demoRole: DemoRole.admin }),
    });
    // A signed-in identity is required for the synthetic demo grant path.
    setIdentityForTest({
      identity: {
        getPrincipal: () => ({
          isAnonymous: () => false,
          toText: () => "aaaaa-aa",
        }),
      } as never,
      loginStatus: "success",
    });
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    // The Store tab renders, but the demo switch is not shown because the
    // caller holds no real Admin grant.
    expect(await screen.findByTestId("admin.store.tab")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByTestId("admin.demo.section"),
      ).not.toBeInTheDocument(),
    );
  });
});

/** A probe that renders the resolved access state and the demo settings note. */
function AccessProbe() {
  const access = useAccessState();
  const role = access.kind === "granted" ? access.grant.role : "none";
  const demo = access.kind === "granted" && access.demo === true;
  return (
    <div>
      <span data-ocid="probe.kind">{access.kind}</span>
      <span data-ocid="probe.role">{role}</span>
      <span data-ocid="probe.demo">{String(demo)}</span>
      <DemoSettingsNote />
    </div>
  );
}

describe("the caller's own demo role resolves per caller", () => {
  it("acts as the caller's chosen demo role while demo is on", async () => {
    const actor = adminActor({
      myAccess: { grant: grant(Role.admin), demoRole: DemoRole.storeManager },
      demo: demoState({ demoRole: DemoRole.storeManager }),
    });
    renderWithActor(<AccessProbe />, actor);

    await waitFor(() =>
      expect(screen.getByTestId("probe.kind")).toHaveTextContent("granted"),
    );
    expect(screen.getByTestId("probe.role")).toHaveTextContent(
      Role.storeManager,
    );
    expect(screen.getByTestId("probe.demo")).toHaveTextContent("true");
  });

  it("defaults a signed-in caller with no chosen demo role to demo Admin", async () => {
    const actor = adminActor({
      myAccess: { grant: grant(Role.admin), demoRole: DemoRole.admin },
      demo: demoState({ demoRole: DemoRole.admin }),
    });
    renderWithActor(<AccessProbe />, actor);

    await waitFor(() =>
      expect(screen.getByTestId("probe.role")).toHaveTextContent(Role.admin),
    );
  });

  it("gives an anonymous caller no role even while demo is on", async () => {
    // The default identity is anonymous; the backend returns no demoRole.
    const actor = adminActor({
      myAccess: { demoRole: undefined },
      demo: demoState({ demoRole: undefined }),
    });
    renderWithActor(<AccessProbe />, actor);

    // No real grant and no demo role: the caller stays pending, not granted.
    await waitFor(() =>
      expect(screen.getByTestId("probe.kind")).toHaveTextContent("pending"),
    );
    expect(screen.getByTestId("probe.role")).toHaveTextContent("none");
  });

  it("does not report a caller with no real grant as approved", async () => {
    const actor = adminActor({
      myAccess: { demoRole: DemoRole.admin },
      demo: demoState({ demoRole: DemoRole.admin }),
    });
    // A signed-in identity is required for the synthetic demo grant path.
    setIdentityForTest({
      identity: {
        getPrincipal: () => ({
          isAnonymous: () => false,
          toText: () => "aaaaa-aa",
        }),
      } as never,
      loginStatus: "success",
    });
    renderWithActor(<AccessProbe />, actor);

    // The caller acts as demo Admin against demo data, but the state is marked
    // as a demo-only grant rather than a real approval.
    await waitFor(() =>
      expect(screen.getByTestId("probe.kind")).toHaveTextContent("granted"),
    );
    expect(screen.getByTestId("probe.role")).toHaveTextContent(Role.admin);
    expect(screen.getByTestId("probe.demo")).toHaveTextContent("true");
  });
});

describe("the demo settings note", () => {
  it("shows the explanatory note while demo mode is on", async () => {
    const actor = adminActor({ demo: demoState({ enabled: true }) });
    renderWithActor(<AccessProbe />, actor);

    expect(await screen.findByTestId("demo.settings_note")).toHaveTextContent(
      "Turn off demo mode to change real settings.",
    );
  });

  it("renders no note while demo mode is off", async () => {
    const actor = adminActor({ demo: demoState({ enabled: false }) });
    renderWithActor(<AccessProbe />, actor);

    await screen.findByTestId("probe.kind");
    expect(screen.queryByTestId("demo.settings_note")).not.toBeInTheDocument();
  });
});
