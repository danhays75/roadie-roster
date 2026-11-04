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
import { formatDateOnly } from "@/lib/format";
import RoadieCardPage from "@/pages/RoadieCard";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

/**
 * Characterization of the roadie card's durable content and keyboard behavior,
 * written before the card's visual markup is replaced with the .rc/.rc-face
 * stylesheet and its outer element changes from a <button> to a focusable
 * div[role=button]. The restyle intentionally changes the card's visual
 * structure, so this file asserts no CSS class and no wrapper tag. It protects
 * only what must survive the restyle: the card's accessible flip control, the
 * Enter/Space flip on the card itself, the roadie's photo on the front face,
 * and the start date and store details the card is required to show.
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

/** A fixed start date so the ROADIE SINCE footer has a stable expected value. */
const START_DATE = BigInt(Date.UTC(2027, 2, 14)) * 1_000_000n;

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
  startDate: START_DATE,
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

/** A single byte is enough to produce a non-empty data URL. */
const PHOTO_BYTES = new Uint8Array([1, 2, 3, 4]);

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
    getPhoto: vi.fn<backendInterface["getPhoto"]>(async () => PHOTO_BYTES),
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
 * The card's flip control, found by its accessible flip label rather than by
 * its tag or any visual structure, so the wrapper change from <button> to a
 * focusable div[role=button] does not invalidate the seam.
 */
async function cardFlipControl() {
  const card = await screen.findByTestId("roadie.flip_card");
  const controls = within(card).getAllByRole("button");
  const flip = controls.find((control) =>
    [t("roadie.action.showBack"), t("roadie.action.flipBack")].includes(
      control.getAttribute("aria-label") ?? "",
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

describe("roadie card content: front face", () => {
  it("shows the roadie's photo on the front face", async () => {
    renderCard(FULL_ROADIE);

    const front = await visibleFace();
    const photo = await front.findByTestId("roadie.card.photo");
    expect(photo).toBeInTheDocument();
    // The photo is fetched on demand and rendered as an image.
    const img = await front.findByRole("img", { name: "Frank" });
    expect(photo).toContainElement(img);
  });

  it("shows the start date and store details in the ROADIE SINCE footer", async () => {
    renderCard(FULL_ROADIE);

    const front = await visibleFace();
    const startDate = formatDateOnly(START_DATE);
    // The footer carries the formatted start date and the store city.
    expect(
      front.getByText(t("roadie.card.roadieSince"), { exact: false }),
    ).toBeInTheDocument();
    expect(front.getByText(startDate, { exact: false })).toBeInTheDocument();
    expect(await front.findByText("Bake")).toBeInTheDocument();
  });
});

describe("roadie card content: keyboard flip", () => {
  it("flips on Enter and Space while the card's flip control is focused", async () => {
    const user = userEvent.setup();
    renderCard(FULL_ROADIE);

    const control = await cardFlipControl();
    control.focus();
    expect(control).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(control).toHaveAttribute("aria-label", t("roadie.action.flipBack"));

    await user.keyboard(" ");
    expect(control).toHaveAttribute("aria-label", t("roadie.action.showBack"));
  });

  it("keeps the Flip card button as a real button that toggles the card", async () => {
    const user = userEvent.setup();
    renderCard(FULL_ROADIE);

    const flipButton = await screen.findByTestId("roadie.flip_button");
    expect(flipButton.tagName).toBe("BUTTON");
    expect(flipButton).toHaveTextContent(t("roadie.action.flip"));

    await user.click(flipButton);
    expect(flipButton).toHaveTextContent(t("roadie.action.flipBack"));
    expect(await cardFlipControl()).toHaveAttribute(
      "aria-label",
      t("roadie.action.flipBack"),
    );
  });
});
