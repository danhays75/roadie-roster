import { renderPageWithActor } from "@/__tests__/router-test-utils";
import type { ContactSet, Roadie, backendInterface } from "@/backend";
import { RoadieStatus, Role } from "@/backend";
import RoadieCardPage from "@/pages/RoadieCard";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

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
  profile: { name: "Ada Lovelace" },
  isMinor: false,
  isDemo: false,
};

/**
 * The actor the roadie card reads. `getContactSet` returns a one-element array
 * with the real contact set for a manager and an empty array for a non-manager,
 * mirroring the backend's redaction on that read.
 */
function actor(role: Role) {
  const isManager = role === Role.admin || role === Role.storeManager;
  return {
    getRoadie: vi.fn<backendInterface["getRoadie"]>(async () => ROADIE),
    listPositions: vi.fn<backendInterface["listPositions"]>(async () => []),
    listCrews: vi.fn<backendInterface["listCrews"]>(async () => []),
    isMinor: vi.fn<backendInterface["isMinor"]>(async () => false),
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      principal: { toText: () => "aaaaa-aa" } as never,
      role,
      approvedAt: 0n,
      approvedBy: { toText: () => "aaaaa-aa" } as never,
      trainerPositionIds: [],
    })),
    getContactSet: vi.fn<backendInterface["getContactSet"]>(async () =>
      isManager ? [CONTACT] : [],
    ),
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

describe("Roadie card contact-set visibility", () => {
  it("shows the contact set to an Admin on the manager tab", async () => {
    const user = userEvent.setup();
    renderCard(Role.admin);

    await user.click(await screen.findByTestId("roadie.manager.tab"));

    expect(await screen.findByTestId("roadie.contact.phone_input")).toHaveValue(
      "+1-555-0100",
    );
    expect(screen.getByTestId("roadie.contact.email_input")).toHaveValue(
      "ada@example.com",
    );
  });

  it("shows the contact set to a Store Manager on the manager tab", async () => {
    const user = userEvent.setup();
    renderCard(Role.storeManager);

    await user.click(await screen.findByTestId("roadie.manager.tab"));

    expect(await screen.findByTestId("roadie.contact.phone_input")).toHaveValue(
      "+1-555-0100",
    );
  });

  it("never renders the contact set for a Trainer", async () => {
    renderCard(Role.trainer);

    // The card tab renders, but the manager tab and its contact editor do not.
    expect(await screen.findByTestId("roadie.card.tab")).toBeInTheDocument();
    expect(screen.queryByTestId("roadie.manager.tab")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("roadie.contact.phone_input"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("+1-555-0100")).not.toBeInTheDocument();
    expect(screen.queryByText("ada@example.com")).not.toBeInTheDocument();
  });
});
