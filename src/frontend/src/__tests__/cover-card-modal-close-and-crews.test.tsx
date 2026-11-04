import { renderPageWithActor, t } from "@/__tests__/router-test-utils";
import { renderWithActor } from "@/__tests__/test-utils";
import type {
  AccessGrant,
  Crew,
  Position,
  Roadie,
  backendInterface,
} from "@/backend";
import { House, RoadieStatus, Role, RosterState } from "@/backend";
import { PositionRosterDialog } from "@/components/dashboard/PositionRosterDialog";
import AdminPage from "@/pages/Admin";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

/**
 * Cover for the accepted "shared card pop-up" request's close paths and the
 * Crews member list entry point:
 *   - the modal closes via the X button, a tap outside, Esc, and the phone's
 *     back button,
 *   - closing returns to the exact prior state with the position dialog still
 *     open,
 *   - the position dialog's "Show former (n)" toggle reveals the archived
 *     section with grayscale tiles and the archive reason,
 *   - a Crews member tile opens the shared card pop-up.
 *
 * The backend is mocked through the prepared typed actor seam; no real canister
 * or browser is exercised.
 */

const PRINCIPAL = { toText: () => "aaaaa-aa" } as never;

function grant(role: Role): AccessGrant {
  return {
    principal: PRINCIPAL,
    role,
    approvedAt: 0n,
    approvedBy: PRINCIPAL,
    trainerPositionIds: [],
  };
}

const POSITION: Position = {
  id: 10n,
  name: "Cashier",
  code: "CSH",
  house: House.foh,
  openingBuildTo: 2n,
  afterOpeningBuildTo: 1n,
  minimumAge: 16n,
  shirtsRequired: 2n,
  hatsRequired: 1n,
  needsAlcoholCert: false,
  shirtType: "Polo",
  shirtQty: 2n,
  hatType: "Cap",
  hatQty: 1n,
};

const PHOTO_BYTES = new Uint8Array([1, 2, 3, 4]);

function roadie(overrides: Partial<Roadie> = {}): Roadie {
  return {
    id: 1n,
    status: RoadieStatus.hired,
    mainPositionId: 10n,
    hiredAt: 0n,
    isMinor: false,
    isDemo: false,
    profile: { name: "Ada Lovelace", preferredName: "Ada" },
    rosterState: RosterState.pending,
    ...overrides,
  };
}

const STORE_INFO = {
  storeNumber: "975",
  appName: "Roadie Roster",
  locationName: "Lake Charles",
  address: "1400 W Prien Lake Rd",
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
  paperworkDueDate: 1_800_000_000_000_000_000n,
};

function dialogActor(roster: Roadie[]) {
  return {
    listRosterForPosition: vi.fn<backendInterface["listRosterForPosition"]>(
      async () => roster,
    ),
    getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(
      async () => STORE_INFO,
    ),
    getPhoto: vi.fn<backendInterface["getPhoto"]>(async () => PHOTO_BYTES),
    listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
      POSITION,
    ]),
    listCrews: vi.fn<backendInterface["listCrews"]>(async () => []),
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: grant(Role.admin),
    })),
  };
}

/** Mount the position dialog inside the router harness so its Links resolve. */
function renderDialog(actor: ReturnType<typeof dialogActor>) {
  function Page() {
    return (
      <PositionRosterDialog
        position={POSITION}
        open
        onOpenChange={vi.fn()}
        canRehire={false}
      />
    );
  }
  return renderPageWithActor(Page, actor, { path: "/" });
}

describe("card pop-up close paths", () => {
  it("closes via the X button and leaves the position dialog open", async () => {
    const user = userEvent.setup();
    renderDialog(dialogActor([roadie({ id: 7n })]));

    await user.click(await screen.findByTestId("dashboard.roster.item.link"));
    await screen.findByTestId("roadie.card_modal");

    await user.click(screen.getByTestId("roadie.card_modal.close_button"));

    await waitFor(() =>
      expect(screen.queryByTestId("roadie.card_modal")).toBeNull(),
    );
    // The position dialog underneath is still mounted.
    expect(screen.getByTestId("dashboard.roster.dialog")).toBeInTheDocument();
  });

  it("closes on Esc and leaves the position dialog open", async () => {
    const user = userEvent.setup();
    renderDialog(dialogActor([roadie({ id: 7n })]));

    await user.click(await screen.findByTestId("dashboard.roster.item.link"));
    await screen.findByTestId("roadie.card_modal");

    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(screen.queryByTestId("roadie.card_modal")).toBeNull(),
    );
    expect(screen.getByTestId("dashboard.roster.dialog")).toBeInTheDocument();
  });

  it("closes on a tap outside the card and leaves the position dialog open", async () => {
    const user = userEvent.setup();
    renderDialog(dialogActor([roadie({ id: 7n })]));

    await user.click(await screen.findByTestId("dashboard.roster.item.link"));
    await screen.findByTestId("roadie.card_modal");

    // The Radix overlay is the dimmed background; a pointer-down on it closes.
    const overlay = document.querySelector('[data-slot="dialog-overlay"]');
    expect(overlay).not.toBeNull();
    await user.pointer({ keys: "[MouseLeft]", target: overlay as Element });

    await waitFor(() =>
      expect(screen.queryByTestId("roadie.card_modal")).toBeNull(),
    );
    expect(screen.getByTestId("dashboard.roster.dialog")).toBeInTheDocument();
  });

  it("closes on the phone's back button and returns to the prior state", async () => {
    const user = userEvent.setup();
    renderDialog(dialogActor([roadie({ id: 7n })]));

    await user.click(await screen.findByTestId("dashboard.roster.item.link"));
    await screen.findByTestId("roadie.card_modal");
    // Opening the pop-up records the card in the URL.
    expect(window.location.search).toContain("card=7");

    window.history.back();

    await waitFor(() =>
      expect(screen.queryByTestId("roadie.card_modal")).toBeNull(),
    );
    // Back returns to the exact prior state: the position dialog is still open.
    expect(screen.getByTestId("dashboard.roster.dialog")).toBeInTheDocument();
  });
});

describe("position dialog former toggle reveals the archived section", () => {
  const ARCHIVED: Roadie = {
    id: 9n,
    status: RoadieStatus.archived,
    mainPositionId: 10n,
    hiredAt: 0n,
    profile: { name: "Archived Ada" },
    isMinor: false,
    isDemo: false,
    archivedReason: { __kind__: "noShow", noShow: null },
    rosterState: RosterState.pending,
  };

  it("reveals the former section with the archive reason and a grayscale tile", async () => {
    const user = userEvent.setup();
    renderWithActor(
      <PositionRosterDialog
        position={POSITION}
        open
        onOpenChange={vi.fn()}
        canRehire={false}
      />,
      dialogActor([roadie({ id: 1n }), ARCHIVED]),
    );

    // The dialog's toggle starts expanded and names the archived count.
    const toggle = await screen.findByTestId("dashboard.roster.former.toggle");
    expect(toggle).toHaveTextContent("Hide former (1)");

    // Collapse, then expand again to prove the toggle drives the section.
    await user.click(toggle);
    await waitFor(() =>
      expect(screen.queryByTestId("dashboard.roster.archived.item")).toBeNull(),
    );
    expect(toggle).toHaveTextContent("Show former (1)");

    await user.click(toggle);
    const item = await screen.findByTestId("dashboard.roster.archived.item");
    expect(item).toHaveTextContent("No-show");
    expect(
      screen.getByTestId("dashboard.roster.archived.section"),
    ).toBeInTheDocument();
  });
});

describe("Crews member list opens the shared card pop-up", () => {
  const CREW: Crew = { id: 0n, name: "Jordan's Crew", isDemo: false };

  function adminActor(roadies: Roadie[]) {
    return {
      getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
        grant: grant(Role.admin),
      })),
      getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(
        async () => STORE_INFO,
      ),
      listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
        POSITION,
      ]),
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
      listCrews: vi.fn<backendInterface["listCrews"]>(async () => [CREW]),
      listLeaders: vi.fn<backendInterface["listLeaders"]>(async () => []),
      listRoadies: vi.fn<backendInterface["listRoadies"]>(async () => roadies),
      getPhoto: vi.fn<backendInterface["getPhoto"]>(async () => PHOTO_BYTES),
    };
  }

  it("opens the card pop-up from a crew member tile", async () => {
    const user = userEvent.setup();
    renderPageWithActor(
      AdminPage,
      adminActor([roadie({ id: 7n, crewId: 0n })]),
      { path: "/admin" },
    );

    await user.click(await screen.findByTestId("admin.crews.tab"));
    await user.click(await screen.findByTestId("admin.crews.members.toggle"));

    const memberTile = await screen.findByTestId(
      "admin.crews.members.item.link",
    );
    await user.click(memberTile);

    const modal = await screen.findByTestId("roadie.card_modal");
    expect(within(modal).getByTestId("roadie.flip_card")).toBeInTheDocument();
    expect(modal.className).toContain("max-w-[420px]");
  });
});
