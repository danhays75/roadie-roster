import { renderPageWithActor } from "@/__tests__/router-test-utils";
import { renderWithActor } from "@/__tests__/test-utils";
import type { StoreInfo, backendInterface } from "@/backend";
import { StoreLogo } from "@/components/StoreLogo";
import AdminPage from "@/pages/Admin";
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
  // jsdom's Blob/File may lack arrayBuffer; the upload path reads bytes through it.
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
  openingDate: 1_802_066_400_000_000_000n,
  amShiftStart: 600n,
  amShiftEnd: 900n,
  pmShiftStart: 960n,
  pmShiftEnd: 1320n,
  trainingGroupSize: 5n,
  leaderTalkName: "10 Minutes with Dan",
  leaderTalkSize: 10n,
};

/** The actor methods the admin store panel reads and writes. */
function storeActor() {
  return {
    getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(async () => STORE),
    updateStoreInfo: vi.fn<backendInterface["updateStoreInfo"]>(
      async () => undefined,
    ),
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

describe("StoreLogo built-in star", () => {
  it("renders the built-in star mark when no store logo is set", () => {
    renderWithActor(<StoreLogo />, {});

    const logo = screen.getByTestId("store.logo");
    expect(logo).toBeInTheDocument();
    // The mark is an accessible image with the default title.
    expect(logo).toHaveAttribute("role", "img");
    expect(logo).toHaveAttribute("aria-label", "Roadie store logo");
    // The star is drawn as inline SVG, not an uploaded image.
    expect(logo.tagName.toLowerCase()).toBe("svg");
    expect(logo.querySelector("circle")).not.toBeNull();
  });

  it("honors a custom title and merges caller classes", () => {
    renderWithActor(<StoreLogo className="h-20 w-20" title="Store mark" />, {});

    const logo = screen.getByTestId("store.logo");
    expect(logo).toHaveAttribute("aria-label", "Store mark");
    expect(logo).toHaveClass("h-20", "w-20");
  });
});

describe("StoreInfoPanel logo upload", () => {
  it("previews an uploaded logo and offers a remove control", async () => {
    const user = userEvent.setup();
    renderPageWithActor(AdminPage, storeActor(), { path: "/admin" });

    // The panel initializes its draft from the loaded record.
    await screen.findByTestId("admin.store.app_name.input");
    // With no logo set, the placeholder icon shows and no remove control exists.
    expect(
      screen.queryByTestId("admin.store.logo.remove_button"),
    ).not.toBeInTheDocument();

    const input = screen.getByTestId("admin.store.logo.input");
    await user.upload(
      input,
      new File(["logo-bytes"], "logo.png", { type: "image/png" }),
    );

    // The uploaded logo is previewed and can be removed.
    const preview = await screen.findByAltText("Store logo");
    expect(preview).toBeInTheDocument();
    expect(preview.getAttribute("src")).toMatch(/^data:image\//);
    expect(
      screen.getByTestId("admin.store.logo.remove_button"),
    ).toBeInTheDocument();
  });

  it("clears the preview when the logo is removed", async () => {
    const user = userEvent.setup();
    renderPageWithActor(AdminPage, storeActor(), { path: "/admin" });

    await screen.findByTestId("admin.store.app_name.input");
    await user.upload(
      screen.getByTestId("admin.store.logo.input"),
      new File(["logo-bytes"], "logo.png", { type: "image/png" }),
    );
    await screen.findByAltText("Store logo");

    await user.click(screen.getByTestId("admin.store.logo.remove_button"));

    await waitFor(() =>
      expect(screen.queryByAltText("Store logo")).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByTestId("admin.store.logo.remove_button"),
    ).not.toBeInTheDocument();
  });

  it("saves the attached logo as part of the store payload", async () => {
    const user = userEvent.setup();
    const actor = storeActor();
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
    // The saved record carries the logo bytes and keeps the other fields.
    expect(payload.logo).toBeInstanceOf(Uint8Array);
    expect(payload.logo?.length).toBeGreaterThan(0);
    expect(payload.appName).toBe("Roadie Roster");
    expect(payload.storeNumber).toBe("975");
  });
});
