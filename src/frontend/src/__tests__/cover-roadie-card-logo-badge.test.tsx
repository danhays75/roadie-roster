import { renderPageWithActor, t } from "@/__tests__/router-test-utils";
import type {
  ContactSet,
  Position,
  Roadie,
  StoreInfo,
  backendInterface,
} from "@/backend";
import { House, RoadieStatus, Role } from "@/backend";
import RoadieCardPage from "@/pages/RoadieCard";
import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * Cover for the trading-card restyle's new front-face branch: the uploaded
 * secondary logo (or, when only a main logo exists, the main logo) replaces the
 * drawn bottle-cap badge in the top banner. The no-logo bottle-cap path is
 * covered by roadie-card-trading-card.test.tsx; this file protects the branch
 * the restyle added. The backend is a typed local actor mock; no canister is
 * contacted.
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

const ROADIE: Roadie = {
  id: 1n,
  status: RoadieStatus.certified,
  orientationEventId: 3n,
  mainPositionId: 0n,
  crewId: 7n,
  birthdayMonthDay: "03-14",
  isMinor: true,
  isDemo: false,
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

/** A single byte is enough to produce a non-empty data URL. */
const LOGO_BYTES = new Uint8Array([1, 2, 3, 4]);

function actor(logos: { logo?: Uint8Array; secondaryLogo?: Uint8Array }) {
  return {
    getRoadie: vi.fn<backendInterface["getRoadie"]>(async () => ROADIE),
    listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
      POSITION,
    ]),
    listCrews: vi.fn<backendInterface["listCrews"]>(async () => []),
    getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(
      async () => STORE_INFO,
    ),
    getStoreLogo: vi.fn<backendInterface["getStoreLogo"]>(async () => logos),
    getPhoto: vi.fn<backendInterface["getPhoto"]>(async () => null),
    isMinor: vi.fn<backendInterface["isMinor"]>(async () => ROADIE.isMinor),
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: {
        principal: { toText: () => "aaaaa-aa" } as never,
        role: Role.admin,
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

function renderCard(logos: {
  logo?: Uint8Array;
  secondaryLogo?: Uint8Array;
}) {
  return renderPageWithActor(RoadieCardPage, actor(logos), {
    path: "/roster/$roadieId",
    initialEntry: `/roster/${ROADIE.id}`,
  });
}

/** The currently visible face of the card. */
async function visibleFace() {
  const card = await screen.findByTestId("roadie.flip_card");
  const faces = card.querySelectorAll<HTMLElement>("[aria-hidden]");
  const face = Array.from(faces).find(
    (node) => node.getAttribute("aria-hidden") === "false",
  );
  if (!face) throw new Error("no visible card face");
  return within(face);
}

describe("roadie trading card: front-face logo substitution", () => {
  it("shows the uploaded secondary logo instead of the bottle-cap badge", async () => {
    renderCard({ secondaryLogo: LOGO_BYTES });

    const front = await visibleFace();
    expect(
      await front.findByTestId("store.logo.secondary"),
    ).toBeInTheDocument();
    // The drawn bottle-cap badge is replaced, not shown alongside.
    expect(
      front.queryByLabelText(t("roadie.card.badge")),
    ).not.toBeInTheDocument();
  });

  it("falls back to the main logo when only a main logo is uploaded", async () => {
    renderCard({ logo: LOGO_BYTES });

    const front = await visibleFace();
    expect(await front.findByTestId("store.logo")).toBeInTheDocument();
    expect(
      front.queryByLabelText(t("roadie.card.badge")),
    ).not.toBeInTheDocument();
  });

  it("shows the drawn bottle-cap badge when no logo is uploaded", async () => {
    renderCard({});

    const front = await visibleFace();
    expect(front.getByLabelText(t("roadie.card.badge"))).toBeInTheDocument();
    expect(front.queryByTestId("store.logo")).not.toBeInTheDocument();
    expect(front.queryByTestId("store.logo.secondary")).not.toBeInTheDocument();
  });
});
