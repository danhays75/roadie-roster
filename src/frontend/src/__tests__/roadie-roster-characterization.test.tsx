import { renderPageWithActor, t } from "@/__tests__/router-test-utils";
import { renderWithActor } from "@/__tests__/test-utils";
import type {
  PhotoRef,
  Position,
  Roadie,
  StoreInfo,
  backendInterface,
} from "@/backend";
import { House, RoadieStatus, Role, RosterState } from "@/backend";
import { ApprovalGate } from "@/components/ApprovalGate";
import { Layout } from "@/components/Layout";
import { StoreLogo } from "@/components/StoreLogo";
import { StoreInfoPanel } from "@/components/admin/StoreInfoPanel";
import { I18nContext, translate } from "@/hooks/useI18n";
import type { Locale } from "@/lib/copy";
import AdminPage from "@/pages/Admin";
import DashboardPage from "@/pages/Dashboard";
import KioskPage from "@/pages/Kiosk";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Characterization of the behavior the "Roadie Roster" request intentionally
 * leaves alone. The request changes the header title text, the tab/manifest
 * titles, the star badge (replaced by a secondary logo) and the public logo
 * query. These tests deliberately do NOT assert the old title text or the star
 * badge; they protect the adjacent behavior that must survive:
 *   - the store name and location stay as the subtitle,
 *   - the main logo still renders exactly as before on every surface,
 *   - the admin main-logo upload with preview and Remove still works,
 *   - the public getStoreLogo read still returns the main logo.
 */

// jsdom does not implement object URLs; the logo upload path reads the file
// through one, so provide a minimal test-only polyfill.
beforeAll(() => {
  if (typeof URL.createObjectURL !== "function") {
    URL.createObjectURL = vi.fn(() => "blob:test-logo");
  }
  if (typeof URL.revokeObjectURL !== "function") {
    URL.revokeObjectURL = vi.fn();
  }
  if (typeof Blob.prototype.arrayBuffer !== "function") {
    Blob.prototype.arrayBuffer = function arrayBuffer(this: Blob) {
      return Promise.resolve(new TextEncoder().encode("logo-bytes").buffer);
    };
  }
});

/** The seeded store identity a fresh install carries, with no logo set. */
const STORE: StoreInfo = {
  storeNumber: "975",
  appName: "Roadie Roster",
  locationName: "Lake Charles",
  address: "1400 W Prien Lake Rd, Lake Charles, LA 70601",
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

/** A minimal PNG signature followed by filler bytes. */
function pngBytes(): Uint8Array {
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02,
  ]);
}

const tEn = (key: string, vars?: Record<string, string | number>) =>
  translate("en" as Locale, key, vars);

function wrap(ui: React.ReactElement) {
  return (
    <I18nContext.Provider value={{ locale: "en", setLocale: vi.fn(), t: tEn }}>
      {ui}
    </I18nContext.Provider>
  );
}

/** An actor exposing only the public logo read. */
function logoActor(logo: PhotoRef | null) {
  return {
    getStoreLogo: vi.fn<backendInterface["getStoreLogo"]>(async () => ({
      logo: logo ?? undefined,
    })),
  };
}

/** The actor methods the admin store panel reads and writes. */
function storeActor(initialLogo: PhotoRef | null) {
  let storedLogo = initialLogo;
  return {
    getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(async () => ({
      ...STORE,
      logo: storedLogo ?? undefined,
    })),
    updateStoreInfo: vi.fn<backendInterface["updateStoreInfo"]>(
      async (info) => {
        storedLogo = info.logo ?? null;
      },
    ),
    getStoreLogo: vi.fn<backendInterface["getStoreLogo"]>(async () => ({
      logo: storedLogo ?? undefined,
    })),
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
  };
}

describe("header keeps the store name and location as the subtitle", () => {
  it("renders the store name and location subtitle beside the logo", async () => {
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
    // The store name and location subtitle are unchanged by the title change.
    expect(home).toHaveTextContent(tEn("app.name"));
    expect(home).toHaveTextContent(tEn("app.tagline"));
    // The main logo still sits inside the home link beside the name.
    expect(home).toContainElement(screen.getByTestId("store.logo"));
  });
});

describe("main logo still renders on every surface", () => {
  it("renders the uploaded main logo in the header", async () => {
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
        getStoreLogo: vi.fn<backendInterface["getStoreLogo"]>(async () => ({
          logo: pngBytes(),
        })),
      },
      { path: "/" },
    );

    await screen.findByTestId("header.home_link");
    const logo = await screen.findByAltText("Roadie store logo logo");
    expect(logo.tagName.toLowerCase()).toBe("img");
    expect(logo).toHaveClass("h-14", "md:h-[72px]");
  });

  it("renders the uploaded main logo on the kiosk welcome screen", async () => {
    renderPageWithActor(KioskPage, logoActor(pngBytes()), { path: "/kiosk" });

    await screen.findByTestId("kiosk.welcome");
    const logo = await screen.findByAltText("Roadie store logo logo");
    expect(logo.tagName.toLowerCase()).toBe("img");
    expect(logo.getAttribute("src")).toMatch(/^data:image\/png;base64,/);
  });

  it("renders the uploaded main logo on the sign-in/waiting screen", async () => {
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

  it("renders the dashboard banner with the store name and no main logo", async () => {
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

    renderPageWithActor(
      DashboardPage,
      {
        getDashboard: vi.fn<backendInterface["getDashboard"]>(async () => ({
          foh: [POSITION],
          boh: [],
          hired: 1n,
          stillNeeded: 1n,
          buildToTotal: 2n,
          active: 1n,
          pending: 0n,
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
    // The store name and location still render in the banner once loaded.
    await waitFor(() => expect(hero).toHaveTextContent("Lake Charles"));
    // The banner no longer renders the main logo; with no secondary logo set
    // it shows just the name and date.
    expect(screen.queryByTestId("store.logo")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("store.logo.secondary"),
    ).not.toBeInTheDocument();
  });
});

describe("admin main-logo upload still works", () => {
  it("previews an uploaded main logo and offers a remove control", async () => {
    const user = userEvent.setup();
    renderPageWithActor(AdminPage, storeActor(null), { path: "/admin" });

    await screen.findByTestId("admin.store.app_name.input");
    expect(
      screen.queryByTestId("admin.store.logo.remove_button"),
    ).not.toBeInTheDocument();

    await user.upload(
      screen.getByTestId("admin.store.logo.input"),
      new File(["logo-bytes"], "logo.png", { type: "image/png" }),
    );

    const preview = await screen.findByAltText("Store logo");
    expect(preview.getAttribute("src")).toMatch(/^data:image\//);
    expect(
      screen.getByTestId("admin.store.logo.remove_button"),
    ).toBeInTheDocument();
  });

  it("saves the main logo bytes in the updateStoreInfo payload", async () => {
    const user = userEvent.setup();
    const actor = storeActor(null);
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    await screen.findByTestId("admin.store.app_name.input");
    await user.upload(
      screen.getByTestId("admin.store.logo.input"),
      new File(["logo-bytes"], "logo.png", { type: "image/png" }),
    );
    await screen.findByAltText("Store logo");
    await user.click(screen.getByTestId("admin.store.save_button"));

    await waitFor(() => expect(actor.updateStoreInfo).toHaveBeenCalledTimes(1));
    const payload = actor.updateStoreInfo.mock.calls[0][0];
    expect(payload.logo).toBeInstanceOf(Uint8Array);
    expect(payload.logo?.length).toBeGreaterThan(0);
    // The store name and location are preserved in the saved payload.
    expect(payload.appName).toBe("Roadie Roster");
    expect(payload.locationName).toBe("Lake Charles");
  });
});

describe("public getStoreLogo read still returns the main logo", () => {
  it("renders the main logo bytes as an object-contain image", async () => {
    renderWithActor(<StoreLogo />, logoActor(pngBytes()));

    const logo = await screen.findByAltText("Roadie store logo logo");
    expect(logo.tagName.toLowerCase()).toBe("img");
    expect(logo).toHaveClass("object-contain");
  });

  it("falls back to the built-in mark when the actor lacks getStoreLogo", async () => {
    renderWithActor(<StoreLogo />, {});

    const logo = await screen.findByTestId("store.logo");
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute("role", "img");
  });
});
