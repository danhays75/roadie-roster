import { renderPageWithActor } from "@/__tests__/router-test-utils";
import type {
  AccessGrant,
  LeaderSummary,
  Position,
  StaffProfile,
  StoreInfo,
  backendInterface,
} from "@/backend";
import { House, Role } from "@/backend";
import LeaderCardPage from "@/pages/LeaderCard";
import LeadersPage from "@/pages/Leaders";
import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * Characterization baseline for the leader photo surfaces around the accepted
 * demo-photo change. The accepted change adds a demo photo URL fallback for
 * demo records with no stored photo, so this file deliberately does NOT assert
 * how a demo leader's photo is sourced. It protects the adjacent behavior that
 * must survive: a real (non-demo) leader with no stored photo still shows the
 * initials placeholder, and a stored photo still wins over any fallback.
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
  needsAlcoholCert: false,
  shirtType: "Polo",
  shirtQty: 2n,
  hatType: "Cap",
  hatQty: 1n,
  defaultShirts: 2n,
  defaultHats: 1n,
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

/** A tiny valid PNG byte sequence, enough for refToDataUrl to build a data URL. */
const PHOTO_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01,
]);

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

/** A real (non-demo) leader summary with a full staff profile. */
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

describe("Leaders grid: real leader without a stored photo keeps initials", () => {
  it("shows the initials placeholder, never a substituted photo", async () => {
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

  it("still renders a stored photo when one exists", async () => {
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
    const img = within(tile).getByRole("img", { name: "Pat · Manager" });
    expect(img).toHaveAttribute("src", PHOTO_DATA_URL);
  });
});

describe("leader card: real leader without a stored photo keeps initials", () => {
  it("shows the initials placeholder on the front, never a substituted photo", async () => {
    const leaders = [leader(Role.storeManager, "plat-1")];
    renderPageWithActor(LeaderCardPage, cardActor(leaders), {
      path: "/leaders/$leaderId",
      initialEntry: "/leaders/plat-1",
    });

    const card = await screen.findByTestId("roadie.flip_card");
    const faces = card.querySelectorAll<HTMLElement>("[aria-hidden]");
    const front = Array.from(faces).find(
      (node) => node.getAttribute("aria-hidden") === "false",
    );
    if (!front) throw new Error("no visible card face");
    // The preferred name "Jordan" yields the initials "JO".
    expect(within(front).getByText("JO")).toBeInTheDocument();
    expect(
      within(front).getByTestId("roadie.card.photo").querySelector("img"),
    ).toBeNull();
  });

  it("still renders a stored photo on the front when one exists", async () => {
    const leaders = [
      leader(Role.storeManager, "plat-1", { photo: PHOTO_BYTES }),
    ];
    renderPageWithActor(LeaderCardPage, cardActor(leaders), {
      path: "/leaders/$leaderId",
      initialEntry: "/leaders/plat-1",
    });

    const card = await screen.findByTestId("roadie.flip_card");
    const faces = card.querySelectorAll<HTMLElement>("[aria-hidden]");
    const front = Array.from(faces).find(
      (node) => node.getAttribute("aria-hidden") === "false",
    );
    if (!front) throw new Error("no visible card face");
    const img = within(front).getByRole("img", { name: "Jordan" });
    expect(img).toHaveAttribute("src", PHOTO_DATA_URL);
  });
});
