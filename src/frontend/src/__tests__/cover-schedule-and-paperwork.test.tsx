import { renderPageWithActor } from "@/__tests__/router-test-utils";
import type {
  Position,
  ScheduleEvent,
  StoreInfo,
  backendInterface,
} from "@/backend";
import { EventKind, House, Role } from "@/backend";
import { paperworkDueEvent } from "@/lib/schedule";
import AdminPage from "@/pages/Admin";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

/**
 * Cover for the accepted schedule / paperwork-due change, exercised through the
 * real Admin page with a typed local actor mock:
 *   - editing a seeded id-0 schedule event updates it instead of creating a
 *     duplicate,
 *   - the separate Paperwork due date box is gone from Admin > Schedule,
 *   - the schedule's "Paperwork due" deadline event is the single source of the
 *     paperwork due date (paperworkDueEvent).
 * The backend is mocked here; the PocketIC lane covers the real canister.
 */

const STORE: StoreInfo = {
  storeNumber: "975",
  appName: "Roadie Roster",
  locationName: "Lake Charles",
  address: "1400 W Prien Lake Rd",
  storePhone: "",
  timeZone: "America/Chicago",
  openingDate: 1_802_066_400_000_000_000n,
  amShiftStart: 600n,
  amShiftEnd: 900n,
  pmShiftStart: 960n,
  pmShiftEnd: 1320n,
  trainingGroupSize: 5n,
  leaderTalkName: "10 Minutes with Dan",
  leaderTalkSize: 10n,
};

const SERVERS: Position = {
  id: 1n,
  name: "Servers",
  code: "SRV",
  house: House.foh,
  openingBuildTo: 65n,
  afterOpeningBuildTo: 65n,
  minimumAge: 18n,
  needsAlcoholCert: true,
  shirtType: "Polo",
  shirtQty: 2n,
  hatType: "Cap",
  hatQty: 1n,
  defaultShirts: 2n,
  defaultHats: 1n,
};

/** The seeded "Paperwork due" deadline event, carrying id 0. */
const PAPERWORK_DUE: ScheduleEvent = {
  id: 0n,
  kind: EventKind.deadline,
  name: "Paperwork due",
  start: 1_801_202_400_000_000_000n,
};

function adminActor(schedule: ScheduleEvent[] = [PAPERWORK_DUE]) {
  const updateScheduleEvent = vi.fn<backendInterface["updateScheduleEvent"]>(
    async () => undefined,
  );
  const createScheduleEvent = vi.fn<backendInterface["createScheduleEvent"]>(
    async () => 1n,
  );
  return {
    actor: {
      getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
        grant: {
          principal: { toText: () => "aaaaa-aa" } as never,
          role: Role.admin,
          approvedAt: 0n,
          approvedBy: { toText: () => "aaaaa-aa" } as never,
          trainerPositionIds: [],
        },
      })),
      listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
        SERVERS,
      ]),
      listSchedule: vi.fn<backendInterface["listSchedule"]>(async () =>
        structuredClone(schedule),
      ),
      getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(async () => STORE),
      getChecklists: vi.fn<backendInterface["getChecklists"]>(async () => ({
        paperwork: [],
        orientationUniform: [],
      })),
      getRetentionSettings: vi.fn<backendInterface["getRetentionSettings"]>(
        async () => ({
          notesDays: 0n,
          archivedContactSetDays: 0n,
          archivedPhotoDays: 0n,
          changeLogDays: 0n,
        }),
      ),
      getDemoState: vi.fn<backendInterface["getDemoState"]>(async () => ({
        enabled: false,
        demoTrainerStations: [],
      })),
      updateStoreInfo: vi.fn<backendInterface["updateStoreInfo"]>(
        async () => undefined,
      ),
      createScheduleEvent,
      updateScheduleEvent,
      deleteScheduleEvent: vi.fn<backendInterface["deleteScheduleEvent"]>(
        async () => undefined,
      ),
    },
    updateScheduleEvent,
    createScheduleEvent,
  };
}

describe("Admin > Schedule seeded event edit", () => {
  it("updates the seeded id-0 event instead of creating a duplicate", async () => {
    const user = userEvent.setup();
    const { actor, updateScheduleEvent, createScheduleEvent } = adminActor();
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    await user.click(await screen.findByTestId("admin.schedule.tab"));
    await screen.findByTestId("admin.schedule.list");

    await user.click(screen.getByTestId("admin.schedule.edit_button"));
    const name = await screen.findByTestId("admin.schedule.name.input");
    expect(name).toHaveValue("Paperwork due");
    await user.clear(name);
    await user.type(name, "Paperwork due (final)");
    await user.click(screen.getByTestId("admin.schedule.save_button"));

    await waitFor(() => expect(updateScheduleEvent).toHaveBeenCalledTimes(1));
    const [saved] = updateScheduleEvent.mock.calls[0];
    expect(saved.id).toBe(0n);
    expect(saved.name).toBe("Paperwork due (final)");
    // The seeded event is updated, never re-created.
    expect(createScheduleEvent).not.toHaveBeenCalled();
  });

  it("shows no separate Paperwork due date box on the schedule tab", async () => {
    const user = userEvent.setup();
    const { actor } = adminActor();
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    await user.click(await screen.findByTestId("admin.schedule.tab"));
    await screen.findByTestId("admin.schedule.list");

    // The retired standalone date input and its save control are gone; the
    // schedule's Paperwork due event is the only source of the due date.
    expect(
      screen.queryByTestId("admin.schedule.paperwork_due.input"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("admin.schedule.paperwork_due.save_button"),
    ).not.toBeInTheDocument();
  });
});

describe("paperworkDueEvent is the single source of the due date", () => {
  it("returns the deadline event named Paperwork due", () => {
    const event = paperworkDueEvent([PAPERWORK_DUE]);
    expect(event?.id).toBe(0n);
    expect(event?.name).toBe("Paperwork due");
  });

  it("ignores a deadline event with a different name", () => {
    const other: ScheduleEvent = {
      id: 5n,
      kind: EventKind.deadline,
      name: "Uniform order due",
      start: 1_801_202_400_000_000_000n,
    };
    expect(paperworkDueEvent([other])).toBeUndefined();
  });

  it("ignores a non-deadline event named Paperwork due", () => {
    const other: ScheduleEvent = {
      id: 6n,
      kind: EventKind.other,
      name: "Paperwork due",
      start: 1_801_202_400_000_000_000n,
    };
    expect(paperworkDueEvent([other])).toBeUndefined();
  });

  it("returns undefined when the schedule carries no such event", () => {
    expect(paperworkDueEvent([])).toBeUndefined();
  });

  it("returns the earliest matching deadline when several are present", () => {
    const later: ScheduleEvent = {
      id: 7n,
      kind: EventKind.deadline,
      name: "Paperwork due",
      start: 1_802_000_000_000_000_000n,
    };
    const earlier: ScheduleEvent = {
      id: 8n,
      kind: EventKind.deadline,
      name: "Paperwork due",
      start: 1_801_000_000_000_000_000n,
    };
    // The later event is listed first; the earliest start still wins.
    expect(paperworkDueEvent([later, earlier])?.id).toBe(8n);
  });
});
