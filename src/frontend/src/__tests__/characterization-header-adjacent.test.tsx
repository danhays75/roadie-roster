import { renderPageWithActor, t } from "@/__tests__/router-test-utils";
import type { DemoStateView, backendInterface } from "@/backend";
import { Role } from "@/backend";
import { Layout } from "@/components/Layout";
import { NAV_ITEMS } from "@/hooks/useAccess";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

/**
 * Characterization of the header behavior the desktop two-row change must not
 * disturb. The request moves the desktop navigation onto its own full-width row
 * beneath the logo/title/subtitle; these assertions protect the surrounding
 * behavior that stays the same:
 *
 *   - the mobile hamburger menu still opens and closes and shows the links,
 *   - the demo banner still renders above the header,
 *   - the navigation order and labels are unchanged,
 *   - the active page is still highlighted,
 *   - the logo, title and subtitle still render in the header home link.
 *
 * The desktop row layout itself is intentionally changing, so it is not
 * asserted here.
 */

const PRINCIPAL = { toText: () => "aaaaa-aa" } as never;

function grant(role: Role) {
  return {
    principal: PRINCIPAL,
    approvedAt: 0n,
    approvedBy: PRINCIPAL,
    role,
    trainerPositionIds: [],
  };
}

function demoState(overrides: Partial<DemoStateView> = {}): DemoStateView {
  return {
    enabled: false,
    demoTrainerStations: [],
    ...overrides,
  };
}

/** The actor the Layout tree reads: access, the two pending queues, demo state. */
function headerActor(role: Role, demo: DemoStateView = demoState()) {
  return {
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: grant(role),
    })),
    listPendingUsers: vi.fn<backendInterface["listPendingUsers"]>(
      async () => [],
    ),
    listPendingSignups: vi.fn<backendInterface["listPendingSignups"]>(
      async () => [],
    ),
    getDemoState: vi.fn<backendInterface["getDemoState"]>(async () => demo),
  };
}

function Page() {
  return (
    <Layout>
      <p>content</p>
    </Layout>
  );
}

/** The mobile menu panel, identified by its own Sign out control. */
function mobilePanel(): HTMLElement {
  const mobileSignOut = screen.getByTestId("nav.sign_out_button.mobile");
  const panel = mobileSignOut.closest("div");
  if (!panel) throw new Error("mobile menu panel not found");
  return panel;
}

describe("header: mobile hamburger menu", () => {
  it("opens the menu and reveals the navigation links, then closes it", async () => {
    const user = userEvent.setup();
    renderPageWithActor(Page, headerActor(Role.admin), { path: "/" });

    const toggle = await screen.findByTestId("nav.menu.toggle");
    // The menu starts closed: the toggle reports collapsed and the mobile
    // Sign out control is not mounted.
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByTestId("nav.sign_out_button.mobile"),
    ).not.toBeInTheDocument();

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    // The mobile panel renders the nav links and its own Sign out control.
    const panel = mobilePanel();
    expect(within(panel).getByTestId("nav.roster.link")).toBeInTheDocument();
    expect(within(panel).getByTestId("nav.today.link")).toBeInTheDocument();

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByTestId("nav.sign_out_button.mobile"),
    ).not.toBeInTheDocument();
  });

  it("closes the mobile menu after a navigation link is chosen", async () => {
    const user = userEvent.setup();
    renderPageWithActor(Page, headerActor(Role.admin), { path: "/" });

    const toggle = await screen.findByTestId("nav.menu.toggle");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    await user.click(within(mobilePanel()).getByTestId("nav.roster.link"));

    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
});

describe("header: demo banner stays above the header", () => {
  it("renders the demo banner before the header in document order", async () => {
    renderPageWithActor(
      Page,
      headerActor(Role.admin, demoState({ enabled: true })),
      { path: "/" },
    );

    const banner = await screen.findByTestId("demo.banner");
    const home = await screen.findByTestId("header.home_link");
    // The banner precedes the header in the DOM, so it stays above it.
    expect(
      banner.compareDocumentPosition(home) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe("header: navigation order and labels", () => {
  it("renders the visible nav links in the accepted desktop order for an Admin", async () => {
    renderPageWithActor(Page, headerActor(Role.admin), { path: "/" });

    // Wait for the role-gated items to render once the access grant resolves.
    await screen.findByTestId("nav.uniforms.link");
    const nav = screen.getByRole("navigation", { name: "Primary" });
    const links = within(nav).getAllByRole("link");
    // The accepted desktop order, applied by the NAV_ORDER sort in Layout.
    const expected = [
      "/today",
      "/dashboard",
      "/roster",
      "/groups",
      "/orientation",
      "/approvals",
      "/leaders",
      "/uniforms",
      "/gift-bags",
      "/export",
      "/kiosk",
      "/my-profile",
      "/admin",
    ];
    expect(links.map((link) => link.getAttribute("href"))).toEqual(expected);
  });

  it("renders each visible nav label on its own link", async () => {
    renderPageWithActor(Page, headerActor(Role.admin), { path: "/" });

    await screen.findByTestId("nav.uniforms.link");
    const nav = screen.getByRole("navigation", { name: "Primary" });
    // Every nav item is present with its translated label.
    for (const item of NAV_ITEMS) {
      const link = within(nav).getByTestId(
        `nav.${item.to.replace("/", "")}.link`,
      );
      expect(link).toHaveTextContent(t(item.labelKey));
    }
  });
});

describe("header: active page highlight", () => {
  it("marks the current route's link as active and leaves others inactive", async () => {
    renderPageWithActor(Page, headerActor(Role.admin), { path: "/roster" });

    await screen.findByTestId("nav.uniforms.link");
    const nav = screen.getByRole("navigation", { name: "Primary" });
    const active = within(nav).getByTestId("nav.roster.link");
    const inactive = within(nav).getByTestId("nav.today.link");

    // The active link carries the solid highlight; the inactive one only has
    // the hover variant.
    expect(active.className).toContain("bg-white/10 text-white");
    expect(inactive.className).toContain("text-white/75");
    expect(inactive.className).not.toContain("bg-white/10 text-white");
  });
});

describe("header: logo, title and subtitle", () => {
  it("renders the store logo, title and subtitle inside the home link", async () => {
    renderPageWithActor(Page, headerActor(Role.admin), { path: "/" });

    const home = await screen.findByTestId("header.home_link");
    expect(within(home).getByTestId("store.logo")).toBeInTheDocument();
    expect(home).toHaveTextContent("Roadie Roster");
    expect(home).toHaveTextContent("Restaurant crew hiring roster");
  });
});

/**
 * Cover for the accepted desktop two-row header. jsdom has no real layout, so
 * these assert the structural contract the change introduces: the brand row
 * holds the logo/title/subtitle with Sign out on the right, the desktop
 * navigation sits in its own row beneath it, the labels are single-line, and
 * the row scrolls horizontally with an edge fade. The mobile hamburger and the
 * demo banner above the header are protected in the characterization blocks
 * above.
 */
describe("header: desktop two-row layout", () => {
  it("puts the brand row above the desktop navigation row", async () => {
    renderPageWithActor(Page, headerActor(Role.admin), { path: "/" });

    const home = await screen.findByTestId("header.home_link");
    const nav = screen.getByRole("navigation", { name: "Primary" });
    // The brand home link precedes the navigation in document order, so the
    // navigation renders on a row beneath the logo, title and subtitle.
    expect(
      home.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("keeps the desktop Sign out control in the brand row, not the nav row", async () => {
    renderPageWithActor(Page, headerActor(Role.admin), { path: "/" });

    const home = await screen.findByTestId("header.home_link");
    const signOut = screen.getByTestId("nav.sign_out_button");
    const nav = screen.getByRole("navigation", { name: "Primary" });
    // Sign out shares the brand row with the home link and is not inside the
    // navigation row.
    expect(home.compareDocumentPosition(signOut)).toBeTruthy();
    expect(nav.contains(signOut)).toBe(false);
  });

  it("renders every desktop nav label on a single line", async () => {
    renderPageWithActor(Page, headerActor(Role.admin), { path: "/" });

    await screen.findByTestId("nav.uniforms.link");
    const nav = screen.getByRole("navigation", { name: "Primary" });
    for (const item of NAV_ITEMS) {
      const link = within(nav).getByTestId(
        `nav.${item.to.replace("/", "")}.link`,
      );
      // The accepted requirement: labels never wrap.
      expect(link.className).toContain("whitespace-nowrap");
    }
  });

  it("wraps the desktop navigation in a horizontally scrolling row with an edge fade", async () => {
    renderPageWithActor(Page, headerActor(Role.admin), { path: "/" });

    const nav = await screen.findByRole("navigation", { name: "Primary" });
    // The nav sits inside an overflow-x-auto scroller so the row scrolls
    // horizontally instead of wrapping.
    const scroller = nav.closest(".overflow-x-auto");
    expect(scroller).not.toBeNull();
    // The scroller's row also carries the subtle right-edge fade overlay.
    const row = scroller?.parentElement;
    expect(row?.querySelector(".bg-gradient-to-l")).not.toBeNull();
  });

  it("keeps the Approve New Hires count badge on its link", async () => {
    const actor = headerActor(Role.admin);
    actor.listPendingSignups = vi.fn<backendInterface["listPendingSignups"]>(
      async () => [{ id: 1n }, { id: 2n }] as never,
    );
    renderPageWithActor(Page, actor, { path: "/" });

    const badge = await screen.findByTestId("nav.approvals.badge");
    expect(badge).toHaveTextContent("2");
    const link = screen.getByTestId("nav.approvals.link");
    expect(link.contains(badge)).toBe(true);
  });
});
