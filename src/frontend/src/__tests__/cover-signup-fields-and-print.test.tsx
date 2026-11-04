import { renderPageWithActor } from "@/__tests__/router-test-utils";
import type {
  GiftBagGroup,
  GiftBagLabel,
  GiftBagsData,
  Position,
  backendInterface,
} from "@/backend";
import { GiftBagCategory, House, Role } from "@/backend";
import GiftBagsPage from "@/pages/GiftBags";
import KioskPage from "@/pages/Kiosk";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// jsdom does not implement object URLs; the signature step uses them to redraw
// a saved signature. The other kiosk tests install the same polyfill.
if (typeof URL.createObjectURL !== "function") {
  URL.createObjectURL = vi.fn(() => "blob:test-preview");
}
if (typeof URL.revokeObjectURL !== "function") {
  URL.revokeObjectURL = vi.fn();
}

/**
 * Cover for two accepted behaviors not exercised elsewhere: a kiosk sign-up
 * collects the three new About Me fields and carries them into the review
 * payload, and the Gift Bags page prints Avery 5163 labels with the app chrome
 * hidden and the label sheet in the print area. The backend is a typed local
 * actor mock; no canister is contacted, so real storage is covered by the
 * PocketIC lane instead.
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

function grant(role: Role) {
  return {
    principal: { toText: () => "aaaaa-aa" } as never,
    role,
    approvedAt: 0n,
    approvedBy: { toText: () => "aaaaa-aa" } as never,
    trainerPositionIds: [],
  };
}

/** A kiosk sign-up journey that fills the three new About Me fields. */
async function reachKioskReview() {
  const user = userEvent.setup();
  const submitSignup = vi.fn<backendInterface["submitSignup"]>(async () => 1n);

  // The signature canvas needs a 2D context and a blob before the step mounts.
  const ctx = {
    scale: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    set lineWidth(_v: number) {},
    set lineCap(_v: string) {},
    set lineJoin(_v: string) {},
    set strokeStyle(_v: string) {},
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
    (callback: BlobCallback) => {
      callback(new Blob(["signature-bytes"], { type: "image/png" }));
    },
  );

  renderPageWithActor(KioskPage, { submitSignup }, { path: "/kiosk" });

  await user.click(await screen.findByTestId("kiosk.start_button"));

  // Step 0: photo.
  const fileInput =
    document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!fileInput) throw new Error("photo file input not found");
  await user.upload(
    fileInput,
    new File(["photo-bytes"], "photo.png", { type: "image/png" }),
  );
  await user.click(screen.getByTestId("kiosk.next_button"));

  // Step 1: details, including the three new fields.
  await user.type(
    await screen.findByTestId("kiosk.name.input"),
    "Ada Lovelace",
  );
  await user.type(screen.getByTestId("kiosk.position.input"), "Cashier");
  await user.type(
    screen.getByTestId("kiosk.favorite_team.textarea"),
    "LSU Tigers",
  );
  await user.type(
    screen.getByTestId("kiosk.favorite_drink.textarea"),
    "Coffee",
  );
  await user.type(
    screen.getByTestId("kiosk.favorite_color.textarea"),
    "Navy blue",
  );
  await user.click(screen.getByTestId("kiosk.next_button"));

  // Step 2: contact.
  await user.type(
    await screen.findByTestId("kiosk.email.input"),
    "ada@example.com",
  );
  await user.type(screen.getByTestId("kiosk.phone.input"), "+1-555-0100");
  await user.type(
    screen.getByTestId("kiosk.date_of_birth.input"),
    "1990-01-01",
  );
  await user.type(
    screen.getByTestId("kiosk.emergency_contact_name.input"),
    "Grace",
  );
  await user.type(
    screen.getByTestId("kiosk.emergency_contact_phone.input"),
    "+1-555-0101",
  );
  await user.click(screen.getByTestId("kiosk.next_button"));

  // Step 3: availability.
  await screen.findByTestId("kiosk.availability_step");
  await user.click(screen.getByTestId("kiosk.availability.wed.am"));
  await user.click(screen.getByTestId("kiosk.next_button"));

  // Step 4: signature.
  const canvas = await screen.findByTestId("kiosk.signature.canvas_target");
  const { fireEvent } = await import("@testing-library/react");
  fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 10, clientY: 10 });
  fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 40, clientY: 40 });
  fireEvent.pointerUp(canvas, { pointerId: 1 });
  await user.click(screen.getByTestId("kiosk.next_button"));

  // Step 5: review.
  await screen.findByTestId("kiosk.review_step");
  return submitSignup;
}

describe("kiosk sign-up carries the three new About Me fields", () => {
  it("shows Favorite team, Favorite drink and Favorite color on the review step", async () => {
    await reachKioskReview();

    const review = await screen.findByTestId("kiosk.review_step");
    // The three new answers are collected and carried into the review payload.
    expect(within(review).getByText("LSU Tigers")).toBeInTheDocument();
    expect(within(review).getByText("Coffee")).toBeInTheDocument();
    expect(within(review).getByText("Navy blue")).toBeInTheDocument();
    // The removed Favorite movie question is not part of the review.
    expect(
      within(review).queryByText("Favorite movie"),
    ).not.toBeInTheDocument();
  }, 20_000);
});

const LABEL: GiftBagLabel = {
  roadieId: 1n,
  house: House.foh,
  name: "Ada Lovelace",
  positionName: "Cashier",
  candySnack: "Snickers",
  drink: "Coffee",
  sportsTeam: "LSU Tigers",
  color: "Navy blue",
  shirtSize: "M",
  hatSize: "S/M",
};

function group(
  category: GiftBagCategory,
  answers: Array<[string, number]>,
  noAnswer: number,
): GiftBagGroup {
  return {
    category,
    noAnswer: BigInt(noAnswer),
    answers: answers.map(([answer, count]) => ({
      answer,
      count: BigInt(count),
    })),
  };
}

function giftBagsData(): GiftBagsData {
  return {
    groups: [
      group(GiftBagCategory.candySnack, [["Snickers", 1]], 0),
      group(GiftBagCategory.drink, [["Coffee", 1]], 0),
      group(GiftBagCategory.sportsTeam, [["LSU Tigers", 1]], 0),
      group(GiftBagCategory.color, [["Navy blue", 1]], 0),
      group(GiftBagCategory.shirtSize, [["M", 1]], 0),
      group(GiftBagCategory.hatSize, [["S/M", 1]], 0),
    ],
    labels: [LABEL],
  };
}

function giftBagsActor() {
  return {
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: grant(Role.admin),
    })),
    listPendingUsers: vi.fn<backendInterface["listPendingUsers"]>(
      async () => [],
    ),
    listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
      POSITION,
    ]),
    getGiftBags: vi.fn<backendInterface["getGiftBags"]>(async () =>
      giftBagsData(),
    ),
  };
}

describe("Gift Bags Avery 5163 print structure", () => {
  it("puts the labels in the print area and the app chrome in print-hide", async () => {
    renderPageWithActor(GiftBagsPage, giftBagsActor(), { path: "/gift-bags" });

    const label = await screen.findByTestId("gift_bags.label.item");
    // Each label is an Avery 5163 cell (2in x 4in) inside the label sheet.
    expect(label).toHaveClass("avery-label");
    const sheet = label.closest(".avery-sheet");
    expect(sheet).not.toBeNull();
    // The sheet is the only thing that prints.
    const printArea = sheet?.closest(".print-area");
    expect(printArea).not.toBeNull();

    // The page header and the labels heading are hidden when printing.
    const page = screen.getByTestId("gift_bags.page");
    const printHide = page.querySelectorAll(".print-hide");
    expect(printHide.length).toBeGreaterThan(0);
    // The print button itself is inside a print-hide region.
    const printButton = screen.getByTestId("gift_bags.print_button");
    expect(printButton.closest(".print-hide")).not.toBeNull();

    // The label carries the accepted fields and no contact info.
    expect(label).toHaveTextContent("Ada Lovelace");
    expect(label).toHaveTextContent("Snickers");
    expect(label).toHaveTextContent("Coffee");
    expect(label).toHaveTextContent("LSU Tigers");
    expect(label).toHaveTextContent("Navy blue");
    expect(label).toHaveTextContent("M");
    expect(label).toHaveTextContent("S/M");
    expect(within(label).queryByText(/\+1-555/)).not.toBeInTheDocument();
  });
});
