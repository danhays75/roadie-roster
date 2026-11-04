import { renderPageWithActor, t } from "@/__tests__/router-test-utils";
import { renderWithActor } from "@/__tests__/test-utils";
import type {
  Crew,
  Position,
  Roadie,
  StoreInfo,
  backendInterface,
} from "@/backend";
import { House, RoadieStatus, Role, RosterState } from "@/backend";
import {
  EMPTY_DETAILS,
  KioskDetailsStep,
} from "@/components/kiosk/KioskDetailsStep";
import { I18nContext, translate } from "@/hooks/useI18n";
import { formatDateOnly, formatTimestampDateOnly } from "@/lib/format";
import RoadieCardPage from "@/pages/RoadieCard";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

/**
 * Cover for the accepted About Me relabeling and card-back changes: the kiosk
 * details step shows the new labels and placeholders in English and Spanish and
 * no longer shows a Favorite movie field; the card back lists only non-empty
 * rows in the accepted order with the MY GOAL quote below; the footer is
 * uppercase; and date-only values render in UTC. The backend is a typed local
 * actor mock; no canister is contacted.
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

const CREW: Crew = { id: 7n, name: "Opening Crew", isDemo: false };

const STORE_INFO: StoreInfo = {
  amShiftEnd: 0n,
  pmShiftStart: 0n,
  storeNumber: "975",
  leaderTalkName: "Leader talk",
  appName: "Roadie Roster",
  leaderTalkSize: 4n,
  amShiftStart: 0n,
  // 2027-02-08T00:00:00Z, a date-only value at UTC midnight.
  openingDate: BigInt(Date.UTC(2027, 1, 8)) * 1_000_000n,
  pmShiftEnd: 0n,
  trainingGroupSize: 4n,
  address: "1 Main St",
  locationName: "Bake",
  timeZone: "America/Chicago",
  storePhone: "+1-555-0199",
  paperworkDueDate: 1_800_000_000_000_000_000n,
};

/** A roadie with every About Me field populated, including the new ones. */
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
      grant: {
        principal: { toText: () => "aaaaa-aa" } as never,
        role: Role.admin,
        approvedAt: 0n,
        approvedBy: { toText: () => "aaaaa-aa" } as never,
        trainerPositionIds: [],
      },
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

async function visibleFace() {
  const card = await screen.findByTestId("roadie.flip_card");
  const faces = card.querySelectorAll<HTMLElement>("[aria-hidden]");
  const face = Array.from(faces).find(
    (node) => node.getAttribute("aria-hidden") === "false",
  );
  if (!face) throw new Error("no visible card face");
  return within(face);
}

describe("kiosk About Me labels and placeholders", () => {
  function renderDetails(locale: "en" | "es") {
    return render(
      <I18nContext.Provider
        value={{
          locale,
          setLocale: vi.fn(),
          t: (key, vars) => translate(locale, key, vars),
        }}
      >
        <KioskDetailsStep
          value={EMPTY_DETAILS}
          onChange={vi.fn()}
          errors={{}}
        />
      </I18nContext.Provider>,
    );
  }

  it("shows the new English labels and no Favorite movie field", () => {
    renderDetails("en");

    expect(
      screen.getByText("What do you do on your day off?"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Favorite candy or snack (brand)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Favorite sports team")).toBeInTheDocument();
    expect(screen.getByText("Favorite drink")).toBeInTheDocument();
    expect(screen.getByText("Favorite color")).toBeInTheDocument();

    // The Favorite movie field is gone from the form.
    expect(screen.queryByText("Favorite movie")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("kiosk.favorite_movie.textarea"),
    ).not.toBeInTheDocument();
  });

  it("shows the Snickers/Hot Cheetos placeholder and the drink placeholder as text, not a value", () => {
    renderDetails("en");

    const snack = screen.getByTestId("kiosk.favorite_snack.textarea");
    expect(snack).toHaveAttribute("placeholder", "e.g. Snickers, Hot Cheetos");
    expect(snack).toHaveValue("");

    const drink = screen.getByTestId("kiosk.favorite_drink.textarea");
    expect(drink).toHaveAttribute(
      "placeholder",
      "Soda, energy drink, or coffee order",
    );
    // The placeholder is not a pre-filled value.
    expect(drink).toHaveValue("");
  });

  it("shows the Spanish labels and placeholders for all five questions", () => {
    renderDetails("es");

    expect(screen.getByText("¿Qué haces en tu día libre?")).toBeInTheDocument();
    expect(
      screen.getByText("Dulce o snack favorito (marca)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Equipo deportivo favorito")).toBeInTheDocument();
    expect(screen.getByText("Bebida favorita")).toBeInTheDocument();
    expect(screen.getByText("Color favorito")).toBeInTheDocument();

    expect(screen.getByTestId("kiosk.favorite_snack.textarea")).toHaveAttribute(
      "placeholder",
      "ej. Snickers, Hot Cheetos",
    );
    expect(screen.getByTestId("kiosk.favorite_drink.textarea")).toHaveAttribute(
      "placeholder",
      "Refresco, bebida energética o tu café",
    );
    expect(screen.queryByText("Película favorita")).not.toBeInTheDocument();
  });
});

describe("roadie card back: accepted row order and footer", () => {
  it("lists only non-empty rows in the accepted order with the MY GOAL quote below", async () => {
    const user = userEvent.setup();
    renderCard(FULL_ROADIE);

    await user.click(await cardButton());
    const back = await visibleFace();

    const labels = [
      t("roadie.field.hometown"),
      t("roadie.field.crew"),
      t("roadie.field.dayOff"),
      t("roadie.field.favoriteTeam"),
      t("roadie.field.favoriteSnack"),
      t("roadie.field.favoriteDrink"),
      t("roadie.field.favoriteColor"),
      t("roadie.field.funFact"),
      t("roadie.field.hiredAt"),
    ];
    const rows = back.getAllByText(
      (_, element) => element?.className === "row",
    );
    const rowText = rows.map((row) => row.textContent ?? "");
    expect(rowText).toHaveLength(labels.length);
    labels.forEach((label, index) => {
      expect(rowText[index]).toContain(label);
    });

    // Favorite movie is no longer listed on the card back.
    expect(
      back.queryByText(t("roadie.field.favoriteMovie")),
    ).not.toBeInTheDocument();

    // The MY GOAL quote stays under the table.
    expect(back.getByText(t("roadie.card.goal"))).toBeInTheDocument();
    expect(back.getByText(/Run the fry station/)).toBeInTheDocument();
  });

  it("keeps the roadie back footer as the opening-crew line with the store number and opening date", async () => {
    const user = userEvent.setup();
    renderCard(FULL_ROADIE);

    await user.click(await cardButton());
    const back = await visibleFace();

    // A roadie card keeps the original opening-crew footer; the leader
    // opening-team footer applies only to leader cards.
    expect(
      back.getByText("#975 OPENING CREW · FEB 8, 2027"),
    ).toBeInTheDocument();
  });

  it("keeps the roadie front footer as Roadie since with the hire date", async () => {
    renderCard(FULL_ROADIE);

    const front = await visibleFace();
    expect(front.getByText(/Roadie since/)).toBeInTheDocument();
    expect(front.getByText(/Jan 30, 2027/)).toBeInTheDocument();
  });
});

describe("date-only values render in UTC", () => {
  it("formats a date-only value on the correct calendar day regardless of device zone", () => {
    // 2027-02-08T00:00:00Z. In a negative-offset device zone a local-time
    // formatter would show Feb 7; the UTC formatter must show Feb 8.
    const dateOnly = BigInt(Date.UTC(2027, 1, 8)) * 1_000_000n;
    expect(formatDateOnly(dateOnly)).toBe("Feb 8, 2027");
  });

  it("formats a timestamp as its UTC calendar day", () => {
    // 2027-02-08T02:00:00Z, which is still Feb 8 in UTC.
    const timestamp = BigInt(Date.UTC(2027, 1, 8, 2, 0, 0)) * 1_000_000n;
    expect(formatTimestampDateOnly(timestamp)).toBe("Feb 8, 2027");
  });
});
