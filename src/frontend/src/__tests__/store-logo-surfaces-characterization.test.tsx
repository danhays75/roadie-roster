import { renderPageWithActor } from "@/__tests__/router-test-utils";
import { renderWithActor } from "@/__tests__/test-utils";
import type { PhotoRef, Position, Roadie, backendInterface } from "@/backend";
import { House, RoadieStatus, Role, RosterState } from "@/backend";
import { ApprovalGate } from "@/components/ApprovalGate";
import { Layout } from "@/components/Layout";
import { StoreLogo } from "@/components/StoreLogo";
import { PositionRosterDialog } from "@/components/dashboard/PositionRosterDialog";
import { I18nContext, translate } from "@/hooks/useI18n";
import type { Locale } from "@/lib/copy";
import DashboardPage from "@/pages/Dashboard";
import KioskPage from "@/pages/Kiosk";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * Characterization of the store-logo surfaces that the accepted request
 * intentionally resizes. These tests deliberately do NOT assert the old size
 * classes; they protect the adjacent behavior that must survive the resize:
 * every affected screen still renders, the logo still appears (uploaded image
 * or built-in star), and the public `getStoreLogo` read seam still works.
 */

const t = (key: string, vars?: Record<string, string | number>) =>
  translate("en" as Locale, key, vars);

function wrap(ui: React.ReactElement) {
  return (
    <I18nContext.Provider value={{ locale: "en", setLocale: vi.fn(), t }}>
      {ui}
    </I18nContext.Provider>
  );
}

/** A minimal PNG signature followed by filler bytes. */
function pngBytes(): Uint8Array {
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02,
  ]);
}

/** An actor exposing only the public logo read. */
function logoActor(logo: PhotoRef | null) {
  return {
    getStoreLogo: vi.fn<backendInterface["getStoreLogo"]>(async () => ({
      logo: logo ?? undefined,
    })),
  };
}

const STORE = {
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
  paperworkDueDate: 1_800_000_000_000_000_000n,
};

describe("StoreLogo renders on every affected surface", () => {
  it("renders the built-in star in the header when no logo is set", async () => {
    function Page() {
      return (
        <Layout>
          <p>content</p>
        </Layout>
      );
    }
    renderPageWithActor(
      Page,
      {
        getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
          grant: {
            principal: { toText: () => "aaaaa-aa" } as never,
            role: Role.admin,
            approvedAt: 0n,
            approvedBy: { toText: () => "aaaaa-aa" } as never,
            trainerPositionIds: [],
          },
        })),
        listPendingUsers: vi.fn<backendInterface["listPendingUsers"]>(
          async () => [],
        ),
        listPendingSignups: vi.fn<backendInterface["listPendingSignups"]>(
          async () => [],
        ),
      },
      { path: "/" },
    );

    // The header renders and carries exactly one store mark.
    await screen.findByTestId("header.home_link");
    const logo = screen.getByTestId("store.logo");
    expect(logo.tagName.toLowerCase()).toBe("svg");
    expect(logo).toHaveAttribute("role", "img");
  });

  it("renders the uploaded logo on the kiosk welcome screen", async () => {
    renderPageWithActor(KioskPage, logoActor(pngBytes()), { path: "/kiosk" });

    await screen.findByTestId("kiosk.welcome");
    const logo = await screen.findByAltText("Roadie store logo logo");
    expect(logo.tagName.toLowerCase()).toBe("img");
    expect(logo.getAttribute("src")).toMatch(/^data:image\/png;base64,/);
  });

  it("renders the uploaded logo on the sign-in/waiting screen", async () => {
    renderWithActor(wrap(<ApprovalGate />), {
      getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
        grant: undefined,
      })),
      requestAccess: vi.fn<backendInterface["requestAccess"]>(
        async () => false,
      ),
      bootstrapAdmin: vi.fn<backendInterface["bootstrapAdmin"]>(
        async () => true,
      ),
      getStoreLogo: vi.fn<backendInterface["getStoreLogo"]>(async () => ({
        logo: pngBytes(),
      })),
    } satisfies Pick<
      backendInterface,
      "getMyAccess" | "requestAccess" | "bootstrapAdmin" | "getStoreLogo"
    >);

    await screen.findByTestId("gate.pending_state");
    const logo = await screen.findByAltText("Roadie store logo logo");
    expect(logo.tagName.toLowerCase()).toBe("img");
  });

  it("renders the dashboard banner and its roster dialog without errors", async () => {
    const POSITION: Position = {
      id: 10n,
      name: "Cashier",
      code: "CSH",
      house: House.foh,
      openingBuildTo: 2n,
      afterOpeningBuildTo: 1n,
      minimumAge: 16n,
      shirtsRequired: 2n,
      hatsRequired: 1n,
      needsAlcoholCert: false,
      shirtType: "Polo",
      shirtQty: 2n,
      hatType: "Cap",
      hatQty: 1n,
    };
    const ROADIE: Roadie = {
      id: 1n,
      status: RoadieStatus.hired,
      mainPositionId: 10n,
      hiredAt: 0n,
      profile: { name: "Ada Lovelace" },
      isMinor: false,
      isDemo: false,
      rosterState: RosterState.pending,
    };

    renderPageWithActor(
      DashboardPage,
      {
        getDashboard: vi.fn<backendInterface["getDashboard"]>(async () => ({
          foh: [POSITION],
          boh: [],
          active: 0n,
          hired: 1n,
          pending: 1n,
          stillNeeded: 1n,
          buildToTotal: 2n,
        })),
        listSchedule: vi.fn<backendInterface["listSchedule"]>(async () => []),
        getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(
          async () => STORE,
        ),
        getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
          grant: undefined,
        })),
        listRosterForPosition: vi.fn<backendInterface["listRosterForPosition"]>(
          async () => [ROADIE],
        ),
        getStoreLogo: vi.fn<backendInterface["getStoreLogo"]>(async () => ({
          logo: pngBytes(),
        })),
      },
      { path: "/dashboard" },
    );

    // The dashboard shell renders with its position row.
    expect(await screen.findByTestId("dashboard.page")).toBeInTheDocument();
    expect(await screen.findByText("Cashier")).toBeInTheDocument();
  });

  it("renders the roster dialog's Present-mode banner with a store mark", async () => {
    const POSITION: Position = {
      id: 10n,
      name: "Cashier",
      code: "CSH",
      house: House.foh,
      openingBuildTo: 2n,
      afterOpeningBuildTo: 1n,
      minimumAge: 16n,
      shirtsRequired: 2n,
      hatsRequired: 1n,
      needsAlcoholCert: false,
      shirtType: "Polo",
      shirtQty: 2n,
      hatType: "Cap",
      hatQty: 1n,
    };
    const ROADIE: Roadie = {
      id: 1n,
      status: RoadieStatus.hired,
      mainPositionId: 10n,
      hiredAt: 0n,
      profile: { name: "Ada Lovelace" },
      isMinor: false,
      isDemo: false,
      rosterState: RosterState.pending,
    };

    renderWithActor(
      <PositionRosterDialog
        position={POSITION}
        open
        onOpenChange={vi.fn()}
        canRehire={false}
      />,
      {
        listRosterForPosition: vi.fn<backendInterface["listRosterForPosition"]>(
          async () => [ROADIE],
        ),
        getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(
          async () => STORE,
        ),
        getStoreLogo: vi.fn<backendInterface["getStoreLogo"]>(async () => ({
          logo: pngBytes(),
        })),
      },
    );

    // The dialog renders its roster card and the store mark inside it.
    expect(
      await screen.findByTestId("dashboard.roster.dialog"),
    ).toBeInTheDocument();
    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByTestId("store.logo")).toBeInTheDocument();
  });
});

describe("StoreLogo read seam", () => {
  it("falls back to the built-in star when the actor lacks getStoreLogo", async () => {
    renderWithActor(<StoreLogo />, {});

    const logo = await screen.findByTestId("store.logo");
    expect(logo.tagName.toLowerCase()).toBe("svg");
    expect(logo.querySelector("circle")).not.toBeNull();
  });

  it("renders the uploaded bytes as an object-contain image", async () => {
    renderWithActor(<StoreLogo />, logoActor(pngBytes()));

    const logo = await screen.findByAltText("Roadie store logo logo");
    expect(logo.tagName.toLowerCase()).toBe("img");
    expect(logo).toHaveClass("object-contain");
  });
});
