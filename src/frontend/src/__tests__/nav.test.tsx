import { renderPageWithActor } from "@/__tests__/router-test-utils";
import type { backendInterface } from "@/backend";
import { Role } from "@/backend";
import { Layout } from "@/components/Layout";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

function actor(role: Role) {
  return {
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      principal: { toText: () => "aaaaa-aa" } as never,
      role,
      approvedAt: 0n,
      approvedBy: { toText: () => "aaaaa-aa" } as never,
      trainerPositionIds: [],
    })),
    listPendingUsers: vi.fn<backendInterface["listPendingUsers"]>(
      async () => [],
    ),
  };
}

function Page() {
  return (
    <Layout>
      <p>content</p>
    </Layout>
  );
}

describe("Layout role-gated navigation", () => {
  it("shows the Admin and Approvals links to an Admin", async () => {
    renderPageWithActor(Page, actor(Role.admin), { path: "/" });

    expect(await screen.findByTestId("nav.admin.link")).toBeInTheDocument();
    expect(screen.getByTestId("nav.approvals.link")).toBeInTheDocument();
  });

  it("hides the Admin link from a Trainer", async () => {
    renderPageWithActor(Page, actor(Role.trainer), { path: "/" });

    // The always-visible roster link renders, but Admin does not.
    expect(await screen.findByTestId("nav.roster.link")).toBeInTheDocument();
    expect(screen.queryByTestId("nav.admin.link")).not.toBeInTheDocument();
  });

  it("shows the Kiosk link to a Kiosk login", async () => {
    renderPageWithActor(Page, actor(Role.kiosk), { path: "/" });

    expect(await screen.findByTestId("nav.kiosk.link")).toBeInTheDocument();
    expect(screen.queryByTestId("nav.admin.link")).not.toBeInTheDocument();
  });
});
