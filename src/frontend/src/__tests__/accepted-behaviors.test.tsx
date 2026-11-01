import { renderPageWithActor, t } from "@/__tests__/router-test-utils";
import { setIdentityForTest } from "@/__tests__/setup";
import { renderWithActor } from "@/__tests__/test-utils";
import type { AccessGrant, Roadie, backendInterface } from "@/backend";
import { RoadieStatus, Role } from "@/backend";
import { Layout } from "@/components/Layout";
import { ManagerSignaturePad } from "@/components/approvals/ManagerSignaturePad";
import { KioskSignatureStep } from "@/components/kiosk/KioskSignatureStep";
import { FlipCard } from "@/components/roadie/FlipCard";
import { formatDateOnly, formatTimestamp } from "@/lib/format";
import ApprovalsPage from "@/pages/Approvals";
import KioskPage from "@/pages/Kiosk";
import RoadieCardPage from "@/pages/RoadieCard";
import { fireEvent, screen, waitFor } from "@testing-library/react";
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
  // jsdom's Blob/File may lack arrayBuffer; the kiosk reads uploads through it.
  if (typeof Blob.prototype.arrayBuffer !== "function") {
    Blob.prototype.arrayBuffer = function arrayBuffer(this: Blob) {
      return Promise.resolve(new TextEncoder().encode("bytes").buffer);
    };
  }
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
  const getContext = vi
    .spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  const toBlob = vi
    .spyOn(HTMLCanvasElement.prototype, "toBlob")
    .mockImplementation((callback: BlobCallback) => {
      // A real Blob so `new File([blob])` and `blob.arrayBuffer()` both work.
      callback(new Blob(["signature-bytes"], { type: "image/png" }));
    });
  return { ctx, getContext, toBlob };
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

describe("kiosk auto-reset and signature survival", () => {
  it("resets the success screen to the welcome screen after 10 seconds", async () => {
    const user = userEvent.setup();
    const actor = { submitSignup: vi.fn(async () => 1n) };
    renderPageWithActor(KioskPage, actor, { path: "/kiosk" });

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

    const { toBlob } = stubCanvas();
    const canvas = await screen.findByTestId("kiosk.signature.canvas_target");
    drawStroke(canvas, [
      { x: 10, y: 10 },
      { x: 40, y: 40 },
    ]);
    await waitFor(() => expect(toBlob).toHaveBeenCalled());
    await user.click(screen.getByTestId("kiosk.next_button"));

    await screen.findByTestId("kiosk.review_step");
    await user.click(screen.getByTestId("kiosk.submit_button"));

    expect(
      await screen.findByTestId("kiosk.success_state"),
    ).toBeInTheDocument();

    // The success screen clears itself after 10 seconds. The reset timer is
    // scheduled when the success phase mounts, so wait on real timers.
    await waitFor(
      () => expect(screen.getByTestId("kiosk.welcome")).toBeInTheDocument(),
      { timeout: 12_000 },
    );
  }, 20_000);

  it("keeps a multi-stroke signature when the window resizes", async () => {
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
      { x: 5, y: 5 },
      { x: 20, y: 20 },
    ]);
    drawStroke(canvas, [
      { x: 30, y: 30 },
      { x: 50, y: 10 },
    ]);

    // A resize must not wipe the drawn strokes: the canvas is sized once on
    // mount and has no resize listener, so the second stroke still emits.
    fireEvent(window, new Event("resize"));
    await waitFor(() => expect(toBlob).toHaveBeenCalledTimes(2));
    expect(onSigned).toHaveBeenCalledTimes(2);
  });
});

describe("manager approval signature", () => {
  it("emits the manager's drawn signature as bytes, separate from the roadie's", async () => {
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
      { x: 8, y: 8 },
      { x: 24, y: 24 },
    ]);

    await waitFor(() => expect(toBlob).toHaveBeenCalled());
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const emitted = onChange.mock.calls.at(-1)?.[0];
    expect(emitted).toBeInstanceOf(Uint8Array);
    expect(emitted.length).toBeGreaterThan(0);
  });
});

describe("roadie card birthday and Minor badge", () => {
  const minorRoadie: Roadie = {
    id: 1n,
    status: RoadieStatus.hired,
    mainPositionId: 0n,
    hiredAt: 0n,
    profile: { name: "Sam Minor" },
    isMinor: true,
    birthdayMonthDay: "03-14",
  };

  it("shows the birthday and Minor badge from the non-sensitive fields", () => {
    renderWithActor(
      <FlipCard
        roadie={minorRoadie}
        position={undefined}
        secondPosition={undefined}
        crossTrainedPosition={undefined}
        crew={undefined}
      />,
      {},
    );

    // The Minor badge is present without any contact set on the roadie.
    expect(screen.getAllByTestId("roadie.minor_badge").length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByText(t("roadie.minor")).length).toBeGreaterThan(0);
    // The birthday renders from birthdayMonthDay, not the contact set.
    expect(screen.getAllByText("Mar 14").length).toBeGreaterThan(0);
  });
});

describe("date-only formatting is time-zone independent", () => {
  it("formats a date-only value in UTC regardless of the device time zone", () => {
    // 2027-03-14 UTC midnight.
    const dateOnly = BigInt(Date.UTC(2027, 2, 14)) * 1_000_000n;
    const formatted = formatDateOnly(dateOnly);
    expect(formatted).toContain("2027");
    expect(formatted).toContain("14");
  });

  it("formats a schedule timestamp in the store time zone", () => {
    // 2027-03-14T12:00:00Z is 07:00 in America/Chicago (CDT, UTC-5).
    const timestamp = BigInt(Date.UTC(2027, 2, 14, 12, 0, 0)) * 1_000_000n;
    const chicago = formatTimestamp(timestamp, "America/Chicago");
    const utc = formatTimestamp(timestamp, "UTC");
    expect(chicago).not.toBe(utc);
    expect(chicago).toContain("7:00");
  });
});

describe("approvals role gating", () => {
  function approvalsActor(role: Role) {
    const grant: AccessGrant = {
      principal: { toText: () => "aaaaa-aa" } as never,
      role,
      approvedAt: 0n,
      approvedBy: { toText: () => "aaaaa-aa" } as never,
      trainerPositionIds: [],
      accessEndsAt: undefined,
      linkedRoadieId: undefined,
    };
    return {
      getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => grant),
      getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(
        async () => ({ timeZone: "America/Chicago" }) as never,
      ),
      listPendingSignups: vi.fn<backendInterface["listPendingSignups"]>(
        async () => [],
      ),
      listPendingUsers: vi.fn<backendInterface["listPendingUsers"]>(
        async () => [],
      ),
      listPositions: vi.fn<backendInterface["listPositions"]>(async () => []),
      listCrews: vi.fn<backendInterface["listCrews"]>(async () => []),
      listSchedule: vi.fn<backendInterface["listSchedule"]>(async () => []),
    };
  }

  it("shows the pending sign-ups queue to a Store Manager but not pending users", async () => {
    const actor = approvalsActor(Role.storeManager);
    renderPageWithActor(ApprovalsPage, actor, { path: "/approvals" });

    expect(
      await screen.findByTestId("approvals.signups.section"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("approvals.users.section"),
    ).not.toBeInTheDocument();
    // A non-admin must never read the pending-users queue.
    expect(actor.listPendingUsers).not.toHaveBeenCalled();
  });

  it("shows the pending-users section to an admin", async () => {
    const actor = approvalsActor(Role.admin);
    renderPageWithActor(ApprovalsPage, actor, { path: "/approvals" });

    expect(
      await screen.findByTestId("approvals.users.section"),
    ).toBeInTheDocument();
    expect(actor.listPendingUsers).toHaveBeenCalled();
  });
});

describe("roadie card route guard", () => {
  it("rejects a malformed roadie id before BigInt and shows not-found", async () => {
    const actor = {
      getRoadie: vi.fn<backendInterface["getRoadie"]>(async () => null),
      listPositions: vi.fn<backendInterface["listPositions"]>(async () => []),
      listCrews: vi.fn<backendInterface["listCrews"]>(async () => []),
      getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => null),
    };
    renderPageWithActor(RoadieCardPage, actor, {
      path: "/roster/$roadieId",
      initialEntry: "/roster/not-a-number",
    });

    expect(await screen.findByText(t("roadie.notFound"))).toBeInTheDocument();
    // A malformed id is rejected before any backend read.
    expect(actor.getRoadie).not.toHaveBeenCalled();
  });
});

describe("sign out is reachable", () => {
  it("renders a sign-out control in the header", async () => {
    setIdentityForTest({
      identity: {
        getPrincipal: () => ({
          isAnonymous: () => false,
          toText: () => "aaaaa-aa",
        }),
      } as never,
      loginStatus: "success",
      clear: vi.fn(),
    });
    const actor = {
      getMyAccess: vi.fn(async () => null),
      listPendingUsers: vi.fn(async () => []),
    };
    // Layout uses router links, so mount it through the router helper.
    function Shell() {
      return (
        <Layout>
          <div>content</div>
        </Layout>
      );
    }
    renderPageWithActor(Shell, actor, { path: "/" });

    expect(
      await screen.findByTestId("nav.sign_out_button"),
    ).toBeInTheDocument();
  });
});
