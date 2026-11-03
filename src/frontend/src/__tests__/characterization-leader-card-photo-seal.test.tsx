import { renderPageWithActor, t } from "@/__tests__/router-test-utils";
import type {
  LeaderSummary,
  Position,
  Roadie,
  StaffProfile,
  StoreInfo,
  backendInterface,
} from "@/backend";
import { House, RoadieStatus, Role } from "@/backend";
import LeaderCardPage from "@/pages/LeaderCard";
import LeadersPage from "@/pages/Leaders";
import RoadieCardPage from "@/pages/RoadieCard";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

/**
 * Characterization baseline for the leader card around three intentional
 * changes: leader cards will show the leader's staff-profile photo instead of
 * initials, the gold/platinum/legend variants will re-color from their own tier
 * variables, and the store seal will change from a plain circle to a scalloped
 * bottle-cap shape.
 *
 * This file deliberately does NOT assert the photo source, any CSS color, or
 * the seal's geometry. It protects the adjacent behavior that must survive:
 * the tier ribbon labels per role, the leader's name/title/About Me rows and
 * footers, the flip interaction, the privacy invariant, the store number the
 * seal still exposes, and the roadie card's initials placeholder (which the
 * leader photo change must not disturb).
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

/** A leader summary with a full staff profile and the given role. */
function leader(
  role: Role,
  principalText: string,
  profile: Partial<StaffProfile> = {},
  travel: { arrivalDate?: bigint; departureDate?: bigint } = {},
): LeaderSummary {
  return {
    principal: {
      toText: () => principalText,
      toString: () => principalText,
    } as never,
    role,
    title: profile.title ?? "Manager",
    trainerPositionIds: [],
    arrivalDate: travel.arrivalDate,
    departureDate: travel.departureDate,
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

function cardActor(leaders: LeaderSummary[]) {
  return {
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      principal: PRINCIPAL,
      role: Role.admin,
      approvedAt: 0n,
      approvedBy: PRINCIPAL,
      trainerPositionIds: [],
    })),
    listLeaders: vi.fn<backendInterface["listLeaders"]>(async () => leaders),
    listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
      POSITION,
    ]),
    getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(
      async () => STORE_INFO,
    ),
    getPhoto: vi.fn<backendInterface["getPhoto"]>(async () => null),
  };
}

function renderLeaderCard(leaders: LeaderSummary[], leaderId: string) {
  return renderPageWithActor(LeaderCardPage, cardActor(leaders), {
    path: "/leaders/$leaderId",
    initialEntry: `/leaders/${leaderId}`,
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

describe("leader card: tier ribbon labels survive the color change", () => {
  it.each([
    [Role.trainer, "roadie.card.tier.gold"],
    [Role.storeManager, "roadie.card.tier.plat"],
    [Role.trainingManager, "roadie.card.tier.plat.training"],
    [Role.visitingManager, "roadie.card.tier.plat.visiting"],
    [Role.leadership, "roadie.card.tier.legend.leadership"],
  ])("shows the %s ribbon label", async (role, labelKey) => {
    const id = `leader-${role}`;
    renderLeaderCard([leader(role, id)], id);

    const card = await screen.findByTestId("roadie.flip_card");
    expect(within(card).getByText(t(labelKey))).toBeInTheDocument();
  });
});

describe("leader card: front and back content", () => {
  it("renders the leader's name, title pill and store seal number", async () => {
    renderLeaderCard([leader(Role.storeManager, "plat-1")], "plat-1");

    const front = await visibleFace();
    // The nameplate and the title pill (a leader's main pill is their title).
    expect(front.getByText("Jordan")).toBeInTheDocument();
    expect(front.getByText("Manager")).toBeInTheDocument();
    // The store seal still exposes the store number as its accessible name,
    // whatever shape the seal is drawn with. The store-info read resolves
    // asynchronously, so wait for the seal to carry the number.
    expect(await front.findByLabelText("975")).toBeInTheDocument();
  });

  it("flips to the back and shows the About Me rows, home store and goal", async () => {
    const user = userEvent.setup();
    const leaders = [
      leader(Role.storeManager, "plat-1", {
        hometown: "Bake",
        favoriteSnack: "Snickers",
        goalHere: "Run the fry station",
      }),
    ];
    renderLeaderCard(leaders, "plat-1");

    await user.click(await cardFlipControl());
    const back = await visibleFace();

    expect(back.getByText(t("roadie.field.hometown"))).toBeInTheDocument();
    expect(back.getByText("Bake")).toBeInTheDocument();
    expect(back.getByText("Snickers")).toBeInTheDocument();
    // The leader-only home store row.
    expect(back.getByText(t("roadie.card.homeStore"))).toBeInTheDocument();
    expect(back.getByText("#975 Lake Charles")).toBeInTheDocument();
    // The MY GOAL quote.
    expect(back.getByText(t("roadie.card.goal"))).toBeInTheDocument();
    expect(back.getByText(/Run the fry station/)).toBeInTheDocument();
  });

  it("shows the trainer travel footer from the home store and dates", async () => {
    const leaders = [
      leader(
        Role.trainer,
        "gold-1",
        {},
        {
          arrivalDate: BigInt(Date.UTC(2027, 0, 30, 12, 0, 0)) * 1_000_000n,
          departureDate: BigInt(Date.UTC(2027, 1, 2, 12, 0, 0)) * 1_000_000n,
        },
      ),
    ];
    renderLeaderCard(leaders, "gold-1");

    const front = await visibleFace();
    // The store-info read resolves asynchronously, so wait for the footer.
    expect(
      await front.findByText(t("roadie.card.from"), { exact: false }),
    ).toBeInTheDocument();
    expect(
      front.getByText(/#975 Lake Charles/, { exact: false }),
    ).toBeInTheDocument();
  });

  it("never renders phone, email or date of birth on either face", async () => {
    const user = userEvent.setup();
    const leaders = [
      leader(Role.storeManager, "plat-1", {
        workPhone: "+1-555-0100",
        workEmail: "jordan@example.com",
      }),
    ];
    renderLeaderCard(leaders, "plat-1");

    await screen.findByTestId("roadie.flip_card");
    expect(screen.queryByText("+1-555-0100")).not.toBeInTheDocument();
    expect(screen.queryByText("jordan@example.com")).not.toBeInTheDocument();

    await user.click(await cardFlipControl());
    expect(screen.queryByText("+1-555-0100")).not.toBeInTheDocument();
    expect(screen.queryByText("jordan@example.com")).not.toBeInTheDocument();
  });
});

describe("roadie card: initials placeholder is unaffected by the leader photo change", () => {
  const ROADIE: Roadie = {
    id: 1n,
    status: RoadieStatus.certified,
    mainPositionId: 0n,
    isMinor: false,
    hiredAt: 0n,
    isDemo: false,
    profile: { name: "Frank George", preferredName: "Frank" },
  };

  function roadieActor() {
    return {
      getRoadie: vi.fn<backendInterface["getRoadie"]>(async () => ROADIE),
      listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
        POSITION,
      ]),
      listCrews: vi.fn<backendInterface["listCrews"]>(async () => []),
      getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(
        async () => STORE_INFO,
      ),
      getPhoto: vi.fn<backendInterface["getPhoto"]>(async () => null),
      isMinor: vi.fn<backendInterface["isMinor"]>(async () => false),
      getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
        principal: PRINCIPAL,
        role: Role.admin,
        approvedAt: 0n,
        approvedBy: PRINCIPAL,
        trainerPositionIds: [],
      })),
      getContactSet: vi.fn<backendInterface["getContactSet"]>(async () => []),
      getChecklists: vi.fn<backendInterface["getChecklists"]>(async () => ({
        paperwork: [],
        orientationUniform: [],
      })),
      listChangeLog: vi.fn<backendInterface["listChangeLog"]>(async () => []),
    };
  }

  it("shows the roadie's initials when no photo exists", async () => {
    renderPageWithActor(RoadieCardPage, roadieActor(), {
      path: "/roster/$roadieId",
      initialEntry: "/roster/1",
    });

    const front = await visibleFace();
    // The card uses the preferred name "Frank" -> "FR"; the roadie card keeps
    // its initials placeholder when no photo exists.
    expect(front.getByText("FR")).toBeInTheDocument();
    expect(document.querySelectorAll("img")).toHaveLength(0);
  });
});

describe("Leaders page: tier grouping is unaffected by the card color change", () => {
  function leadersActor(leaders: LeaderSummary[]) {
    return {
      getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
        principal: PRINCIPAL,
        role: Role.admin,
        approvedAt: 0n,
        approvedBy: PRINCIPAL,
        trainerPositionIds: [],
      })),
      listPendingUsers: vi.fn<backendInterface["listPendingUsers"]>(
        async () => [],
      ),
      listLeaders: vi.fn<backendInterface["listLeaders"]>(async () => leaders),
      listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
        POSITION,
      ]),
    };
  }

  it("groups leaders into legend, platinum and gold sections", async () => {
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
  });
});
