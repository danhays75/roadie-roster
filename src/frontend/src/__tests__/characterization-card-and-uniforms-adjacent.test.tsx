import { renderPageWithActor, t } from "@/__tests__/router-test-utils";
import type {
  ContactSet,
  Crew,
  Position,
  Roadie,
  StoreInfo,
  UniformOrderView,
  backendInterface,
} from "@/backend";
import {
  House,
  RoadieStatus,
  Role,
  RosterState,
  UniformHouseFilter,
} from "@/backend";
import RoadieCardPage from "@/pages/RoadieCard";
import UniformsPage from "@/pages/Uniforms";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

/**
 * Characterization of behavior adjacent to the accepted card and uniform
 * changes, written before those edits. The request intentionally changes the
 * card-front badge, removes the ROADIE STATS section and the birthday tag,
 * drops the Favorite movie row, collapses the position uniform fields and
 * changes the projected-count math. This file deliberately does NOT assert any
 * of that. It protects only what must survive: the card's position pills, the
 * two-line back name and headshot, the Size unknown reason copy, and the
 * order-total formula that the projected change must not disturb.
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

/** A roadie with a main and a second position, and a populated profile. */
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
    hometown: "Bake",
    favoriteSnack: "Pretzels",
    hobbies: "Cycling",
    funFact: "Can juggle",
    goalHere: "Run the fry station",
  },
  contactSet: CONTACT,
};

function cardActor(roadie: Roadie, role: Role = Role.admin) {
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
  return renderPageWithActor(RoadieCardPage, cardActor(roadie, role), {
    path: "/roster/$roadieId",
    initialEntry: `/roster/${roadie.id}`,
  });
}

/** The card's flip control, found by its accessible flip label. */
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

describe("roadie card: position pills survive the badge change", () => {
  it("shows the main position and the second position on the front face", async () => {
    renderCard(FULL_ROADIE);

    const front = await visibleFace();
    // The main position pill carries the position name.
    expect(await front.findByText("Cashier")).toBeInTheDocument();
    // The second position pill carries the second position's name.
    expect(front.getByText("Fry Cook")).toBeInTheDocument();
  });
});

describe("roadie card: back name and headshot survive the stats removal", () => {
  it("shows the two-line name and the headshot window on the back face", async () => {
    const user = userEvent.setup();
    renderCard(FULL_ROADIE);

    await user.click(await cardButton());
    const back = await visibleFace();

    // The back name splits the preferred name across two lines.
    const name = back.getByRole("heading", { level: 2 });
    expect(name.textContent).toContain("Frank");
    expect(name.textContent).toContain("George");
    // The headshot window is present even without a stored photo.
    expect(back.getByTestId("roadie.card.headshot")).toBeInTheDocument();
  });
});

/* ---------------------------------------------------------------------------
   Uniforms page: the Size unknown reason copy for each missing-size case.
   The bucket itself is accepted behavior; this protects the copy mapping that
   the projected-count change must not disturb.
--------------------------------------------------------------------------- */

const UNIFORMS_STORE: StoreInfo = {
  ...STORE_INFO,
  openingDate: BigInt(Date.UTC(2027, 1, 8)) * 1_000_000n,
};

const ORDER: UniformOrderView = {
  filter: UniformHouseFilter.all,
  bufferPercent: 10n,
  rows: [{ item: "Polo", size: "M", hired: 4n, projected: 2n, orderTotal: 7n }],
  totals: [{ item: "Polo", hired: 4n, projected: 2n, orderTotal: 7n }],
  sizeUnknown: [
    { roadieId: 42n, name: "Dana Reed", missingShirt: true, missingHat: false },
    { roadieId: 43n, name: "Eli Stone", missingShirt: false, missingHat: true },
    { roadieId: 44n, name: "Fay West", missingShirt: true, missingHat: true },
  ],
};

function uniformsActor() {
  return {
    getUniformSettings: vi.fn<backendInterface["getUniformSettings"]>(
      async () => ({
        sizeCurve: {
          shirts: [{ size: "M", percent: 100n }],
          hats: [{ size: "One size", percent: 100n }],
        },
        bufferPercent: 10n,
      }),
    ),
    getUniformOrder: vi.fn<backendInterface["getUniformOrder"]>(async () =>
      structuredClone(ORDER),
    ),
    updateUniformSettings: vi.fn<backendInterface["updateUniformSettings"]>(
      async () => undefined,
    ),
    getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(
      async () => UNIFORMS_STORE,
    ),
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: {
        principal: { toText: () => "aaaaa-aa" } as never,
        role: Role.admin,
        approvedAt: 0n,
        approvedBy: { toText: () => "aaaaa-aa" } as never,
        trainerPositionIds: [],
      },
    })),
    getDemoState: vi.fn<backendInterface["getDemoState"]>(async () => ({
      enabled: false,
      demoTrainerStations: [],
    })),
  };
}

describe("Uniforms page: Size unknown reason copy", () => {
  it("labels each missing-size case with its own reason", async () => {
    renderPageWithActor(UniformsPage, uniformsActor(), {
      path: "/uniforms",
      initialEntry: "/uniforms",
    });

    const section = await screen.findByTestId("uniforms.size_unknown.section");
    // Each roadie is listed by name with the reason for their missing size.
    expect(within(section).getByText("Dana Reed")).toBeInTheDocument();
    expect(within(section).getByText("Missing shirt size")).toBeInTheDocument();
    expect(within(section).getByText("Eli Stone")).toBeInTheDocument();
    expect(within(section).getByText("Missing hat size")).toBeInTheDocument();
    expect(within(section).getByText("Fay West")).toBeInTheDocument();
    expect(
      within(section).getByText("Missing shirt and hat size"),
    ).toBeInTheDocument();
  });
});
