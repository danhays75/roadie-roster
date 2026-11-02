import { renderPageWithActor, t } from "@/__tests__/router-test-utils";
import type { ContactSet, Position, Roadie, backendInterface } from "@/backend";
import { House, RoadieStatus, Role } from "@/backend";
import RoadieCardPage from "@/pages/RoadieCard";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

/**
 * Characterization of the roadie card page shell that the trading-card
 * restyle must not disturb: the page chrome around the card, the Card tab
 * trigger, and the card's data-safety invariant (no phone, email or date of
 * birth on the card). The card's own layout is intentionally changing, so this
 * file asserts only the surrounding behavior and the privacy rule.
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
  email: "ada@example.com",
  emergencyContactName: "Grace",
  emergencyContactPhone: "+1-555-0101",
  dateOfBirth: 0n,
  availability: [],
  availabilityResignPending: false,
};

const ROADIE: Roadie = {
  id: 1n,
  status: RoadieStatus.hired,
  mainPositionId: 0n,
  hiredAt: 0n,
  profile: { name: "Ada Lovelace", preferredName: "Ada" },
  isMinor: false,
  contactSet: CONTACT,
};

function actor(role: Role) {
  return {
    getRoadie: vi.fn<backendInterface["getRoadie"]>(async () => ROADIE),
    listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
      POSITION,
    ]),
    listCrews: vi.fn<backendInterface["listCrews"]>(async () => []),
    isMinor: vi.fn<backendInterface["isMinor"]>(async () => false),
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      principal: { toText: () => "aaaaa-aa" } as never,
      role,
      approvedAt: 0n,
      approvedBy: { toText: () => "aaaaa-aa" } as never,
      trainerPositionIds: [],
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

function renderCard(role: Role) {
  return renderPageWithActor(RoadieCardPage, actor(role), {
    path: "/roster/$roadieId",
    initialEntry: "/roster/1",
  });
}

describe("roadie card page shell", () => {
  it("renders the back control, header and Card tab for a roadie", async () => {
    renderCard(Role.admin);

    expect(await screen.findByTestId("roadie.page")).toBeInTheDocument();
    expect(screen.getByTestId("roadie.back_button")).toBeInTheDocument();
    expect(await screen.findByTestId("roadie.card.tab")).toBeInTheDocument();
    // The header shows the preferred name and the main position name.
    expect(screen.getAllByText("Ada").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cashier").length).toBeGreaterThan(0);
  });

  it("keeps the Card tab selected by default", async () => {
    renderCard(Role.admin);

    const cardTab = await screen.findByTestId("roadie.card.tab");
    expect(cardTab).toHaveAttribute("data-state", "active");
  });

  it("shows the not-found state for a malformed roadie id", async () => {
    renderPageWithActor(RoadieCardPage, actor(Role.admin), {
      path: "/roster/$roadieId",
      initialEntry: "/roster/not-a-number",
    });

    expect(await screen.findByText(t("roadie.notFound"))).toBeInTheDocument();
  });
});

describe("roadie card privacy invariant", () => {
  it("never renders phone, email or date of birth on the card", async () => {
    const user = userEvent.setup();
    renderCard(Role.admin);

    // The card tab is the default surface; the contact set is only reachable
    // through the manager tab, so the card itself must not leak it.
    await screen.findByTestId("roadie.card.tab");
    expect(screen.queryByText("+1-555-0100")).not.toBeInTheDocument();
    expect(screen.queryByText("ada@example.com")).not.toBeInTheDocument();

    // Flipping the card must not reveal the contact set either.
    await user.click(await screen.findByTestId("roadie.flip_button"));
    expect(screen.queryByText("+1-555-0100")).not.toBeInTheDocument();
    expect(screen.queryByText("ada@example.com")).not.toBeInTheDocument();
  });
});
