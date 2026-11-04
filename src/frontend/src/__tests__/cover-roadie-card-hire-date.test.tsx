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
 * Cover for the accepted card changes: the inline SVG store seal replaces the
 * uploaded logo in the top banner, the front shows 16 positioned stars and no
 * birthday tag, the front footer reads "Roadie since" + hireDate, and the back
 * drops the ROADIE STATS section in favour of a table listing every non-empty
 * About Me field in order, ending with HIRED. The backend is a typed local actor
 * mock; no canister is contacted.
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
  defaultShirts: 3n,
  defaultHats: 2n,
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

/**
 * 2027-01-30T12:00:00Z. In America/Chicago (CST, UTC-6) this is Jan 30, 2027,
 * so the formatted hire date is "Jan 30, 2027" regardless of the host zone.
 */
const HIRE_TS = BigInt(Date.UTC(2027, 0, 30, 12, 0, 0)) * 1_000_000n;
const HIRE_LABEL = "Jan 30, 2027";

/** A roadie with every optional profile field populated and a hire date. */
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
  hireDate: HIRE_TS,
  startDate: 0n,
  rosterState: RosterState.active,
  profile: {
    name: "Frank George",
    preferredName: "Frank",
    hometown: "Bake",
    favoriteSnack: "Pretzels",
    favoriteTeam: "LSU Tigers",
    favoriteDrink: "Coffee",
    favoriteColor: "Navy blue",
    favoriteMovie: "Top Gun",
    hobbies: "Cycling",
    funFact: "Can juggle",
    goalHere: "Run the fry station",
  },
  contactSet: CONTACT,
};

/** A roadie with no hireDate, so the footer falls back to hiredAt. */
const FALLBACK_ROADIE: Roadie = {
  id: 3n,
  status: RoadieStatus.hired,
  mainPositionId: 0n,
  isMinor: false,
  hiredAt: HIRE_TS,
  isDemo: false,
  profile: { name: "Bake Lee" },
  contactSet: CONTACT,
  rosterState: RosterState.active,
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

/** The card's flip control, found by its flip aria-label. */
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

/** The currently visible face; both faces stay mounted, one aria-hidden. */
async function visibleFace() {
  const card = await screen.findByTestId("roadie.flip_card");
  const faces = card.querySelectorAll<HTMLElement>("[aria-hidden]");
  const face = Array.from(faces).find(
    (node) => node.getAttribute("aria-hidden") === "false",
  );
  if (!face) throw new Error("no visible card face");
  return within(face);
}

describe("roadie card: front seal, stars and hire-date footer", () => {
  it("shows the inline SVG store seal with the store number and no uploaded logo", async () => {
    renderCard(FULL_ROADIE);

    const front = await visibleFace();
    // The seal is an SVG whose accessible name is the store number.
    const seal = await front.findByRole("img", { name: "975" });
    expect(seal.tagName.toLowerCase()).toBe("svg");
    // No uploaded logo appears in the banner.
    expect(front.queryByTestId("store.logo")).not.toBeInTheDocument();
    expect(front.queryByTestId("store.logo.secondary")).not.toBeInTheDocument();
  });

  it("shows 16 stars and no birthday tag, while the MINOR tag still appears", async () => {
    renderCard(FULL_ROADIE);

    const front = await visibleFace();
    // The star container holds exactly 16 star spans.
    const starContainer = front
      .getAllByText("★", { selector: ".stars span" })[0]
      .closest(".stars");
    expect(starContainer?.querySelectorAll("span")).toHaveLength(16);

    // The birthday tag is gone; the MINOR tag remains for a minor.
    expect(
      screen.queryByTestId("roadie.birthday_badge"),
    ).not.toBeInTheDocument();
    expect(await screen.findByTestId("roadie.minor_badge")).toBeInTheDocument();
  });

  it("shows the Roadie since footer with the hire date and store city", async () => {
    renderCard(FULL_ROADIE);

    const front = await visibleFace();
    // A roadie card keeps the original "Roadie since" footer; the leader
    // opening-team footer applies only to leader cards.
    expect(
      await front.findByText(`${t("roadie.card.roadieSince")} ${HIRE_LABEL}`),
    ).toBeInTheDocument();
    expect(front.getByText("Bake")).toBeInTheDocument();
  });

  it("falls back to hiredAt in the Roadie since footer when hireDate is absent", async () => {
    renderCard(FALLBACK_ROADIE);

    const front = await visibleFace();
    expect(
      await front.findByText(`${t("roadie.card.roadieSince")} ${HIRE_LABEL}`),
    ).toBeInTheDocument();
  });
});

describe("roadie card: back table replaces ROADIE STATS", () => {
  it("lists every non-empty About Me field in order and ends with HIRED", async () => {
    const user = userEvent.setup();
    renderCard(FULL_ROADIE);

    await user.click(await cardButton());
    const back = await visibleFace();

    // No ROADIE STATS section remains.
    expect(back.queryByText(t("roadie.card.stats"))).not.toBeInTheDocument();
    expect(
      back.queryByText(t("roadie.card.stat.orientation")),
    ).not.toBeInTheDocument();

    // The table rows appear in the accepted order, ending with Hired.
    const labels = [
      t("roadie.field.hometown"),
      t("roadie.field.crew"),
      t("roadie.field.dayOff"),
      t("roadie.field.favoriteTeam"),
      t("roadie.field.favoriteSnack"),
      t("roadie.field.favoriteDrink"),
      t("roadie.field.favoriteColor"),
      t("roadie.field.funFact"),
      t("roadie.field.hiredAt"),
    ];
    const rows = back.getAllByText(
      (_, element) => element?.className === "row",
    );
    const rowText = rows.map((row) => row.textContent ?? "");
    expect(rowText).toHaveLength(labels.length);
    labels.forEach((label, index) => {
      expect(rowText[index]).toContain(label);
    });

    // The last row is HIRED: and shows the hire date.
    expect(rowText[rowText.length - 1]).toContain(HIRE_LABEL);

    // The MY GOAL quote stays under the table.
    expect(back.getByText(t("roadie.card.goal"))).toBeInTheDocument();
    expect(back.getByText(/Run the fry station/)).toBeInTheDocument();
  });

  it("still hides empty About Me fields and shows HIRED for a sparse roadie", async () => {
    const user = userEvent.setup();
    renderCard(FALLBACK_ROADIE);

    await user.click(await cardButton());
    const back = await visibleFace();

    expect(
      back.queryByText(t("roadie.field.hometown")),
    ).not.toBeInTheDocument();
    expect(back.queryByText(t("roadie.field.crew"))).not.toBeInTheDocument();
    expect(back.queryByText(t("roadie.card.goal"))).not.toBeInTheDocument();

    // Hired is always present because the hire date is never blank.
    expect(back.getByText(t("roadie.field.hiredAt"))).toBeInTheDocument();
    expect(back.getByText(HIRE_LABEL)).toBeInTheDocument();
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
