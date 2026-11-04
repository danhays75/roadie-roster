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
 * Characterization of the roadie card's two rendered faces, written before a
 * new stylesheet is imported by the card component. The stylesheet import is
 * not intended to change what the card renders, so this file protects the
 * observable content of the front and back faces: the front's TLC banner,
 * badge, nameplate, position pills and ROADIE SINCE footer, and the back's
 * two-line name, headshot, profile rows, ROADIE STATS bars, MY GOAL ticket and
 * opening-crew footer. It deliberately asserts no CSS class or visual styling,
 * so a stylesheet-only change cannot invalidate it.
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
  defaultShirts: 2n,
  defaultHats: 1n,
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
  defaultShirts: 2n,
  defaultHats: 1n,
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

/** The card's flip control: the button wrapping both faces. */
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

describe("roadie card faces: front", () => {
  it("renders the front face content before any flip", async () => {
    renderCard(FULL_ROADIE);

    const front = await visibleFace();

    // TLC banner wordmark and the drawn bottle-cap badge (no uploaded logo).
    expect(front.getByText(t("roadie.card.tlc"))).toBeInTheDocument();
    expect(front.getByLabelText(t("roadie.card.badge"))).toBeInTheDocument();
    // Nameplate and position pills.
    expect(front.getByText("Frank")).toBeInTheDocument();
    expect(front.getByText("Cashier")).toBeInTheDocument();
    expect(front.getByText("Fry Cook")).toBeInTheDocument();
    // ROADIE SINCE footer with the store city from the store-info query.
    expect(
      front.getByText(t("roadie.card.roadieSince"), { exact: false }),
    ).toBeInTheDocument();
    expect(await front.findByText("Bake")).toBeInTheDocument();
  });
});

describe("roadie card faces: back", () => {
  it("renders the back face content after a flip", async () => {
    const user = userEvent.setup();
    renderCard(FULL_ROADIE);

    await user.click(await cardButton());
    const back = await visibleFace();

    // Two-line name with the circular headshot.
    expect(back.getByRole("heading", { name: "Frank" })).toBeInTheDocument();
    expect(back.getByTestId("roadie.card.headshot")).toBeInTheDocument();
    // Profile rows for the populated fields.
    expect(back.getByText(t("roadie.field.hometown"))).toBeInTheDocument();
    expect(back.getByText("Opening Crew")).toBeInTheDocument();
    expect(back.getByText("Pretzels")).toBeInTheDocument();
    // ROADIE STATS bars.
    expect(back.getByText(t("roadie.card.stats"))).toBeInTheDocument();
    expect(
      back.getByText(t("roadie.card.stat.orientation")),
    ).toBeInTheDocument();
    expect(back.getByText(t("roadie.card.stat.certified"))).toBeInTheDocument();
    // MY GOAL ticket.
    expect(back.getByText(t("roadie.card.goal"))).toBeInTheDocument();
    expect(back.getByText(/Run the fry station/)).toBeInTheDocument();
    // Opening-crew footer from store info.
    expect(
      back.getByText(`#975 ${t("roadie.card.openingCrew")}`, { exact: false }),
    ).toBeInTheDocument();
  });
});
