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
import RoadieCardPage from "@/pages/RoadieCard";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

/**
 * Cover for the accepted paperwork-order and Hired-stage-tag change, exercised
 * through the real Manager tab and the shared RoadieTile with a typed local
 * actor mock:
 *   - the checklist renders the seeded items in enforced order (Digital
 *     Paperwork, I-9 / W-4, Alcohol Certificate, Policies & Procedures, then
 *     minor-only items),
 *   - a later item is disabled with a "Finish <previous item> first" hint until
 *     the item above it is checked,
 *   - unchecking an item clears every item below it,
 *   - a non-alcohol position hides the Alcohol Certificate and lets I-9 / W-4
 *     be checked once Digital Paperwork is done,
 *   - a Hired roadie's stage tag shows the latest completed paperwork step with
 *     a check mark, and Paperwork Done once every applicable item is checked.
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

/** The seeded paperwork checklist in its enforced order. */
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
  {
    id: 4n,
    text: "LA employment certificate (LWC confirmation received)",
    minorOnly: true,
    requiresAlcoholCert: false,
    enabled: true,
    itemType: UniformItemType.checkbox,
  },
];

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
  position: Position = SERVERS,
) {
  const setPaperworkItems = vi.fn<backendInterface["setPaperworkItems"]>(
    async () => undefined,
  );
  return {
    actor: {
      getRoadie: vi.fn<backendInterface["getRoadie"]>(async () => roadie),
      listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
        position,
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
        paperwork: PAPERWORK_ITEMS,
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

describe("Manager tab paperwork checklist order and in-order enforcement", () => {
  it("renders the seeded items in enforced order with minor-only items last", async () => {
    renderPageWithActor(
      RoadieCardPage,
      managerTabActor(managerRoadie({ isMinor: true }), checkoff([])).actor,
      { path: "/roster/$roadieId", initialEntry: "/roster/1" },
    );

    await openManagerTab();

    const section = await screen.findByTestId("roadie.manager.paperwork");
    const labels = within(section)
      .getAllByTestId("roadie.paperwork.checkbox")
      .map((box) => {
        const id = box.getAttribute("id");
        return id
          ? section.querySelector(`label[for="${id}"]`)?.textContent
          : "";
      });

    expect(labels[0]).toContain("Digital Paperwork");
    expect(labels[1]).toContain("I-9 / W-4");
    expect(labels[2]).toContain("Alcohol Certificate");
    expect(labels[3]).toContain("Policies & Procedures");
    // The minor-only item is last, after every general item.
    expect(labels[4]).toContain(
      "LA employment certificate (LWC confirmation received)",
    );
    // The removed Food handler card is gone.
    expect(
      within(section).queryByText(/Food handler/i),
    ).not.toBeInTheDocument();
  });

  it("disables the I-9 / W-4 checkbox with a Finish Digital Paperwork first hint until Digital Paperwork is checked", async () => {
    renderPageWithActor(
      RoadieCardPage,
      managerTabActor(managerRoadie(), checkoff([])).actor,
      { path: "/roster/$roadieId", initialEntry: "/roster/1" },
    );

    await openManagerTab();

    const section = await screen.findByTestId("roadie.manager.paperwork");
    const boxes = within(section).getAllByTestId("roadie.paperwork.checkbox");
    // Digital Paperwork is the first item and is enabled; I-9 / W-4 is blocked.
    expect(boxes[0]).not.toBeDisabled();
    expect(boxes[1]).toBeDisabled();
    // The blocked item shows the hint naming the item above it.
    expect(
      within(section).getByText("Finish Digital Paperwork first"),
    ).toBeInTheDocument();
  });

  it("unchecking Digital Paperwork also unchecks I-9 / W-4, Alcohol Certificate and Policies & Procedures", async () => {
    const actor = managerTabActor(
      managerRoadie(),
      checkoff(["0", "5", "3", "1"]),
    );
    renderPageWithActor(RoadieCardPage, actor.actor, {
      path: "/roster/$roadieId",
      initialEntry: "/roster/1",
    });

    const user = await openManagerTab();

    const section = await screen.findByTestId("roadie.manager.paperwork");
    const boxes = within(section).getAllByTestId("roadie.paperwork.checkbox");
    // Uncheck the first item; every item below it must be cleared too.
    await user.click(boxes[0]);

    await waitFor(() =>
      expect(actor.setPaperworkItems).toHaveBeenCalledWith(1n, []),
    );
  });

  it("hides the Alcohol Certificate for a non-alcohol position and lets I-9 / W-4 be checked once Digital Paperwork is done", async () => {
    const cook: Position = { ...SERVERS, needsAlcoholCert: false };
    const actor = managerTabActor(managerRoadie(), checkoff(["0"]), cook);
    renderPageWithActor(RoadieCardPage, actor.actor, {
      path: "/roster/$roadieId",
      initialEntry: "/roster/1",
    });

    const user = await openManagerTab();

    const section = await screen.findByTestId("roadie.manager.paperwork");
    // The alcohol item does not apply to a cook.
    expect(
      within(section).queryByText("Alcohol Certificate"),
    ).not.toBeInTheDocument();
    const boxes = within(section).getAllByTestId("roadie.paperwork.checkbox");
    // Digital Paperwork is done, so I-9 / W-4 is now enabled.
    expect(boxes[0]).toBeChecked();
    expect(boxes[1]).not.toBeDisabled();

    await user.click(boxes[1]);
    await waitFor(() =>
      expect(actor.setPaperworkItems).toHaveBeenCalledWith(1n, ["0", "5"]),
    );
  });
});

/* ---------------------------------------------------------------------------
   Hired stage tag shows the latest completed paperwork step
--------------------------------------------------------------------------- */

function tileActor() {
  return {
    getPhoto: vi.fn<backendInterface["getPhoto"]>(async () => null),
  };
}

describe("RoadieTile Hired stage tag shows the latest completed paperwork step", () => {
  it("shows Digital Paperwork with a check mark for a Hired roadie with Digital Paperwork done", async () => {
    renderWithActor(
      <RoadieTile
        roadie={managerRoadie({
          stage: RoadieStage.hired,
          paperworkStep: PaperworkStep.digitalPaperwork,
        })}
        positionName="Servers"
        onOpen={vi.fn()}
        ocid="tile"
        statusOcid="tile.status"
      />,
      tileActor(),
    );

    const status = await screen.findByTestId("tile.status");
    expect(status).toHaveTextContent("Digital Paperwork");
    // The check mark marks a completed step.
    expect(status.querySelector("svg")).not.toBeNull();
  });

  it("shows I-9 / W-4 with a check mark for a Hired roadie with I-9 / W-4 done", async () => {
    renderWithActor(
      <RoadieTile
        roadie={managerRoadie({
          stage: RoadieStage.hired,
          paperworkStep: PaperworkStep.i9W4,
        })}
        positionName="Servers"
        onOpen={vi.fn()}
        ocid="tile"
        statusOcid="tile.status"
      />,
      tileActor(),
    );

    const status = await screen.findByTestId("tile.status");
    expect(status).toHaveTextContent("I-9 / W-4");
    expect(status.querySelector("svg")).not.toBeNull();
  });

  it("shows Alcohol Cert with a check mark for a Hired roadie with the Alcohol Certificate done", async () => {
    renderWithActor(
      <RoadieTile
        roadie={managerRoadie({
          stage: RoadieStage.hired,
          paperworkStep: PaperworkStep.alcoholCertificate,
        })}
        positionName="Servers"
        onOpen={vi.fn()}
        ocid="tile"
        statusOcid="tile.status"
      />,
      tileActor(),
    );

    const status = await screen.findByTestId("tile.status");
    expect(status).toHaveTextContent("Alcohol Cert");
    expect(status.querySelector("svg")).not.toBeNull();
  });

  it("shows Paperwork Done once every applicable item is checked", async () => {
    renderWithActor(
      <RoadieTile
        roadie={managerRoadie({ stage: RoadieStage.paperworkDone })}
        positionName="Servers"
        onOpen={vi.fn()}
        ocid="tile"
        statusOcid="tile.status"
      />,
      tileActor(),
    );

    const status = await screen.findByTestId("tile.status");
    expect(status).toHaveTextContent("Paperwork Done");
    // A non-Hired stage tag carries no check mark.
    expect(status.querySelector("svg")).toBeNull();
  });

  it("shows the plain Hired label for a Hired roadie with no completed step", async () => {
    renderWithActor(
      <RoadieTile
        roadie={managerRoadie({
          stage: RoadieStage.hired,
          paperworkStep: PaperworkStep.none,
        })}
        positionName="Servers"
        onOpen={vi.fn()}
        ocid="tile"
        statusOcid="tile.status"
      />,
      tileActor(),
    );

    const status = await screen.findByTestId("tile.status");
    expect(status).toHaveTextContent("Hired");
    expect(status.querySelector("svg")).toBeNull();
  });
});
