import { renderPageWithActor, t } from "@/__tests__/router-test-utils";
import { renderWithActor } from "@/__tests__/test-utils";
import type {
  AccessGrant,
  GiftBagLabel,
  GiftBagsData,
  LeaderSummary,
  Position,
  StaffProfile,
  backendInterface,
} from "@/backend";
import { House, Role } from "@/backend";
import { Layout } from "@/components/Layout";
import { StaffProfileForm } from "@/components/StaffProfileForm";
import { I18nContext, translate } from "@/hooks/useI18n";
import type { Locale } from "@/lib/copy";
import GiftBagsPage from "@/pages/GiftBags";
import LeaderCardPage from "@/pages/LeaderCard";
import LeadersPage from "@/pages/Leaders";
import MyProfilePage from "@/pages/MyProfile";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

/**
 * Cover for the accepted Leaders work: the leader About Me fields on the staff
 * profile form and My profile (optional, kiosk labels/placeholders, Spanish
 * copy, 200-character caps); the leader card's tier ribbon and gold/platinum/
 * legend variants; the Leaders page grouping cards by tier and opening a full
 * flip card; and the Gift Bags roadies/leaders filter with leader labels
 * showing the title. The backend is a typed local actor mock; no canister is
 * contacted.
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

/** A leader summary with a full staff profile and the given role. */
function leader(
  role: Role,
  principalText: string,
  profile: Partial<StaffProfile> = {},
): LeaderSummary {
  return {
    // The card route looks the leader up by `principal.toString()`, so the
    // mock principal must stringify to the same id the route carries.
    principal: {
      toText: () => principalText,
      toString: () => principalText,
    } as never,
    role,
    title: profile.title ?? "Manager",
    trainerPositionIds: [],
    staffProfile: {
      fullName: "Jordan Rivera",
      preferredName: "Jordan",
      title: "Manager",
      requestedRole: role,
      homeStoreNumber: "975",
      homeStoreCity: "Lake Charles",
      trainerPositionIds: [],
      ...profile,
    },
  };
}

describe("staff profile form: leader About Me fields", () => {
  function wrap(ui: React.ReactElement, locale: Locale = "en") {
    return (
      <I18nContext.Provider
        value={{
          locale,
          setLocale: vi.fn(),
          t: (key, vars) => translate(locale, key, vars),
        }}
      >
        {ui}
      </I18nContext.Provider>
    );
  }

  function renderForm(locale: Locale = "en") {
    return renderWithActor(
      wrap(
        <StaffProfileForm
          submitLabel={t("profile.submit")}
          pending={false}
          onSubmit={vi.fn()}
        />,
        locale,
      ),
      {
        listPositions: vi.fn<backendInterface["listPositions"]>(async () => []),
      } satisfies Pick<backendInterface, "listPositions">,
    );
  }

  it("shows the About Me fields with the kiosk labels and placeholders", () => {
    renderForm("en");

    expect(screen.getByTestId("profile.about_me.section")).toBeInTheDocument();
    expect(screen.getByText("Hometown")).toBeInTheDocument();
    expect(
      screen.getByText("What do you do on your day off?"),
    ).toBeInTheDocument();
    expect(screen.getByText("Favorite sports team")).toBeInTheDocument();
    expect(
      screen.getByText("Favorite candy or snack (brand)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Favorite drink")).toBeInTheDocument();
    expect(screen.getByText("Favorite color")).toBeInTheDocument();
    expect(screen.getByText("Fun fact")).toBeInTheDocument();
    expect(screen.getByText("Your goal here")).toBeInTheDocument();
    expect(screen.getByText("Shirt size")).toBeInTheDocument();
    expect(screen.getByText("Hat size")).toBeInTheDocument();

    expect(screen.getByTestId("profile.favorite_team.input")).toHaveAttribute(
      "placeholder",
      "e.g. LSU Tigers, Saints",
    );
    expect(screen.getByTestId("profile.favorite_snack.input")).toHaveAttribute(
      "placeholder",
      "e.g. Snickers, Hot Cheetos",
    );
    expect(screen.getByTestId("profile.favorite_drink.input")).toHaveAttribute(
      "placeholder",
      "Soda, energy drink, or coffee order",
    );
    expect(screen.getByTestId("profile.favorite_color.input")).toHaveAttribute(
      "placeholder",
      "e.g. Navy blue",
    );
  });

  it("shows the Spanish About Me copy", () => {
    renderForm("es");

    expect(screen.getByText("Sobre mí")).toBeInTheDocument();
    expect(screen.getByText("Ciudad natal")).toBeInTheDocument();
    expect(screen.getByText("¿Qué haces en tu día libre?")).toBeInTheDocument();
    expect(screen.getByText("Equipo deportivo favorito")).toBeInTheDocument();
    expect(
      screen.getByText("Dulce o snack favorito (marca)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Bebida favorita")).toBeInTheDocument();
    expect(screen.getByText("Color favorito")).toBeInTheDocument();
    expect(screen.getByText("Dato curioso")).toBeInTheDocument();
    expect(screen.getByText("Tu meta aquí")).toBeInTheDocument();
    expect(screen.getByText("Talla de camiseta")).toBeInTheDocument();
    expect(screen.getByText("Talla de gorra")).toBeInTheDocument();
  });

  it("caps every About Me answer at 200 characters", () => {
    renderForm("en");

    for (const testId of [
      "profile.hometown.input",
      "profile.favorite_team.input",
      "profile.favorite_snack.input",
      "profile.favorite_drink.input",
      "profile.favorite_color.input",
      "profile.hobbies.textarea",
      "profile.fun_fact.textarea",
      "profile.goal_here.textarea",
    ]) {
      expect(screen.getByTestId(testId)).toHaveAttribute("maxLength", "200");
    }
  });

  it("submits the About Me answers and leaves blank ones absent", async () => {
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
    await user.type(screen.getByTestId("profile.title.input"), "Manager");
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
    await user.type(screen.getByTestId("profile.hometown.input"), "Bake");
    await user.type(
      screen.getByTestId("profile.favorite_snack.input"),
      "Snickers",
    );
    await user.click(screen.getByTestId("profile.submit_button"));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const submitted = onSubmit.mock.calls[0]?.[0] as StaffProfile;
    expect(submitted.hometown).toBe("Bake");
    expect(submitted.favoriteSnack).toBe("Snickers");
    // A blank optional About Me field stays absent rather than empty.
    expect(submitted.favoriteDrink).toBeUndefined();
    expect(submitted.goalHere).toBeUndefined();
  });
});

describe("My profile: leader About Me fields", () => {
  it("seeds the About Me fields from the grant and saves an edit", async () => {
    const user = userEvent.setup();
    const updateMyStaffProfile = vi.fn<
      backendInterface["updateMyStaffProfile"]
    >(async () => {});
    const actor = {
      getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
        grant: grant(Role.storeManager, {
          fullName: "Jordan Rivera",
          preferredName: "Jordan",
          title: "Manager",
          requestedRole: Role.storeManager,
          homeStoreNumber: "975",
          homeStoreCity: "Lake Charles",
          trainerPositionIds: [],
          hometown: "Bake",
          favoriteSnack: "Snickers",
        }),
      })),
      listPositions: vi.fn<backendInterface["listPositions"]>(async () => []),
      updateMyStaffProfile,
    };
    renderPageWithActor(MyProfilePage, actor, { path: "/my-profile" });

    const hometown = await screen.findByTestId("my_profile.hometown.input");
    expect(hometown).toHaveValue("Bake");
    expect(screen.getByTestId("my_profile.favorite_snack.input")).toHaveValue(
      "Snickers",
    );

    await user.clear(hometown);
    await user.type(hometown, "Lafayette");
    await user.click(screen.getByTestId("my_profile.submit_button"));

    await waitFor(() => expect(updateMyStaffProfile).toHaveBeenCalledTimes(1));
    expect(updateMyStaffProfile.mock.calls[0]?.[0]?.hometown).toBe("Lafayette");
  });
});

describe("Leaders page: tier grouping and card pop-up", () => {
  function leadersActor(leaders: LeaderSummary[]) {
    return {
      getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
        grant: grant(Role.admin),
      })),
      listPendingUsers: vi.fn<backendInterface["listPendingUsers"]>(
        async () => [],
      ),
      listLeaders: vi.fn<backendInterface["listLeaders"]>(async () => leaders),
      listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
        POSITION,
      ]),
      listCrews: vi.fn<backendInterface["listCrews"]>(async () => []),
      getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(async () => ({
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
      })),
    };
  }

  it("groups cards by tier and opens the card pop-up from a tile", async () => {
    const user = userEvent.setup();
    const leaders = [
      leader(Role.leadership, "legend-1", { preferredName: "Lee" }),
      leader(Role.storeManager, "plat-1", { preferredName: "Pat" }),
      leader(Role.trainer, "gold-1", { preferredName: "Tay" }),
    ];
    renderPageWithActor(LeadersPage, leadersActor(leaders), {
      path: "/leaders",
    });

    const legend = await screen.findByTestId("leaders.section.legend");
    const plat = screen.getByTestId("leaders.section.plat");
    const gold = screen.getByTestId("leaders.section.gold");

    expect(within(legend).getByText(/Lee/)).toBeInTheDocument();
    expect(within(plat).getByText(/Pat/)).toBeInTheDocument();
    expect(within(gold).getByText(/Tay/)).toBeInTheDocument();

    // Tapping a tile opens the shared card pop-up rather than navigating.
    const tile = within(legend).getByTestId("leaders.item.link");
    expect(tile.tagName.toLowerCase()).toBe("button");
    await user.click(tile);

    const modal = await screen.findByTestId("roadie.card_modal");
    expect(within(modal).getByTestId("roadie.flip_card")).toBeInTheDocument();

    // The "Open full profile" link inside the modal still goes to the leader's
    // full card route.
    const fullProfile = within(modal).getByTestId(
      "roadie.card_modal.full_profile_link",
    );
    expect(within(fullProfile).getByRole("link")).toHaveAttribute(
      "href",
      "/leaders/legend-1",
    );
  });

  it("shows the tier ribbon label for each leader role", async () => {
    const leaders = [
      leader(Role.leadership, "legend-1"),
      leader(Role.storeManager, "plat-1"),
      leader(Role.trainer, "gold-1"),
    ];
    renderPageWithActor(LeadersPage, leadersActor(leaders), {
      path: "/leaders",
    });

    const legend = await screen.findByTestId("leaders.section.legend");
    const plat = screen.getByTestId("leaders.section.plat");
    const gold = screen.getByTestId("leaders.section.gold");

    expect(
      within(legend).getByText(t("roadie.card.tier.legend.leadership")),
    ).toBeInTheDocument();
    expect(
      within(plat).getByText(t("roadie.card.tier.plat")),
    ).toBeInTheDocument();
    expect(
      within(gold).getByText(t("roadie.card.tier.gold")),
    ).toBeInTheDocument();
  });

  it("groups by the stated profile role, not the access-grant role", async () => {
    // The store owner is bootstrapped as an Admin but stated Store Manager on
    // their profile, so they must group under Platinum with a MANAGER ribbon.
    const leaders = [
      leader(Role.admin, "owner-1", {
        preferredName: "Owen",
        requestedRole: Role.storeManager,
      }),
    ];
    renderPageWithActor(LeadersPage, leadersActor(leaders), {
      path: "/leaders",
    });

    const plat = await screen.findByTestId("leaders.section.plat");
    expect(within(plat).getByText(/Owen/)).toBeInTheDocument();
    expect(
      within(plat).getByText(t("roadie.card.tier.plat")),
    ).toBeInTheDocument();
    // The Admin grant role must not drop them into the Legend fallback.
    expect(
      screen.queryByTestId("leaders.section.legend"),
    ).not.toBeInTheDocument();
  });
});

describe("leader card: tier ribbon and variant", () => {
  function cardActor(leaders: LeaderSummary[]) {
    return {
      getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
        grant: grant(Role.admin),
      })),
      listLeaders: vi.fn<backendInterface["listLeaders"]>(async () => leaders),
      listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
        POSITION,
      ]),
      getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(async () => ({
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
      })),
      getPhoto: vi.fn<backendInterface["getPhoto"]>(async () => null),
    };
  }

  function renderLeaderCard(leaders: LeaderSummary[], leaderId: string) {
    return renderPageWithActor(LeaderCardPage, cardActor(leaders), {
      path: "/leaders/$leaderId",
      initialEntry: `/leaders/${leaderId}`,
    });
  }

  it("shows the gold variant and NSO TRAINER ribbon for a trainer", async () => {
    const leaders = [leader(Role.trainer, "gold-1")];
    renderLeaderCard(leaders, "gold-1");

    const card = await screen.findByTestId("roadie.flip_card");
    const flip = within(card).getByRole("button", {
      name: t("roadie.action.showBack"),
    });
    expect(flip).toHaveClass("gold");
    expect(
      within(card).getByText(t("roadie.card.tier.gold")),
    ).toBeInTheDocument();
  });

  it("shows the platinum variant and MANAGER ribbon for a store manager", async () => {
    const leaders = [leader(Role.storeManager, "plat-1")];
    renderLeaderCard(leaders, "plat-1");

    const card = await screen.findByTestId("roadie.flip_card");
    const flip = within(card).getByRole("button", {
      name: t("roadie.action.showBack"),
    });
    expect(flip).toHaveClass("plat");
    expect(
      within(card).getByText(t("roadie.card.tier.plat")),
    ).toBeInTheDocument();
  });

  it("shows the legend variant and LEADERSHIP ribbon for a leader", async () => {
    const leaders = [leader(Role.leadership, "legend-1")];
    renderLeaderCard(leaders, "legend-1");

    const card = await screen.findByTestId("roadie.flip_card");
    const flip = within(card).getByRole("button", {
      name: t("roadie.action.showBack"),
    });
    expect(flip).toHaveClass("legend");
    expect(
      within(card).getByText(t("roadie.card.tier.legend.leadership")),
    ).toBeInTheDocument();
  });

  it("uses the stated profile role for the card variant, not the grant role", async () => {
    // An Admin grant with a stated Store Manager profile must render the
    // platinum variant and MANAGER ribbon, not the Legend fallback.
    const leaders = [
      leader(Role.admin, "owner-1", { requestedRole: Role.storeManager }),
    ];
    renderLeaderCard(leaders, "owner-1");

    const card = await screen.findByTestId("roadie.flip_card");
    const flip = within(card).getByRole("button", {
      name: t("roadie.action.showBack"),
    });
    expect(flip).toHaveClass("plat");
    expect(
      within(card).getByText(t("roadie.card.tier.plat")),
    ).toBeInTheDocument();
  });

  it("flips to the back and shows the leader's About Me rows", async () => {
    const user = userEvent.setup();
    const leaders = [
      leader(Role.storeManager, "plat-1", {
        hometown: "Bake",
        favoriteSnack: "Snickers",
        goalHere: "Run the fry station",
      }),
    ];
    renderLeaderCard(leaders, "plat-1");

    const card = await screen.findByTestId("roadie.flip_card");
    await user.click(
      within(card).getByRole("button", { name: t("roadie.action.showBack") }),
    );

    const faces = card.querySelectorAll<HTMLElement>("[aria-hidden]");
    const back = Array.from(faces).find(
      (node) => node.getAttribute("aria-hidden") === "false",
    );
    if (!back) throw new Error("no visible card face");
    const backScope = within(back);
    expect(backScope.getByText(t("roadie.field.hometown"))).toBeInTheDocument();
    expect(backScope.getByText("Bake")).toBeInTheDocument();
    expect(backScope.getByText(/Run the fry station/)).toBeInTheDocument();
  });
});

describe("Gift Bags: roadies and leaders filter", () => {
  const LEADER_LABEL: GiftBagLabel = {
    roadieId: 2n,
    house: House.foh,
    name: "Jordan Rivera",
    positionName: "Store Manager",
    candySnack: "Snickers",
    drink: "Coffee",
    sportsTeam: "LSU Tigers",
    color: "Navy blue",
    shirtSize: "M",
    hatSize: "S/M",
  };

  function data(): GiftBagsData {
    return { groups: [], labels: [LEADER_LABEL] };
  }

  function actor() {
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
      getGiftBags: vi.fn<backendInterface["getGiftBags"]>(async () => data()),
    };
  }

  it("offers roadies, leaders and all filter options", async () => {
    const user = userEvent.setup();
    renderPageWithActor(GiftBagsPage, actor(), { path: "/gift-bags" });

    await screen.findByTestId("gift_bags.page");
    await user.click(screen.getByTestId("gift_bags.filter.select"));

    expect(
      await screen.findByTestId("gift_bags.filter.roadies"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("gift_bags.filter.leaders")).toBeInTheDocument();
    expect(screen.getByTestId("gift_bags.filter.all")).toBeInTheDocument();
  });

  it("re-queries the backend with the leaders filter when selected", async () => {
    const user = userEvent.setup();
    const a = actor();
    renderPageWithActor(GiftBagsPage, a, { path: "/gift-bags" });

    await screen.findByTestId("gift_bags.page");
    await user.click(screen.getByTestId("gift_bags.filter.select"));
    await user.click(await screen.findByTestId("gift_bags.filter.leaders"));

    expect(a.getGiftBags).toHaveBeenCalledWith({
      __kind__: "leaders",
      leaders: null,
    });
  });

  it("shows the leader's title on the label", async () => {
    renderPageWithActor(GiftBagsPage, actor(), { path: "/gift-bags" });

    const label = await screen.findByTestId("gift_bags.label.item");
    expect(label).toHaveTextContent("Jordan Rivera");
    expect(label).toHaveTextContent("Store Manager");
  });
});

describe("Leaders nav visibility", () => {
  function Page() {
    return (
      <Layout>
        <p>content</p>
      </Layout>
    );
  }

  function navActor(role: Role) {
    return {
      getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
        grant: grant(role),
      })),
      listPendingUsers: vi.fn<backendInterface["listPendingUsers"]>(
        async () => [],
      ),
    };
  }

  it.each([
    Role.admin,
    Role.storeManager,
    Role.trainingManager,
    Role.trainer,
    Role.visitingManager,
    Role.leadership,
  ])("shows the Leaders link to %s", async (role) => {
    renderPageWithActor(Page, navActor(role), { path: "/" });
    expect(await screen.findByTestId("nav.leaders.link")).toBeInTheDocument();
  });

  it.each([Role.kiosk, Role.integration])(
    "hides the Leaders link from %s",
    async (role) => {
      renderPageWithActor(Page, navActor(role), { path: "/" });
      expect(await screen.findByTestId("nav.roster.link")).toBeInTheDocument();
      expect(screen.queryByTestId("nav.leaders.link")).not.toBeInTheDocument();
    },
  );
});
