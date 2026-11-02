import { renderPageWithActor } from "@/__tests__/router-test-utils";
import { renderWithActor } from "@/__tests__/test-utils";
import type { PhotoRef, StoreInfo, backendInterface } from "@/backend";
import { ApprovalGate } from "@/components/ApprovalGate";
import { StoreLogo } from "@/components/StoreLogo";
import { StoreInfoPanel } from "@/components/admin/StoreInfoPanel";
import { I18nContext, translate } from "@/hooks/useI18n";
import type { Locale } from "@/lib/copy";
import AdminPage from "@/pages/Admin";
import KioskPage from "@/pages/Kiosk";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

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
};

/** A minimal PNG signature followed by filler bytes. */
function pngBytes(): Uint8Array {
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02,
  ]);
}

/** A minimal JPEG signature followed by filler bytes. */
function jpegBytes(): Uint8Array {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
}

/** A minimal WebP (RIFF....WEBP) header. */
function webpBytes(): Uint8Array {
  return new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    0x00,
  ]);
}

/**
 * An SVG document as UTF-8 bytes. Built as a plain `Uint8Array` so the bytes
 * belong to the jsdom realm: `TextEncoder` here can return a cross-realm
 * `Uint8Array` that fails the app's `instanceof Uint8Array` check.
 */
function svgBytes(): Uint8Array {
  const text =
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>';
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) {
    bytes[i] = text.charCodeAt(i);
  }
  return bytes;
}

const t = (key: string, vars?: Record<string, string | number>) =>
  translate("en" as Locale, key, vars);

function wrap(ui: React.ReactElement) {
  return (
    <I18nContext.Provider value={{ locale: "en", setLocale: vi.fn(), t }}>
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

describe("StoreLogo uploaded logo", () => {
  it("renders the uploaded logo as an object-contain image with alt naming the store", async () => {
    renderWithActor(<StoreLogo />, logoActor(pngBytes()));

    // The star renders first, then the async logo read replaces it.
    const logo = await screen.findByAltText("Roadie store logo logo");
    expect(logo.tagName.toLowerCase()).toBe("img");
    // An uploaded logo is sized by height with automatic width, so it is not
    // squashed into a small square: no fixed `w-*`, `w-auto` instead.
    expect(logo).toHaveClass("h-10", "shrink-0", "object-contain", "w-auto");
    expect(logo).not.toHaveClass("w-10");
    expect(logo.getAttribute("src")).toMatch(/^data:image\/png;base64,/);
  });

  it("keeps a caller's height override and drops its square width", async () => {
    renderWithActor(<StoreLogo className="h-20 w-20" />, logoActor(pngBytes()));

    const logo = await screen.findByAltText("Roadie store logo logo");
    // The caller's height wins; the square width is replaced by `w-auto` so the
    // uploaded logo keeps its own aspect ratio.
    expect(logo).toHaveClass("h-20", "object-contain", "w-auto");
    expect(logo).not.toHaveClass("w-20");
  });

  it("detects JPEG bytes as image/jpeg", async () => {
    renderWithActor(<StoreLogo />, logoActor(jpegBytes()));
    const logo = await screen.findByAltText("Roadie store logo logo");
    expect(logo.getAttribute("src")).toMatch(/^data:image\/jpeg;base64,/);
  });

  it("detects WebP bytes as image/webp", async () => {
    renderWithActor(<StoreLogo />, logoActor(webpBytes()));
    const logo = await screen.findByAltText("Roadie store logo logo");
    expect(logo.getAttribute("src")).toMatch(/^data:image\/webp;base64,/);
  });

  it("detects SVG bytes as image/svg+xml", async () => {
    renderWithActor(<StoreLogo />, logoActor(svgBytes()));
    const logo = await screen.findByAltText("Roadie store logo logo");
    expect(logo.getAttribute("src")).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it("falls back to the built-in star when no logo is set", async () => {
    renderWithActor(<StoreLogo />, logoActor(null));

    const logo = await screen.findByTestId("store.logo");
    expect(logo.tagName.toLowerCase()).toBe("svg");
    expect(logo).toHaveAttribute("role", "img");
    expect(logo).toHaveAttribute("aria-label", "Roadie store logo");
  });

  it("falls back to the built-in star when the actor lacks getStoreLogo", async () => {
    renderWithActor(<StoreLogo />, {});

    const logo = await screen.findByTestId("store.logo");
    expect(logo.tagName.toLowerCase()).toBe("svg");
    expect(logo.querySelector("circle")).not.toBeNull();
  });
});

describe("StoreLogo on the kiosk welcome screen", () => {
  it("shows the uploaded logo instead of the star", async () => {
    renderPageWithActor(KioskPage, logoActor(pngBytes()), { path: "/kiosk" });

    await screen.findByTestId("kiosk.welcome");
    const logo = await screen.findByAltText("Roadie store logo logo");
    expect(logo.tagName.toLowerCase()).toBe("img");
    // The kiosk welcome logo is large and centered: 160px tall on phones,
    // 200px on tablets, with automatic width.
    expect(logo).toHaveClass("h-40", "w-auto", "object-contain");
    expect(logo).toHaveClass("md:h-[200px]");
  });
});

describe("StoreLogo on the waiting screen", () => {
  it("shows the uploaded logo for a signed-in caller awaiting approval", async () => {
    const getMyAccess = vi.fn<backendInterface["getMyAccess"]>(
      async () => null,
    );
    const requestAccess = vi.fn<backendInterface["requestAccess"]>(
      async () => false,
    );
    const bootstrapAdmin = vi.fn<backendInterface["bootstrapAdmin"]>(
      async () => true,
    );
    const getStoreLogo = vi.fn<backendInterface["getStoreLogo"]>(async () => ({
      logo: pngBytes(),
    }));

    renderWithActor(wrap(<ApprovalGate />), {
      getMyAccess,
      requestAccess,
      bootstrapAdmin,
      getStoreLogo,
    } satisfies Pick<
      backendInterface,
      "getMyAccess" | "requestAccess" | "bootstrapAdmin" | "getStoreLogo"
    >);

    await screen.findByTestId("gate.pending_state");
    const logo = await screen.findByAltText("Roadie store logo logo");
    expect(logo.tagName.toLowerCase()).toBe("img");
    // The sign-in/waiting screen shows a centered logo about 128px tall; the
    // uploaded logo keeps its aspect ratio, so the square width is dropped.
    expect(logo).toHaveClass("h-32", "object-contain", "w-auto");
  });
});

describe("StoreInfoPanel logo save", () => {
  /** The actor methods the admin store panel reads and writes. */
  function storeActor(initialLogo: PhotoRef | null) {
    // A stateful fake: a real canister returns the saved logo on the next read.
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

  it("saves the resized logo bytes in the updateStoreInfo payload", async () => {
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
  });

  it("resizes a large PNG logo and keeps its PNG type so transparency survives", async () => {
    const user = userEvent.setup();
    const actor = storeActor(null);

    // jsdom never decodes an image, so stub the decode and the canvas encode to
    // drive the real resize path instead of its fallback.
    const naturalWidth = 2000;
    const naturalHeight = 1000;
    const imageSpy = vi.spyOn(window, "Image").mockImplementation(() => {
      const image = {
        naturalWidth,
        naturalHeight,
        set src(_value: string) {
          queueMicrotask(() => image.onload?.(new Event("load")));
        },
        onload: null as ((event: Event) => void) | null,
        onerror: null as ((event: Event) => void) | null,
      };
      return image as unknown as HTMLImageElement;
    });
    const ctx = { drawImage: vi.fn() };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    );
    const toBlob = vi
      .spyOn(HTMLCanvasElement.prototype, "toBlob")
      .mockImplementation((callback: BlobCallback) => {
        callback(new Blob(["resized-png"], { type: "image/png" }));
      });

    renderPageWithActor(AdminPage, actor, { path: "/admin" });
    await screen.findByTestId("admin.store.app_name.input");
    await user.upload(
      screen.getByTestId("admin.store.logo.input"),
      new File(["large-logo"], "big.png", { type: "image/png" }),
    );
    await screen.findByAltText("Store logo");

    // The resize ran and re-encoded the PNG as PNG, not JPEG.
    expect(toBlob).toHaveBeenCalled();
    expect(toBlob.mock.calls[0][1]).toBe("image/png");

    await user.click(screen.getByTestId("admin.store.save_button"));
    await waitFor(() => expect(actor.updateStoreInfo).toHaveBeenCalledTimes(1));
    const payload = actor.updateStoreInfo.mock.calls[0][0];
    expect(payload.logo).toBeInstanceOf(Uint8Array);
    expect(payload.logo?.length).toBeGreaterThan(0);

    imageSpy.mockRestore();
  });

  it("shows the new logo in the header after a save without a reload", async () => {
    const user = userEvent.setup();
    const actor = storeActor(null);
    // The header logo and the admin panel share one QueryClient, as they do in
    // the running app, so the save's invalidation reaches the mounted logo.
    renderWithActor(
      <>
        <StoreLogo />
        <StoreInfoPanel />
      </>,
      actor,
    );

    // The header starts on the built-in star because no logo is set.
    await screen.findByTestId("admin.store.app_name.input");
    expect(screen.getByTestId("store.logo").tagName.toLowerCase()).toBe("svg");

    await user.upload(
      screen.getByTestId("admin.store.logo.input"),
      new File(["logo-bytes"], "logo.png", { type: "image/png" }),
    );
    await screen.findByAltText("Store logo");
    await user.click(screen.getByTestId("admin.store.save_button"));

    // After the save the header logo refetches and renders the uploaded image
    // without a page reload.
    const headerLogo = await screen.findByAltText("Roadie store logo logo");
    expect(headerLogo.tagName.toLowerCase()).toBe("img");
  });
});
