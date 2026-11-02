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
 * Cover for the accepted profile-gate change:
 *  - only leader roles see the "Tell us who you are" form; a granted kiosk or
 *    integration user with no profile goes straight to the app;
 *  - the pending role dropdown offers "Store tablet (kiosk)" and submitting it
 *    skips the rest of the form;
 *  - a pending user whose request already carries a profile (getMyPendingRequest
 *    reports hasProfile) goes straight to the waiting screen after a reload.
 *
 * The backend is a typed local actor mock; no canister or identity is contacted.
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

describe("ApprovalGate: profile form is limited to leader roles", () => {
  it("sends a granted kiosk user with no profile straight to the app", async () => {
    const getMyAccess = vi.fn<backendInterface["getMyAccess"]>(async () =>
      grant(Role.kiosk),
    );
    const requestAccess = vi.fn<backendInterface["requestAccess"]>(
      async () => false,
    );
    const bootstrapAdmin = vi.fn<backendInterface["bootstrapAdmin"]>(
      async () => false,
    );

    renderWithActor(
      wrap(
        <ApprovalGate>
          <p>kiosk welcome</p>
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

    expect(await screen.findByText("kiosk welcome")).toBeInTheDocument();
    expect(screen.queryByTestId("gate.profile_state")).not.toBeInTheDocument();
    expect(screen.queryByTestId("gate.pending_state")).not.toBeInTheDocument();
  });

  it("sends a granted integration user with no profile straight to the app", async () => {
    const getMyAccess = vi.fn<backendInterface["getMyAccess"]>(async () =>
      grant(Role.integration),
    );
    const requestAccess = vi.fn<backendInterface["requestAccess"]>(
      async () => false,
    );
    const bootstrapAdmin = vi.fn<backendInterface["bootstrapAdmin"]>(
      async () => false,
    );

    renderWithActor(
      wrap(
        <ApprovalGate>
          <p>integration app</p>
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

    expect(await screen.findByText("integration app")).toBeInTheDocument();
    expect(screen.queryByTestId("gate.profile_state")).not.toBeInTheDocument();
  });

  it("still shows the profile form to a granted leader with no profile", async () => {
    const getMyAccess = vi.fn<backendInterface["getMyAccess"]>(async () =>
      grant(Role.storeManager),
    );
    const requestAccess = vi.fn<backendInterface["requestAccess"]>(
      async () => false,
    );
    const bootstrapAdmin = vi.fn<backendInterface["bootstrapAdmin"]>(
      async () => false,
    );
    const updateMyStaffProfile = vi.fn<
      backendInterface["updateMyStaffProfile"]
    >(async () => {});

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
        updateMyStaffProfile,
      } satisfies Pick<
        backendInterface,
        | "getMyAccess"
        | "requestAccess"
        | "bootstrapAdmin"
        | "updateMyStaffProfile"
      >,
    );

    expect(await screen.findByTestId("gate.profile_state")).toBeInTheDocument();
    expect(screen.queryByText("app chrome")).not.toBeInTheDocument();
  });
});

describe("ApprovalGate: pending user with a profile skips the form after reload", () => {
  it("goes straight to the waiting screen when getMyPendingRequest reports hasProfile", async () => {
    const getMyAccess = vi.fn<backendInterface["getMyAccess"]>(
      async () => null,
    );
    const requestAccess = vi.fn<backendInterface["requestAccess"]>(
      async () => false,
    );
    const bootstrapAdmin = vi.fn<backendInterface["bootstrapAdmin"]>(
      async () => false,
    );
    const getMyPendingRequest = vi.fn<backendInterface["getMyPendingRequest"]>(
      async () => ({
        requestedAt: 1_700_000_000_000_000_000n,
        hasProfile: true,
      }),
    );

    renderWithActor(wrap(<ApprovalGate />), {
      getMyAccess,
      requestAccess,
      bootstrapAdmin,
      getMyPendingRequest,
    } satisfies Pick<
      backendInterface,
      "getMyAccess" | "requestAccess" | "bootstrapAdmin" | "getMyPendingRequest"
    >);

    expect(await screen.findByTestId("gate.pending_state")).toBeInTheDocument();
    expect(screen.queryByTestId("gate.profile_state")).not.toBeInTheDocument();
  });

  it("still shows the profile form when the pending request has no profile", async () => {
    const getMyAccess = vi.fn<backendInterface["getMyAccess"]>(
      async () => null,
    );
    const requestAccess = vi.fn<backendInterface["requestAccess"]>(
      async () => false,
    );
    const bootstrapAdmin = vi.fn<backendInterface["bootstrapAdmin"]>(
      async () => false,
    );
    const getMyPendingRequest = vi.fn<backendInterface["getMyPendingRequest"]>(
      async () => ({
        requestedAt: 1_700_000_000_000_000_000n,
        hasProfile: false,
      }),
    );

    renderWithActor(wrap(<ApprovalGate />), {
      getMyAccess,
      requestAccess,
      bootstrapAdmin,
      getMyPendingRequest,
    } satisfies Pick<
      backendInterface,
      "getMyAccess" | "requestAccess" | "bootstrapAdmin" | "getMyPendingRequest"
    >);

    expect(await screen.findByTestId("gate.profile_state")).toBeInTheDocument();
    expect(screen.queryByTestId("gate.pending_state")).not.toBeInTheDocument();
  });
});

describe("StaffProfileForm: kiosk role skips the rest of the form", () => {
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

  it("offers the Store tablet (kiosk) choice in the role dropdown", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByTestId("profile.role.select"));

    expect(
      await screen.findByRole("option", { name: t("profile.role.kiosk") }),
    ).toBeInTheDocument();
  });

  it("hides the remaining fields once kiosk is chosen", async () => {
    const user = userEvent.setup();
    renderForm();

    // The full-name field is present before choosing kiosk.
    expect(screen.getByTestId("profile.full_name.input")).toBeInTheDocument();

    await user.click(screen.getByTestId("profile.role.select"));
    await user.click(
      await screen.findByRole("option", { name: t("profile.role.kiosk") }),
    );

    expect(
      screen.queryByTestId("profile.full_name.input"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("profile.title.input")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("profile.home_store_number.input"),
    ).not.toBeInTheDocument();
  });

  it("submits a kiosk request without filling the rest of the form", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderForm(onSubmit);

    await user.click(screen.getByTestId("profile.role.select"));
    await user.click(
      await screen.findByRole("option", { name: t("profile.role.kiosk") }),
    );
    await user.click(screen.getByTestId("profile.submit_button"));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const submitted = onSubmit.mock.calls[0]?.[0] as StaffProfile;
    expect(submitted.requestedRole).toBe(Role.kiosk);
    // No validation error blocks the kiosk submission.
    expect(screen.queryByTestId("profile.error_state")).not.toBeInTheDocument();
  });
});
