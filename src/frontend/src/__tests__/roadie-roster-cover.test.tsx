import { renderPageWithActor } from "@/__tests__/router-test-utils";
import { renderWithActor } from "@/__tests__/test-utils";
import type {
  PhotoRef,
  Position,
  Roadie,
  StoreInfo,
  backendInterface,
} from "@/backend";
import { House, RoadieStatus, Role, RosterState } from "@/backend";
import { Layout } from "@/components/Layout";
import { StoreLogo } from "@/components/StoreLogo";
import { StoreInfoPanel } from "@/components/admin/StoreInfoPanel";
import { translate } from "@/hooks/useI18n";
import type { Locale } from "@/lib/copy";
import AdminPage from "@/pages/Admin";
import DashboardPage from "@/pages/Dashboard";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Cover for the accepted "Roadie Roster" change. These tests assert the
 * observable behavior the request intentionally adds or changes:
 *   - the header title text is "Roadie Roster",
 *   - the secondary logo replaces the star badge in the header and dashboard
 *     banner, at the main logo's height, and shows nothing when absent,
 *   - Admin > Store info has a Secondary logo upload with preview and Remove,
 *   - the public getStoreLogo query returns both logos,
 *   - both logos refresh after Save without a page reload.
 * The adjacent behavior that must survive (store name/location subtitle, the
 * main logo, the main-logo upload) is protected by the characterization suite.
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

const t = (key: string, vars?: Record<string, string | number>) =>
  translate("en" as Locale, key, vars);

/** An actor exposing only the public logo read, returning both logos. */
function logoActor(logos: {
  logo?: PhotoRef | null;
  secondaryLogo?: PhotoRef | null;
}) {
  return {
    getStoreLogo: vi.fn<backendInterface["getStoreLogo"]>(async () => ({
      logo: logos.logo ?? undefined,
      secondaryLogo: logos.secondaryLogo ?? undefined,
    })),
  };
}

/** The actor methods the admin store panel reads and writes. */
function storeActor(initial: {
  logo?: PhotoRef | null;
  secondaryLogo?: PhotoRef | null;
}) {
  // A stateful fake: a real canister returns the saved logos on the next read.
  let storedLogo = initial.logo ?? null;
  let storedSecondary = initial.secondaryLogo ?? null;
  return {
    getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(async () => ({
      ...STORE,
      logo: storedLogo ?? undefined,
      secondaryLogo: storedSecondary ?? undefined,
    })),
    updateStoreInfo: vi.fn<backendInterface["updateStoreInfo"]>(
      async (info) => {
        storedLogo = info.logo ?? null;
        storedSecondary = info.secondaryLogo ?? null;
      },
    ),
    getStoreLogo: vi.fn<backendInterface["getStoreLogo"]>(async () => ({
      logo: storedLogo ?? undefined,
      secondaryLogo: storedSecondary ?? undefined,
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
  defaultShirts: 2n,
  defaultHats: 1n,
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

/** The actor methods the dashboard reads. */
function dashboardActor(logos: {
  logo?: PhotoRef | null;
  secondaryLogo?: PhotoRef | null;
}) {
  return {
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
    getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(async () => STORE),
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: undefined,
    })),
    listRosterForPosition: vi.fn<backendInterface["listRosterForPosition"]>(
      async () => [ROADIE],
    ),
    getStoreLogo: vi.fn<backendInterface["getStoreLogo"]>(async () => ({
      logo: logos.logo ?? undefined,
      secondaryLogo: logos.secondaryLogo ?? undefined,
    })),
  };
}

describe("header title text", () => {
  it("renders the store name as the header title", async () => {
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
    expect(home).toHaveTextContent("Roadie Roster");
    // The store name and location subtitle are unchanged by the title change.
    expect(home).toHaveTextContent(t("app.name"));
    expect(home).toHaveTextContent(t("app.tagline"));
  });
});

describe("header shows only the main logo", () => {
  it("renders the main logo and no secondary logo even when one is uploaded", async () => {
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
          secondaryLogo: pngBytes(),
        })),
      },
      { path: "/" },
    );

    const home = await screen.findByTestId("header.home_link");
    const main = await screen.findByAltText("Roadie store logo logo");
    expect(main.tagName.toLowerCase()).toBe("img");
    expect(home).toContainElement(main);
    // The secondary logo is no longer rendered in the header.
    expect(
      screen.queryByTestId("store.logo.secondary"),
    ).not.toBeInTheDocument();
  });

  it("still renders the main logo when no secondary logo is set", async () => {
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
          secondaryLogo: undefined,
        })),
      },
      { path: "/" },
    );

    await screen.findByTestId("header.home_link");
    const main = await screen.findByAltText("Roadie store logo logo");
    expect(main.tagName.toLowerCase()).toBe("img");
    expect(
      screen.queryByTestId("store.logo.secondary"),
    ).not.toBeInTheDocument();
  });
});

describe("secondary logo in the dashboard banner", () => {
  it("renders the secondary logo once, on the left of the store name, at 96px/120px", async () => {
    renderPageWithActor(
      DashboardPage,
      dashboardActor({ logo: pngBytes(), secondaryLogo: pngBytes() }),
      { path: "/dashboard" },
    );

    const hero = await screen.findByTestId("dashboard.hero");
    await waitFor(() => expect(hero).toHaveTextContent("Lake Charles"));
    const secondary = await screen.findByTestId("store.logo.secondary");
    expect(secondary.tagName.toLowerCase()).toBe("img");
    // 96px on phones, 120px from the small breakpoint up.
    expect(secondary).toHaveClass("h-24", "sm:h-[120px]");
    expect(hero).toContainElement(secondary);
    // The secondary logo appears exactly once in the banner.
    expect(screen.getAllByTestId("store.logo.secondary")).toHaveLength(1);
    // The main logo is no longer rendered in the banner.
    expect(screen.queryByTestId("store.logo")).not.toBeInTheDocument();
    // The logo precedes the store name in document order (left of it).
    const name = hero.querySelector("h2");
    expect(name).not.toBeNull();
    expect(
      secondary.compareDocumentPosition(name as Node) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("shows no logo at all when no secondary logo is set", async () => {
    renderPageWithActor(
      DashboardPage,
      dashboardActor({ logo: pngBytes(), secondaryLogo: undefined }),
      { path: "/dashboard" },
    );

    const hero = await screen.findByTestId("dashboard.hero");
    await waitFor(() => expect(hero).toHaveTextContent("Lake Charles"));
    // Neither the secondary logo nor the main logo/star fallback renders.
    expect(
      screen.queryByTestId("store.logo.secondary"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("store.logo")).not.toBeInTheDocument();
    // The store name and opening date still render.
    expect(hero).toHaveTextContent("Lake Charles");
    expect(hero).toHaveTextContent("Opening");
  });
});

describe("public getStoreLogo returns both logos", () => {
  it("renders the main logo and the secondary logo from one query", async () => {
    renderWithActor(
      <>
        <StoreLogo />
        <StoreLogo variant="secondary" />
      </>,
      logoActor({ logo: pngBytes(), secondaryLogo: pngBytes() }),
    );

    // The main logo starts as the built-in star and is replaced by the
    // uploaded image once the async read resolves.
    const main = await screen.findByAltText("Roadie store logo logo");
    const secondary = await screen.findByTestId("store.logo.secondary");
    expect(main.tagName.toLowerCase()).toBe("img");
    expect(secondary.tagName.toLowerCase()).toBe("img");
    expect(main.getAttribute("src")).toMatch(/^data:image\/png;base64,/);
    expect(secondary.getAttribute("src")).toMatch(/^data:image\/png;base64,/);
  });

  it("renders nothing for the secondary variant when only the main logo is set", async () => {
    renderWithActor(
      <StoreLogo variant="secondary" />,
      logoActor({ logo: pngBytes(), secondaryLogo: null }),
    );

    // The secondary variant never falls back to the star.
    await waitFor(() =>
      expect(
        screen.queryByTestId("store.logo.secondary"),
      ).not.toBeInTheDocument(),
    );
  });
});

describe("admin secondary-logo upload", () => {
  it("previews an uploaded secondary logo and offers a remove control", async () => {
    const user = userEvent.setup();
    renderPageWithActor(AdminPage, storeActor({}), { path: "/admin" });

    await screen.findByTestId("admin.store.app_name.input");
    expect(
      screen.queryByTestId("admin.store.secondary_logo.remove_button"),
    ).not.toBeInTheDocument();

    await user.upload(
      screen.getByTestId("admin.store.secondary_logo.input"),
      new File(["logo-bytes"], "secondary.png", { type: "image/png" }),
    );

    const preview = await screen.findByAltText("Secondary logo");
    expect(preview.getAttribute("src")).toMatch(/^data:image\//);
    expect(
      screen.getByTestId("admin.store.secondary_logo.remove_button"),
    ).toBeInTheDocument();
  });

  it("removes the secondary logo preview when Remove is clicked", async () => {
    const user = userEvent.setup();
    renderPageWithActor(AdminPage, storeActor({ secondaryLogo: pngBytes() }), {
      path: "/admin",
    });

    await screen.findByTestId("admin.store.app_name.input");
    await screen.findByAltText("Secondary logo");
    await user.click(
      screen.getByTestId("admin.store.secondary_logo.remove_button"),
    );

    await waitFor(() =>
      expect(screen.queryByAltText("Secondary logo")).not.toBeInTheDocument(),
    );
  });

  it("saves the secondary logo bytes in the updateStoreInfo payload", async () => {
    const user = userEvent.setup();
    const actor = storeActor({});
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    await screen.findByTestId("admin.store.app_name.input");
    await user.upload(
      screen.getByTestId("admin.store.secondary_logo.input"),
      new File(["logo-bytes"], "secondary.png", { type: "image/png" }),
    );
    await screen.findByAltText("Secondary logo");
    await user.click(screen.getByTestId("admin.store.save_button"));

    await waitFor(() => expect(actor.updateStoreInfo).toHaveBeenCalledTimes(1));
    const payload = actor.updateStoreInfo.mock.calls[0][0];
    expect(payload.secondaryLogo).toBeInstanceOf(Uint8Array);
    expect(payload.secondaryLogo?.length).toBeGreaterThan(0);
    // The store name and location are preserved in the saved payload.
    expect(payload.appName).toBe("Roadie Roster");
    expect(payload.locationName).toBe("Lake Charles");
  });
});

describe("both logos refresh after Save without a reload", () => {
  it("shows the newly saved secondary logo on the banner surface after a save", async () => {
    const user = userEvent.setup();
    const actor = storeActor({ logo: pngBytes() });
    // The banner logo and the admin panel share one QueryClient, as they do in
    // the running app, so the save's invalidation reaches the mounted logo.
    renderWithActor(
      <>
        <StoreLogo />
        <StoreLogo variant="secondary" />
        <StoreInfoPanel />
      </>,
      actor,
    );

    // The banner starts with no secondary logo.
    await screen.findByTestId("admin.store.app_name.input");
    expect(
      screen.queryByTestId("store.logo.secondary"),
    ).not.toBeInTheDocument();

    await user.upload(
      screen.getByTestId("admin.store.secondary_logo.input"),
      new File(["logo-bytes"], "secondary.png", { type: "image/png" }),
    );
    await screen.findByAltText("Secondary logo");
    await user.click(screen.getByTestId("admin.store.save_button"));

    // After the save the secondary logo refetches and renders the uploaded
    // image without a page reload.
    const bannerSecondary = await screen.findByTestId("store.logo.secondary");
    expect(bannerSecondary.tagName.toLowerCase()).toBe("img");
  });
});
