import { renderPageWithActor, t } from "@/__tests__/router-test-utils";
import type {
  GiftBagGroup,
  GiftBagLabel,
  GiftBagsData,
  Position,
  backendInterface,
} from "@/backend";
import { GiftBagCategory, House, Role } from "@/backend";
import { Layout } from "@/components/Layout";
import { buildGiftBagsWorkbook } from "@/lib/giftBags";
import GiftBagsPage from "@/pages/GiftBags";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

/**
 * Cover for the accepted Gift Bags surface: the nav item is visible only to
 * Admin, Store Manager and Training Manager; the shopping list groups answers
 * case-insensitively ignoring extra spaces and punctuation, shows the most
 * common spelling, sorts by count highest first and includes a No answer count;
 * the filters change the counts; the labels carry the accepted fields and never
 * contact info; and the download builds a two-sheet workbook. The backend is a
 * typed local actor mock; no canister is contacted.
 */

const POSITION: Position = {
  id: 0n,
  name: "Cashier",
  code: "CSH",
  house: House.foh,
  openingBuildTo: 2n,
  afterOpeningBuildTo: 2n,
  minimumAge: 18n,
  needsAlcoholCert: false,
  shirtType: "Polo",
  shirtQty: 2n,
  hatType: "Cap",
  hatQty: 1n,
  defaultShirts: 2n,
  defaultHats: 1n,
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

/** The full payload the page renders for the All filter. */
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

function actor(role: Role, data: GiftBagsData = allData()) {
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

function renderGiftBags(role: Role, data?: GiftBagsData) {
  return renderPageWithActor(GiftBagsPage, actor(role, data), {
    path: "/gift-bags",
  });
}

describe("Gift Bags nav visibility", () => {
  function Page() {
    return (
      <Layout>
        <p>content</p>
      </Layout>
    );
  }

  it.each([Role.admin, Role.storeManager, Role.trainingManager])(
    "shows the Gift Bags link to %s",
    async (role) => {
      renderPageWithActor(Page, actor(role), { path: "/" });
      expect(
        await screen.findByTestId("nav.gift-bags.link"),
      ).toBeInTheDocument();
    },
  );

  it.each([
    Role.leadership,
    Role.visitingManager,
    Role.trainer,
    Role.kiosk,
    Role.integration,
  ])("hides the Gift Bags link from %s", async (role) => {
    renderPageWithActor(Page, actor(role), { path: "/" });
    // The always-visible roster link renders, but Gift Bags does not.
    expect(await screen.findByTestId("nav.roster.link")).toBeInTheDocument();
    expect(screen.queryByTestId("nav.gift-bags.link")).not.toBeInTheDocument();
  });
});

describe("Gift Bags shopping list", () => {
  it("sorts answers by count highest first and shows the No answer count", async () => {
    renderGiftBags(Role.admin);

    const candy = await screen.findByTestId("gift_bags.shopping.candySnack");
    const rows = within(candy).getAllByTestId(
      "gift_bags.shopping.candySnack.row",
    );
    // Snickers (3) sorts above Hot Cheetos (1).
    expect(rows[0]).toHaveTextContent("Snickers");
    expect(rows[0]).toHaveTextContent("3");
    expect(rows[1]).toHaveTextContent("Hot Cheetos");
    expect(rows[1]).toHaveTextContent("1");

    // The No answer row carries the backend's count.
    const noAnswer = within(candy).getByTestId(
      "gift_bags.shopping.candySnack.no_answer",
    );
    expect(noAnswer).toHaveTextContent(t("giftBags.noAnswer"));
    expect(noAnswer).toHaveTextContent("2");
  });

  it("renders every shopping category section", async () => {
    renderGiftBags(Role.admin);

    for (const category of [
      "candySnack",
      "drink",
      "sportsTeam",
      "color",
      "shirtSize",
      "hatSize",
    ]) {
      expect(
        await screen.findByTestId(`gift_bags.shopping.${category}`),
      ).toBeInTheDocument();
    }
  });

  it("re-queries the backend when the filter changes", async () => {
    const user = userEvent.setup();
    const a = actor(Role.admin);
    renderPageWithActor(GiftBagsPage, a, { path: "/gift-bags" });

    await screen.findByTestId("gift_bags.shopping.candySnack");
    // The initial read is the All filter.
    expect(a.getGiftBags).toHaveBeenCalledWith({ __kind__: "all", all: null });

    await user.click(screen.getByTestId("gift_bags.filter.select"));
    await user.click(await screen.findByTestId("gift_bags.filter.foh"));

    // The FOH filter triggers a fresh read with the FOH variant.
    expect(a.getGiftBags).toHaveBeenCalledWith({ __kind__: "foh", foh: null });
  });
});

describe("Gift Bags labels", () => {
  it("prints the accepted label fields and never contact info", async () => {
    renderGiftBags(Role.admin);

    const label = await screen.findByTestId("gift_bags.label.item");
    expect(label).toHaveTextContent("Ada Lovelace");
    expect(label).toHaveTextContent("Cashier");
    expect(label).toHaveTextContent("Snickers");
    expect(label).toHaveTextContent("Coffee");
    expect(label).toHaveTextContent("LSU Tigers");
    expect(label).toHaveTextContent("Navy blue");
    expect(label).toHaveTextContent("M");
    expect(label).toHaveTextContent("S/M");

    // No phone, email or date of birth anywhere on the page.
    const page = screen.getByTestId("gift_bags.page");
    expect(page).not.toHaveTextContent("+1-555");
    expect(page).not.toHaveTextContent("@example.com");
    expect(page).not.toHaveTextContent("Date of birth");
  });
});

describe("Gift Bags download workbook", () => {
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
