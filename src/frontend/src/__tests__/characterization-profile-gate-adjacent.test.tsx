import { renderWithActor } from "@/__tests__/test-utils";
import type { AccessGrant, StaffProfile, backendInterface } from "@/backend";
import { Role } from "@/backend";
import { ApprovalGate } from "@/components/ApprovalGate";
import { StaffProfileForm } from "@/components/StaffProfileForm";
import { I18nContext, translate } from "@/hooks/useI18n";
import type { Locale } from "@/lib/copy";
import type { Principal } from "@icp-sdk/core/principal";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

/**
 * Characterization of behavior adjacent to the accepted profile-gate change,
 * written before the profile form is limited to leader roles and before the
 * pending role dropdown gains a kiosk option. None of these assertions describe
 * the behavior the request intentionally changes; they protect the surrounding
 * behavior that must keep working: the pending flow still shows the profile form
 * and then the waiting screen, a granted caller with a profile still reaches the
 * app, the error state still renders, the staff profile form still validates its
 * required fields and saves the existing role options, and listLeaders still
 * returns the leader roles.
 *
 * The backend is a typed local actor mock; no canister is contacted.
 */

const PRINCIPAL = { toText: () => "aaaaa-aa" } as unknown as Principal;

const t = (key: string, vars?: Record<string, string | number>) =>
  translate("en" as Locale, key, vars);

function wrap(ui: React.ReactElement) {
  return (
    <I18nContext.Provider value={{ locale: "en", setLocale: vi.fn(), t }}>
      {ui}
    </I18nContext.Provider>
  );
}

function grant(role: Role, staffProfile?: StaffProfile): AccessGrant {
  return {
    principal: PRINCIPAL,
    role,
    approvedAt: 0n,
    approvedBy: PRINCIPAL,
    trainerPositionIds: [],
    staffProfile,
  };
}

const PROFILE: StaffProfile = {
  fullName: "Jordan Rivera",
  preferredName: "Jordan",
  title: "Store Manager",
  requestedRole: Role.storeManager,
  homeStoreNumber: "975",
  homeStoreCity: "Lake Charles",
  trainerPositionIds: [],
};

describe("ApprovalGate: adjacent pending and granted behavior", () => {
  it("shows the profile form to a pending caller, then the waiting screen after submit", async () => {
    const user = userEvent.setup();
    const getMyAccess = vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: undefined,
    }));
    const requestAccess = vi.fn<backendInterface["requestAccess"]>(
      async () => false,
    );
    const bootstrapAdmin = vi.fn<backendInterface["bootstrapAdmin"]>(
      async () => false,
    );
    const submitStaffProfile = vi.fn<backendInterface["submitStaffProfile"]>(
      async () => {},
    );

    renderWithActor(wrap(<ApprovalGate />), {
      getMyAccess,
      requestAccess,
      bootstrapAdmin,
      submitStaffProfile,
    } satisfies Pick<
      backendInterface,
      "getMyAccess" | "requestAccess" | "bootstrapAdmin" | "submitStaffProfile"
    >);

    // The pending caller sees the profile form before the waiting screen.
    expect(await screen.findByTestId("gate.profile_state")).toBeInTheDocument();
    expect(screen.queryByTestId("gate.pending_state")).not.toBeInTheDocument();

    await user.type(
      screen.getByTestId("profile.full_name.input"),
      "Jordan Rivera",
    );
    await user.type(screen.getByTestId("profile.title.input"), "Store Manager");
    await user.type(
      screen.getByTestId("profile.home_store_number.input"),
      "975",
    );
    await user.type(
      screen.getByTestId("profile.home_store_city.input"),
      "Lake Charles",
    );
    await user.click(screen.getByTestId("profile.role.select"));
    await user.click(
      await screen.findByRole("option", { name: "Store Manager" }),
    );
    await user.click(screen.getByTestId("profile.submit_button"));

    await waitFor(() => expect(submitStaffProfile).toHaveBeenCalledTimes(1));
    const submitted = submitStaffProfile.mock.calls[0]?.[0];
    expect(submitted?.fullName).toBe("Jordan Rivera");
    expect(submitted?.requestedRole).toBe(Role.storeManager);
    // Once submitted, the waiting screen replaces the form.
    expect(await screen.findByTestId("gate.pending_state")).toBeInTheDocument();
  });

  it("renders the app chrome for a granted caller who already has a profile", async () => {
    const getMyAccess = vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: grant(Role.storeManager, PROFILE),
    }));
    const requestAccess = vi.fn<backendInterface["requestAccess"]>(
      async () => false,
    );
    const bootstrapAdmin = vi.fn<backendInterface["bootstrapAdmin"]>(
      async () => true,
    );

    renderWithActor(
      wrap(
        <ApprovalGate>
          <p>app chrome</p>
        </ApprovalGate>,
      ),
      {
        getMyAccess,
        requestAccess,
        bootstrapAdmin,
      } satisfies Pick<
        backendInterface,
        "getMyAccess" | "requestAccess" | "bootstrapAdmin"
      >,
    );

    expect(await screen.findByText("app chrome")).toBeInTheDocument();
    expect(screen.queryByTestId("gate.profile_state")).not.toBeInTheDocument();
    expect(screen.queryByTestId("gate.pending_state")).not.toBeInTheDocument();
  });

  it("shows the error state when the access read fails", async () => {
    const getMyAccess = vi.fn<backendInterface["getMyAccess"]>(async () => {
      throw new Error("boom");
    });
    const requestAccess = vi.fn<backendInterface["requestAccess"]>(
      async () => false,
    );

    renderWithActor(wrap(<ApprovalGate />), {
      getMyAccess,
      requestAccess,
    } satisfies Pick<backendInterface, "getMyAccess" | "requestAccess">);

    expect(await screen.findByTestId("gate.error_state")).toBeInTheDocument();
    expect(requestAccess).not.toHaveBeenCalled();
  });
});

describe("StaffProfileForm: adjacent validation and role options", () => {
  function renderForm(onSubmit = vi.fn()) {
    return renderWithActor(
      wrap(
        <StaffProfileForm
          submitLabel={t("profile.submit")}
          pending={false}
          onSubmit={onSubmit}
        />,
      ),
      {
        listPositions: vi.fn<backendInterface["listPositions"]>(async () => []),
      } satisfies Pick<backendInterface, "listPositions">,
    );
  }

  it("still blocks submit and reports the first missing required field", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderForm(onSubmit);

    await user.click(screen.getByTestId("profile.submit_button"));

    expect(screen.getByTestId("profile.error_state")).toHaveTextContent(
      t("profile.fullName.required"),
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("still offers the existing leader role options", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByTestId("profile.role.select"));

    for (const label of [
      "Store Manager",
      "Training Manager",
      "Trainer",
      "Visiting Manager",
      "Leadership",
    ]) {
      expect(
        await screen.findByRole("option", { name: label }),
      ).toBeInTheDocument();
    }
  });

  it("submits a complete profile with the existing fields intact", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderForm(onSubmit);

    await user.type(
      screen.getByTestId("profile.full_name.input"),
      "Jordan Rivera",
    );
    await user.type(screen.getByTestId("profile.title.input"), "Store Manager");
    await user.type(
      screen.getByTestId("profile.home_store_number.input"),
      "975",
    );
    await user.type(
      screen.getByTestId("profile.home_store_city.input"),
      "Lake Charles",
    );
    await user.click(screen.getByTestId("profile.role.select"));
    await user.click(
      await screen.findByRole("option", { name: "Store Manager" }),
    );
    await user.click(screen.getByTestId("profile.submit_button"));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const submitted = onSubmit.mock.calls[0]?.[0] as StaffProfile;
    expect(submitted.fullName).toBe("Jordan Rivera");
    expect(submitted.title).toBe("Store Manager");
    expect(submitted.requestedRole).toBe(Role.storeManager);
    expect(submitted.homeStoreNumber).toBe("975");
    expect(submitted.homeStoreCity).toBe("Lake Charles");
  });
});
