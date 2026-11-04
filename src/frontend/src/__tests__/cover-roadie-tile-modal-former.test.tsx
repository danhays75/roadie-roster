import { renderPageWithActor, t } from "@/__tests__/router-test-utils";
import { renderWithActor } from "@/__tests__/test-utils";
import type {
  AccessGrant,
  LeaderSummary,
  Position,
  Roadie,
  backendInterface,
} from "@/backend";
import { House, RoadieStatus, Role, RosterState } from "@/backend";
import { PositionRosterDialog } from "@/components/dashboard/PositionRosterDialog";
import RosterPage from "@/pages/Roster";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

/**
 * Cover for the accepted "shared RoadieTile / card pop-up / Show former"
 * request:
 *   - the position roster dialog shows each roadie's own photo (read by id),
 *     not the store logo,
 *   - tapping a roadie tile opens the shared card pop-up with the dimmed
 *     background and the FlipCard centered at max width 420px,
 *   - the "Show former (n)" toggle reveals archived roadies in a separate
 *     "No longer a roadie" section with grayscale tiles and the archive reason,
 *   - archived roadies never count toward on-hand.
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

/** A single byte is enough to produce a non-empty data URL. */
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

/** The actor methods the position roster dialog reads. */
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

/** The actor methods the Roster page reads. */
function rosterActor(roadies: Roadie[]) {
  return {
    listRoadies: vi.fn<backendInterface["listRoadies"]>(async () => roadies),
    listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
      POSITION,
    ]),
    listCrews: vi.fn<backendInterface["listCrews"]>(async () => []),
    getPhoto: vi.fn<backendInterface["getPhoto"]>(async () => PHOTO_BYTES),
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: grant(Role.admin),
    })),
  };
}

describe("position roster dialog shows each roadie's own photo", () => {
  it("reads the roadie's photo by id and renders it in the tile, not the store logo", async () => {
    const actor = dialogActor([roadie({ id: 7n })]);
    renderWithActor(
      <PositionRosterDialog
        position={POSITION}
        open
        onOpenChange={vi.fn()}
        canRehire={false}
      />,
      actor,
    );

    const photo = await screen.findByTestId("dashboard.roster.item.photo");
    const img = await within(photo).findByRole("img", { name: "Ada" });
    expect(img).toHaveAttribute("src", expect.stringContaining("data:"));
    // The photo is fetched for this roadie's own id, not a store logo.
    await waitFor(() => expect(actor.getPhoto).toHaveBeenCalledWith(7n));
  });

  it("falls back to the roadie's initials when no photo is stored", async () => {
    const actor = dialogActor([roadie({ id: 7n })]);
    actor.getPhoto = vi.fn<backendInterface["getPhoto"]>(async () => null);
    renderWithActor(
      <PositionRosterDialog
        position={POSITION}
        open
        onOpenChange={vi.fn()}
        canRehire={false}
      />,
      actor,
    );

    const photo = await screen.findByTestId("dashboard.roster.item.photo");
    await waitFor(() => expect(actor.getPhoto).toHaveBeenCalledWith(7n));
    expect(within(photo).queryByRole("img")).toBeNull();
    // "Ada" is a single name part, so the placeholder is its first two letters.
    expect(photo).toHaveTextContent("AD");
  });
});

describe("tapping a roadie tile opens the shared card pop-up", () => {
  it("opens the modal with the dimmed overlay and the FlipCard at max width 420px", async () => {
    const user = userEvent.setup();
    // The dialog's manager "Open full profile" link is a router Link, so the
    // dialog is mounted inside the memory-history router harness.
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
    renderPageWithActor(Page, dialogActor([roadie({ id: 7n })]), {
      path: "/",
    });

    const tile = await screen.findByTestId("dashboard.roster.item.link");
    await user.click(tile);

    const modal = await screen.findByTestId("roadie.card_modal");
    // The Radix overlay dims the background behind the pop-up.
    expect(
      document.querySelector('[data-slot="dialog-overlay"]'),
    ).toBeInTheDocument();
    // The FlipCard is centered inside the modal at a max width of 420px.
    expect(within(modal).getByTestId("roadie.flip_card")).toBeInTheDocument();
    expect(modal.className).toContain("max-w-[420px]");
  });

  it("opens the card pop-up from a Roster page tile", async () => {
    const user = userEvent.setup();
    renderPageWithActor(RosterPage, rosterActor([roadie({ id: 7n })]), {
      path: "/roster",
    });

    const tile = await screen.findByTestId("roster.item.link");
    await user.click(tile);

    const modal = await screen.findByTestId("roadie.card_modal");
    expect(within(modal).getByTestId("roadie.flip_card")).toBeInTheDocument();
  });
});

describe("Show former (n) toggle reveals archived roadies separately", () => {
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

  it("shows the count, the archive reason and a grayscale tile in the former section", async () => {
    const user = userEvent.setup();
    renderPageWithActor(
      RosterPage,
      rosterActor([roadie({ id: 1n }), ARCHIVED]),
      { path: "/roster" },
    );

    // The toggle names the archived count and starts collapsed.
    const toggle = await screen.findByTestId("roster.former.toggle");
    expect(toggle).toHaveTextContent("Show former (1)");
    expect(screen.queryByTestId("roster.former.list")).toBeNull();

    await user.click(toggle);

    expect(toggle).toHaveTextContent("Hide former (1)");
    const formerList = await screen.findByTestId("roster.former.list");
    const formerTile = within(formerList).getByTestId("roster.former.item");
    // The archive reason replaces the status badge on a former roadie's tile.
    expect(formerTile).toHaveTextContent("No-show");
    // The former tile is grayscale.
    expect(
      within(formerTile).getByTestId("roster.former.item.link").className,
    ).toContain("grayscale");
  });

  it("keeps archived roadies out of the on-hand count in the dialog", async () => {
    renderWithActor(
      <PositionRosterDialog
        position={POSITION}
        open
        onOpenChange={vi.fn()}
        canRehire={false}
      />,
      dialogActor([roadie({ id: 1n }), ARCHIVED]),
    );

    const dialog = await screen.findByTestId("dashboard.roster.dialog");
    // One active roadie against a build-to of 2: the archived one is excluded.
    await waitFor(() =>
      expect(dialog).toHaveTextContent("1 on hand · build to 2"),
    );
    expect(screen.getAllByTestId("dashboard.roster.item")).toHaveLength(1);
    // The former toggle names the single archived roadie.
    expect(
      screen.getByTestId("dashboard.roster.former.toggle"),
    ).toHaveTextContent("Hide former (1)");
  });
});

describe("Leaders page tiles open the shared card pop-up", () => {
  const LEADER: LeaderSummary = {
    principal: PRINCIPAL,
    role: Role.storeManager,
    title: "Store Manager",
    trainerPositionIds: [],
    staffProfile: {
      fullName: "Grace Hopper",
      preferredName: "Grace",
      title: "Store Manager",
      trainerPositionIds: [],
      homeStoreNumber: "975",
      homeStoreCity: "Lake Charles",
      requestedRole: Role.storeManager,
    },
  };

  it("opens the card pop-up from a leader tile", async () => {
    const user = userEvent.setup();
    const actor = {
      listLeaders: vi.fn<backendInterface["listLeaders"]>(async () => [LEADER]),
      getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
        grant: grant(Role.admin),
      })),
      getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(
        async () => STORE_INFO,
      ),
      listPositions: vi.fn<backendInterface["listPositions"]>(async () => []),
      listCrews: vi.fn<backendInterface["listCrews"]>(async () => []),
    };
    const LeadersPage = (await import("@/pages/Leaders")).default;
    renderPageWithActor(LeadersPage, actor, { path: "/leaders" });

    const tile = await screen.findByTestId("leaders.item.link");
    await user.click(tile);

    const modal = await screen.findByTestId("roadie.card_modal");
    expect(within(modal).getByTestId("roadie.flip_card")).toBeInTheDocument();
    expect(modal.className).toContain("max-w-[420px]");
  });
});
