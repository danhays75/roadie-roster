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
import KioskPage from "@/pages/Kiosk";
import RoadieCardPage from "@/pages/RoadieCard";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Characterization of behavior adjacent to the About Me relabeling, the card
 * back row reorder, the card footer change, the UTC date-only formatting and
 * the new Gift Bags surface. None of these assertions describe the behavior the
 * request intentionally changes; they protect the surrounding behavior that
 * must keep working: the kiosk's required-field validation and step navigation,
 * the other About Me questions, the card's flip/photo/footer/quote and its
 * privacy invariant, the export variants, and the role-gated navigation.
 *
 * The backend is a typed local actor mock; no canister is contacted.
 */

beforeAll(() => {
  if (typeof URL.createObjectURL !== "function") {
    URL.createObjectURL = vi.fn(() => "blob:test-preview");
  }
  if (typeof URL.revokeObjectURL !== "function") {
    URL.revokeObjectURL = vi.fn();
  }
});

function kioskActor() {
  return {
    submitSignup: vi.fn<backendInterface["submitSignup"]>(async () => 1n),
  };
}

/** Upload a photo through the kiosk's file-picker fallback. */
async function uploadPhoto(user: ReturnType<typeof userEvent.setup>) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("photo file input not found");
  const file = new File(["photo-bytes"], "photo.png", { type: "image/png" });
  await user.upload(input, file);
}

/** Advance the kiosk from the welcome screen to the details step. */
async function reachDetailsStep(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByTestId("kiosk.start_button"));
  await uploadPhoto(user);
  await user.click(screen.getByTestId("kiosk.next_button"));
  await screen.findByTestId("kiosk.details_step");
}

describe("kiosk About Me: adjacent behavior", () => {
  it("keeps the non-relabeled About Me questions on the details step", async () => {
    const user = userEvent.setup();
    renderPageWithActor(KioskPage, kioskActor(), { path: "/kiosk" });
    await reachDetailsStep(user);

    // The questions the request does not touch must still render.
    expect(screen.getByTestId("kiosk.hometown.input")).toBeInTheDocument();
    expect(screen.getByTestId("kiosk.fun_fact.textarea")).toBeInTheDocument();
    expect(screen.getByTestId("kiosk.goal_here.textarea")).toBeInTheDocument();
    expect(screen.getByTestId("kiosk.shirt_size.select")).toBeInTheDocument();
    expect(screen.getByTestId("kiosk.hat_size.select")).toBeInTheDocument();
    expect(screen.getByTestId("kiosk.shifts_wanted.input")).toBeInTheDocument();
    expect(screen.getByTestId("kiosk.weekday_lunch.yes")).toBeInTheDocument();
  });

  it("still blocks advancing without the required name and position", async () => {
    const user = userEvent.setup();
    renderPageWithActor(KioskPage, kioskActor(), { path: "/kiosk" });
    await reachDetailsStep(user);

    await user.click(screen.getByTestId("kiosk.next_button"));

    expect(screen.getByTestId("kiosk.details_step")).toBeInTheDocument();
    expect(screen.getByTestId("kiosk.name.input")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByTestId("kiosk.position.input")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("advances to the contact step once name and position are filled", async () => {
    const user = userEvent.setup();
    renderPageWithActor(KioskPage, kioskActor(), { path: "/kiosk" });
    await reachDetailsStep(user);

    await user.type(screen.getByTestId("kiosk.name.input"), "Ada Lovelace");
    await user.type(screen.getByTestId("kiosk.position.input"), "Cashier");
    await user.click(screen.getByTestId("kiosk.next_button"));

    expect(await screen.findByTestId("kiosk.contact_step")).toBeInTheDocument();
  });

  it("offers both language choices on the welcome screen", async () => {
    renderPageWithActor(KioskPage, kioskActor(), { path: "/kiosk" });

    expect(await screen.findByTestId("kiosk.lang.en")).toBeInTheDocument();
    expect(screen.getByTestId("kiosk.lang.es")).toBeInTheDocument();
  });
});

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

const START_DATE = BigInt(Date.UTC(2027, 2, 14)) * 1_000_000n;

/** A roadie with the About Me fields the request does not remove. */
const FULL_ROADIE: Roadie = {
  id: 1n,
  status: RoadieStatus.certified,
  orientationEventId: 3n,
  mainPositionId: 0n,
  crewId: 7n,
  birthdayMonthDay: "03-14",
  isMinor: true,
  isDemo: false,
  hiredAt: 0n,
  hireDate: START_DATE,
  startDate: START_DATE,
  rosterState: RosterState.active,
  profile: {
    name: "Frank George",
    preferredName: "Frank",
    hometown: "Bake",
    favoriteSnack: "Pretzels",
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

const PHOTO_BYTES = new Uint8Array([1, 2, 3, 4]);

function cardActor(roadie: Roadie, role: Role = Role.admin) {
  return {
    getRoadie: vi.fn<backendInterface["getRoadie"]>(async () => roadie),
    listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
      POSITION,
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
  return renderPageWithActor(RoadieCardPage, cardActor(roadie, role), {
    path: "/roster/$roadieId",
    initialEntry: `/roster/${roadie.id}`,
  });
}

/** The card's flip control, found by its accessible flip label. */
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

describe("roadie card: adjacent behavior", () => {
  it("flips to the back and back to the front on tap", async () => {
    const user = userEvent.setup();
    renderCard(FULL_ROADIE);

    const card = await cardFlipControl();
    expect(card).toHaveAttribute("aria-label", t("roadie.action.showBack"));

    await user.click(card);
    expect(card).toHaveAttribute("aria-label", t("roadie.action.flipBack"));

    await user.click(card);
    expect(card).toHaveAttribute("aria-label", t("roadie.action.showBack"));
  });

  it("shows the roadie's photo on the front face", async () => {
    renderCard(FULL_ROADIE);

    const front = await visibleFace();
    const photo = await front.findByTestId("roadie.card.photo");
    expect(photo).toBeInTheDocument();
    expect(
      await front.findByRole("img", { name: "Frank" }),
    ).toBeInTheDocument();
  });

  it("shows the ROADIE SINCE footer with the start date and store city", async () => {
    renderCard(FULL_ROADIE);

    const front = await visibleFace();
    expect(
      front.getByText(t("roadie.card.roadieSince"), { exact: false }),
    ).toBeInTheDocument();
    expect(
      front.getByText(formatDateOnly(START_DATE), { exact: false }),
    ).toBeInTheDocument();
    expect(await front.findByText("Bake")).toBeInTheDocument();
  });

  it("keeps the MY GOAL quote below the back table", async () => {
    const user = userEvent.setup();
    renderCard(FULL_ROADIE);

    await user.click(await cardFlipControl());
    const back = await visibleFace();

    expect(back.getByText(t("roadie.card.goal"))).toBeInTheDocument();
    expect(back.getByText(/Run the fry station/)).toBeInTheDocument();
  });

  it("hides every empty profile field and the empty goal on the back face", async () => {
    const user = userEvent.setup();
    renderCard(SPARSE_ROADIE);

    await user.click(await cardFlipControl());
    const back = await visibleFace();

    expect(
      back.queryByText(t("roadie.field.hometown")),
    ).not.toBeInTheDocument();
    expect(back.queryByText(t("roadie.field.crew"))).not.toBeInTheDocument();
    expect(back.queryByText(t("roadie.field.funFact"))).not.toBeInTheDocument();
    expect(back.queryByText(t("roadie.card.goal"))).not.toBeInTheDocument();
  });

  it("never renders phone, email or date of birth on either face", async () => {
    const user = userEvent.setup();
    renderCard(FULL_ROADIE);

    await screen.findByTestId("roadie.flip_card");
    expect(screen.queryByText("+1-555-0100")).not.toBeInTheDocument();
    expect(screen.queryByText("frank@example.com")).not.toBeInTheDocument();

    await user.click(await cardFlipControl());
    expect(screen.queryByText("+1-555-0100")).not.toBeInTheDocument();
    expect(screen.queryByText("frank@example.com")).not.toBeInTheDocument();
  });
});
