import { renderPageWithActor, t } from "@/__tests__/router-test-utils";
import type { Position, SignupSubmission, backendInterface } from "@/backend";
import { House } from "@/backend";
import ApprovalsPage from "@/pages/Approvals";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

/**
 * Characterization baseline for the Main position select on a pending kiosk
 * sign-up card, protecting the behavior the pre-fill change must not disturb:
 * the select starts on its "Select a position" placeholder, the manager can
 * still choose a position by hand, and the chosen position is carried into the
 * approval decision. These tests deliberately do NOT assert the new pre-fill
 * from the applicant's Position applied for; that is the intentional change.
 */

const SERVERS: Position = {
  id: 10n,
  name: "Servers",
  code: "SRV",
  house: House.foh,
  openingBuildTo: 2n,
  afterOpeningBuildTo: 1n,
  minimumAge: 18n,
  needsAlcoholCert: false,
  shirtType: "Polo",
  shirtQty: 2n,
  hatType: "Cap",
  hatQty: 1n,
  defaultShirts: 2n,
  defaultHats: 1n,
};

const BARTENDER: Position = {
  id: 11n,
  name: "Bartender",
  code: "BAR",
  house: House.foh,
  openingBuildTo: 2n,
  afterOpeningBuildTo: 1n,
  minimumAge: 18n,
  needsAlcoholCert: true,
  shirtType: "Polo",
  shirtQty: 2n,
  hatType: "Cap",
  hatQty: 1n,
  defaultShirts: 2n,
  defaultHats: 1n,
};

/** A pending sign-up that is a clear adult, so no age gate interferes. */
function adultSignup(): SignupSubmission {
  const now = Date.now();
  const twentyFiveYearsAgo = new Date(now - 25 * 365 * 24 * 60 * 60 * 1000);
  return {
    id: 1n,
    status: { __kind__: "pending", pending: null },
    submittedAt: BigInt(now) * 1_000_000n,
    profile: { name: "Adult Applicant" },
    isDemo: false,
    contactSet: {
      email: "adult@example.com",
      phone: "+1-555-0100",
      dateOfBirth: BigInt(twentyFiveYearsAgo.getTime()) * 1_000_000n,
      emergencyContactName: "Emergency",
      emergencyContactPhone: "+1-555-0101",
      availability: [],
      availabilityResignPending: false,
    },
  };
}

/** The actor methods the approvals page tree reads for these journeys. */
function approvalsActor() {
  return {
    listPendingUsers: vi.fn<backendInterface["listPendingUsers"]>(
      async () => [],
    ),
    listPendingSignups: vi.fn<backendInterface["listPendingSignups"]>(
      async () => [adultSignup()],
    ),
    listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
      SERVERS,
      BARTENDER,
    ]),
    listCrewSummaries: vi.fn<backendInterface["listCrewSummaries"]>(
      async () => [],
    ),
    listSchedule: vi.fn<backendInterface["listSchedule"]>(async () => []),
    findDuplicates: vi.fn<backendInterface["findDuplicates"]>(async () => []),
    approveSignup: vi.fn<backendInterface["approveSignup"]>(async () => 0n),
  };
}

describe("Approvals Main position select: adjacent behavior", () => {
  it("starts on the Select a position placeholder", async () => {
    renderPageWithActor(ApprovalsPage, approvalsActor(), {
      path: "/approvals",
    });

    const select = await screen.findByTestId("approvals.signup.main.select");
    await waitFor(() =>
      expect(select).toHaveTextContent(t("approvals.signup.main.placeholder")),
    );
  });

  it("lets the manager choose a position by hand", async () => {
    const user = userEvent.setup();
    renderPageWithActor(ApprovalsPage, approvalsActor(), {
      path: "/approvals",
    });

    const select = await screen.findByTestId("approvals.signup.main.select");
    await user.click(select);
    await user.click(await screen.findByRole("option", { name: "Bartender" }));

    await waitFor(() => expect(select).toHaveTextContent("Bartender"));
  });

  it("carries the hand-chosen position into the approval decision", async () => {
    const user = userEvent.setup();
    const actor = approvalsActor();
    renderPageWithActor(ApprovalsPage, actor, { path: "/approvals" });

    await user.click(await screen.findByTestId("approvals.signup.main.select"));
    await user.click(await screen.findByRole("option", { name: "Bartender" }));

    // Draw a stroke on the manager signature pad so approval is unblocked.
    const ctx = {
      scale: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      clearRect: vi.fn(),
      drawImage: vi.fn(),
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
        const bytes = new Uint8Array([1, 2, 3, 4]);
        const blob = {
          arrayBuffer: async () => bytes.buffer,
        } as unknown as Blob;
        callback(blob);
      },
    );
    const { fireEvent } = await import("@testing-library/react");
    const canvas = await screen.findByTestId(
      "approvals.signup.signature.canvas_target",
    );
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 40, clientY: 40 });
    fireEvent.pointerUp(canvas, { pointerId: 1 });

    await user.click(screen.getByTestId("approvals.signup.approve_button"));

    await waitFor(() => expect(actor.approveSignup).toHaveBeenCalledTimes(1));
    const [id, decision] = actor.approveSignup.mock.calls[0] ?? [];
    expect(id).toBe(1n);
    expect(decision?.mainPositionId).toBe(11n);
  });
});
