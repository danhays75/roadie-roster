import { renderPageWithActor } from "@/__tests__/router-test-utils";
import { renderWithActor } from "@/__tests__/test-utils";
import type {
  ChecklistItem,
  ContactSet,
  OrientationCheckoff,
  Position,
  Roadie,
  backendInterface,
} from "@/backend";
import {
  House,
  PaperworkStep,
  RoadieStage,
  RoadieStatus,
  Role,
  RosterState,
  UniformItemType,
} from "@/backend";
import { RoadieTile } from "@/components/roadie/RoadieTile";
import AdminPage from "@/pages/Admin";
import RoadieCardPage from "@/pages/RoadieCard";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

/**
 * Cover for the accepted paperwork enabled-flag and admin-order change,
 * exercised through the real Admin checklist editor, the real Manager tab
 * checklist and the shared RoadieTile with a typed local actor mock:
 *   - each paperwork item carries an On/Off switch and Move up / Move down
 *     buttons in the admin editor,
 *   - moving an item changes the order saved through `updateChecklists`,
 *   - turning an item off saves `enabled: false` for that item,
 *   - a disabled item is hidden from the roadie's paperwork checklist as if it
 *     did not exist,
 *   - an enabled Food Handler Card step shows the "Food Handler" tag with a
 *     check mark.
 * The backend is mocked here; the PocketIC lane covers the real canister.
 */

const SERVERS: Position = {
  id: 0n,
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

/** The seeded paperwork checklist in its enforced order, all enabled. */
const PAPERWORK_ITEMS: ChecklistItem[] = [
  {
    id: 0n,
    text: "Digital Paperwork",
    minorOnly: false,
    requiresAlcoholCert: false,
    enabled: true,
    itemType: UniformItemType.checkbox,
  },
  {
    id: 5n,
    text: "I-9 / W-4",
    minorOnly: false,
    requiresAlcoholCert: false,
    enabled: true,
    itemType: UniformItemType.checkbox,
  },
  {
    id: 3n,
    text: "Alcohol Certificate",
    minorOnly: false,
    requiresAlcoholCert: true,
    enabled: true,
    itemType: UniformItemType.checkbox,
  },
  {
    id: 1n,
    text: "Policies & Procedures",
    minorOnly: false,
    requiresAlcoholCert: false,
    enabled: true,
    itemType: UniformItemType.checkbox,
  },
];

/* ---------------------------------------------------------------------------
   Admin > Checklists > Paperwork: On/Off switch and Move up / Move down
--------------------------------------------------------------------------- */

/** The actor methods the Admin checklists panel reads. */
function adminActor(paperwork: ChecklistItem[] = PAPERWORK_ITEMS) {
  const updateChecklists = vi.fn<backendInterface["updateChecklists"]>(
    async () => undefined,
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
      getDemoState: vi.fn<backendInterface["getDemoState"]>(async () => ({
        enabled: false,
        demoRole: undefined,
        demoTrainerStations: [],
        pretendDate: undefined,
        turnedOnAt: undefined,
        autoOffAt: undefined,
      })),
      getChecklists: vi.fn<backendInterface["getChecklists"]>(async () => ({
        paperwork,
        orientationUniform: [],
      })),
      getRetentionSettings: vi.fn<backendInterface["getRetentionSettings"]>(
        async () => ({
          archivedContactSetDays: 90n,
          notesDays: 365n,
          archivedPhotoDays: 365n,
          changeLogDays: 730n,
        }),
      ),
      updateChecklists,
    },
    updateChecklists,
  };
}

async function openChecklistsTab() {
  const user = userEvent.setup();
  renderPageWithActor(AdminPage, adminActor().actor, { path: "/admin" });
  await user.click(await screen.findByTestId("admin.checklists.tab"));
  return user;
}

describe("Admin paperwork editor shows an On/Off switch and Move up / Move down per item", () => {
  it("renders the enabled switch and both move buttons on each paperwork item", async () => {
    await openChecklistsTab();

    const section = await screen.findByTestId("admin.checklists.paperwork");
    // The first item carries the enabled switch and both move controls.
    expect(
      within(section).getByTestId(
        "admin.checklists.paperwork.enabled.switch.1",
      ),
    ).toBeInTheDocument();
    expect(
      within(section).getByTestId(
        "admin.checklists.paperwork.move_up_button.1",
      ),
    ).toBeInTheDocument();
    expect(
      within(section).getByTestId(
        "admin.checklists.paperwork.move_down_button.1",
      ),
    ).toBeInTheDocument();
    // The last item also carries the controls.
    expect(
      within(section).getByTestId(
        "admin.checklists.paperwork.enabled.switch.4",
      ),
    ).toBeInTheDocument();
  });

  it("disables Move up on the first item and Move down on the last item", async () => {
    await openChecklistsTab();

    const section = await screen.findByTestId("admin.checklists.paperwork");
    expect(
      within(section).getByTestId(
        "admin.checklists.paperwork.move_up_button.1",
      ),
    ).toBeDisabled();
    expect(
      within(section).getByTestId(
        "admin.checklists.paperwork.move_down_button.4",
      ),
    ).toBeDisabled();
  });

  it("saves the reordered paperwork list when Move down is pressed", async () => {
    const user = userEvent.setup();
    const actor = adminActor();
    renderPageWithActor(AdminPage, actor.actor, { path: "/admin" });
    await user.click(await screen.findByTestId("admin.checklists.tab"));
    await screen.findByDisplayValue("Digital Paperwork");

    // Move the first item (Digital Paperwork) down one position.
    await user.click(
      screen.getByTestId("admin.checklists.paperwork.move_down_button.1"),
    );
    await user.click(screen.getByTestId("admin.checklists.save_button"));

    await waitFor(() =>
      expect(actor.updateChecklists).toHaveBeenCalledTimes(1),
    );
    const saved = actor.updateChecklists.mock.calls[0]?.[0];
    // I-9 / W-4 is now first and Digital Paperwork second.
    expect(saved?.paperwork.map((item) => item.text)).toEqual([
      "I-9 / W-4",
      "Digital Paperwork",
      "Alcohol Certificate",
      "Policies & Procedures",
    ]);
  });

  it("saves enabled: false for an item turned off with the On/Off switch", async () => {
    const user = userEvent.setup();
    const actor = adminActor();
    renderPageWithActor(AdminPage, actor.actor, { path: "/admin" });
    await user.click(await screen.findByTestId("admin.checklists.tab"));
    await screen.findByDisplayValue("Digital Paperwork");

    // Turn the first item off.
    await user.click(
      screen.getByTestId("admin.checklists.paperwork.enabled.switch.1"),
    );
    await user.click(screen.getByTestId("admin.checklists.save_button"));

    await waitFor(() =>
      expect(actor.updateChecklists).toHaveBeenCalledTimes(1),
    );
    const saved = actor.updateChecklists.mock.calls[0]?.[0];
    const digital = saved?.paperwork.find(
      (item) => item.text === "Digital Paperwork",
    );
    expect(digital?.enabled).toBe(false);
    // The other items keep their enabled flag.
    const i9 = saved?.paperwork.find((item) => item.text === "I-9 / W-4");
    expect(i9?.enabled).toBe(true);
  });
});

/* ---------------------------------------------------------------------------
   Manager tab: a disabled paperwork item is hidden
--------------------------------------------------------------------------- */

const MANAGER_CONTACT: ContactSet = {
  phone: "+1-555-0100",
  email: "ada@example.com",
  emergencyContactName: "Grace",
  emergencyContactPhone: "+1-555-0101",
  dateOfBirth: 0n,
  availability: [],
  availabilityResignPending: false,
};

function managerRoadie(overrides: Partial<Roadie> = {}): Roadie {
  return {
    id: 1n,
    status: RoadieStatus.hired,
    mainPositionId: 0n,
    hiredAt: 0n,
    isMinor: false,
    isDemo: false,
    profile: { name: "Ada Lovelace" },
    rosterState: RosterState.pending,
    ...overrides,
  };
}

function checkoff(paperworkItems: string[]): OrientationCheckoff {
  return {
    roadieId: 1n,
    paperworkItems,
    uniformItems: [],
    uniformCounts: [],
    shirtsCount: 0n,
    hatsCount: 0n,
    updatedAt: 0n,
    isDemo: false,
  };
}

/** The actor the roadie card's manager tab reads. */
function managerTabActor(
  roadie: Roadie,
  stored: OrientationCheckoff | null,
  paperwork: ChecklistItem[] = PAPERWORK_ITEMS,
) {
  const setPaperworkItems = vi.fn<backendInterface["setPaperworkItems"]>(
    async () => undefined,
  );
  return {
    actor: {
      getRoadie: vi.fn<backendInterface["getRoadie"]>(async () => roadie),
      listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
        SERVERS,
      ]),
      listCrews: vi.fn<backendInterface["listCrews"]>(async () => []),
      getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
        grant: {
          principal: { toText: () => "aaaaa-aa" } as never,
          role: Role.storeManager,
          approvedAt: 0n,
          approvedBy: { toText: () => "aaaaa-aa" } as never,
          trainerPositionIds: [],
        },
      })),
      getContactSet: vi.fn<backendInterface["getContactSet"]>(async () => [
        MANAGER_CONTACT,
      ]),
      getChecklists: vi.fn<backendInterface["getChecklists"]>(async () => ({
        paperwork,
        orientationUniform: [],
      })),
      getOrientationCheckoff: vi.fn<backendInterface["getOrientationCheckoff"]>(
        async () => stored,
      ),
      setPaperworkItems,
      listChangeLog: vi.fn<backendInterface["listChangeLog"]>(async () => []),
      listOrientationSessions: vi.fn<
        backendInterface["listOrientationSessions"]
      >(async () => []),
      moveRoadieToSession: vi.fn<backendInterface["moveRoadieToSession"]>(
        async () => undefined,
      ),
    },
    setPaperworkItems,
  };
}

async function openManagerTab() {
  const user = userEvent.setup();
  await user.click(await screen.findByTestId("roadie.manager.tab"));
  return user;
}

describe("Manager tab hides a disabled paperwork item", () => {
  it("does not render a disabled item and counts only the enabled items", async () => {
    const withDisabled: ChecklistItem[] = PAPERWORK_ITEMS.map((item) =>
      item.id === 5n ? { ...item, enabled: false } : item,
    );
    renderPageWithActor(
      RoadieCardPage,
      managerTabActor(managerRoadie(), checkoff([]), withDisabled).actor,
      { path: "/roster/$roadieId", initialEntry: "/roster/1" },
    );

    await openManagerTab();

    const section = await screen.findByTestId("roadie.manager.paperwork");
    // The disabled I-9 / W-4 item is hidden as if it did not exist.
    expect(within(section).queryByText("I-9 / W-4")).not.toBeInTheDocument();
    // The remaining three enabled items are shown.
    expect(within(section).getByText("Digital Paperwork")).toBeInTheDocument();
    expect(
      within(section).getByText("Alcohol Certificate"),
    ).toBeInTheDocument();
    expect(
      within(section).getByText("Policies & Procedures"),
    ).toBeInTheDocument();
    expect(
      within(section).getByTestId("roadie.paperwork.progress"),
    ).toHaveTextContent("Paperwork 0 of 3");
  });

  it("hides a disabled Food Handler Card item from the checklist", async () => {
    const withFoodHandler: ChecklistItem[] = [
      ...PAPERWORK_ITEMS,
      {
        id: 2n,
        text: "Food Handler Card",
        minorOnly: false,
        requiresAlcoholCert: false,
        enabled: false,
        itemType: UniformItemType.checkbox,
      },
    ];
    renderPageWithActor(
      RoadieCardPage,
      managerTabActor(managerRoadie(), checkoff([]), withFoodHandler).actor,
      { path: "/roster/$roadieId", initialEntry: "/roster/1" },
    );

    await openManagerTab();

    const section = await screen.findByTestId("roadie.manager.paperwork");
    expect(
      within(section).queryByText("Food Handler Card"),
    ).not.toBeInTheDocument();
  });
});

/* ---------------------------------------------------------------------------
   Enabled Food Handler Card step tag reads "Food Handler" with a check mark
--------------------------------------------------------------------------- */

function tileActor() {
  return {
    getPhoto: vi.fn<backendInterface["getPhoto"]>(async () => null),
  };
}

describe("RoadieTile shows the Food Handler step tag for an enabled Food Handler Card", () => {
  it("shows Food Handler with a check mark for a Hired roadie with the Food Handler Card done", async () => {
    renderWithActor(
      <RoadieTile
        roadie={managerRoadie({
          stage: RoadieStage.hired,
          paperworkStep: PaperworkStep.foodHandlerCard,
        })}
        positionName="Servers"
        onOpen={vi.fn()}
        ocid="tile"
        statusOcid="tile.status"
      />,
      tileActor(),
    );

    const status = await screen.findByTestId("tile.status");
    expect(status).toHaveTextContent("Food Handler");
    // The check mark marks a completed step.
    expect(status.querySelector("svg")).not.toBeNull();
  });
});
