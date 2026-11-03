import { renderPageWithActor, t } from "@/__tests__/router-test-utils";
import { renderWithActor } from "@/__tests__/test-utils";
import type {
  AccessGrant,
  DemoStateView,
  StoreInfo,
  backendInterface,
} from "@/backend";
import { DemoRole, DemoShift, Role } from "@/backend";
import { DemoBanner } from "@/components/DemoBanner";
import { ManagerSignaturePad } from "@/components/approvals/ManagerSignaturePad";
import { KioskSignatureStep } from "@/components/kiosk/KioskSignatureStep";
import AdminPage from "@/pages/Admin";
import type { Principal } from "@icp-sdk/core/principal";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Cover for the accepted Demo mode change on the frontend: the Admin Store
 * settings switch (off by default, Admin-only, DEMO-confirmed), the sticky
 * banner with its Turn off / View as / Pretend it's controls, and the Sign as
 * Test button on both signature pads. The actor is a typed local mock; no live
 * backend or identity is exercised.
 */

// jsdom does not implement object URLs; the kiosk photo step previews the
// captured file through one, so provide a minimal test-only polyfill.
beforeAll(() => {
  if (typeof URL.createObjectURL !== "function") {
    URL.createObjectURL = vi.fn(() => "blob:test-preview");
  }
  if (typeof URL.revokeObjectURL !== "function") {
    URL.revokeObjectURL = vi.fn();
  }
  // jsdom does not implement ResizeObserver; the demo banner measures its own
  // height through one, so provide a minimal test-only polyfill.
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

/** The actor methods the Admin Store settings tab reads and writes. */
function adminActor(role: Role = Role.admin, state = demoState()) {
  return {
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: grant(role),
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
    updateStoreInfo: vi.fn<backendInterface["updateStoreInfo"]>(async () => {}),
    getDemoState: vi.fn<backendInterface["getDemoState"]>(async () => state),
    setDemoMode: vi.fn<backendInterface["setDemoMode"]>(async () => ({
      __kind__: "ok" as const,
      ok: demoState({ enabled: true }),
    })),
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

describe("Admin Store settings demo mode switch", () => {
  it("shows the switch off by default and requires typing DEMO to turn it on", async () => {
    const user = userEvent.setup();
    const actor = adminActor();
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    const toggle = await screen.findByTestId("admin.demo.switch");
    expect(toggle).not.toBeChecked();
    expect(screen.getByTestId("admin.demo.off_state")).toBeInTheDocument();

    // A blank confirmation leaves demo mode off and reports the error.
    await user.click(screen.getByTestId("admin.demo.turn_on_button"));
    expect(
      await screen.findByText("Type DEMO to turn demo mode on."),
    ).toBeInTheDocument();
    expect(actor.setDemoMode).not.toHaveBeenCalled();

    // A wrong entry also leaves it off.
    await user.type(screen.getByTestId("admin.demo.confirm.input"), "demo");
    await user.click(screen.getByTestId("admin.demo.turn_on_button"));
    expect(actor.setDemoMode).not.toHaveBeenCalled();

    // Typing DEMO exactly turns it on.
    await user.clear(screen.getByTestId("admin.demo.confirm.input"));
    await user.type(screen.getByTestId("admin.demo.confirm.input"), "DEMO");
    await user.click(screen.getByTestId("admin.demo.turn_on_button"));
    await waitFor(() =>
      expect(actor.setDemoMode).toHaveBeenCalledWith(true, "DEMO"),
    );
  });

  it("hides the demo switch from a non-admin", async () => {
    renderPageWithActor(AdminPage, adminActor(Role.storeManager), {
      path: "/admin",
    });

    // The store settings panel still loads, but the demo section is absent.
    expect(
      await screen.findByTestId("admin.store.app_name.input"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("admin.demo.switch")).not.toBeInTheDocument();
  });

  it("shows the demo data controls and auto-off time while demo mode is on", async () => {
    const actor = adminActor(
      Role.admin,
      demoState({
        enabled: true,
        autoOffAt: 1_900_000_000_000_000_000n,
        turnedOnAt: 1_800_000_000_000_000_000n,
      }),
    );
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    expect(
      await screen.findByTestId("admin.demo.on_state"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("admin.demo.auto_off")).toBeInTheDocument();
    expect(
      screen.getByTestId("admin.demo.load_data_button"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("admin.demo.clear_data_button"),
    ).toBeInTheDocument();
  });
});

describe("sticky demo banner", () => {
  it("renders nothing while demo mode is off", async () => {
    renderWithActor(<DemoBanner />, {
      getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
        grant: grant(Role.admin),
      })),
      getDemoState: vi.fn<backendInterface["getDemoState"]>(async () =>
        demoState(),
      ),
    } satisfies Pick<backendInterface, "getMyAccess" | "getDemoState">);

    await waitFor(() =>
      expect(screen.queryByTestId("demo.banner")).not.toBeInTheDocument(),
    );
  });

  it("shows the orange banner with the label and a Turn off button for an Admin", async () => {
    const setDemoMode = vi.fn<backendInterface["setDemoMode"]>(async () => ({
      __kind__: "ok" as const,
      ok: demoState(),
    }));
    renderWithActor(<DemoBanner />, {
      getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
        grant: grant(Role.admin),
      })),
      getDemoState: vi.fn<backendInterface["getDemoState"]>(async () =>
        demoState({ enabled: true }),
      ),
      setDemoMode,
    } satisfies Pick<
      backendInterface,
      "getMyAccess" | "getDemoState" | "setDemoMode"
    >);

    const banner = await screen.findByTestId("demo.banner");
    expect(banner).toHaveTextContent(t("demo.banner.label"));
    expect(banner).toHaveTextContent(
      "DEMO MODE · fake data · not for real hires",
    );

    const turnOff = screen.getByTestId("demo.turn_off_button");
    await userEvent.setup().click(turnOff);
    await waitFor(() => expect(setDemoMode).toHaveBeenCalledWith(false, ""));
  });

  it("hides the Turn off button when the chosen demo role is not Admin", async () => {
    // While demo mode is on the effective role is the chosen demo role, so a
    // non-admin demo role does not see the Admin-only Turn off control.
    renderWithActor(<DemoBanner />, {
      getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
        grant: grant(Role.storeManager),
      })),
      getDemoState: vi.fn<backendInterface["getDemoState"]>(async () =>
        demoState({ enabled: true, demoRole: DemoRole.kiosk }),
      ),
    } satisfies Pick<backendInterface, "getMyAccess" | "getDemoState">);

    expect(await screen.findByTestId("demo.banner")).toBeInTheDocument();
    expect(
      screen.queryByTestId("demo.turn_off_button"),
    ).not.toBeInTheDocument();
  });

  it("offers the View as picker with every demo role", async () => {
    const user = userEvent.setup();
    renderWithActor(<DemoBanner />, {
      getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
        grant: grant(Role.admin),
      })),
      getDemoState: vi.fn<backendInterface["getDemoState"]>(async () =>
        demoState({ enabled: true }),
      ),
      listPositions: vi.fn<backendInterface["listPositions"]>(async () => []),
    } satisfies Pick<
      backendInterface,
      "getMyAccess" | "getDemoState" | "listPositions"
    >);

    await user.click(await screen.findByTestId("demo.view_as.open_button"));
    await user.click(await screen.findByTestId("demo.view_as.select"));

    for (const label of [
      "Admin",
      "Store Manager",
      "Training Manager",
      "NSO Trainer",
      "Visiting Manager",
      "Leadership",
      "Kiosk",
    ]) {
      expect(
        await screen.findByRole("option", { name: label }),
      ).toBeInTheDocument();
    }
  });

  it("shows the pretend date in the banner once it is set", async () => {
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
    } satisfies Pick<
      backendInterface,
      "getMyAccess" | "getDemoState" | "listPositions"
    >);

    const banner = await screen.findByTestId("demo.banner");
    // The pretend date is shown in the banner, with its AM/PM shift.
    expect(banner).toHaveTextContent("PM");
  });
});

/** A minimal canvas 2D context so the signature pads can draw in jsdom. */
function stubCanvas() {
  const ctx = {
    scale: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    clearRect: vi.fn(),
    set lineWidth(_v: number) {},
    set lineCap(_v: string) {},
    set lineJoin(_v: string) {},
    set strokeStyle(_v: string) {},
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  );
  const toBlob = vi
    .spyOn(HTMLCanvasElement.prototype, "toBlob")
    .mockImplementation((callback: BlobCallback) => {
      const bytes = new TextEncoder().encode("signature-bytes");
      const blob = {
        type: "image/png",
        arrayBuffer: async () => bytes.buffer,
      } as unknown as Blob;
      callback(blob);
    });
  return { ctx, toBlob };
}

describe("Sign as Test on the signature pads", () => {
  it("shows the kiosk Sign as Test button only in demo mode and fills a signature", async () => {
    stubCanvas();
    const onSigned = vi.fn();
    const { unmount } = renderWithActor(
      <KioskSignatureStep
        hasSignature={false}
        onSigned={onSigned}
        onClear={vi.fn()}
      />,
      {
        getDemoState: vi.fn<backendInterface["getDemoState"]>(async () =>
          demoState({ enabled: true }),
        ),
      } satisfies Pick<backendInterface, "getDemoState">,
    );

    const button = await screen.findByTestId(
      "kiosk.signature.sign_as_test_button",
    );
    await userEvent.setup().click(button);
    await waitFor(() => expect(onSigned).toHaveBeenCalledTimes(1));
    expect(onSigned.mock.calls[0]?.[0]).toBeInstanceOf(File);
    unmount();
  });

  it("hides the kiosk Sign as Test button when demo mode is off", async () => {
    stubCanvas();
    renderWithActor(
      <KioskSignatureStep
        hasSignature={false}
        onSigned={vi.fn()}
        onClear={vi.fn()}
      />,
      {
        getDemoState: vi.fn<backendInterface["getDemoState"]>(async () =>
          demoState(),
        ),
      } satisfies Pick<backendInterface, "getDemoState">,
    );

    await waitFor(() =>
      expect(
        screen.queryByTestId("kiosk.signature.sign_as_test_button"),
      ).not.toBeInTheDocument(),
    );
  });

  it("shows the manager Sign as Test button only in demo mode and fills a signature", async () => {
    stubCanvas();
    const onChange = vi.fn();
    renderWithActor(<ManagerSignaturePad value={null} onChange={onChange} />, {
      getDemoState: vi.fn<backendInterface["getDemoState"]>(async () =>
        demoState({ enabled: true }),
      ),
    } satisfies Pick<backendInterface, "getDemoState">);

    const button = await screen.findByTestId(
      "approvals.signup.signature.sign_as_test_button",
    );
    await userEvent.setup().click(button);
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(onChange.mock.calls[0]?.[0]).toBeInstanceOf(Uint8Array);
  });
});
