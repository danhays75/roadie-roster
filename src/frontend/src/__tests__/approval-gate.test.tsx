import { renderWithActor } from "@/__tests__/test-utils";
import type { AccessGrant, backendInterface } from "@/backend";
import { Role } from "@/backend";
import { ApprovalGate } from "@/components/ApprovalGate";
import { I18nContext, translate } from "@/hooks/useI18n";
import type { Locale } from "@/lib/copy";
import type { Principal } from "@icp-sdk/core/principal";
import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const PRINCIPAL = { toText: () => "aaaaa-aa" } as unknown as Principal;

function grant(role: Role): AccessGrant {
  return {
    principal: PRINCIPAL,
    role,
    approvedAt: 0n,
    approvedBy: PRINCIPAL,
    trainerPositionIds: [],
  };
}

const t = (key: string, vars?: Record<string, string | number>) =>
  translate("en" as Locale, key, vars);

function wrap(ui: React.ReactElement) {
  return (
    <I18nContext.Provider value={{ locale: "en", setLocale: vi.fn(), t }}>
      {ui}
    </I18nContext.Provider>
  );
}

describe("ApprovalGate", () => {
  it("shows the waiting-for-approval screen for a signed-in user without a grant", async () => {
    const getMyAccess = vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: undefined,
    }));
    const requestAccess = vi.fn<backendInterface["requestAccess"]>(
      async () => false,
    );

    renderWithActor(wrap(<ApprovalGate />), {
      getMyAccess,
      requestAccess,
    } satisfies Pick<backendInterface, "getMyAccess" | "requestAccess">);

    expect(await screen.findByTestId("gate.pending_state")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: t("gate.pending.title") }),
    ).toBeInTheDocument();
    // The gate registers the caller for approval exactly once.
    await waitFor(() => expect(requestAccess).toHaveBeenCalledTimes(1));
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

  it("persists the first admin's grant by bootstrapping once for a signed-in caller", async () => {
    const getMyAccess = vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: undefined,
    }));
    const requestAccess = vi.fn<backendInterface["requestAccess"]>(
      async () => false,
    );
    const bootstrapAdmin = vi.fn<backendInterface["bootstrapAdmin"]>(
      async () => true,
    );

    renderWithActor(wrap(<ApprovalGate />), {
      getMyAccess,
      requestAccess,
      bootstrapAdmin,
    } satisfies Pick<
      backendInterface,
      "getMyAccess" | "requestAccess" | "bootstrapAdmin"
    >);

    await screen.findByTestId("gate.pending_state");
    // The gate bridges the platform admin grant into the app model exactly once.
    await waitFor(() => expect(bootstrapAdmin).toHaveBeenCalledTimes(1));
  });

  it("waits for the backend actor before bootstrapping the first admin", async () => {
    const bootstrapAdmin = vi.fn<backendInterface["bootstrapAdmin"]>(
      async () => true,
    );

    // No actor yet: the gate must not fire bootstrapAdmin while the backend
    // connection is still initializing, or the call is lost.
    renderWithActor(
      wrap(<ApprovalGate />),
      null as unknown as Pick<
        backendInterface,
        "getMyAccess" | "requestAccess" | "bootstrapAdmin"
      >,
    );

    await screen.findByTestId("gate.pending_state");
    expect(bootstrapAdmin).not.toHaveBeenCalled();
  });

  it("renders the app chrome for a caller who already holds a grant", async () => {
    const getMyAccess = vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: grant(Role.admin),
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
    expect(screen.queryByTestId("gate.pending_state")).not.toBeInTheDocument();
    // A granted caller never registers a pending access request.
    expect(requestAccess).not.toHaveBeenCalled();
  });
});
