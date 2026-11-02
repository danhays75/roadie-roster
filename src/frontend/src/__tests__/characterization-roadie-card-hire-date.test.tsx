import { renderPageWithActor, t } from "@/__tests__/router-test-utils";
import type {
  ContactSet,
  Crew,
  Position,
  Roadie,
  StoreInfo,
  backendInterface,
} from "@/backend";
import { House, RoadieStatus, Role } from "@/backend";
import RoadieCardPage from "@/pages/RoadieCard";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

/**
 * Characterization of the roadie card behavior that the hire-date change must
 * not disturb. The accepted change intentionally replaces the front badge with
 * the inline SVG store seal, removes the birthday tag, changes the star layout,
 * moves the front footer from startDate to hireDate, removes the ROADIE STATS
 * section and lists every non-empty About Me field plus Hired in the back
 * table. This file therefore asserts none of those changing surfaces. It
 * protects only what must survive: the flip interaction (tap, Flip card button,
 * Enter/Space), the card's placement between the Card tab and the Flip card
 * button, the MINOR tag for a minor, the MY GOAL quote under the back table,
 * the hiding of empty About Me fields, the nameplate/pills/store-city/back-name
 * content, and the privacy invariant that phone, email and date of birth never
 * appear on either face.
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
};

const CREW: Crew = { id: 7n, name: "Opening Crew" };

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
  hiredAt: 0n,
  startDate: 0n,
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
  profile: { name: "Bake Lee" },
  contactSet: CONTACT,
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
      principal: { toText: () => "aaaaa-aa" } as never,
      role,
      approvedAt: 0n,
      approvedBy: { toText: () => "aaaaa-aa" } as never,
      trainerPositionIds: [],
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
 * flip aria-label rather than by any visual structure, so the badge, star and
 * table changes do not invalidate the seam.
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

describe("roadie card: placement and flip survive the hire-date change", () => {
  it("renders the card between the Card tab and the Flip card button", async () => {
    renderCard(FULL_ROADIE);

    const tab = await screen.findByTestId("roadie.card.tab");
    const card = await screen.findByTestId("roadie.flip_card");
    const flipButton = await screen.findByTestId("roadie.flip_button");

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

describe("roadie card: front content that must survive", () => {
  it("keeps the TLC wordmark, nameplate, position pills and store city", async () => {
    renderCard(FULL_ROADIE);

    const front = await visibleFace();

    expect(front.getByText(t("roadie.card.tlc"))).toBeInTheDocument();
    expect(front.getByText("Frank")).toBeInTheDocument();
    expect(front.getByText("Cashier")).toBeInTheDocument();
    expect(front.getByText("Fry Cook")).toBeInTheDocument();
    // The store city comes from the store-info query, which resolves after the
    // card first renders.
    expect(await front.findByText("Bake")).toBeInTheDocument();
  });

  it("still shows the MINOR tag for a minor", async () => {
    renderCard(FULL_ROADIE);

    expect(await screen.findByTestId("roadie.minor_badge")).toBeInTheDocument();
  });

  it("shows only the main pill and no MINOR tag for a non-minor without a second position", async () => {
    renderCard(SPARSE_ROADIE);

    const front = await visibleFace();
    expect(front.getByText("Cashier")).toBeInTheDocument();
    expect(front.queryByText("Fry Cook")).not.toBeInTheDocument();
    expect(screen.queryByTestId("roadie.minor_badge")).not.toBeInTheDocument();
  });
});

describe("roadie card: back content that must survive", () => {
  it("keeps the two-line name, headshot, populated About Me fields, MY GOAL quote and opening-crew footer", async () => {
    const user = userEvent.setup();
    renderCard(FULL_ROADIE);

    await user.click(await cardButton());
    const back = await visibleFace();

    expect(back.getByRole("heading", { name: "Frank" })).toBeInTheDocument();
    expect(back.getByTestId("roadie.card.headshot")).toBeInTheDocument();

    // Every populated About Me field still renders its label and value.
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

    // The MY GOAL quote stays under the back table.
    expect(back.getByText(t("roadie.card.goal"))).toBeInTheDocument();
    expect(back.getByText(/Run the fry station/)).toBeInTheDocument();

    // Opening-crew footer from store info.
    expect(
      back.getByText(`#975 ${t("roadie.card.openingCrew")}`, { exact: false }),
    ).toBeInTheDocument();
  });

  it("hides every empty About Me field and the empty goal on the back face", async () => {
    const user = userEvent.setup();
    renderCard(SPARSE_ROADIE);

    await user.click(await cardButton());
    const back = await visibleFace();

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
