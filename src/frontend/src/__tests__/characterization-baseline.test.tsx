import { renderPageWithActor, t } from "@/__tests__/router-test-utils";
import type { ExportData, SignupSubmission, backendInterface } from "@/backend";
import { House, Shift } from "@/backend";
import { buildExportWorkbook } from "@/lib/export";
import ApprovalsPage from "@/pages/Approvals";
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

/** Upload a photo through the kiosk's file-picker fallback. */
async function uploadPhoto(user: ReturnType<typeof userEvent.setup>) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("photo file input not found");
  const file = new File(["photo-bytes"], "photo.png", { type: "image/png" });
  await user.upload(input, file);
}

/** Fill the details step with the two required fields. */
async function fillDetails(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    await screen.findByTestId("kiosk.name.input"),
    "Ada Lovelace",
  );
  await user.type(screen.getByTestId("kiosk.position.input"), "Cashier");
}

/** Fill the contact step with every required field. */
async function fillContact(user: ReturnType<typeof userEvent.setup>) {
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
}

describe("kiosk sign-up validation baseline", () => {
  it("blocks the contact step when the email is malformed", async () => {
    const user = userEvent.setup();
    renderPageWithActor(
      KioskPage,
      { submitSignup: vi.fn(async () => 1n) },
      {
        path: "/kiosk",
      },
    );

    await user.click(await screen.findByTestId("kiosk.start_button"));
    await uploadPhoto(user);
    await user.click(screen.getByTestId("kiosk.next_button"));
    await fillDetails(user);
    await user.click(screen.getByTestId("kiosk.next_button"));

    // On the contact step, enter an invalid email and advance.
    await screen.findByTestId("kiosk.contact_step");
    await user.type(screen.getByTestId("kiosk.email.input"), "not-an-email");
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

    // Still on the contact step; the email field is marked invalid.
    expect(screen.getByTestId("kiosk.contact_step")).toBeInTheDocument();
    expect(screen.getByTestId("kiosk.email.input")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("blocks the availability step until at least one slot is chosen", async () => {
    const user = userEvent.setup();
    renderPageWithActor(
      KioskPage,
      { submitSignup: vi.fn(async () => 1n) },
      {
        path: "/kiosk",
      },
    );

    await user.click(await screen.findByTestId("kiosk.start_button"));
    await uploadPhoto(user);
    await user.click(screen.getByTestId("kiosk.next_button"));
    await fillDetails(user);
    await user.click(screen.getByTestId("kiosk.next_button"));
    await fillContact(user);
    await user.click(screen.getByTestId("kiosk.next_button"));

    // On the availability step, advance without selecting a slot.
    await screen.findByTestId("kiosk.availability_step");
    await user.click(screen.getByTestId("kiosk.next_button"));

    // Still on the availability step.
    expect(screen.getByTestId("kiosk.availability_step")).toBeInTheDocument();
  });

  it("blocks the signature step until a signature is drawn", async () => {
    const user = userEvent.setup();
    const submitSignup = vi.fn<backendInterface["submitSignup"]>(
      async () => 1n,
    );
    renderPageWithActor(KioskPage, { submitSignup }, { path: "/kiosk" });

    await user.click(await screen.findByTestId("kiosk.start_button"));
    await uploadPhoto(user);
    await user.click(screen.getByTestId("kiosk.next_button"));
    await fillDetails(user);
    await user.click(screen.getByTestId("kiosk.next_button"));
    await fillContact(user);
    await user.click(screen.getByTestId("kiosk.next_button"));
    await screen.findByTestId("kiosk.availability_step");
    await user.click(screen.getByTestId("kiosk.availability.wed.am"));
    await user.click(screen.getByTestId("kiosk.next_button"));

    // On the signature step, advance without drawing anything.
    await screen.findByTestId("kiosk.signature_step");
    await user.click(screen.getByTestId("kiosk.next_button"));

    // Still on the signature step; the required-signature error is shown and
    // nothing has been submitted.
    expect(screen.getByTestId("kiosk.signature_step")).toBeInTheDocument();
    expect(
      screen.getByTestId("kiosk.signature.error_state"),
    ).toBeInTheDocument();
    expect(submitSignup).not.toHaveBeenCalled();
  });
});

/** A minimal export payload with one roadie who has a phone number. */
function sampleExport(): ExportData {
  return {
    overview: [{ positionName: "Cashier", totalPar: 4n, hired: 1n, need: 3n }],
    fohTotal: 1n,
    bohTotal: 0n,
    grandTotal: 1n,
    fohNeed: 3n,
    bohNeed: 0n,
    grandNeed: 3n,
    fohTotalPar: 4n,
    bohTotalPar: 0n,
    grandTotalPar: 4n,
    groups: [
      [
        "Cashier",
        [
          {
            name: "Ada Lovelace",
            phone: "+1-555-0100",
            availability: [Shift.am],
            availabilityByDay: [],
            onboardingComplete: true,
            policiesComplete: false,
            alcoholCert: false,
            foodHandlers: true,
            shirtSize: "M",
            weekdayLunch: true,
          },
        ],
      ],
    ],
  };
}

/** Flatten every cell of every worksheet into one string for inspection. */
function workbookText(data: ExportData, variant: "shareable" | "full"): string {
  const workbook = buildExportWorkbook(data, variant);
  const parts: string[] = [];
  workbook.eachSheet((sheet) => {
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        parts.push(String(cell.value ?? ""));
      });
    });
  });
  return parts.join("|");
}

describe("export workbook baseline", () => {
  it("keeps the overview totals and group rows in both variants", () => {
    const shareable = workbookText(sampleExport(), "shareable");
    const full = workbookText(sampleExport(), "full");

    for (const text of [shareable, full]) {
      expect(text).toContain("Position");
      expect(text).toContain("Total Par");
      expect(text).toContain("Cashier");
      expect(text).toContain("Ada Lovelace");
      expect(text).toContain("FOH total");
      expect(text).toContain("BOH total");
      expect(text).toContain("Grand total");
    }
  });

  it("differs only by the contact phone column between variants", () => {
    const shareable = workbookText(sampleExport(), "shareable");
    const full = workbookText(sampleExport(), "full");

    expect(shareable).not.toContain("Phone");
    expect(shareable).not.toContain("+1-555-0100");
    expect(full).toContain("Phone");
    expect(full).toContain("+1-555-0100");
  });
});

/** A pending sign-up whose date of birth makes the applicant an adult. */
function adultSignup(): SignupSubmission {
  const now = Date.now();
  const thirtyYearsAgo = new Date(now - 30 * 365 * 24 * 60 * 60 * 1000);
  return {
    id: 1n,
    status: { __kind__: "pending", pending: null },
    submittedAt: BigInt(now) * 1_000_000n,
    profile: { name: "Adult Applicant" },
    contactSet: {
      email: "adult@example.com",
      phone: "+1-555-0199",
      dateOfBirth: BigInt(thirtyYearsAgo.getTime()) * 1_000_000n,
      emergencyContactName: "Parent",
      emergencyContactPhone: "+1-555-0101",
      availability: [],
      availabilityResignPending: false,
    },
  };
}

function approvalsActor(signup: SignupSubmission) {
  return {
    listPendingUsers: vi.fn(async () => []),
    listPendingSignups: vi.fn(async () => [signup]),
    listPositions: vi.fn(async () => [
      {
        id: 10n,
        name: "Bartender",
        code: "BAR",
        house: House.foh,
        openingBuildTo: 2n,
        afterOpeningBuildTo: 1n,
        minimumAge: 21n,
        shirtsRequired: 1n,
        hatsRequired: 1n,
        needsAlcoholCert: true,
      },
    ]),
    listCrews: vi.fn(async () => []),
    listSchedule: vi.fn(async () => []),
    findDuplicates: vi.fn(async () => [
      { roadieId: 7n, matchedOn: "phone", archived: false },
    ]),
  };
}

describe("approvals review baseline", () => {
  it("requires a manager signature before approving a sign-up", async () => {
    const user = userEvent.setup();
    renderPageWithActor(ApprovalsPage, approvalsActor(adultSignup()), {
      path: "/approvals",
    });

    // Choose a position but leave the signature blank, then approve.
    await user.click(await screen.findByTestId("approvals.signup.main.select"));
    await user.click(await screen.findByRole("option", { name: "Bartender" }));
    await user.click(screen.getByTestId("approvals.signup.approve_button"));

    expect(
      await screen.findByTestId("approvals.signup.error_state"),
    ).toHaveTextContent(t("approvals.signup.signature.required"));
  });
});
