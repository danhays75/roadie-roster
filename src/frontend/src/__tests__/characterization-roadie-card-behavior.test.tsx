import { renderPageWithActor, t } from "@/__tests__/router-test-utils";
import type {
  ContactSet,
  Crew,
  Position,
  Roadie,
  StoreInfo,
  backendInterface,
} from "@/backend";
import { House, RoadieStatus, Role, RosterState } from "@/backend";
import RoadieCardPage from "@/pages/RoadieCard";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

/**
 * Characterization of the roadie card's durable behavior, written before the
 * card's visual restyle. The restyle intentionally changes the card's visual
 * structure (banner, badge, photo window, nameplate, pills, footers, fact
 * table, stats bars, quote plaque), so this file deliberately does NOT assert
 * any of that structure. It protects only the behavior that must survive the
 * restyle: the card's placement between the tab list and the Flip card button,
 * the flip interaction (tap, button, Enter/Space), the hiding of empty profile
 * fields and an empty goal, and the privacy invariant that phone, email and
 * date of birth never appear on either face.
 *
 * The backend is a typed local actor mock; no canister is contacted.
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
  shirtType: "Polo",
  shirtQty: 2n,
  hatType: "Cap",
  hatQty: 1n,
};

const SECOND_POSITION: Position = {
  id: 1n,
  name: "Fry Cook",
  code: "FRY",
  house: House.boh,
  openingBuildTo: 1n,
  afterOpeningBuildTo: 1n,
  minimumAge: 18n,
  shirtsRequired: 1n,
  hatsRequired: 1n,
  needsAlcoholCert: false,
  shirtType: "Polo",
  shirtQty: 2n,
  hatType: "Cap",
  hatQty: 1n,
};

const CREW: Crew = { id: 7n, name: "Opening Crew", isDemo: false };

const CONTACT: ContactSet = {
  phone: "+1-555-0100",
  email: "frank@example.com",
  emergencyContactName: "Grace",
  emergencyContactPhone: "+1-555-0101",
  dateOfBirth: 0n,
  availability: [],
  availabilityResignPending: false,
};

const STORE_INFO: StoreInfo = {
  amShiftEnd: 0n,
  pmShiftStart: 0n,
  storeNumber: "975",
  leaderTalkName: "Leader talk",
  appName: "Roadie Roster",
  leaderTalkSize: 4n,
  amShiftStart: 0n,
  openingDate: 0n,
  pmShiftEnd: 0n,
  trainingGroupSize: 4n,
  address: "1 Main St",
  locationName: "Bake",
  timeZone: "America/Chicago",
  storePhone: "+1-555-0199",
  paperworkDueDate: 1_800_000_000_000_000_000n,
};

/** A roadie with every optional profile field populated. */
const FULL_ROADIE: Roadie = {
  id: 1n,
  status: RoadieStatus.certified,
  orientationEventId: 3n,
  mainPositionId: 0n,
  secondPositionId: 1n,
  crewId: 7n,
  birthdayMonthDay: "03-14",
  isMinor: true,
  isDemo: false,
  hiredAt: 0n,
  startDate: 0n,
  rosterState: RosterState.active,
  profile: {
    name: "Frank George",
    preferredName: "Frank",
    hometown: "Bake",
    favoriteSnack: "Pretzels",
    favoriteMovie: "Top Gun",
    hobbies: "Cycling",
    funFact: "Can juggle",
    goalHere: "Run the fry station",
  },
  contactSet: CONTACT,
};

/** A roadie with every optional profile field empty. */
const SPARSE_ROADIE: Roadie = {
  id: 2n,
  status: RoadieStatus.hired,
  mainPositionId: 0n,
  isMinor: false,
  hiredAt: 0n,
  isDemo: false,
  profile: { name: "Bake Lee" },
  contactSet: CONTACT,
  rosterState: RosterState.pending,
};

function actor(roadie: Roadie, role: Role = Role.admin) {
  return {
    getRoadie: vi.fn<backendInterface["getRoadie"]>(async () => roadie),
    listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
      POSITION,
      SECOND_POSITION,
    ]),
    listCrews: vi.fn<backendInterface["listCrews"]>(async () => [CREW]),
    getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(
      async () => STORE_INFO,
    ),
    getStoreLogo: vi.fn<backendInterface["getStoreLogo"]>(async () => ({})),
    getPhoto: vi.fn<backendInterface["getPhoto"]>(async () => null),
    isMinor: vi.fn<backendInterface["isMinor"]>(async () => roadie.isMinor),
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: {
        principal: { toText: () => "aaaaa-aa" } as never,
        role,
        approvedAt: 0n,
        approvedBy: { toText: () => "aaaaa-aa" } as never,
        trainerPositionIds: [],
      },
    })),
    getContactSet: vi.fn<backendInterface["getContactSet"]>(async () => [
      CONTACT,
    ]),
    getChecklists: vi.fn<backendInterface["getChecklists"]>(async () => ({
      paperwork: [],
      orientationUniform: [],
    })),
    listChangeLog: vi.fn<backendInterface["listChangeLog"]>(async () => []),
  };
}

function renderCard(roadie: Roadie, role: Role = Role.admin) {
  return renderPageWithActor(RoadieCardPage, actor(roadie, role), {
    path: "/roster/$roadieId",
    initialEntry: `/roster/${roadie.id}`,
  });
}

/**
 * The card's flip control: the button wrapping both faces. It is found by its
 * flip aria-label rather than by any visual structure, so the restyle does not
 * invalidate the seam.
 */
async function cardButton() {
  const card = await screen.findByTestId("roadie.flip_card");
  const buttons = within(card).getAllByRole("button");
  const flip = buttons.find((button) =>
    [t("roadie.action.showBack"), t("roadie.action.flipBack")].includes(
      button.getAttribute("aria-label") ?? "",
    ),
  );
  if (!flip) throw new Error("no card flip control");
  return flip;
}

/**
 * The currently visible face. Both faces stay mounted (the hidden one is
 * `aria-hidden`), so assertions are scoped to the face that is showing.
 */
async function visibleFace() {
  const card = await screen.findByTestId("roadie.flip_card");
  const faces = card.querySelectorAll<HTMLElement>("[aria-hidden]");
  const face = Array.from(faces).find(
    (node) => node.getAttribute("aria-hidden") === "false",
  );
  if (!face) throw new Error("no visible card face");
  return within(face);
}

describe("roadie card: placement and flip", () => {
  it("renders the card between the Card tab and the Flip card button", async () => {
    renderCard(FULL_ROADIE);

    const tab = await screen.findByTestId("roadie.card.tab");
    const card = await screen.findByTestId("roadie.flip_card");
    const flipButton = await screen.findByTestId("roadie.flip_button");

    // The card sits after the tab list and before the Flip card button in
    // document order, so the Card tab is not blank.
    expect(
      tab.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      card.compareDocumentPosition(flipButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("flips to the back on tap and back to the front on a second tap", async () => {
    const user = userEvent.setup();
    renderCard(FULL_ROADIE);

    const card = await cardButton();
    expect(card).toHaveAttribute("aria-label", t("roadie.action.showBack"));

    await user.click(card);
    expect(card).toHaveAttribute("aria-label", t("roadie.action.flipBack"));

    await user.click(card);
    expect(card).toHaveAttribute("aria-label", t("roadie.action.showBack"));
  });

  it("flips with the Flip card button", async () => {
    const user = userEvent.setup();
    renderCard(FULL_ROADIE);

    const flipButton = await screen.findByTestId("roadie.flip_button");
    expect(flipButton).toHaveTextContent(t("roadie.action.flip"));

    await user.click(flipButton);
    expect(flipButton).toHaveTextContent(t("roadie.action.flipBack"));
    expect(await cardButton()).toHaveAttribute(
      "aria-label",
      t("roadie.action.flipBack"),
    );
  });

  it("flips with Enter and Space while the card is focused", async () => {
    const user = userEvent.setup();
    renderCard(FULL_ROADIE);

    const card = await cardButton();
    card.focus();
    expect(card).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(card).toHaveAttribute("aria-label", t("roadie.action.flipBack"));

    await user.keyboard(" ");
    expect(card).toHaveAttribute("aria-label", t("roadie.action.showBack"));
  });
});

describe("roadie card: empty fields stay hidden", () => {
  it("hides every empty profile field and the empty goal on the back face", async () => {
    const user = userEvent.setup();
    renderCard(SPARSE_ROADIE);

    await user.click(await cardButton());
    const back = await visibleFace();

    // The sparse roadie has no hometown, crew, snack, movie, hobbies, fun fact
    // or goal, so none of those labels or the goal plaque may render.
    expect(
      back.queryByText(t("roadie.field.hometown")),
    ).not.toBeInTheDocument();
    expect(back.queryByText(t("roadie.field.crew"))).not.toBeInTheDocument();
    expect(
      back.queryByText(t("roadie.field.favoriteSnack")),
    ).not.toBeInTheDocument();
    expect(
      back.queryByText(t("roadie.field.favoriteMovie")),
    ).not.toBeInTheDocument();
    expect(back.queryByText(t("roadie.field.hobbies"))).not.toBeInTheDocument();
    expect(back.queryByText(t("roadie.field.funFact"))).not.toBeInTheDocument();
    expect(back.queryByText(t("roadie.card.goal"))).not.toBeInTheDocument();
  });

  it("shows the populated profile fields and the goal on the back face", async () => {
    const user = userEvent.setup();
    renderCard(FULL_ROADIE);

    await user.click(await cardButton());
    const back = await visibleFace();

    expect(back.getByText(t("roadie.field.hometown"))).toBeInTheDocument();
    expect(back.getByText("Bake")).toBeInTheDocument();
    expect(back.getByText(t("roadie.field.crew"))).toBeInTheDocument();
    expect(back.getByText("Opening Crew")).toBeInTheDocument();
    expect(back.getByText(t("roadie.field.favoriteSnack"))).toBeInTheDocument();
    expect(back.getByText("Pretzels")).toBeInTheDocument();
    // Favorite movie is no longer listed on the card back.
    expect(
      back.queryByText(t("roadie.field.favoriteMovie")),
    ).not.toBeInTheDocument();
    expect(back.getByText(t("roadie.field.dayOff"))).toBeInTheDocument();
    expect(back.getByText("Cycling")).toBeInTheDocument();
    expect(back.getByText(t("roadie.field.funFact"))).toBeInTheDocument();
    expect(back.getByText("Can juggle")).toBeInTheDocument();
    expect(back.getByText(t("roadie.card.goal"))).toBeInTheDocument();
    expect(back.getByText(/Run the fry station/)).toBeInTheDocument();
  });
});

describe("roadie card: privacy invariant", () => {
  it("never renders phone, email or date of birth on either face", async () => {
    const user = userEvent.setup();
    renderCard(FULL_ROADIE);

    await screen.findByTestId("roadie.flip_card");
    expect(screen.queryByText("+1-555-0100")).not.toBeInTheDocument();
    expect(screen.queryByText("frank@example.com")).not.toBeInTheDocument();

    await user.click(await cardButton());
    expect(screen.queryByText("+1-555-0100")).not.toBeInTheDocument();
    expect(screen.queryByText("frank@example.com")).not.toBeInTheDocument();
  });
});
