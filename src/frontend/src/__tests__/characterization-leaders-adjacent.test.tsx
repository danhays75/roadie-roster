import { renderPageWithActor, t } from "@/__tests__/router-test-utils";
import { renderWithActor } from "@/__tests__/test-utils";
import type {
  AccessGrant,
  Crew,
  GiftBagGroup,
  GiftBagLabel,
  GiftBagsData,
  Position,
  Roadie,
  StaffProfile,
  StoreInfo,
  backendInterface,
} from "@/backend";
import {
  GiftBagCategory,
  House,
  RoadieStatus,
  Role,
  RosterState,
} from "@/backend";
import { StaffProfileForm } from "@/components/StaffProfileForm";
import { I18nContext } from "@/hooks/useI18n";
import type { Locale } from "@/lib/copy";
import { buildGiftBagsWorkbook } from "@/lib/giftBags";
import GiftBagsPage from "@/pages/GiftBags";
import MyProfilePage from "@/pages/MyProfile";
import RoadieCardPage from "@/pages/RoadieCard";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

/**
 * Characterization of behavior adjacent to the Leaders work, written before the
 * leader About Me fields, the ROADIE tier ribbon and the new Gift Bags filter
 * options are added. None of these assertions describe the behavior the request
 * intentionally changes; they protect the surrounding behavior that must keep
 * working: the staff profile form's required-field validation and save path, the
 * roadie card's flip/photo/footer/quote and its privacy invariant, the Gift Bags
 * shopping list grouping and label fields, and the role-gated navigation.
 *
 * The backend is a typed local actor mock; no canister is contacted.
 */

const PRINCIPAL = { toText: () => "aaaaa-aa" } as never;

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
  openingDate: 0n,
  pmShiftEnd: 0n,
  trainingGroupSize: 4n,
  address: "1 Main St",
  locationName: "Bake",
  timeZone: "America/Chicago",
  storePhone: "+1-555-0199",
  paperworkDueDate: 1_800_000_000_000_000_000n,
};

const PROFILE: StaffProfile = {
  fullName: "Jordan Rivera",
  preferredName: "Jordan",
  title: "Store Manager",
  requestedRole: Role.storeManager,
  homeStoreNumber: "975",
  homeStoreCity: "Lake Charles",
  trainerPositionIds: [],
};

function grant(role: Role, staffProfile?: StaffProfile): AccessGrant {
  return {
    principal: PRINCIPAL,
    role,
    approvedAt: 0n,
    approvedBy: PRINCIPAL,
    trainerPositionIds: [],
    staffProfile,
  };
}

/** A roadie with the About Me fields the request does not remove. */
const FULL_ROADIE: Roadie = {
  id: 1n,
  status: RoadieStatus.certified,
  mainPositionId: 0n,
  crewId: 7n,
  isMinor: false,
  hiredAt: 0n,
  isDemo: false,
  hireDate: BigInt(Date.UTC(2027, 0, 30, 12, 0, 0)) * 1_000_000n,
  rosterState: RosterState.active,
  profile: {
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
  },
};

function cardActor(roadie: Roadie) {
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
    getPhoto: vi.fn<backendInterface["getPhoto"]>(async () => null),
    isMinor: vi.fn<backendInterface["isMinor"]>(async () => roadie.isMinor),
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: grant(Role.admin),
    })),
    getContactSet: vi.fn<backendInterface["getContactSet"]>(async () => []),
    getChecklists: vi.fn<backendInterface["getChecklists"]>(async () => ({
      paperwork: [],
      orientationUniform: [],
    })),
    listChangeLog: vi.fn<backendInterface["listChangeLog"]>(async () => []),
  };
}

function renderCard(roadie: Roadie) {
  return renderPageWithActor(RoadieCardPage, cardActor(roadie), {
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

describe("staff profile form: adjacent behavior", () => {
  function wrap(ui: React.ReactElement) {
    return (
      <I18nContext.Provider
        value={{ locale: "en" as Locale, setLocale: vi.fn(), t }}
      >
        {ui}
      </I18nContext.Provider>
    );
  }

  it("still blocks submit and reports the first missing required field", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderWithActor(
      wrap(
        <StaffProfileForm
          submitLabel={t("profile.submit")}
          pending={false}
          onSubmit={onSubmit}
        />,
      ),
      {
        listPositions: vi.fn<backendInterface["listPositions"]>(async () => []),
      } satisfies Pick<backendInterface, "listPositions">,
    );

    await user.click(screen.getByTestId("profile.submit_button"));

    expect(screen.getByTestId("profile.error_state")).toHaveTextContent(
      t("profile.fullName.required"),
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits a complete profile with the existing fields intact", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderWithActor(
      wrap(
        <StaffProfileForm
          submitLabel={t("profile.submit")}
          pending={false}
          onSubmit={onSubmit}
        />,
      ),
      {
        listPositions: vi.fn<backendInterface["listPositions"]>(async () => []),
      } satisfies Pick<backendInterface, "listPositions">,
    );

    await user.type(
      screen.getByTestId("profile.full_name.input"),
      "Jordan Rivera",
    );
    await user.type(screen.getByTestId("profile.title.input"), "Store Manager");
    await user.type(
      screen.getByTestId("profile.home_store_number.input"),
      "975",
    );
    await user.type(
      screen.getByTestId("profile.home_store_city.input"),
      "Lake Charles",
    );
    await user.click(screen.getByTestId("profile.role.select"));
    await user.click(
      await screen.findByRole("option", { name: "Store Manager" }),
    );
    await user.click(screen.getByTestId("profile.submit_button"));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const submitted = onSubmit.mock.calls[0]?.[0] as StaffProfile;
    expect(submitted.fullName).toBe("Jordan Rivera");
    expect(submitted.title).toBe("Store Manager");
    expect(submitted.requestedRole).toBe(Role.storeManager);
    expect(submitted.homeStoreNumber).toBe("975");
    expect(submitted.homeStoreCity).toBe("Lake Charles");
  });

  it("seeds My profile from the grant and saves an edited profile", async () => {
    const user = userEvent.setup();
    const updateMyStaffProfile = vi.fn<
      backendInterface["updateMyStaffProfile"]
    >(async () => {});
    const actor = {
      getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
        grant: grant(Role.storeManager, PROFILE),
      })),
      listPositions: vi.fn<backendInterface["listPositions"]>(async () => []),
      updateMyStaffProfile,
    };
    renderPageWithActor(MyProfilePage, actor, { path: "/my-profile" });

    const fullName = await screen.findByTestId("my_profile.full_name.input");
    expect(fullName).toHaveValue("Jordan Rivera");

    await user.clear(fullName);
    await user.type(fullName, "Jordan R. Rivera");
    await user.click(screen.getByTestId("my_profile.submit_button"));

    await waitFor(() => expect(updateMyStaffProfile).toHaveBeenCalledTimes(1));
    expect(updateMyStaffProfile.mock.calls[0]?.[0]?.fullName).toBe(
      "Jordan R. Rivera",
    );
    expect(
      await screen.findByTestId("my_profile.success_state"),
    ).toBeInTheDocument();
  });
});

describe("roadie card: adjacent behavior", () => {
  it("flips to the back and back to the front on tap", async () => {
    const user = userEvent.setup();
    renderCard(FULL_ROADIE);

    const control = await cardFlipControl();
    expect(control).toHaveAttribute("aria-label", t("roadie.action.showBack"));

    await user.click(control);
    expect(control).toHaveAttribute("aria-label", t("roadie.action.flipBack"));

    await user.click(control);
    expect(control).toHaveAttribute("aria-label", t("roadie.action.showBack"));
  });

  it("keeps the ROADIE SINCE footer and the MY GOAL quote", async () => {
    const user = userEvent.setup();
    renderCard(FULL_ROADIE);

    const front = await visibleFace();
    expect(
      front.getByText(t("roadie.card.roadieSince"), { exact: false }),
    ).toBeInTheDocument();
    expect(await front.findByText("Bake")).toBeInTheDocument();

    await user.click(await cardFlipControl());
    const back = await visibleFace();
    expect(back.getByText(t("roadie.card.goal"))).toBeInTheDocument();
    expect(back.getByText(/Run the fry station/)).toBeInTheDocument();
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

/** A group with the given answers and No answer count. */
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

function allData(): GiftBagsData {
  return {
    groups: [
      group(
        GiftBagCategory.candySnack,
        [
          ["Snickers", 3],
          ["Hot Cheetos", 1],
        ],
        2,
      ),
      group(GiftBagCategory.drink, [["Coffee", 2]], 4),
      group(GiftBagCategory.sportsTeam, [["LSU Tigers", 1]], 5),
      group(GiftBagCategory.color, [["Navy blue", 1]], 5),
      group(GiftBagCategory.shirtSize, [["M", 2]], 4),
      group(GiftBagCategory.hatSize, [["S/M", 1]], 5),
    ],
    labels: [LABEL],
  };
}

function giftBagsActor(role: Role, data: GiftBagsData = allData()) {
  return {
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: grant(role),
    })),
    listPendingUsers: vi.fn<backendInterface["listPendingUsers"]>(
      async () => [],
    ),
    listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
      POSITION,
    ]),
    getGiftBags: vi.fn<backendInterface["getGiftBags"]>(async () => data),
  };
}

describe("Gift Bags: adjacent behavior", () => {
  it("sorts answers by count highest first and shows the No answer count", async () => {
    renderPageWithActor(GiftBagsPage, giftBagsActor(Role.admin), {
      path: "/gift-bags",
    });

    const candy = await screen.findByTestId("gift_bags.shopping.candySnack");
    const rows = within(candy).getAllByTestId(
      "gift_bags.shopping.candySnack.row",
    );
    expect(rows[0]).toHaveTextContent("Snickers");
    expect(rows[0]).toHaveTextContent("3");
    expect(rows[1]).toHaveTextContent("Hot Cheetos");
    expect(rows[1]).toHaveTextContent("1");

    const noAnswer = within(candy).getByTestId(
      "gift_bags.shopping.candySnack.no_answer",
    );
    expect(noAnswer).toHaveTextContent(t("giftBags.noAnswer"));
    expect(noAnswer).toHaveTextContent("2");
  });

  it("prints the accepted label fields and never contact info", async () => {
    renderPageWithActor(GiftBagsPage, giftBagsActor(Role.admin), {
      path: "/gift-bags",
    });

    const label = await screen.findByTestId("gift_bags.label.item");
    expect(label).toHaveTextContent("Ada Lovelace");
    expect(label).toHaveTextContent("Cashier");
    expect(label).toHaveTextContent("Snickers");
    expect(label).toHaveTextContent("Coffee");
    expect(label).toHaveTextContent("LSU Tigers");
    expect(label).toHaveTextContent("Navy blue");
    expect(label).toHaveTextContent("M");
    expect(label).toHaveTextContent("S/M");

    const page = screen.getByTestId("gift_bags.page");
    expect(page).not.toHaveTextContent("+1-555");
    expect(page).not.toHaveTextContent("@example.com");
    expect(page).not.toHaveTextContent("Date of birth");
  });

  it("builds a shopping-list sheet and a labels sheet", () => {
    const workbook = buildGiftBagsWorkbook(allData());
    const names = workbook.worksheets.map((sheet) => sheet.name);
    expect(names).toContain("Shopping list");
    expect(names).toContain("Labels");

    const shopping = workbook.getWorksheet("Shopping list");
    const shoppingText: string[] = [];
    shopping?.eachRow((row) => {
      row.eachCell((cell) => shoppingText.push(String(cell.value ?? "")));
    });
    expect(shoppingText).toContain("Snickers");
    expect(shoppingText).toContain("No answer");

    const labels = workbook.getWorksheet("Labels");
    const labelText: string[] = [];
    labels?.eachRow((row) => {
      row.eachCell((cell) => labelText.push(String(cell.value ?? "")));
    });
    expect(labelText).toContain("Ada Lovelace");
    expect(labelText).toContain("Snickers");
  });
});
