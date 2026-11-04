import { renderPageWithActor } from "@/__tests__/router-test-utils";
import { renderWithActor } from "@/__tests__/test-utils";
import type { PhotoRef, Position, Roadie, backendInterface } from "@/backend";
import { House, RoadieStatus, Role, RosterState } from "@/backend";
import { ApprovalGate } from "@/components/ApprovalGate";
import { Layout } from "@/components/Layout";
import { StoreLogo } from "@/components/StoreLogo";
import { I18nContext, translate } from "@/hooks/useI18n";
import type { Locale } from "@/lib/copy";
import DashboardPage from "@/pages/Dashboard";
import KioskPage from "@/pages/Kiosk";
import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * Characterization of the main-logo surfaces the accepted request leaves
 * unchanged: the header keeps the main logo, the kiosk and sign-in screens keep
 * the main logo, and the public `getStoreLogo` read still returns the main
 * logo. These tests deliberately do NOT assert the secondary-logo placement or
 * the dashboard banner's logo, which the request intentionally changes.
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

/** An actor exposing only the public logo read, returning the main logo. */
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
  openingDate: 1_802_066_400_000_000n,
  amShiftStart: 600n,
  amShiftEnd: 900n,
  pmShiftStart: 960n,
  pmShiftEnd: 1320n,
  trainingGroupSize: 5n,
  leaderTalkName: "10 Minutes with Dan",
  leaderTalkSize: 10n,
  paperworkDueDate: 1_800_000_000_000_000_000n,
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
  defaultShirts: 3n,
  defaultHats: 2n,
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

/** The actor methods the header reads. */
function headerActor() {
  return {
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
  };
}

describe("header keeps the main logo", () => {
  it("renders the uploaded main logo beside the store name and tagline", async () => {
    function Page() {
      return (
        <Layout>
          <p>content</p>
        </Layout>
      );
    }
    renderPageWithActor(
      Page,
      { ...headerActor(), ...logoActor(pngBytes()) },
      { path: "/" },
    );

    const home = await screen.findByTestId("header.home_link");
    const logo = await screen.findByAltText("Roadie store logo logo");
    expect(logo.tagName.toLowerCase()).toBe("img");
    expect(logo.getAttribute("src")).toMatch(/^data:image\/png;base64,/);
    // The main logo and the store name/tagline stay inside the home link.
    expect(home).toContainElement(logo);
    expect(home).toHaveTextContent(t("app.name"));
    expect(home).toHaveTextContent(t("app.tagline"));
  });

  it("falls back to the built-in star in the header when no logo is set", async () => {
    function Page() {
      return (
        <Layout>
          <p>content</p>
        </Layout>
      );
    }
    renderPageWithActor(Page, headerActor(), { path: "/" });

    await screen.findByTestId("header.home_link");
    const logo = screen.getByTestId("store.logo");
    expect(logo.tagName.toLowerCase()).toBe("svg");
    expect(logo).toHaveAttribute("role", "img");
  });
});

describe("kiosk keeps the main logo", () => {
  it("renders the uploaded main logo on the kiosk welcome screen", async () => {
    renderPageWithActor(KioskPage, logoActor(pngBytes()), { path: "/kiosk" });

    await screen.findByTestId("kiosk.welcome");
    const logo = await screen.findByAltText("Roadie store logo logo");
    expect(logo.tagName.toLowerCase()).toBe("img");
    expect(logo.getAttribute("src")).toMatch(/^data:image\/png;base64,/);
  });

  it("falls back to the built-in star on the kiosk when no logo is set", async () => {
    renderPageWithActor(KioskPage, logoActor(null), { path: "/kiosk" });

    await screen.findByTestId("kiosk.welcome");
    const logo = await screen.findByTestId("store.logo");
    expect(logo.tagName.toLowerCase()).toBe("svg");
  });
});

describe("sign-in/waiting screen keeps the main logo", () => {
  it("renders the uploaded main logo for a caller awaiting approval", async () => {
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
});

describe("public getStoreLogo read still returns the main logo", () => {
  it("renders the main logo from the public query", async () => {
    renderWithActor(<StoreLogo />, logoActor(pngBytes()));

    const logo = await screen.findByAltText("Roadie store logo logo");
    expect(logo.tagName.toLowerCase()).toBe("img");
    expect(logo.getAttribute("src")).toMatch(/^data:image\/png;base64,/);
  });

  it("falls back to the built-in star when the actor lacks getStoreLogo", async () => {
    renderWithActor(<StoreLogo />, {});

    const logo = await screen.findByTestId("store.logo");
    expect(logo.tagName.toLowerCase()).toBe("svg");
    expect(logo.querySelector("circle")).not.toBeNull();
  });
});

describe("dashboard banner keeps the store name and opening date", () => {
  it("renders the navy hero with the store name and opening date", async () => {
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

    const hero = await screen.findByTestId("dashboard.hero");
    expect(hero).toHaveClass("bg-secondary");
    expect(hero.querySelector(".stripe-flag")).not.toBeNull();
    await waitFor(() => expect(hero).toHaveTextContent("Lake Charles"));
    expect(hero).toHaveTextContent("Opening");
  });
});
