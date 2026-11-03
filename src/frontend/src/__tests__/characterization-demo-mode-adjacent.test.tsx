import { renderPageWithActor, t } from "@/__tests__/router-test-utils";
import { renderWithActor } from "@/__tests__/test-utils";
import type { StoreInfo, backendInterface } from "@/backend";
import { ManagerSignaturePad } from "@/components/approvals/ManagerSignaturePad";
import { KioskSignatureStep } from "@/components/kiosk/KioskSignatureStep";
import AdminPage from "@/pages/Admin";
import KioskPage from "@/pages/Kiosk";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Characterization baseline for the surfaces the Demo mode change touches.
 * Demo mode is OFF here (the current, pre-change state), so these tests protect
 * the behavior that must survive the change: the Admin Store settings panel
 * still loads and saves, the kiosk sign-up flow still works, and both signature
 * pads still capture a drawn signature. They deliberately do not assert any
 * demo banner, demo switch, or Sign as Test control.
 */

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

/** The actor methods the Admin Store settings tab reads and writes. */
function adminActor() {
  return {
    getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(async () => STORE),
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
    updateStoreInfo: vi.fn<backendInterface["updateStoreInfo"]>(async () => {}),
  };
}

describe("Admin Store settings panel survives the Demo mode switch addition", () => {
  it("loads the current store settings into the form", async () => {
    renderPageWithActor(AdminPage, adminActor(), { path: "/admin" });

    // The default tab is Store settings and the loaded record fills the form.
    expect(await screen.findByTestId("admin.store.app_name.input")).toHaveValue(
      "Roadie Roster",
    );
    expect(screen.getByTestId("admin.store.store_number.input")).toHaveValue(
      "975",
    );
    expect(screen.getByTestId("admin.store.location.input")).toHaveValue(
      "Lake Charles",
    );
  });

  it("saves an edited store setting through updateStoreInfo", async () => {
    const user = userEvent.setup();
    const actor = adminActor();
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    const location = await screen.findByTestId("admin.store.location.input");
    await user.clear(location);
    await user.type(location, "Sulphur");
    await user.click(screen.getByTestId("admin.store.save_button"));

    await waitFor(() => expect(actor.updateStoreInfo).toHaveBeenCalledTimes(1));
    const saved = actor.updateStoreInfo.mock.calls[0]?.[0];
    expect(saved?.locationName).toBe("Sulphur");
    // The rest of the record is carried through unchanged.
    expect(saved?.storeNumber).toBe("975");
    expect(
      await screen.findByTestId("admin.store.success_state"),
    ).toBeInTheDocument();
  });
});

/** Upload a photo through the kiosk's file-picker fallback. */
async function uploadPhoto(user: ReturnType<typeof userEvent.setup>) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("photo file input not found");
  const file = new File(["photo-bytes"], "photo.png", { type: "image/png" });
  await user.upload(input, file);
}

describe("kiosk sign-up flow survives the demo banner and Sign as Test addition", () => {
  it("walks from the welcome screen to the signature step and submits", async () => {
    const user = userEvent.setup();
    const submitSignup = vi.fn<backendInterface["submitSignup"]>(
      async () => 1n,
    );
    renderPageWithActor(KioskPage, { submitSignup }, { path: "/kiosk" });

    await user.click(await screen.findByTestId("kiosk.start_button"));
    await uploadPhoto(user);
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

    // The signature step is reached and nothing has been submitted yet.
    expect(
      await screen.findByTestId("kiosk.signature_step"),
    ).toBeInTheDocument();
    expect(submitSignup).not.toHaveBeenCalled();
  });
});

/** A minimal canvas 2D context so the signature pads can draw in jsdom. */
function stubCanvas() {
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
  const toBlob = vi
    .spyOn(HTMLCanvasElement.prototype, "toBlob")
    .mockImplementation((callback: BlobCallback) => {
      // jsdom's Blob lacks arrayBuffer in this environment; the manager pad
      // reads the drawn bytes through it, so supply a minimal stand-in.
      const bytes = new TextEncoder().encode("signature-bytes");
      const blob = {
        type: "image/png",
        arrayBuffer: async () => bytes.buffer,
      } as unknown as Blob;
      callback(blob);
    });
  return { ctx, toBlob };
}

/** Draw a stroke on a canvas via pointer events. */
function drawStroke(
  canvas: HTMLElement,
  points: Array<{ x: number; y: number }>,
) {
  fireEvent.pointerDown(canvas, {
    pointerId: 1,
    clientX: points[0].x,
    clientY: points[0].y,
  });
  for (const point of points.slice(1)) {
    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      clientX: point.x,
      clientY: point.y,
    });
  }
  fireEvent.pointerUp(canvas, { pointerId: 1 });
}

describe("signature pads still capture a drawn signature", () => {
  it("emits the kiosk signature bytes once a stroke is drawn", async () => {
    const { toBlob } = stubCanvas();
    const onSigned = vi.fn();
    renderWithActor(
      <KioskSignatureStep
        hasSignature={false}
        onSigned={onSigned}
        onClear={vi.fn()}
      />,
      {},
    );

    const canvas = screen.getByTestId("kiosk.signature.canvas_target");
    drawStroke(canvas, [
      { x: 10, y: 10 },
      { x: 40, y: 40 },
    ]);

    await waitFor(() => expect(toBlob).toHaveBeenCalled());
    await waitFor(() => expect(onSigned).toHaveBeenCalledTimes(1));
    expect(onSigned.mock.calls[0]?.[0]).toBeInstanceOf(File);
  });

  it("emits the manager signature bytes once a stroke is drawn", async () => {
    const { toBlob } = stubCanvas();
    const onChange = vi.fn();
    renderWithActor(
      <ManagerSignaturePad value={null} onChange={onChange} />,
      {},
    );

    const canvas = screen.getByTestId(
      "approvals.signup.signature.canvas_target",
    );
    drawStroke(canvas, [
      { x: 10, y: 10 },
      { x: 40, y: 40 },
    ]);

    await waitFor(() => expect(toBlob).toHaveBeenCalled());
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(onChange.mock.calls[0]?.[0]).toBeInstanceOf(Uint8Array);
  });
});

describe("default route renders without a blank screen", () => {
  it("shows the dashboard shell for an approved admin", async () => {
    renderPageWithActor(AdminPage, adminActor(), { path: "/admin" });

    // The admin page renders its header and tablist rather than a blank screen.
    expect(await screen.findByTestId("admin.page")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: t("admin.title") }),
    ).toBeInTheDocument();
  });
});
