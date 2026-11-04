import { renderPageWithActor } from "@/__tests__/router-test-utils";
import type {
  GroupChangeNotice,
  MyGroupView,
  Roadie,
  ShiftBoardRoadie,
} from "@/backend";
import { RoadieStatus, Role, RosterState, Shift } from "@/backend";
import TodayPage from "@/pages/Today";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

function chip(
  roadieId: bigint,
  name: string,
  positionCode: string,
): ShiftBoardRoadie {
  return {
    roadieId,
    name,
    positionCode,
    positionId: 0n,
    markedUnavailable: false,
  };
}

function roadie(id: bigint, name: string): Roadie {
  return {
    id,
    status: RoadieStatus.active,
    mainPositionId: 0n,
    isDemo: false,
    rosterState: RosterState.active,
    isMinor: false,
    hiredAt: 0n,
    profile: {
      name,
    },
  };
}

function myGroup(): MyGroupView {
  return {
    eventId: 1n,
    shift: Shift.am,
    shiftLabel: "Training Day 1 · AM",
    capacity: 4n,
    roadies: [chip(1n, "Ada Roadie", "SRV"), chip(2n, "Bea Roadie", "HST")],
  };
}

function notice(id: bigint): GroupChangeNotice {
  return {
    id,
    eventId: 1n,
    shift: Shift.am,
    shiftLabel: "Training Day 1 · AM",
    addedNames: ["Ada Roadie"],
    removedNames: ["Cy Roadie"],
    editorName: "Manager One",
    createdAt: 0n,
    dismissed: false,
    isDemo: false,
    trainerPrincipal: { toText: () => "aaaaa-aa" } as never,
  };
}

function actor(
  role: Role,
  options: { group?: MyGroupView | null; notices?: GroupChangeNotice[] } = {},
) {
  return {
    getMyAccess: vi.fn(async () => ({
      grant: {
        principal: { toText: () => "aaaaa-aa" } as never,
        role,
        approvedAt: 0n,
        approvedBy: { toText: () => "aaaaa-aa" } as never,
        trainerPositionIds: [],
      },
    })),
    getMyGroup: vi.fn(async () => options.group ?? null),
    listGroupChangeNotices: vi.fn(async () => options.notices ?? []),
    listRoadies: vi.fn(async () => [
      roadie(1n, "Ada Roadie"),
      roadie(2n, "Bea Roadie"),
    ]),
    dismissGroupChangeNotice: vi.fn(async () => undefined),
    getDemoState: vi.fn(async () => ({
      enabled: false,
      demoTrainerStations: [],
    })),
  };
}

describe("Today page trainer My group", () => {
  it("shows the trainer's group with their roadies and a link to all groups", async () => {
    const a = actor(Role.trainer, { group: myGroup() });
    renderPageWithActor(TodayPage, a, { path: "/today" });

    const section = await screen.findByTestId("today.myGroup.section");
    expect(
      within(section).getByText("My group · Training Day 1 · AM"),
    ).toBeInTheDocument();
    expect(within(section).getByText("Ada Roadie")).toBeInTheDocument();
    expect(within(section).getByText("Bea Roadie")).toBeInTheDocument();

    const link = within(section).getByTestId("today.myGroup.view_all_link");
    expect(link).toHaveAttribute("href", "/groups");
  });

  it("shows the placeholder when the trainer has no group", async () => {
    const a = actor(Role.trainer, { group: null });
    renderPageWithActor(TodayPage, a, { path: "/today" });

    expect(await screen.findByTestId("today.placeholder")).toBeInTheDocument();
    expect(
      screen.queryByTestId("today.myGroup.section"),
    ).not.toBeInTheDocument();
  });

  it("shows the placeholder to a role that may not read groups", async () => {
    const a = actor(Role.kiosk, { group: myGroup() });
    renderPageWithActor(TodayPage, a, { path: "/today" });

    expect(await screen.findByTestId("today.placeholder")).toBeInTheDocument();
    // The group read never runs for a role the backend would reject.
    expect(a.getMyGroup).not.toHaveBeenCalled();
  });

  it("shows and dismisses the group-change notice card", async () => {
    const a = actor(Role.trainer, { group: myGroup(), notices: [notice(9n)] });
    const user = userEvent.setup();
    renderPageWithActor(TodayPage, a, { path: "/today" });

    const card = await screen.findByTestId("today.notice.card");
    expect(within(card).getByText("Your group changed")).toBeInTheDocument();
    expect(within(card).getByText("Added: Ada Roadie")).toBeInTheDocument();
    expect(within(card).getByText("Removed: Cy Roadie")).toBeInTheDocument();

    await user.click(within(card).getByTestId("today.notice.dismiss_button"));
    expect(a.dismissGroupChangeNotice).toHaveBeenCalledWith(9n);
  });
});
