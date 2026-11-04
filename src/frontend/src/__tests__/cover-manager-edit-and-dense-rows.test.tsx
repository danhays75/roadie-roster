import { renderPageWithActor } from "@/__tests__/router-test-utils";
import type {
  Crew,
  Position,
  Roadie,
  RoadieProfile,
  StoreInfo,
  backendInterface,
} from "@/backend";
import { House, RoadieStatus, Role, RosterState } from "@/backend";
import RoadieCardPage from "@/pages/RoadieCard";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

/**
 * Cover for two accepted behaviors not exercised elsewhere: a manager can edit
 * Favorite sports team, Favorite drink and Favorite color in Edit details and
 * the saved values appear on the card back; and a card back with more than 7
 * rows renders its rows with the dense 3.4cqw font-size class. The backend is a
 * typed local actor mock; no canister is contacted.
 */

const POSITION: Position = {
  id: 0n,
  name: "Cashier",
  code: "CSH",
  house: House.foh,
  openingBuildTo: 2n,
  afterOpeningBuildTo: 2n,
  minimumAge: 18n,
  shirtsRequired: 2n,
  hatsRequired: 1n,
  needsAlcoholCert: false,
  defaultShirts: 3n,
  defaultHats: 2n,
  shirtType: "Polo",
  shirtQty: 2n,
  hatType: "Cap",
  hatQty: 1n,
};

const CREW: Crew = { id: 7n, name: "Opening Crew", isDemo: false };

const STORE_INFO: StoreInfo = {
  amShiftEnd: 0n,
  pmShiftStart: 0n,
  storeNumber: "975",
  leaderTalkName: "Leader talk",
  appName: "Roadie Roster",
  leaderTalkSize: 4n,
  amShiftStart: 0n,
  openingDate: BigInt(Date.UTC(2027, 1, 8)) * 1_000_000n,
  pmShiftEnd: 0n,
  trainingGroupSize: 4n,
  address: "1 Main St",
  locationName: "Bake",
  timeZone: "America/Chicago",
  storePhone: "+1-555-0199",
  paperworkDueDate: 1_800_000_000_000_000_000n,
};

function baseProfile(overrides: Partial<RoadieProfile> = {}): RoadieProfile {
  return {
    name: "Frank George",
    preferredName: "Frank",
    hometown: "Bake",
    hobbies: "Cycling",
    favoriteSnack: "Snickers",
    favoriteTeam: "LSU Tigers",
    favoriteDrink: "Coffee",
    favoriteColor: "Navy blue",
    funFact: "Can juggle",
    goalHere: "Run the fry station",
    ...overrides,
  };
}

function roadie(profile: RoadieProfile): Roadie {
  return {
    id: 1n,
    status: RoadieStatus.certified,
    mainPositionId: 0n,
    crewId: 7n,
    isMinor: false,
    hiredAt: 0n,
    isDemo: false,
    hireDate: BigInt(Date.UTC(2027, 0, 30, 12, 0, 0)) * 1_000_000n,
    rosterState: RosterState.active,
    profile,
  };
}

function grant(role: Role) {
  return {
    principal: { toText: () => "aaaaa-aa" } as never,
    role,
    approvedAt: 0n,
    approvedBy: { toText: () => "aaaaa-aa" } as never,
    trainerPositionIds: [],
  };
}

/**
 * A stateful actor whose `getRoadie` returns a fresh clone of the current
 * record, so a successful edit mutation's invalidation refetches the saved
 * values rather than a shared mutable object.
 */
function statefulActor(initial: Roadie, role: Role = Role.storeManager) {
  let current = structuredClone(initial);
  const updateRoadieDetails = vi.fn<backendInterface["updateRoadieDetails"]>(
    async (_id, profile) => {
      current = { ...current, profile: structuredClone(profile) };
    },
  );
  return {
    actor: {
      getRoadie: vi.fn<backendInterface["getRoadie"]>(async () =>
        structuredClone(current),
      ),
      updateRoadieDetails,
      listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
        POSITION,
      ]),
      listCrews: vi.fn<backendInterface["listCrews"]>(async () => [CREW]),
      getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(
        async () => STORE_INFO,
      ),
      getStoreLogo: vi.fn<backendInterface["getStoreLogo"]>(async () => ({})),
      getPhoto: vi.fn<backendInterface["getPhoto"]>(async () => null),
      isMinor: vi.fn<backendInterface["isMinor"]>(async () => false),
      getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
        grant: grant(role),
      })),
      getContactSet: vi.fn<backendInterface["getContactSet"]>(async () => []),
      getChecklists: vi.fn<backendInterface["getChecklists"]>(async () => ({
        paperwork: [],
        orientationUniform: [],
      })),
      listChangeLog: vi.fn<backendInterface["listChangeLog"]>(async () => []),
    },
    updateRoadieDetails,
  };
}

function renderCard(actor: ReturnType<typeof statefulActor>["actor"]) {
  return renderPageWithActor(RoadieCardPage, actor, {
    path: "/roster/$roadieId",
    initialEntry: "/roster/1",
  });
}

async function cardButton() {
  // The dedicated flip control is always in the accessibility tree, unlike the
  // card's own button while a modal dialog is still mounted.
  return screen.findByTestId("roadie.flip_button");
}

async function visibleFace() {
  const card = await screen.findByTestId("roadie.flip_card");
  const faces = card.querySelectorAll<HTMLElement>("[aria-hidden]");
  const face = Array.from(faces).find(
    (node) => node.getAttribute("aria-hidden") === "false",
  );
  if (!face) throw new Error("no visible card face");
  return within(face);
}

describe("manager edits the three new fields and the card back reflects them", () => {
  it("saves Favorite team, Favorite drink and Favorite color and shows them on the card back", async () => {
    const user = userEvent.setup();
    const { actor, updateRoadieDetails } = statefulActor(roadie(baseProfile()));
    renderCard(actor);

    // Open Edit details and change the three new fields.
    await user.click(await screen.findByTestId("roadie.edit_button"));
    const team = await screen.findByTestId("roadie.edit.favoriteTeam_input");
    const drink = screen.getByTestId("roadie.edit.favoriteDrink_input");
    const color = screen.getByTestId("roadie.edit.favoriteColor_input");

    await user.clear(team);
    await user.type(team, "Saints");
    await user.clear(drink);
    await user.type(drink, "Iced tea");
    await user.clear(color);
    await user.type(color, "Crimson");

    await user.click(screen.getByTestId("roadie.edit.save_button"));

    // The mutation carried the edited profile to the actor.
    expect(updateRoadieDetails).toHaveBeenCalledTimes(1);
    const [, savedProfile] = updateRoadieDetails.mock.calls[0];
    expect(savedProfile.favoriteTeam).toBe("Saints");
    expect(savedProfile.favoriteDrink).toBe("Iced tea");
    expect(savedProfile.favoriteColor).toBe("Crimson");

    // Dismiss the modal dialog so the card is interactive again.
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(
        screen.queryByTestId("roadie.edit.dialog"),
      ).not.toBeInTheDocument(),
    );

    // The saved values appear on the card back.
    await user.click(await cardButton());
    const back = await visibleFace();
    expect(back.getByText("Saints")).toBeInTheDocument();
    expect(back.getByText("Iced tea")).toBeInTheDocument();
    expect(back.getByText("Crimson")).toBeInTheDocument();
  });
});

describe("card back with more than 7 rows uses the dense row size", () => {
  it("adds the dense class to the table when more than 7 rows render", async () => {
    const user = userEvent.setup();
    // Every About Me field populated plus the hire date gives 9 rows.
    const { actor } = statefulActor(roadie(baseProfile()));
    renderCard(actor);

    await user.click(await cardButton());
    const back = await visibleFace();

    const rows = back.getAllByText(
      (_, element) => element?.className === "row",
    );
    expect(rows.length).toBeGreaterThan(7);

    const table = rows[0].closest(".tbl");
    expect(table).not.toBeNull();
    expect(table).toHaveClass("dense");
  });

  it("does not add the dense class when 7 or fewer rows render", async () => {
    const user = userEvent.setup();
    // Only hometown, crew, day off and hired render: 4 rows.
    const { actor } = statefulActor(
      roadie(
        baseProfile({
          favoriteSnack: "",
          favoriteTeam: "",
          favoriteDrink: "",
          favoriteColor: "",
          funFact: "",
        }),
      ),
    );
    renderCard(actor);

    await user.click(await cardButton());
    const back = await visibleFace();

    const rows = back.getAllByText(
      (_, element) => element?.className === "row",
    );
    expect(rows.length).toBeLessThanOrEqual(7);

    const table = rows[0].closest(".tbl");
    expect(table).not.toBeNull();
    expect(table).not.toHaveClass("dense");
  });
});
