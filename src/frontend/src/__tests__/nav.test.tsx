import { renderPageWithActor } from "@/__tests__/router-test-utils";
import type { backendInterface } from "@/backend";
import { Role } from "@/backend";
import { Layout } from "@/components/Layout";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

function actor(role: Role) {
  return {
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: {
        principal: { toText: () => "aaaaa-aa" } as never,
        role,
        approvedAt: 0n,
        approvedBy: { toText: () => "aaaaa-aa" } as never,
        trainerPositionIds: [],
      },
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

/**
 * Characterization of the nav model the new Groups item joins: the four
 * always-visible items render for every read role, and the role-gated items
 * follow their role arrays. The request adds a Groups item for every read role
 * except kiosk and integration; these assertions protect the surrounding
 * gating so that addition cannot silently widen or narrow the existing items.
 */
describe("Layout nav visibility across read roles", () => {
  const READ_ROLES = [
    Role.admin,
    Role.storeManager,
    Role.trainingManager,
    Role.trainer,
    Role.visitingManager,
    Role.leadership,
  ];

  it.each(READ_ROLES)(
    "shows the always-visible items to a %s",
    async (role) => {
      renderPageWithActor(Page, actor(role), { path: "/" });

      expect(await screen.findByTestId("nav.today.link")).toBeInTheDocument();
      expect(screen.getByTestId("nav.dashboard.link")).toBeInTheDocument();
      expect(screen.getByTestId("nav.roster.link")).toBeInTheDocument();
      expect(screen.getByTestId("nav.my-profile.link")).toBeInTheDocument();
    },
  );

  it.each([Role.kiosk, Role.integration])(
    "hides the Leaders link from a %s",
    async (role) => {
      renderPageWithActor(Page, actor(role), { path: "/" });

      expect(await screen.findByTestId("nav.roster.link")).toBeInTheDocument();
      expect(screen.queryByTestId("nav.leaders.link")).not.toBeInTheDocument();
    },
  );

  it.each(READ_ROLES)("shows the Groups link to a %s", async (role) => {
    renderPageWithActor(Page, actor(role), { path: "/" });

    expect(await screen.findByTestId("nav.groups.link")).toBeInTheDocument();
  });

  it.each([Role.kiosk, Role.integration])(
    "hides the Groups link from a %s",
    async (role) => {
      renderPageWithActor(Page, actor(role), { path: "/" });

      expect(await screen.findByTestId("nav.roster.link")).toBeInTheDocument();
      expect(screen.queryByTestId("nav.groups.link")).not.toBeInTheDocument();
    },
  );

  it("shows the Uniforms link to Admin, Store Manager and Training Manager only", async () => {
    for (const role of [Role.admin, Role.storeManager, Role.trainingManager]) {
      const { unmount } = renderPageWithActor(Page, actor(role), {
        path: "/",
      });
      expect(
        await screen.findByTestId("nav.uniforms.link"),
      ).toBeInTheDocument();
      unmount();
    }
    for (const role of [Role.trainer, Role.leadership, Role.kiosk]) {
      const { unmount } = renderPageWithActor(Page, actor(role), {
        path: "/",
      });
      expect(await screen.findByTestId("nav.roster.link")).toBeInTheDocument();
      expect(screen.queryByTestId("nav.uniforms.link")).not.toBeInTheDocument();
      unmount();
    }
  });
});
