import { renderPageWithActor, t } from "@/__tests__/router-test-utils";
import { renderWithActor } from "@/__tests__/test-utils";
import type {
  AccessGrant,
  ExportData,
  Position,
  Roadie,
  SignupSubmission,
  backendInterface,
} from "@/backend";
import { House, RoadieStatus, Role, Shift, Weekday } from "@/backend";
import { Layout } from "@/components/Layout";
import { PositionRosterDialog } from "@/components/dashboard/PositionRosterDialog";
import { KioskSuccess } from "@/components/kiosk/KioskSuccess";
import { I18nContext, translate } from "@/hooks/useI18n";
import { buildExportWorkbook } from "@/lib/export";
import KioskPage from "@/pages/Kiosk";
import { render, screen, waitFor } from "@testing-library/react";
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

const PRINCIPAL = { toText: () => "aaaaa-aa" } as never;

function grant(role: Role): AccessGrant {
  return {
    principal: PRINCIPAL,
    role,
    approvedAt: 0n,
    approvedBy: PRINCIPAL,
    trainerPositionIds: [],
  };
}

/** A pending sign-up with a distinct id, for the badge count. */
function pendingSignup(id: bigint): SignupSubmission {
  return {
    id,
    status: { __kind__: "pending", pending: null },
    submittedAt: 0n,
    profile: { name: `Applicant ${id}` },
    isDemo: false,
    contactSet: {
      email: `a${id}@example.com`,
      phone: "+1-555-0100",
      dateOfBirth: 0n,
      emergencyContactName: "Parent",
      emergencyContactPhone: "+1-555-0101",
      availability: [],
      availabilityResignPending: false,
    },
  };
}

describe("approvals badge counts pending sign-ups", () => {
  function Page() {
    return (
      <Layout>
        <p>content</p>
      </Layout>
    );
  }

  it("shows the pending sign-ups count on the approvals link for an admin", async () => {
    const actor = {
      getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () =>
        grant(Role.admin),
      ),
      listPendingSignups: vi.fn<backendInterface["listPendingSignups"]>(
        async () => [pendingSignup(1n), pendingSignup(2n), pendingSignup(3n)],
      ),
      listPendingUsers: vi.fn<backendInterface["listPendingUsers"]>(
        async () => [],
      ),
    };
    renderPageWithActor(Page, actor, { path: "/" });

    const badge = await screen.findByTestId("nav.approvals.badge");
    expect(badge).toHaveTextContent("3");
  });

  it("hides the badge when there are no pending sign-ups", async () => {
    const actor = {
      getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () =>
        grant(Role.admin),
      ),
      listPendingSignups: vi.fn<backendInterface["listPendingSignups"]>(
        async () => [],
      ),
      listPendingUsers: vi.fn<backendInterface["listPendingUsers"]>(
        async () => [],
      ),
    };
    renderPageWithActor(Page, actor, { path: "/" });

    await screen.findByTestId("nav.approvals.link");
    expect(screen.queryByTestId("nav.approvals.badge")).not.toBeInTheDocument();
  });

  it("loads the pending-users queue only for an admin", async () => {
    const adminActor = {
      getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () =>
        grant(Role.admin),
      ),
      listPendingSignups: vi.fn<backendInterface["listPendingSignups"]>(
        async () => [],
      ),
      listPendingUsers: vi.fn<backendInterface["listPendingUsers"]>(
        async () => [],
      ),
    };
    renderPageWithActor(Page, adminActor, { path: "/" });
    await screen.findByTestId("nav.approvals.link");
    await waitFor(() =>
      expect(adminActor.listPendingUsers).toHaveBeenCalledTimes(1),
    );
  });
});

describe("kiosk staff PIN is checked against the stored value", () => {
  it("signs out only when the backend confirms the entered PIN", async () => {
    const user = userEvent.setup();
    const checkKioskPin = vi.fn<backendInterface["checkKioskPin"]>(
      async (pin) => pin === "4321",
    );
    const clear = vi.fn();
    const { setIdentityForTest } = await import("@/__tests__/setup");
    setIdentityForTest({
      identity: {
        getPrincipal: () => ({
          isAnonymous: () => false,
          toText: () => "aaaaa-aa",
        }),
      } as never,
      loginStatus: "success",
      clear,
    });

    // The kiosk sign-out control lives in the root shell; render it through the
    // real App router so the PIN dialog is exercised as shipped.
    const App = (await import("@/App")).default;
    renderWithActor(<App />, {
      getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () =>
        grant(Role.kiosk),
      ),
      checkKioskPin,
    } satisfies Pick<backendInterface, "getMyAccess" | "checkKioskPin">);

    await user.click(await screen.findByTestId("kiosk.sign_out.open_button"));
    const input = await screen.findByTestId("kiosk.sign_out.pin_input");

    // A wrong PIN is rejected and the session is not cleared.
    await user.type(input, "0000");
    await user.click(screen.getByTestId("kiosk.sign_out.confirm_button"));
    expect(
      await screen.findByTestId("kiosk.sign_out.error_state"),
    ).toBeInTheDocument();
    expect(clear).not.toHaveBeenCalled();

    // The stored PIN is accepted and the session is cleared.
    await user.clear(input);
    await user.type(input, "4321");
    await user.click(screen.getByTestId("kiosk.sign_out.confirm_button"));
    await waitFor(() => expect(clear).toHaveBeenCalledTimes(1));
  });
});

describe("kiosk cancel clears the submit error", () => {
  it("returns to the welcome screen and drops a failed submit error", async () => {
    const user = userEvent.setup();
    const submitSignup = vi.fn<backendInterface["submitSignup"]>(async () => {
      throw new Error("backend down");
    });
    renderPageWithActor(KioskPage, { submitSignup }, { path: "/kiosk" });

    await user.click(await screen.findByTestId("kiosk.start_button"));
    const fileInput =
      document.querySelector<HTMLInputElement>('input[type="file"]');
    if (!fileInput) throw new Error("photo file input not found");
    await user.upload(
      fileInput,
      new File(["photo-bytes"], "photo.png", { type: "image/png" }),
    );
    await user.click(screen.getByTestId("kiosk.next_button"));

    await user.type(
      await screen.findByTestId("kiosk.name.input"),
      "Ada Lovelace",
    );
    await user.type(screen.getByTestId("kiosk.position.input"), "Cashier");
    await user.click(screen.getByTestId("kiosk.next_button"));

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

    await screen.findByTestId("kiosk.availability_step");
    await user.click(screen.getByTestId("kiosk.availability.wed.am"));
    await user.click(screen.getByTestId("kiosk.next_button"));

    // Draw a signature so the review step is reachable.
    const ctx = {
      scale: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      clearRect: vi.fn(),
      set lineWidth(_v: number) {},
      set lineCap(_v: string) {},
      set lineJoin(_v: string) {},
      set strokeStyle(_v: string) {},
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      (callback: BlobCallback) => {
        callback(new Blob(["signature-bytes"], { type: "image/png" }));
      },
    );
    const canvas = await screen.findByTestId("kiosk.signature.canvas_target");
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 40, clientY: 40 });
    fireEvent.pointerUp(canvas, { pointerId: 1 });
    await user.click(screen.getByTestId("kiosk.next_button"));

    await screen.findByTestId("kiosk.review_step");
    await user.click(screen.getByTestId("kiosk.submit_button"));

    // The failed submit shows the error state. Image resize falls back after a
    // 2s decode timeout in jsdom, so allow more than the default wait.
    expect(
      await screen.findByTestId("kiosk.submit.error_state", undefined, {
        timeout: 8_000,
      }),
    ).toBeInTheDocument();

    // Step back to the first step, where the back control is a cancel.
    for (let i = 0; i < 5; i += 1) {
      await user.click(screen.getByTestId("kiosk.back_button"));
    }
    await screen.findByTestId("kiosk.photo_step");

    // Cancel returns to the welcome screen and clears the submit error so the
    // next person starts clean.
    await user.click(screen.getByTestId("kiosk.back_button"));
    expect(await screen.findByTestId("kiosk.welcome")).toBeInTheDocument();
    expect(
      screen.queryByTestId("kiosk.submit.error_state"),
    ).not.toBeInTheDocument();
  }, 20_000);
});

describe("kiosk success screen uses the chosen language", () => {
  it("renders the Spanish success copy under a Spanish locale", () => {
    const onReset = vi.fn();
    render(
      <I18nContext.Provider
        value={{
          locale: "es",
          setLocale: vi.fn(),
          t: (key, vars) => translate("es", key, vars),
        }}
      >
        <KioskSuccess onReset={onReset} />
      </I18nContext.Provider>,
    );

    expect(screen.getByTestId("kiosk.success_state")).toBeInTheDocument();
    expect(screen.getByText("Solicitud enviada")).toBeInTheDocument();
    expect(
      screen.getByText(
        "¡Gracias! El equipo de contratación revisará tu solicitud y se comunicará pronto.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId("kiosk.success.reset_button")).toHaveTextContent(
      "Comenzar una nueva solicitud",
    );
  });
});

describe("full export includes contact details and totals", () => {
  /** A payload with one roadie carrying contact details and day availability. */
  function sampleData(): ExportData {
    return {
      overview: [
        { positionName: "Cashier", totalPar: 4n, hired: 1n, need: 3n },
      ],
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
              email: "ada@example.com",
              emergencyContactName: "Grace Hopper",
              emergencyContactPhone: "+1-555-0101",
              dateOfBirth: BigInt(Date.UTC(1990, 0, 1)) * 1_000_000n,
              availability: [Shift.am],
              availabilityByDay: [
                [Weekday.wed, [Shift.am]],
                [Weekday.fri, [Shift.pm]],
              ],
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

  /** Every cell of every worksheet, in sheet/row order. */
  function workbookCells(data: ExportData, variant: "shareable" | "full") {
    const workbook = buildExportWorkbook(data, variant);
    const sheets: string[][] = [];
    workbook.eachSheet((sheet) => {
      const rows: string[] = [];
      sheet.eachRow((row) => {
        row.eachCell((cell) => {
          rows.push(String(cell.value ?? ""));
        });
      });
      sheets.push(rows);
    });
    return sheets;
  }

  it("carries contact details, date of birth and day availability in Full", () => {
    const full = workbookCells(sampleData(), "full").flat().join("|");
    expect(full).toContain("Email");
    expect(full).toContain("ada@example.com");
    expect(full).toContain("Emergency contact name");
    expect(full).toContain("Grace Hopper");
    expect(full).toContain("Emergency contact phone");
    expect(full).toContain("+1-555-0101");
    expect(full).toContain("Date of birth");
    // The day-by-shift availability columns render the selected days.
    expect(full).toContain("Wed");
    expect(full).toContain("Fri");
  });

  it("fills Total Par and Need on the FOH, BOH and Grand total rows", () => {
    const overview = workbookCells(sampleData(), "full")[0];
    // The overview sheet carries the par and need totals for each row.
    expect(overview).toContain("FOH total");
    expect(overview).toContain("BOH total");
    expect(overview).toContain("Grand total");
    expect(overview).toContain("Total Par");
    expect(overview).toContain("Need");
    // Grand total par is 4 and need is 3 for this payload.
    expect(overview).toContain("4");
    expect(overview).toContain("3");
  });

  it("renders the day-by-shift availability values in the Full export", () => {
    const full = workbookCells(sampleData(), "full").flat().join("|");
    // The Full export carries the day-by-shift availability values. The
    // Shareable export's empty availability is a backend contract, covered by
    // the PocketIC lane, not by this workbook builder.
    expect(full).toContain("Wed");
    expect(full).toContain("Fri");
  });
});

describe("kiosk phone validation requires at least 7 digits", () => {
  it("rejects a phone with fewer than 7 digits", async () => {
    const user = userEvent.setup();
    renderPageWithActor(
      KioskPage,
      { submitSignup: vi.fn(async () => 1n) },
      { path: "/kiosk" },
    );

    await user.click(await screen.findByTestId("kiosk.start_button"));
    const fileInput =
      document.querySelector<HTMLInputElement>('input[type="file"]');
    if (!fileInput) throw new Error("photo file input not found");
    await user.upload(
      fileInput,
      new File(["photo-bytes"], "photo.png", { type: "image/png" }),
    );
    await user.click(screen.getByTestId("kiosk.next_button"));

    await user.type(
      await screen.findByTestId("kiosk.name.input"),
      "Ada Lovelace",
    );
    await user.type(screen.getByTestId("kiosk.position.input"), "Cashier");
    await user.click(screen.getByTestId("kiosk.next_button"));

    await screen.findByTestId("kiosk.contact_step");
    await user.type(screen.getByTestId("kiosk.email.input"), "ada@example.com");
    // Six digits: the format matches but the digit count is too low.
    await user.type(screen.getByTestId("kiosk.phone.input"), "123-456");
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

    expect(screen.getByTestId("kiosk.contact_step")).toBeInTheDocument();
    expect(screen.getByTestId("kiosk.phone.input")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });
});

describe("archived dates show as timestamps in the store time zone", () => {
  const POSITION: Position = {
    id: 0n,
    name: "Servers",
    code: "SRV",
    house: House.foh,
    openingBuildTo: 2n,
    afterOpeningBuildTo: 2n,
    minimumAge: 18n,
    shirtsRequired: 2n,
    hatsRequired: 1n,
    needsAlcoholCert: true,
  };

  // 2027-02-09T05:59:59Z, which is 2027-02-08 23:59:59 in America/Chicago.
  const ARCHIVED_AT = 1_802_152_799_000_000_000n;

  const ARCHIVED: Roadie = {
    id: 9n,
    status: RoadieStatus.archived,
    mainPositionId: 0n,
    hiredAt: 0n,
    profile: { name: "Archived Ada" },
    isMinor: false,
    isDemo: false,
    archivedReason: { __kind__: "noShow", noShow: null },
    archivedAt: ARCHIVED_AT,
  };

  it("renders the archivedAt instant in the store time zone", async () => {
    // No store info is loaded, so the dialog falls back to the default store
    // time zone (America/Chicago), which is what this assertion pins.
    const actor = {
      listRosterForPosition: vi.fn<backendInterface["listRosterForPosition"]>(
        async () => [ARCHIVED],
      ),
    };
    renderWithActor(
      <PositionRosterDialog
        position={POSITION}
        open
        onOpenChange={vi.fn()}
        canRehire
      />,
      actor,
    );

    const item = await screen.findByTestId("dashboard.roster.archived.item");
    // The store-zone rendering of the instant, not the UTC one.
    const expected = new Date(Number(ARCHIVED_AT / 1_000_000n)).toLocaleString(
      undefined,
      { dateStyle: "medium", timeStyle: "short", timeZone: "America/Chicago" },
    );
    expect(item).toHaveTextContent(expected);
  });
});
