import { renderPageWithActor } from "@/__tests__/router-test-utils";
import type { Roadie, backendInterface } from "@/backend";
import { RoadieStatus, Role, RosterState } from "@/backend";
import RoadieCardPage from "@/pages/RoadieCard";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const roadie: Roadie = {
  id: 1n,
  status: RoadieStatus.hired,
  mainPositionId: 0n,
  hiredAt: 0n,
  isMinor: false,
  isDemo: false,
  profile: { name: "Ada Lovelace", preferredName: "Ada" },
  rosterState: RosterState.pending,
  contactSet: {
    phone: "+1-555-0100",
    email: "ada@example.com",
    emergencyContactName: "Grace",
    emergencyContactPhone: "+1-555-0101",
    dateOfBirth: 0n,
    availability: [],
    availabilityResignPending: false,
  },
};

function actor(role: Role) {
  return {
    getRoadie: vi.fn<backendInterface["getRoadie"]>(async () => roadie),
    listPositions: vi.fn<backendInterface["listPositions"]>(async () => []),
    listCrews: vi.fn<backendInterface["listCrews"]>(async () => []),
    isMinor: vi.fn<backendInterface["isMinor"]>(async () => false),
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: {
        principal: { toText: () => "aaaaa-aa" } as never,
        role,
        approvedAt: 0n,
        approvedBy: { toText: () => "aaaaa-aa" } as never,
        trainerPositionIds: [],
      },
    })),
    getContactSet: vi.fn<backendInterface["getContactSet"]>(async () =>
      roadie.contactSet ? [roadie.contactSet] : [],
    ),
    getChecklists: vi.fn<backendInterface["getChecklists"]>(async () => ({
      paperwork: [],
      orientationUniform: [],
    })),
    listChangeLog: vi.fn<backendInterface["listChangeLog"]>(async () => []),
  };
}

describe("RoadieCardPage manager tab", () => {
  it("shows the manager-only tab to an Admin", async () => {
    renderPageWithActor(RoadieCardPage, actor(Role.admin), {
      path: "/roster/$roadieId",
      initialEntry: "/roster/1",
    });

    expect(await screen.findByTestId("roadie.manager.tab")).toBeInTheDocument();
  });

  it("shows the manager-only tab to a Store Manager", async () => {
    renderPageWithActor(RoadieCardPage, actor(Role.storeManager), {
      path: "/roster/$roadieId",
      initialEntry: "/roster/1",
    });

    expect(await screen.findByTestId("roadie.manager.tab")).toBeInTheDocument();
  });

  it("hides the manager-only tab from a Trainer", async () => {
    renderPageWithActor(RoadieCardPage, actor(Role.trainer), {
      path: "/roster/$roadieId",
      initialEntry: "/roster/1",
    });

    // The card tab renders, but the manager tab never appears.
    expect(await screen.findByTestId("roadie.card.tab")).toBeInTheDocument();
    expect(screen.queryByTestId("roadie.manager.tab")).not.toBeInTheDocument();
  });
});
