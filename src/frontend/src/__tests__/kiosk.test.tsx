import { renderPageWithActor } from "@/__tests__/router-test-utils";
import KioskPage from "@/pages/Kiosk";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

// jsdom does not implement object URLs; the photo step previews the captured
// file through one, so provide a minimal test-only polyfill.
beforeAll(() => {
  if (typeof URL.createObjectURL !== "function") {
    URL.createObjectURL = vi.fn(() => "blob:test-preview");
  }
  if (typeof URL.revokeObjectURL !== "function") {
    URL.revokeObjectURL = vi.fn();
  }
});

function actor() {
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

describe("KioskPage sign-up journey", () => {
  it("starts the form from the welcome screen", async () => {
    const user = userEvent.setup();
    renderPageWithActor(KioskPage, actor(), { path: "/kiosk" });

    expect(await screen.findByTestId("kiosk.welcome")).toBeInTheDocument();
    await user.click(screen.getByTestId("kiosk.start_button"));

    expect(await screen.findByTestId("kiosk.photo_step")).toBeInTheDocument();
  });

  it("blocks advancing past the details step without a name", async () => {
    const user = userEvent.setup();
    renderPageWithActor(KioskPage, actor(), { path: "/kiosk" });

    await user.click(await screen.findByTestId("kiosk.start_button"));
    await uploadPhoto(user);
    await user.click(screen.getByTestId("kiosk.next_button"));

    // Now on the details step; advance without filling the required fields.
    await screen.findByTestId("kiosk.details_step");
    await user.click(screen.getByTestId("kiosk.next_button"));

    // Still on the details step; the name field is marked invalid.
    expect(screen.getByTestId("kiosk.details_step")).toBeInTheDocument();
    expect(screen.getByTestId("kiosk.name.input")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("reaches the signature step with a completed form and does not submit early", async () => {
    const user = userEvent.setup();
    const a = actor();
    renderPageWithActor(KioskPage, a, { path: "/kiosk" });

    await user.click(await screen.findByTestId("kiosk.start_button"));

    // Step 0: photo.
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

    // Step 3: availability — pick one slot.
    await screen.findByTestId("kiosk.availability_step");
    await user.click(screen.getByTestId("kiosk.availability.wed.am"));
    await user.click(screen.getByTestId("kiosk.next_button"));

    // Step 4: signature — required before review/submit.
    expect(
      await screen.findByTestId("kiosk.signature_step"),
    ).toBeInTheDocument();
    expect(a.submitSignup).not.toHaveBeenCalled();
  });
});
