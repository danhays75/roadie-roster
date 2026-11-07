import { renderPageWithActor, t } from "@/__tests__/router-test-utils";
import { renderWithActor } from "@/__tests__/test-utils";
import type {
  ChangeLogEntry,
  ChecklistItem,
  ContactSet,
  Position,
  Roadie,
  backendInterface,
} from "@/backend";
import {
  House,
  RoadieStatus,
  Role,
  RosterState,
  Shift,
  Weekday,
} from "@/backend";
import { ManagerTab } from "@/components/roadie/ManagerTab";
import { RoadieTile } from "@/components/roadie/RoadieTile";
import { formatTimestamp } from "@/lib/format";
import RosterPage from "@/pages/Roster";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

/**
 * Characterization baseline for the behavior the "computed roadie stage"
 * request intentionally leaves alone.
 *
 * The request retires the hand-set status values, derives a stage instead,
 * removes the separate red Pending/Active tag, changes the roster tabs and
 * rewrites the demo seed and the Manager tab's Uniform sizes / Availability /
 * change-history copy. This file deliberately does NOT assert the old
 * Pending/Active tag, the old All/Pending/Active tabs, the raw
 * `manager.sizes.body` key, the two-badge availability panel or the raw
 * change-log action/detail. It protects the adjacent behavior that must
 * survive:
 *   - the roster tile's name, position, crew tag, Minor tag and
 *     paperwork-incomplete flag,
 *   - the roster page's search, crew filter, My crew chip, empty states and
 *     contact-set redaction,
 *   - the Manager tab's contact editor, orientation row, paperwork checklist
 *     and corporate id,
 *   - the FlipCard's on-demand photo, no-photo placeholder and flip.
 */

const PRINCIPAL = { toText: () => "aaaaa-aa" } as never;

function grant(role: Role) {
  return {
    principal: PRINCIPAL,
    role,
    approvedAt: 0n,
    approvedBy: PRINCIPAL,
    trainerPositionIds: [],
  };
}

const POSITION: Position = {
  id: 10n,
  name: "Cashier",
  code: "CSH",
  house: House.foh,
  openingBuildTo: 2n,
  afterOpeningBuildTo: 1n,
  minimumAge: 16n,
  needsAlcoholCert: false,
  shirtType: "Polo",
  shirtQty: 2n,
  hatType: "Cap",
  hatQty: 1n,
  defaultShirts: 2n,
  defaultHats: 1n,
};

function roadie(overrides: Partial<Roadie> = {}): Roadie {
  return {
    id: 1n,
    status: RoadieStatus.hired,
    mainPositionId: 10n,
    hiredAt: 0n,
    isMinor: false,
    isDemo: false,
    profile: { name: "Ada Lovelace", preferredName: "Ada" },
    rosterState: RosterState.pending,
    ...overrides,
  };
}

/** The actor methods the Roster page reads. */
function rosterActor(roadies: Roadie[]) {
  return {
    listRoadies: vi.fn<backendInterface["listRoadies"]>(async () => roadies),
    listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
      POSITION,
    ]),
    listCrews: vi.fn<backendInterface["listCrews"]>(async () => []),
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: grant(Role.admin),
    })),
  };
}

describe("RoadieTile keeps its name, position, crew, Minor and paperwork tags", () => {
  it("renders the name, position, crew tag and Minor tag", async () => {
    renderWithActor(
      <RoadieTile
        roadie={roadie({ isMinor: true })}
        positionName="Cashier"
        crewName="Opening Crew"
        crewLabel="Crew"
        onOpen={vi.fn()}
        ocid="tile"
        statusOcid="tile.status"
      />,
      {
        getPhoto: vi.fn<backendInterface["getPhoto"]>(async () => null),
      },
    );

    expect(await screen.findByText("Ada")).toBeInTheDocument();
    expect(screen.getByText("Cashier")).toBeInTheDocument();
    expect(screen.getByText("Crew: Opening Crew")).toBeInTheDocument();
    expect(screen.getByTestId("tile.minor")).toHaveTextContent("Minor");
  });

  it("shows the red paperwork-incomplete flag when set", async () => {
    renderWithActor(
      <RoadieTile
        roadie={roadie()}
        positionName="Cashier"
        paperworkIncomplete
        onOpen={vi.fn()}
        ocid="tile"
        statusOcid="tile.status"
      />,
      {
        getPhoto: vi.fn<backendInterface["getPhoto"]>(async () => null),
      },
    );

    expect(await screen.findByTestId("tile.paperwork")).toHaveTextContent(
      "Paperwork incomplete",
    );
  });

  it("shows Former as the stage and the archive reason for a former roadie", async () => {
    renderWithActor(
      <RoadieTile
        roadie={roadie({
          status: RoadieStatus.archived,
          archivedReason: { __kind__: "noShow", noShow: null },
        })}
        positionName="Cashier"
        onOpen={vi.fn()}
        ocid="tile"
        statusOcid="tile.status"
      />,
      {
        getPhoto: vi.fn<backendInterface["getPhoto"]>(async () => null),
      },
    );

    expect(await screen.findByTestId("tile.status")).toHaveTextContent(
      "Former",
    );
    expect(screen.getByTestId("tile.archive_reason")).toHaveTextContent(
      "No-show",
    );
  });
});

describe("Roster page keeps its search, crew filter and empty states", () => {
  it("filters rows by the search query", async () => {
    const user = userEvent.setup();
    renderPageWithActor(
      RosterPage,
      rosterActor([
        roadie({ id: 1n, profile: { name: "Ada Lovelace" } }),
        roadie({ id: 2n, profile: { name: "Grace Hopper" } }),
      ]),
      { path: "/roster" },
    );

    await screen.findByText("Ada Lovelace");
    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();

    await user.type(screen.getByTestId("roster.search_input"), "grace");

    await waitFor(() =>
      expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();
  });

  it("shows the no-match empty state for a query that matches nothing", async () => {
    const user = userEvent.setup();
    renderPageWithActor(RosterPage, rosterActor([roadie()]), {
      path: "/roster",
    });

    await screen.findByText("Ada");
    await user.type(screen.getByTestId("roster.search_input"), "zzz");

    expect(await screen.findByText(t("roster.empty"))).toBeInTheDocument();
  });

  it("shows the empty state when no roadies exist", async () => {
    renderPageWithActor(RosterPage, rosterActor([]), { path: "/roster" });

    expect(await screen.findByText(t("roster.emptyAll"))).toBeInTheDocument();
  });

  it("never renders contact-set fields for a redacted roadie", async () => {
    renderPageWithActor(RosterPage, rosterActor([roadie()]), {
      path: "/roster",
    });

    await screen.findByText("Ada");
    expect(screen.queryByText("+1-555-0100")).not.toBeInTheDocument();
    expect(screen.queryByText("ada@example.com")).not.toBeInTheDocument();
  });

  it("keeps the Show former toggle revealing archived roadies separately", async () => {
    const user = userEvent.setup();
    const archived = roadie({
      id: 9n,
      status: RoadieStatus.archived,
      profile: { name: "Archived Ada" },
      archivedReason: { __kind__: "noShow", noShow: null },
    });
    renderPageWithActor(
      RosterPage,
      rosterActor([roadie({ id: 1n }), archived]),
      {
        path: "/roster",
      },
    );

    const toggle = await screen.findByTestId("roster.former.toggle");
    expect(toggle).toHaveTextContent("Show former (1)");
    await user.click(toggle);

    const formerList = await screen.findByTestId("roster.former.list");
    expect(
      within(formerList).getByTestId("roster.former.item"),
    ).toHaveTextContent("No-show");
  });
});

/** The actor methods the Manager tab reads. */
function managerActor(
  overrides: {
    contactSet?: ContactSet | null;
    checkoff?: {
      paperworkItems: string[];
      uniformItems: string[];
      uniformCounts: Array<[bigint, bigint]>;
      shirtsCount: bigint;
      hatsCount: bigint;
      roadieId: bigint;
      isDemo: boolean;
      updatedAt: bigint;
    } | null;
    changeLog?: ChangeLogEntry[];
    paperwork?: ChecklistItem[];
  } = {},
) {
  const contactSet: ContactSet = overrides.contactSet ?? {
    phone: "+1-555-0100",
    email: "ada@example.com",
    emergencyContactName: "Grace",
    emergencyContactPhone: "+1-555-0101",
    dateOfBirth: 0n,
    availability: [],
    availabilityResignPending: false,
  };
  return {
    getContactSet: vi.fn<backendInterface["getContactSet"]>(async () =>
      contactSet ? [contactSet] : [],
    ),
    listChangeLog: vi.fn<backendInterface["listChangeLog"]>(
      async () => overrides.changeLog ?? [],
    ),
    getChecklists: vi.fn<backendInterface["getChecklists"]>(async () => ({
      paperwork: overrides.paperwork ?? [],
      orientationUniform: [],
    })),
    listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
      POSITION,
    ]),
    getOrientationCheckoff: vi.fn<backendInterface["getOrientationCheckoff"]>(
      async () => overrides.checkoff ?? null,
    ),
    listSchedule: vi.fn<backendInterface["listSchedule"]>(async () => []),
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: grant(Role.storeManager),
    })),
    updateRoadieDetails: vi.fn<backendInterface["updateRoadieDetails"]>(
      async () => {},
    ),
    updateContactSet: vi.fn<backendInterface["updateContactSet"]>(
      async () => {},
    ),
    setPaperworkItems: vi.fn<backendInterface["setPaperworkItems"]>(
      async () => {},
    ),
    moveRoadieToSession: vi.fn<backendInterface["moveRoadieToSession"]>(
      async () => {},
    ),
  };
}

describe("Manager tab keeps its contact, orientation, paperwork and corporate sections", () => {
  it("renders the contact editor with the stored phone and email", async () => {
    renderWithActor(<ManagerTab roadie={roadie()} />, managerActor());

    expect(await screen.findByTestId("roadie.contact.phone_input")).toHaveValue(
      "+1-555-0100",
    );
    expect(screen.getByTestId("roadie.contact.email_input")).toHaveValue(
      "ada@example.com",
    );
    expect(screen.getByTestId("roadie.manager.contact")).toBeInTheDocument();
  });

  it("shows the orientation row and the corporate id section", async () => {
    renderWithActor(
      <ManagerTab roadie={roadie({ corporateEmployeeId: "E-42" })} />,
      managerActor(),
    );

    expect(
      await screen.findByTestId("roadie.manager.orientation"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("roadie.manager.corporate")).toHaveTextContent(
      "E-42",
    );
  });

  it("renders the paperwork checklist with its progress line", async () => {
    const paperwork: ChecklistItem[] = [
      {
        id: 0n,
        text: "I-9",
        requiresAlcoholCert: false,
        minorOnly: false,
        itemType: "paperwork" as never,
      },
      {
        id: 1n,
        text: "W-4",
        requiresAlcoholCert: false,
        minorOnly: false,
        itemType: "paperwork" as never,
      },
    ];
    renderWithActor(
      <ManagerTab roadie={roadie()} />,
      managerActor({
        paperwork,
        checkoff: {
          paperworkItems: ["0"],
          uniformItems: [],
          uniformCounts: [],
          shirtsCount: 0n,
          hatsCount: 0n,
          roadieId: 1n,
          isDemo: false,
          updatedAt: 0n,
        },
      }),
    );

    expect(
      await screen.findByTestId("roadie.paperwork.progress"),
    ).toHaveTextContent("Paperwork 1 of 2");
    expect(screen.getByText("I-9")).toBeInTheDocument();
    expect(screen.getByText("W-4")).toBeInTheDocument();
  });

  it("shows the empty change-history state when no entries exist", async () => {
    renderWithActor(<ManagerTab roadie={roadie()} />, managerActor());

    expect(
      await screen.findByText(t("roadie.changeHistory.empty")),
    ).toBeInTheDocument();
  });
});

/**
 * Adjacent behavior the accepted Manager-tab change must not disturb: the
 * availability panel's weekday/shift grid and its signature pad, and the
 * change-history row's timestamp, detail line and contact-set marker. The
 * request intentionally changes the availability badge count and the
 * change-history labels/merging, so this file deliberately does NOT assert
 * those; it protects the surrounding structure.
 */
describe("Manager tab availability panel keeps its grid and signature pad", () => {
  it("renders the weekday/shift grid and the signature canvas", async () => {
    renderWithActor(<ManagerTab roadie={roadie()} />, managerActor());

    // The availability section renders the grid with one cell per weekday and
    // shift, and the signature canvas the manager draws on. The contact-set
    // query resolves asynchronously, so wait for the canvas to appear.
    const canvas = await screen.findByTestId(
      "roadie.availability.canvas_target",
    );
    expect(canvas).toBeInTheDocument();
    const availability = screen.getByTestId("roadie.manager.availability");
    // Seven weekday rows, each with an AM and a PM cell.
    const cells = within(availability).getAllByLabelText(/ (AM|PM)$/);
    expect(cells).toHaveLength(14);
  });

  it("marks the stored availability slots as selected in the grid", async () => {
    const contactSet: ContactSet = {
      phone: "+1-555-0100",
      email: "ada@example.com",
      emergencyContactName: "Grace",
      emergencyContactPhone: "+1-555-0101",
      dateOfBirth: 0n,
      availability: [
        { day: Weekday.mon, shift: Shift.am },
        { day: Weekday.fri, shift: Shift.pm },
      ],
      availabilityResignPending: false,
    };
    renderWithActor(
      <ManagerTab roadie={roadie()} />,
      managerActor({ contactSet }),
    );

    await screen.findByTestId("roadie.availability.canvas_target");
    const availability = screen.getByTestId("roadie.manager.availability");
    // The two stored slots carry the accent (selected) class; the rest do not.
    const selected = within(availability)
      .getAllByLabelText(/ (AM|PM)$/)
      .filter((cell) => cell.className.includes("bg-accent"));
    expect(selected).toHaveLength(2);
  });
});

describe("Manager tab change history keeps its row structure", () => {
  it("renders the timestamp, detail line and contact-set marker for an entry", async () => {
    const at = BigInt(Date.UTC(2027, 0, 15, 18, 30)) * 1_000_000n;
    const entry: ChangeLogEntry = {
      id: 5n,
      at,
      by: { toText: () => "aaaaa-aa" } as never,
      action: "updateContactSet",
      detail: "Updated the contact set",
      isDemo: false,
      touchesContactSet: true,
      subjectRoadieId: 1n,
    };
    renderWithActor(
      <ManagerTab roadie={roadie()} />,
      managerActor({ changeLog: [entry] }),
    );

    const row = await screen.findByTestId("roadie.change_history.item");
    // The row shows the entry's timestamp and its detail line.
    expect(row).toHaveTextContent(formatTimestamp(at));
    expect(row).toHaveTextContent("Updated the contact set");
    // A contact-set-touching entry carries the contact-set marker.
    expect(row).toHaveTextContent(t("roadie.changeHistory.touchesContact"));
  });

  it("omits the contact-set marker for an entry that does not touch it", async () => {
    const entry: ChangeLogEntry = {
      id: 6n,
      at: 1_000_000_000n,
      by: { toText: () => "aaaaa-aa" } as never,
      action: "markPresent",
      detail: "Marked present",
      isDemo: false,
      touchesContactSet: false,
      subjectRoadieId: 1n,
    };
    renderWithActor(
      <ManagerTab roadie={roadie()} />,
      managerActor({ changeLog: [entry] }),
    );

    const row = await screen.findByTestId("roadie.change_history.item");
    expect(row).toHaveTextContent("Marked present");
    expect(row).not.toHaveTextContent(t("roadie.changeHistory.touchesContact"));
  });
});
