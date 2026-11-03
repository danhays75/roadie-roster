import { renderPageWithActor, t } from "@/__tests__/router-test-utils";
import type { Position, Roadie, backendInterface } from "@/backend";
import { House, RoadieStatus, Role } from "@/backend";
import RoadieCardPage from "@/pages/RoadieCard";
import RosterPage from "@/pages/Roster";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * Characterization baseline for the roster list and roadie card around the
 * photo change. The accepted change moves photo bytes out of the list payload
 * and onto an on-demand `getPhoto(id)` read, so this file deliberately does NOT
 * assert how a stored photo is sourced. It protects the adjacent behavior that
 * must survive: the non-photo fields each surface renders, and the placeholder
 * icon shown for a roadie with no photo.
 */

const POSITION: Position = {
  id: 10n,
  name: "Cashier",
  code: "CSH",
  house: House.foh,
  openingBuildTo: 4n,
  afterOpeningBuildTo: 2n,
  minimumAge: 16n,
  shirtsRequired: 2n,
  hatsRequired: 1n,
  needsAlcoholCert: false,
};

/** A roadie with no photo, as the backend returns it to a non-manager. */
function roadieWithoutPhoto(): Roadie {
  return {
    id: 1n,
    status: RoadieStatus.hired,
    mainPositionId: 10n,
    hiredAt: 0n,
    isMinor: false,
    isDemo: false,
    profile: { name: "Ada Lovelace", preferredName: "Ada" },
  };
}

function rosterActor(roadies: Roadie[]) {
  return {
    listRoadies: vi.fn<backendInterface["listRoadies"]>(async () => roadies),
    listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
      POSITION,
    ]),
    listCrews: vi.fn<backendInterface["listCrews"]>(async () => []),
  };
}

function cardActor(roadie: Roadie, role: Role) {
  return {
    getRoadie: vi.fn<backendInterface["getRoadie"]>(async () => roadie),
    listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
      POSITION,
    ]),
    listCrews: vi.fn<backendInterface["listCrews"]>(async () => []),
    isMinor: vi.fn<backendInterface["isMinor"]>(async () => false),
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      principal: { toText: () => "aaaaa-aa" } as never,
      role,
      approvedAt: 0n,
      approvedBy: { toText: () => "aaaaa-aa" } as never,
      trainerPositionIds: [],
    })),
    getContactSet: vi.fn<backendInterface["getContactSet"]>(async () => []),
    getChecklists: vi.fn<backendInterface["getChecklists"]>(async () => ({
      paperwork: [],
      orientationUniform: [],
    })),
    listChangeLog: vi.fn<backendInterface["listChangeLog"]>(async () => []),
  };
}

describe("roster list without a stored photo", () => {
  it("renders the roadie's name, position and status", async () => {
    renderPageWithActor(RosterPage, rosterActor([roadieWithoutPhoto()]), {
      path: "/roster",
    });

    expect(await screen.findByText("Ada")).toBeInTheDocument();
    expect(screen.getByText(/Cashier/)).toBeInTheDocument();
    expect(screen.getByTestId("roster.item.status")).toBeInTheDocument();
  });

  it("shows the placeholder icon instead of a broken image", async () => {
    renderPageWithActor(RosterPage, rosterActor([roadieWithoutPhoto()]), {
      path: "/roster",
    });

    await screen.findByText("Ada");
    // No photo bytes exist, so the row must not render an <img> at all.
    expect(document.querySelectorAll("img")).toHaveLength(0);
  });
});

describe("roadie card without a stored photo", () => {
  it("renders the card fields and the placeholder icon", async () => {
    renderPageWithActor(
      RoadieCardPage,
      cardActor(roadieWithoutPhoto(), Role.admin),
      { path: "/roster/$roadieId", initialEntry: "/roster/1" },
    );

    const card = await screen.findByTestId("roadie.flip_card");
    // The name renders in the page header and on the card front and back.
    expect(screen.getAllByText("Ada").length).toBeGreaterThan(0);
    expect(card).toHaveTextContent("Cashier");
    expect(card).toHaveTextContent("CSH");
    // The card front shows the placeholder icon, never a broken <img>.
    expect(document.querySelectorAll("img")).toHaveLength(0);
  });

  it("still shows the manager tab to an Admin", async () => {
    renderPageWithActor(
      RoadieCardPage,
      cardActor(roadieWithoutPhoto(), Role.admin),
      { path: "/roster/$roadieId", initialEntry: "/roster/1" },
    );

    expect(await screen.findByTestId("roadie.manager.tab")).toBeInTheDocument();
  });
});

describe("default route loads", () => {
  it("renders the roster page without a blank screen", async () => {
    renderPageWithActor(RosterPage, rosterActor([roadieWithoutPhoto()]), {
      path: "/",
    });

    expect(await screen.findByTestId("roster.page")).toBeInTheDocument();
    expect(screen.getByText(t("roster.title"))).toBeInTheDocument();
  });
});
