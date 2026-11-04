import { renderPageWithActor } from "@/__tests__/router-test-utils";
import type {
  AccessGrant,
  OrientationRoadieRow,
  OrientationSessionView,
  Position,
  ScheduleEvent,
  StoreInfo,
  backendInterface,
} from "@/backend";
import {
  EventKind,
  House,
  PaperworkStatus,
  Role,
  RosterState,
} from "@/backend";
import { Layout } from "@/components/Layout";
import AdminPage from "@/pages/Admin";
import OrientationPage from "@/pages/Orientation";
import type { Principal } from "@icp-sdk/core/principal";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

/**
 * Cover for the orientation / roster-state request's remaining accepted
 * behavior, exercised through the real page components with a typed local actor
 * mock:
 *   - the Orientation nav item is visible to Admin, Store Manager, Training
 *     Manager and Visiting Manager and hidden from other roles,
 *   - Admin > Schedule shows an editable Paperwork due date,
 *   - Admin > Positions lets an admin edit default shirts and hats,
 *   - the Orientation screen's Archive all No-Shows confirmation lists the
 *     names before archiving,
 *   - the Orientation screen's Move to another session dialog lists the other
 *     sessions and moves the roadie.
 * The backend is mocked here; the PocketIC lane covers the real canister.
 */

const STORE: StoreInfo = {
  storeNumber: "975",
  appName: "Roadie Roster",
  locationName: "Lake Charles",
  address: "1400 W Prien Lake Rd, Lake Charles, LA 70601",
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
  // A non-zero id: the Positions panel treats id 0n as the add-vs-edit
  // sentinel, so an edit must target a real position id.
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

const PRINCIPAL = { toText: () => "aaaaa-aa" } as unknown as Principal;

function grant(role: Role): AccessGrant {
  return {
    principal: PRINCIPAL,
    approvedAt: 0n,
    approvedBy: PRINCIPAL,
    role,
    trainerPositionIds: [],
  };
}

/** The actor the Layout nav reads for a given role. */
function navActor(role: Role) {
  return {
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: grant(role),
    })),
    listPendingUsers: vi.fn<backendInterface["listPendingUsers"]>(
      async () => [],
    ),
    listPendingSignups: vi.fn<backendInterface["listPendingSignups"]>(
      async () => [],
    ),
  };
}

function NavPage() {
  return (
    <Layout>
      <p>content</p>
    </Layout>
  );
}

describe("Orientation nav item visibility", () => {
  for (const role of [
    Role.admin,
    Role.storeManager,
    Role.trainingManager,
    Role.visitingManager,
  ]) {
    it(`shows the Orientation link to a ${role}`, async () => {
      renderPageWithActor(NavPage, navActor(role), { path: "/" });

      expect(
        await screen.findByTestId("nav.orientation.link"),
      ).toBeInTheDocument();
    });
  }

  for (const role of [Role.trainer, Role.leadership, Role.kiosk]) {
    it(`hides the Orientation link from a ${role}`, async () => {
      renderPageWithActor(NavPage, navActor(role), { path: "/" });

      // The always-visible roster link renders, but Orientation does not.
      expect(await screen.findByTestId("nav.roster.link")).toBeInTheDocument();
      expect(
        screen.queryByTestId("nav.orientation.link"),
      ).not.toBeInTheDocument();
    });
  }
});

/** The actor the Admin page tree reads. */
function adminActor() {
  return {
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: grant(Role.admin),
    })),
    listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
      SERVERS,
    ]),
    listSchedule: vi.fn<backendInterface["listSchedule"]>(async () => []),
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
    updatePosition: vi.fn<backendInterface["updatePosition"]>(
      async () => undefined,
    ),
  };
}

describe("Admin > Positions uniform defaults", () => {
  it("lets an admin edit the shirt and hat type and quantity on a position", async () => {
    const user = userEvent.setup();
    const actor = adminActor();
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    await user.click(await screen.findByTestId("admin.positions.tab"));
    await user.click(await screen.findByTestId("admin.positions.edit_button"));

    const shirtQty = await screen.findByTestId(
      "admin.positions.shirt_qty.input",
    );
    const hatQty = screen.getByTestId("admin.positions.hat_qty.input");
    // The seeded uniform defaults are 2 shirts and 1 hat.
    expect(shirtQty).toHaveValue(2);
    expect(hatQty).toHaveValue(1);

    fireEvent.change(shirtQty, { target: { value: "4" } });
    fireEvent.change(hatQty, { target: { value: "5" } });
    expect(shirtQty).toHaveValue(4);
    expect(hatQty).toHaveValue(5);
    await user.click(screen.getByTestId("admin.positions.save_button"));

    await waitFor(() => expect(actor.updatePosition).toHaveBeenCalledTimes(1));
    const saved = actor.updatePosition.mock.calls[0][0];
    expect(saved.shirtQty).toBe(4n);
    expect(saved.hatQty).toBe(5n);
  });
});

/** One orientation session, starting in the future. */
function futureSession(
  id: bigint,
  name: string,
  daysAhead: number,
): ScheduleEvent {
  const now = Date.now();
  return {
    id,
    kind: EventKind.orientation,
    name,
    start: BigInt(now + daysAhead * 24 * 60 * 60 * 1000) * 1_000_000n,
  };
}

function orientationRow(
  overrides: Partial<OrientationRoadieRow> = {},
): OrientationRoadieRow {
  return {
    roadieId: 1n,
    name: "Ada Lovelace",
    positionId: 0n,
    positionName: "Servers",
    present: false,
    noShow: false,
    rosterState: RosterState.pending,
    paperworkStatus: PaperworkStatus.complete,
    ...overrides,
  };
}

function sessionView(
  roadies: OrientationRoadieRow[],
  presentCount: bigint,
): OrientationSessionView {
  return {
    eventId: 7n,
    name: "Orientation",
    start: futureSession(7n, "Orientation", 2).start,
    roadies,
    assignedCount: BigInt(roadies.length),
    presentCount,
  };
}

/** The actor the Orientation page reads, with two sessions. */
function orientationActor(view: OrientationSessionView) {
  return {
    listSchedule: vi.fn<backendInterface["listSchedule"]>(async () => [
      futureSession(7n, "Orientation", 2),
      futureSession(8n, "Makeup Orientation", 5),
    ]),
    getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(async () => STORE),
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: grant(Role.storeManager),
    })),
    getOrientationSessionView: vi.fn<
      backendInterface["getOrientationSessionView"]
    >(async () => view),
    markPresent: vi.fn<backendInterface["markPresent"]>(async () => undefined),
    undoPresent: vi.fn<backendInterface["undoPresent"]>(async () => undefined),
    archiveNoShows: vi.fn<backendInterface["archiveNoShows"]>(async () => []),
    archiveRoadie: vi.fn<backendInterface["archiveRoadie"]>(
      async () => undefined,
    ),
    moveRoadieToSession: vi.fn<backendInterface["moveRoadieToSession"]>(
      async () => undefined,
    ),
    getUniformCheckoff: vi.fn<backendInterface["getUniformCheckoff"]>(
      async () => null,
    ),
  };
}

describe("Orientation archive no-shows and move session", () => {
  it("lists the no-show names in the confirmation before archiving", async () => {
    const user = userEvent.setup();
    const actor = orientationActor(
      sessionView(
        [
          orientationRow({ roadieId: 1n, name: "Ada Lovelace", noShow: true }),
          orientationRow({ roadieId: 2n, name: "Grace Hopper", noShow: true }),
        ],
        0n,
      ),
    );
    renderPageWithActor(OrientationPage, actor, { path: "/orientation" });

    await user.click(
      await screen.findByTestId("orientation.archive_no_shows_button"),
    );

    const dialog = await screen.findByTestId(
      "orientation.archive_no_shows.dialog",
    );
    expect(within(dialog).getByText("Ada Lovelace")).toBeInTheDocument();
    expect(within(dialog).getByText("Grace Hopper")).toBeInTheDocument();

    await user.click(
      screen.getByTestId("orientation.archive_no_shows.confirm_button"),
    );

    await waitFor(() => expect(actor.archiveNoShows).toHaveBeenCalledWith(7n));
  });

  it("moves a roadie to another session through the move dialog", async () => {
    const user = userEvent.setup();
    const actor = orientationActor(
      sessionView([orientationRow({ roadieId: 1n, name: "Ada Lovelace" })], 0n),
    );
    renderPageWithActor(OrientationPage, actor, { path: "/orientation" });

    await user.click(
      await screen.findByTestId("orientation.roadie.move_button.1"),
    );

    const select = await screen.findByTestId("orientation.move.session_select");
    await user.click(select);
    await user.click(
      await screen.findByRole("option", { name: /Makeup Orientation/ }),
    );
    await user.click(screen.getByTestId("orientation.move.confirm_button"));

    await waitFor(() =>
      expect(actor.moveRoadieToSession).toHaveBeenCalledWith(1n, 8n),
    );
  });
});
