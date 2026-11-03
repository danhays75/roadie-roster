import { renderPageWithActor, t } from "@/__tests__/router-test-utils";
import { renderWithActor } from "@/__tests__/test-utils";
import type { Position, Roadie, backendInterface } from "@/backend";
import { House, RoadieStatus, RosterState } from "@/backend";
import { PositionRosterDialog } from "@/components/dashboard/PositionRosterDialog";
import { FlipCard } from "@/components/roadie/FlipCard";
import RosterPage from "@/pages/Roster";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

/**
 * Characterization baseline for the behavior the "shared RoadieTile / card
 * pop-up / Show former" request intentionally leaves alone.
 *
 * The request changes three things: the position roster dialog's tiles stop
 * showing the store logo and start showing the roadie's own photo; the Roster
 * page's rows become tappable tiles that open a card pop-up instead of linking
 * straight to the card page; and both surfaces gain a "Show former (n)" toggle
 * that reveals archived roadies in a separate section. This file deliberately
 * does NOT assert the store logo inside a dialog tile, the roster row's link to
 * /roster/$roadieId, or an always-visible archived section. It protects the
 * adjacent behavior that must survive:
 *   - the dialog's on-hand count excludes archived roadies and its open-spot
 *     tiles, empty, loading and error states,
 *   - the dialog's manager rehire control, archive reason and store-zone
 *     timestamp,
 *   - the Roster page's name/position/crew/status rendering, search, filter
 *     tabs, empty states and contact-set redaction,
 *   - the FlipCard's on-demand photo read, no-photo placeholder and flip.
 */

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
  defaultShirts: 3n,
  defaultHats: 2n,
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

/** The actor methods the position roster dialog reads. */
function dialogActor(roster: Roadie[]) {
  return {
    listRosterForPosition: vi.fn<backendInterface["listRosterForPosition"]>(
      async () => roster,
    ),
    getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(async () => ({
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
  };
}

describe("position roster dialog keeps its on-hand and open-spot behavior", () => {
  it("counts only active roadies toward on-hand and shows the remaining open spots", async () => {
    // Two active roadies and one archived: the archived one must not count, so
    // 2 of the build-to 2 are on hand and no open spot remains.
    renderWithActor(
      <PositionRosterDialog
        position={POSITION}
        open
        onOpenChange={vi.fn()}
        canRehire={false}
      />,
      dialogActor([
        roadie({ id: 1n, profile: { name: "Ada Lovelace" } }),
        roadie({ id: 2n, profile: { name: "Grace Hopper" } }),
        roadie({
          id: 3n,
          status: RoadieStatus.archived,
          profile: { name: "Archived Ada" },
          archivedReason: { __kind__: "noShow", noShow: null },
        }),
      ]),
    );

    const dialog = await screen.findByTestId("dashboard.roster.dialog");
    // The summary counts the two active roadies, not the archived one.
    await waitFor(() =>
      expect(dialog).toHaveTextContent("2 on hand · build to 2"),
    );
    // Both active roadies render as tiles; the archived one is not among them.
    expect(screen.getAllByTestId("dashboard.roster.item")).toHaveLength(2);
    expect(screen.queryByTestId("dashboard.roster.open_spot.1")).toBeNull();
  });

  it("renders a dashed open-spot tile for each still-needed hire", async () => {
    // One active roadie against a build-to of 2 leaves exactly one open spot.
    renderWithActor(
      <PositionRosterDialog
        position={POSITION}
        open
        onOpenChange={vi.fn()}
        canRehire={false}
      />,
      dialogActor([roadie()]),
    );

    const dialog = await screen.findByTestId("dashboard.roster.dialog");
    await waitFor(() =>
      expect(dialog).toHaveTextContent("1 on hand · build to 2"),
    );
    expect(
      await screen.findByTestId("dashboard.roster.open_spot.1"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard.roster.open_spot.2")).toBeNull();
  });

  it("shows the empty state when there are no roadies and no open spots", async () => {
    const emptyPosition: Position = { ...POSITION, openingBuildTo: 0n };
    renderWithActor(
      <PositionRosterDialog
        position={emptyPosition}
        open
        onOpenChange={vi.fn()}
        canRehire={false}
      />,
      dialogActor([]),
    );

    expect(
      await screen.findByTestId("dashboard.roster.empty_state"),
    ).toHaveTextContent(t("dashboard.roster.empty"));
  });

  it("shows the error state when the roster read fails", async () => {
    const actor = dialogActor([]);
    actor.listRosterForPosition = vi.fn<
      backendInterface["listRosterForPosition"]
    >(async () => {
      throw new Error("boom");
    });
    renderWithActor(
      <PositionRosterDialog
        position={POSITION}
        open
        onOpenChange={vi.fn()}
        canRehire={false}
      />,
      actor,
    );

    expect(
      await screen.findByTestId("dashboard.roster.error_state"),
    ).toHaveTextContent(t("dashboard.roster.error"));
  });
});

describe("position roster dialog keeps its archived-row behavior", () => {
  // 2027-02-09T05:59:59Z, which is 2027-02-08 23:59:59 in America/Chicago.
  const ARCHIVED_AT = 1_802_152_799_000_000_000n;

  const ARCHIVED: Roadie = {
    id: 9n,
    status: RoadieStatus.archived,
    mainPositionId: 10n,
    hiredAt: 0n,
    profile: { name: "Archived Ada" },
    isMinor: false,
    isDemo: false,
    archivedReason: { __kind__: "noShow", noShow: null },
    archivedAt: ARCHIVED_AT,
    rosterState: RosterState.pending,
  };

  it("shows the archive reason and a rehire control for a manager", async () => {
    const actor = {
      ...dialogActor([ARCHIVED]),
      rehireRoadie: vi.fn<backendInterface["rehireRoadie"]>(async () => {}),
    };
    renderWithActor(
      <PositionRosterDialog
        position={POSITION}
        open
        onOpenChange={vi.fn()}
        canRehire
      />,
      actor,
    );

    const item = await screen.findByTestId("dashboard.roster.archived.item");
    expect(item).toHaveTextContent("No-show");
    expect(
      screen.getByTestId("dashboard.roster.rehire_button"),
    ).toBeInTheDocument();
  });

  it("renders the archivedAt instant in the store time zone", async () => {
    renderWithActor(
      <PositionRosterDialog
        position={POSITION}
        open
        onOpenChange={vi.fn()}
        canRehire
      />,
      dialogActor([ARCHIVED]),
    );

    const item = await screen.findByTestId("dashboard.roster.archived.item");
    const expected = new Date(Number(ARCHIVED_AT / 1_000_000n)).toLocaleString(
      undefined,
      { dateStyle: "medium", timeStyle: "short", timeZone: "America/Chicago" },
    );
    expect(item).toHaveTextContent(expected);
  });

  it("hides the rehire control from a non-manager", async () => {
    renderWithActor(
      <PositionRosterDialog
        position={POSITION}
        open
        onOpenChange={vi.fn()}
        canRehire={false}
      />,
      dialogActor([ARCHIVED]),
    );

    await screen.findByTestId("dashboard.roster.archived.item");
    expect(
      screen.queryByTestId("dashboard.roster.rehire_button"),
    ).not.toBeInTheDocument();
  });
});

describe("Roster page keeps its row content and filtering", () => {
  it("renders the roadie's name, position, crew and status", async () => {
    renderPageWithActor(RosterPage, rosterActor([roadie()]), {
      path: "/roster",
    });

    expect(await screen.findByText("Ada")).toBeInTheDocument();
    expect(screen.getByText(/Cashier/)).toBeInTheDocument();
    expect(screen.getByTestId("roster.item.status")).toBeInTheDocument();
    // The crew line renders even when the roadie has no crew.
    expect(screen.getByText(/Crew/)).toBeInTheDocument();
  });

  it("filters rows by the search query", async () => {
    const user = userEvent.setup();
    renderPageWithActor(
      RosterPage,
      rosterActor([
        roadie({ id: 1n, profile: { name: "Ada Lovelace" } }),
        roadie({ id: 2n, profile: { name: "Grace Hopper" } }),
      ]),
      { path: "/roster" },
    );

    await screen.findByText("Ada Lovelace");
    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();

    await user.type(screen.getByTestId("roster.search_input"), "grace");

    await waitFor(() =>
      expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();
    // The row still shows the matched roadie's position and status.
    expect(screen.getByText(/Cashier/)).toBeInTheDocument();
    expect(screen.getByTestId("roster.item.status")).toBeInTheDocument();
  });

  it("shows the no-match empty state for a query that matches nothing", async () => {
    const user = userEvent.setup();
    renderPageWithActor(RosterPage, rosterActor([roadie()]), {
      path: "/roster",
    });

    await screen.findByText("Ada");
    await user.type(screen.getByTestId("roster.search_input"), "zzz");

    expect(await screen.findByText(t("roster.empty"))).toBeInTheDocument();
  });

  it("shows the empty state when no roadies exist", async () => {
    renderPageWithActor(RosterPage, rosterActor([]), { path: "/roster" });

    expect(await screen.findByText(t("roster.emptyAll"))).toBeInTheDocument();
  });

  it("never renders contact-set fields for a redacted roadie", async () => {
    renderPageWithActor(RosterPage, rosterActor([roadie()]), {
      path: "/roster",
    });

    await screen.findByText("Ada");
    expect(screen.queryByText("+1-555-0100")).not.toBeInTheDocument();
    expect(screen.queryByText("ada@example.com")).not.toBeInTheDocument();
  });
});

describe("FlipCard keeps its on-demand photo and flip behavior", () => {
  it("reads the roadie's photo by id and renders it on the card", async () => {
    const getPhoto = vi.fn<backendInterface["getPhoto"]>(
      async () => PHOTO_BYTES,
    );
    renderWithActor(<FlipCard roadie={roadie()} position={POSITION} />, {
      getPhoto,
    });

    const card = await screen.findByTestId("roadie.flip_card");
    const img = await screen.findByRole("img", { name: "Ada" });
    expect(card).toContainElement(img);
    expect(getPhoto).toHaveBeenCalledWith(1n);
  });

  it("shows the initials placeholder, not a broken image, when there is no photo", async () => {
    const getPhoto = vi.fn<backendInterface["getPhoto"]>(async () => null);
    renderWithActor(<FlipCard roadie={roadie()} position={POSITION} />, {
      getPhoto,
    });

    await screen.findByTestId("roadie.flip_card");
    await waitFor(() => expect(getPhoto).toHaveBeenCalledWith(1n));
    const photo = screen.getByTestId("roadie.card.photo");
    expect(photo.querySelector("img")).toBeNull();
    // The preferred name "Ada" is a single part, so the placeholder is its
    // first two letters.
    expect(photo).toHaveTextContent("AD");
  });

  it("flips the card when the flip button is pressed", async () => {
    const user = userEvent.setup();
    renderWithActor(<FlipCard roadie={roadie()} position={POSITION} />, {
      getPhoto: vi.fn<backendInterface["getPhoto"]>(async () => null),
    });

    const button = await screen.findByTestId("roadie.flip_button");
    expect(button).toHaveAttribute("aria-pressed", "false");
    await user.click(button);
    expect(button).toHaveAttribute("aria-pressed", "true");
  });
});
