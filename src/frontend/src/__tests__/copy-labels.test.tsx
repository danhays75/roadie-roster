import { renderPageWithActor } from "@/__tests__/router-test-utils";
import type { backendInterface } from "@/backend";
import AdminPage from "@/pages/Admin";
import KioskPage from "@/pages/Kiosk";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

// jsdom does not implement object URLs; the kiosk photo step previews the
// captured file through one, so provide a minimal test-only polyfill.
beforeAll(() => {
  if (typeof URL.createObjectURL !== "function") {
    URL.createObjectURL = vi.fn(() => "blob:test-preview");
  }
  if (typeof URL.revokeObjectURL !== "function") {
    URL.revokeObjectURL = vi.fn();
  }
});

/** The actor methods the admin page tree reads across its tabs. */
function adminActor() {
  return {
    getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(async () => ({
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

function kioskActor() {
  return {
    submitSignup: vi.fn(async () => 1n),
  };
}

/** Upload a photo through the kiosk's file-picker fallback. */
async function uploadPhoto(user: ReturnType<typeof userEvent.setup>) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("photo file input not found");
  const file = new File(["photo-bytes"], "photo.png", { type: "image/png" });
  await user.upload(input, file);
}

describe("Admin tab labels render readable copy", () => {
  it("shows human-readable section labels instead of raw i18n keys", async () => {
    renderPageWithActor(AdminPage, adminActor(), { path: "/admin" });

    expect(await screen.findByTestId("admin.page")).toBeInTheDocument();

    // Each tab's visible label is the translated copy, not the dotted key.
    expect(screen.getByTestId("admin.store.tab")).toHaveTextContent(
      "Store settings",
    );
    expect(screen.getByTestId("admin.positions.tab")).toHaveTextContent(
      "Positions",
    );
    expect(screen.getByTestId("admin.schedule.tab")).toHaveTextContent(
      "Schedule",
    );
    expect(screen.getByTestId("admin.checklists.tab")).toHaveTextContent(
      "Checklists",
    );
    expect(screen.getByTestId("admin.template.tab")).toHaveTextContent(
      "Store template",
    );
    expect(screen.getByTestId("admin.access.tab")).toHaveTextContent(
      "Access grants",
    );

    // No tab leaks a raw dotted key such as "admin.section.store".
    for (const key of [
      "store",
      "positions",
      "schedule",
      "checklists",
      "template",
      "access",
    ]) {
      expect(screen.getByTestId(`admin.${key}.tab`)).not.toHaveTextContent(
        `admin.section.${key}`,
      );
    }
  });
});

describe("Kiosk availability day labels render readable copy", () => {
  it("shows full weekday names instead of raw i18n keys", async () => {
    const user = userEvent.setup();
    renderPageWithActor(KioskPage, kioskActor(), { path: "/kiosk" });

    await user.click(await screen.findByTestId("kiosk.start_button"));
    await uploadPhoto(user);
    await user.click(screen.getByTestId("kiosk.next_button"));

    // Step 1: details.
    await user.type(
      await screen.findByTestId("kiosk.name.input"),
      "Ada Lovelace",
    );
    await user.type(screen.getByTestId("kiosk.position.input"), "Cashier");
    await user.click(screen.getByTestId("kiosk.next_button"));

    // Step 2: contact.
    await user.type(
      await screen.findByTestId("kiosk.email.input"),
      "ada@example.com",
    );
    await user.type(screen.getByTestId("kiosk.phone.input"), "+1-555-0100");
    await user.type(
      screen.getByTestId("kiosk.date_of_birth.input"),
      "1990-01-01",
    );
    await user.type(
      screen.getByTestId("kiosk.emergency_contact_name.input"),
      "Grace",
    );
    await user.type(
      screen.getByTestId("kiosk.emergency_contact_phone.input"),
      "+1-555-0101",
    );
    await user.click(screen.getByTestId("kiosk.next_button"));

    // Step 3: availability — the day column shows full weekday names.
    await screen.findByTestId("kiosk.availability_step");
    for (const day of [
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ]) {
      expect(screen.getByText(day)).toBeInTheDocument();
    }
    // The raw dotted key must not leak into the grid.
    expect(screen.queryByText("kiosk.weekday.wed")).not.toBeInTheDocument();
    expect(screen.queryByText("kiosk.weekday.mon")).not.toBeInTheDocument();
  });
});
