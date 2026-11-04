import { renderPageWithActor, t } from "@/__tests__/router-test-utils";
import { renderWithActor } from "@/__tests__/test-utils";
import type {
  AccessGrant,
  LeaderSummary,
  Position,
  StaffProfile,
  StoreInfo,
  backendInterface,
} from "@/backend";
import { House, Role } from "@/backend";
import { StaffProfileForm } from "@/components/StaffProfileForm";
import { I18nContext, translate } from "@/hooks/useI18n";
import type { Locale } from "@/lib/copy";
import LeaderCardPage from "@/pages/LeaderCard";
import LeadersPage from "@/pages/Leaders";
import MyProfilePage from "@/pages/MyProfile";
import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * Cover for the accepted leader-photo, tier re-color and store-seal changes:
 * a leader card renders the leader's staff-profile photo instead of initials on
 * both faces; the leader photo also appears on the Leaders grid cards and on My
 * profile's preview; gold/platinum/legend cards carry their tier variant class
 * (which re-colors from the tier variables); and the store seal is the
 * scalloped bottle-cap SVG carrying the store number. The backend is a typed
 * local actor mock; no canister is contacted.
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
  shirtType: "Polo",
  shirtQty: 2n,
  hatType: "Cap",
  hatQty: 1n,
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

/** A tiny valid PNG byte sequence, enough for refToDataUrl to build a data URL. */
const PHOTO_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01,
]);

/** The data URL the app builds from PHOTO_BYTES with the default PNG type. */
const PHOTO_DATA_URL = `data:image/png;base64,${btoa(
  String.fromCharCode(...PHOTO_BYTES),
)}`;

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

function cardActor(leaders: LeaderSummary[]) {
  return {
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: grant(Role.admin),
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

describe("leader card: staff-profile photo on both faces", () => {
  it("renders the leader's photo instead of initials on the front shield", async () => {
    const leaders = [
      leader(Role.storeManager, "plat-1", { photo: PHOTO_BYTES }),
    ];
    renderLeaderCard(leaders, "plat-1");

    const front = await visibleFace();
    const photo = front.getByTestId("roadie.card.photo");
    const img = within(photo).getByRole("img", { name: "Jordan" });
    expect(img).toHaveAttribute("src", PHOTO_DATA_URL);
    // The initials placeholder is gone once a photo exists.
    expect(front.queryByText("JR")).not.toBeInTheDocument();
  });

  it("renders the leader's photo on the back headshot", async () => {
    const leaders = [
      leader(Role.storeManager, "plat-1", { photo: PHOTO_BYTES }),
    ];
    renderLeaderCard(leaders, "plat-1");

    await screen.findByTestId("roadie.flip_card");
    const headshot = screen.getByTestId("roadie.card.headshot");
    expect(headshot).toHaveStyle({
      backgroundImage: `url(${PHOTO_DATA_URL})`,
    });
  });

  it("falls back to initials on the front when the leader has no photo", async () => {
    const leaders = [leader(Role.storeManager, "plat-1")];
    renderLeaderCard(leaders, "plat-1");

    const front = await visibleFace();
    // The preferred name "Jordan" yields the initials "JO".
    expect(front.getByText("JO")).toBeInTheDocument();
    expect(
      within(front.getByTestId("roadie.card.photo")).queryByRole("img"),
    ).not.toBeInTheDocument();
  });
});

describe("leader card: tier variant classes re-color from tier variables", () => {
  it.each([
    [Role.trainer, "gold"],
    [Role.storeManager, "plat"],
    [Role.trainingManager, "plat"],
    [Role.visitingManager, "plat"],
    [Role.leadership, "legend"],
  ])("applies the %s tier variant class", async (role, variant) => {
    const id = `leader-${role}`;
    renderLeaderCard([leader(role, id)], id);

    const card = await screen.findByTestId("roadie.flip_card");
    const flip = within(card).getByRole("button", {
      name: t("roadie.action.showBack"),
    });
    expect(flip).toHaveClass(variant);
  });
});

describe("leader card: scalloped bottle-cap store seal", () => {
  it("renders the seal as an SVG with the store number as its accessible name", async () => {
    renderLeaderCard([leader(Role.storeManager, "plat-1")], "plat-1");

    const front = await visibleFace();
    const seal = await front.findByRole("img", { name: "975" });
    expect(seal.tagName.toLowerCase()).toBe("svg");
    // The scalloped bottle-cap outline is a path, not a plain circle. A circle
    // would be a <circle> or a path with a couple of arcs; the scalloped cap
    // traces many alternating vertices, so count the path's points.
    const outline = seal.querySelector("path");
    expect(outline).not.toBeNull();
    const vertices = (outline?.getAttribute("d") ?? "").match(
      /[ML]\s*[\d.]+\s*[\d.]+/g,
    );
    expect(vertices?.length ?? 0).toBeGreaterThan(20);
  });
});

describe("Leaders grid: leader photo on the tile", () => {
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
    };
  }

  it("shows the leader's photo in the grid tile", async () => {
    const leaders = [
      leader(Role.storeManager, "plat-1", {
        preferredName: "Pat",
        photo: PHOTO_BYTES,
      }),
    ];
    renderPageWithActor(LeadersPage, leadersActor(leaders), {
      path: "/leaders",
    });

    const tile = await screen.findByTestId("leaders.item.photo");
    // The tile's alt is the display name plus title.
    const img = within(tile).getByRole("img", { name: "Pat · Manager" });
    expect(img).toHaveAttribute("src", PHOTO_DATA_URL);
  });

  it("falls back to initials in the grid tile when the leader has no photo", async () => {
    const leaders = [
      leader(Role.storeManager, "plat-1", { preferredName: "Pat" }),
    ];
    renderPageWithActor(LeadersPage, leadersActor(leaders), {
      path: "/leaders",
    });

    const tile = await screen.findByTestId("leaders.item.photo");
    // The display name "Pat · Manager" yields the initials "PM".
    expect(within(tile).getByText("PM")).toBeInTheDocument();
    expect(within(tile).queryByRole("img")).not.toBeInTheDocument();
  });
});

describe("My profile: staff photo preview", () => {
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

  it("shows the seeded staff photo in the preview", async () => {
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
          photo: PHOTO_BYTES,
        }),
      })),
      listPositions: vi.fn<backendInterface["listPositions"]>(async () => []),
      updateMyStaffProfile: vi.fn<backendInterface["updateMyStaffProfile"]>(
        async () => {},
      ),
    };
    renderPageWithActor(MyProfilePage, actor, { path: "/my-profile" });

    const preview = await screen.findByTestId("my_profile.photo.preview");
    expect(preview).toHaveAttribute("src", PHOTO_DATA_URL);
  });

  it("shows the upload placeholder when the profile has no photo", async () => {
    renderWithActor(
      wrap(
        <StaffProfileForm
          submitLabel={t("profile.submit")}
          pending={false}
          onSubmit={vi.fn()}
        />,
      ),
      {
        listPositions: vi.fn<backendInterface["listPositions"]>(async () => []),
      } satisfies Pick<backendInterface, "listPositions">,
    );

    expect(
      screen.queryByTestId("profile.photo.preview"),
    ).not.toBeInTheDocument();
  });
});
