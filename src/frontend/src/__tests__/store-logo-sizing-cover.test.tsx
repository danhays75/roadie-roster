import { renderPageWithActor } from "@/__tests__/router-test-utils";
import { renderWithActor } from "@/__tests__/test-utils";
import type {
  Crew,
  PhotoRef,
  Position,
  Roadie,
  backendInterface,
} from "@/backend";
import { House, RoadieStatus, Role } from "@/backend";
import { ApprovalGate } from "@/components/ApprovalGate";
import { Layout } from "@/components/Layout";
import { StoreLogo } from "@/components/StoreLogo";
import { FlipCard } from "@/components/roadie/FlipCard";
import { I18nContext, translate } from "@/hooks/useI18n";
import type { Locale } from "@/lib/copy";
import DashboardPage from "@/pages/Dashboard";
import KioskPage from "@/pages/Kiosk";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * Cover for the accepted store-logo sizing and placement change. These tests
 * assert the observable size/placement contract on each affected surface: the
 * uploaded logo is sized by height with automatic width (never a small square),
 * and each surface uses the accepted height. The adjacent behavior that must
 * survive the resize (the logo still renders, the star fallback stays square)
 * is protected by the characterization suite.
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
};

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
};

const ROADIE: Roadie = {
  id: 1n,
  status: RoadieStatus.hired,
  mainPositionId: 10n,
  hiredAt: 0n,
  profile: { name: "Ada Lovelace" },
  isMinor: false,
  isDemo: false,
};

const CREW: Crew = { id: 1n, name: "Opening Crew", isDemo: false };

describe("StoreLogo sizes an uploaded logo by height with automatic width", () => {
  it("keeps the caller's height, drops a square width, and stays object-contain", async () => {
    renderWithActor(<StoreLogo className="h-24 w-24" />, logoActor(pngBytes()));

    const logo = await screen.findByAltText("Roadie store logo logo");
    expect(logo.tagName.toLowerCase()).toBe("img");
    // Height is honored; the square width is replaced by an automatic width.
    expect(logo).toHaveClass("h-24");
    expect(logo).toHaveClass("w-auto");
    expect(logo).not.toHaveClass("w-24");
    expect(logo).toHaveClass("object-contain");
  });

  it("keeps the built-in star fallback square", async () => {
    renderWithActor(<StoreLogo className="h-24 w-24" />, {});

    const logo = await screen.findByTestId("store.logo");
    expect(logo.tagName.toLowerCase()).toBe("svg");
    expect(logo).toHaveClass("h-24");
    expect(logo).toHaveClass("w-24");
  });
});

describe("Header logo sizing and store name", () => {
  it("renders the logo 56px on phones and 72px on tablet/desktop beside the name", async () => {
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

    const home = await screen.findByTestId("header.home_link");
    const logo = screen.getByTestId("store.logo");
    expect(logo).toHaveClass("h-14");
    expect(logo).toHaveClass("md:h-[72px]");
    // The store name sits beside the logo inside the same home link.
    expect(home).toContainElement(logo);
    expect(home).toHaveTextContent(t("app.name"));
  });
});

describe("Kiosk welcome logo sizing", () => {
  it("renders a large centered logo above the welcome text", async () => {
    renderPageWithActor(KioskPage, logoActor(pngBytes()), { path: "/kiosk" });

    const welcome = await screen.findByTestId("kiosk.welcome");
    const logo = await screen.findByAltText("Roadie store logo logo");
    expect(logo).toHaveClass("h-40");
    expect(logo).toHaveClass("md:h-[200px]");
    expect(logo).toHaveClass("w-auto");
    // The logo precedes the welcome heading in document order.
    const heading = screen.getByRole("heading", { level: 1 });
    expect(
      logo.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(welcome).toContainElement(logo);
  });
});

describe("Sign-in/waiting screen logo sizing", () => {
  it("renders a centered logo about 128px tall", async () => {
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
    expect(logo).toHaveClass("h-32");
  });
});

describe("Dashboard hero banner", () => {
  it("shows a navy hero with the stripe accent, a 96px/120px secondary logo, name and opening date", async () => {
    renderPageWithActor(
      DashboardPage,
      {
        getDashboard: vi.fn<backendInterface["getDashboard"]>(async () => ({
          foh: [POSITION],
          boh: [],
          hired: 1n,
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
          secondaryLogo: pngBytes(),
        })),
      },
      { path: "/dashboard" },
    );

    const hero = await screen.findByTestId("dashboard.hero");
    expect(hero).toHaveClass("bg-secondary");
    expect(hero.querySelector(".stripe-flag")).not.toBeNull();

    // The banner shows the secondary logo, 96px on phones and 120px from the
    // small breakpoint up, and no longer shows the main logo.
    const logo = await screen.findByTestId("store.logo.secondary");
    expect(logo).toHaveClass("h-24", "sm:h-[120px]");
    expect(hero).toContainElement(logo);
    expect(screen.queryByTestId("store.logo")).not.toBeInTheDocument();

    // The store name and opening date sit beside the logo in the hero.
    expect(hero).toHaveTextContent("Lake Charles");
    expect(hero).toHaveTextContent("Opening");
  });
});

describe("Present-mode banner logo sizing", () => {
  it("renders the uploaded logo about 120px tall at the top of the card", async () => {
    renderWithActor(
      wrap(
        <FlipCard
          roadie={ROADIE}
          position={POSITION}
          secondPosition={undefined}
          crossTrainedPosition={undefined}
          crew={CREW}
        />,
      ),
      logoActor(pngBytes()),
    );

    const card = await screen.findByTestId("roadie.flip_card");
    const logo = await screen.findByAltText(`${t("roadie.openingTeam")} logo`);
    expect(logo).toHaveClass("h-[120px]");
    expect(logo).toHaveClass("w-auto");
    expect(card).toContainElement(logo);
  });
});
