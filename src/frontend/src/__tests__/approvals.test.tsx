import { renderPageWithActor, t } from "@/__tests__/router-test-utils";
import type { SignupSubmission } from "@/backend";
import { House } from "@/backend";
import ApprovalsPage from "@/pages/Approvals";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

/** A pending sign-up whose date of birth makes the applicant a minor. */
function minorSignup(): SignupSubmission {
  const now = Date.now();
  const tenYearsAgo = new Date(now - 10 * 365 * 24 * 60 * 60 * 1000);
  return {
    id: 1n,
    status: { __kind__: "pending", pending: null },
    submittedAt: BigInt(now) * 1_000_000n,
    profile: { name: "Young Applicant" },
    isDemo: false,
    contactSet: {
      email: "young@example.com",
      phone: "+1-555-0199",
      dateOfBirth: BigInt(tenYearsAgo.getTime()) * 1_000_000n,
      emergencyContactName: "Parent",
      emergencyContactPhone: "+1-555-0101",
      availability: [],
      availabilityResignPending: false,
    },
  };
}

function baseActor(signup: SignupSubmission) {
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
        defaultShirts: 3n,
        defaultHats: 2n,
        shirtType: "Polo",
        shirtQty: 2n,
        hatType: "Cap",
        hatQty: 1n,
      },
    ]),
    listCrews: vi.fn(async () => []),
    listSchedule: vi.fn(async () => []),
    findDuplicates: vi.fn(async () => [
      {
        roadieId: 7n,
        name: "Alex Rivera",
        mainPositionName: "Bartender",
        matchedOn: "phone",
        archived: false,
      },
    ]),
  };
}

describe("ApprovalsPage duplicate check and minor block", () => {
  it("flags a duplicate match for a pending sign-up", async () => {
    renderPageWithActor(ApprovalsPage, baseActor(minorSignup()), {
      path: "/approvals",
    });

    expect(
      await screen.findByTestId("approvals.signup.duplicates.list"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        t("approvals.signup.duplicates.row", {
          name: "Alex Rivera",
          position: "Bartender",
          field: t("approvals.signup.duplicates.match.phone"),
        }),
      ),
    ).toBeInTheDocument();
  });

  it("shows no-duplicates when the check finds none", async () => {
    const actor = baseActor(minorSignup());
    actor.findDuplicates = vi.fn(async () => []);
    renderPageWithActor(ApprovalsPage, actor, { path: "/approvals" });

    expect(
      await screen.findByTestId("approvals.signup.duplicates.none"),
    ).toBeInTheDocument();
  });

  it("blocks approving a minor into a position with a higher minimum age", async () => {
    const user = userEvent.setup();
    renderPageWithActor(ApprovalsPage, baseActor(minorSignup()), {
      path: "/approvals",
    });

    // The minor badge is shown for the applicant.
    expect(
      await screen.findByTestId("approvals.signup.minor_badge"),
    ).toBeInTheDocument();

    // Choose the 21+ position; the age block then disables approval.
    await user.click(screen.getByTestId("approvals.signup.main.select"));
    const option = await screen.findByRole("option", { name: "Bartender" });
    await user.click(option);

    expect(
      await screen.findByTestId("approvals.signup.minor.error"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("approvals.signup.approve_button"),
    ).toBeDisabled();
  });
});
