import { renderPageWithActor, t } from "@/__tests__/router-test-utils";
import type { Roadie, RoadieProfile } from "@/backend";
import { House, RoadieStatus, RosterState } from "@/backend";
import RosterPage from "@/pages/Roster";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const PROFILE: RoadieProfile = { name: "Ada Lovelace" };

/** A roadie as the backend returns it to a non-manager: contact set stripped. */
function redactedRoadie(): Roadie {
  return {
    id: 1n,
    status: RoadieStatus.hired,
    mainPositionId: 10n,
    profile: PROFILE,
    hiredAt: 0n,
    isMinor: false,
    isDemo: false,
    rosterState: RosterState.pending,
  };
}

describe("RosterPage", () => {
  it("renders roadies returned by the backend", async () => {
    const actor = {
      listRoadies: vi.fn(async () => [redactedRoadie()]),
      listPositions: vi.fn(async () => [
        {
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
          defaultShirts: 3n,
          defaultHats: 2n,
          shirtType: "Polo",
          shirtQty: 2n,
          hatType: "Cap",
          hatQty: 1n,
        },
      ]),
      listCrews: vi.fn(async () => []),
    };

    renderPageWithActor(RosterPage, actor, { path: "/roster" });

    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText(/Cashier/)).toBeInTheDocument();
  });

  it("shows the empty state when no roadies exist", async () => {
    const actor = {
      listRoadies: vi.fn(async () => []),
      listPositions: vi.fn(async () => []),
      listCrews: vi.fn(async () => []),
    };

    renderPageWithActor(RosterPage, actor, { path: "/roster" });

    expect(await screen.findByText(t("roster.emptyAll"))).toBeInTheDocument();
  });

  it("never renders contact-set fields for a redacted roadie", async () => {
    const actor = {
      listRoadies: vi.fn(async () => [redactedRoadie()]),
      listPositions: vi.fn(async () => []),
      listCrews: vi.fn(async () => []),
    };

    renderPageWithActor(RosterPage, actor, { path: "/roster" });

    await screen.findByText("Ada Lovelace");
    // The backend strips the contact set for non-managers; the roster must not
    // surface a phone or email even if one were present in the payload.
    expect(screen.queryByText("+1-555-0100")).not.toBeInTheDocument();
    expect(screen.queryByText("ada@example.com")).not.toBeInTheDocument();
  });
});
