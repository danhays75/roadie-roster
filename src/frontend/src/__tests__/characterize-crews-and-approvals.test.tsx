import { renderPageWithActor, t } from "@/__tests__/router-test-utils";
import type {
  Crew,
  Position,
  SignupSubmission,
  StoreInfo,
  backendInterface,
} from "@/backend";
import { House } from "@/backend";
import AdminPage from "@/pages/Admin";
import ApprovalsPage from "@/pages/Approvals";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

/**
 * Characterization baseline for the surfaces the Crews work touches. These
 * tests protect behavior that must survive the change: the existing Admin tabs
 * and their panels, the duplicate-check states around the intentionally
 * reworded row, and the Crew field's current "No crew" default and its
 * round-trip into the approval decision. They deliberately do not assert the
 * old "Card #{id} matched on {field}" row text or the absence of a Crews tab.
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
  paperworkDueDate: 1_800_000_000_000_000_000n,
};

const SERVERS: Position = {
  id: 0n,
  name: "Servers",
  code: "SRV",
  house: House.foh,
  openingBuildTo: 65n,
  afterOpeningBuildTo: 65n,
  minimumAge: 18n,
  shirtsRequired: 2n,
  hatsRequired: 1n,
  needsAlcoholCert: true,
  defaultShirts: 3n,
  defaultHats: 2n,
  shirtType: "Polo",
  shirtQty: 2n,
  hatType: "Cap",
  hatQty: 1n,
};

const CREWS: Crew[] = [
  { id: 0n, name: "Jordan's Crew", isDemo: false },
  { id: 1n, name: "Sam's Crew", isDemo: false },
];

/** A pending sign-up that is a clear adult, so no age gate interferes. */
function adultSignup(): SignupSubmission {
  const now = Date.now();
  const twentyFiveYearsAgo = new Date(now - 25 * 365 * 24 * 60 * 60 * 1000);
  return {
    id: 1n,
    status: { __kind__: "pending", pending: null },
    submittedAt: BigInt(now) * 1_000_000n,
    profile: { name: "Adult Applicant" },
    isDemo: false,
    contactSet: {
      email: "adult@example.com",
      phone: "+1-555-0100",
      dateOfBirth: BigInt(twentyFiveYearsAgo.getTime()) * 1_000_000n,
      emergencyContactName: "Emergency",
      emergencyContactPhone: "+1-555-0101",
      availability: [],
      availabilityResignPending: false,
    },
  };
}

/** The actor methods the admin page tree reads across its tabs. */
function adminActor() {
  return {
    getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(async () => STORE),
    listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
      SERVERS,
    ]),
    listSchedule: vi.fn<backendInterface["listSchedule"]>(async () => []),
    getChecklists: vi.fn<backendInterface["getChecklists"]>(async () => ({
      orientationUniform: [],
      paperwork: [],
    })),
    getRetentionSettings: vi.fn<backendInterface["getRetentionSettings"]>(
      async () => ({
        archivedContactSetDays: 90n,
        notesDays: 365n,
        archivedPhotoDays: 365n,
        changeLogDays: 730n,
      }),
    ),
    listAccessGrants: vi.fn<backendInterface["listAccessGrants"]>(
      async () => [],
    ),
    adminCount: vi.fn<backendInterface["adminCount"]>(async () => 1n),
    listCrews: vi.fn<backendInterface["listCrews"]>(async () => CREWS),
  };
}

/** The actor methods the approvals page tree reads. */
function approvalsActor(signup: SignupSubmission) {
  return {
    listPendingUsers: vi.fn<backendInterface["listPendingUsers"]>(
      async () => [],
    ),
    listPendingSignups: vi.fn<backendInterface["listPendingSignups"]>(
      async () => [signup],
    ),
    listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
      SERVERS,
    ]),
    listCrews: vi.fn<backendInterface["listCrews"]>(async () => CREWS),
    listSchedule: vi.fn<backendInterface["listSchedule"]>(async () => []),
    getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(async () => STORE),
    findDuplicates: vi.fn<backendInterface["findDuplicates"]>(async () => []),
    approveSignup: vi.fn<backendInterface["approveSignup"]>(async () => 0n),
  };
}

describe("Admin page existing tabs survive the Crews addition", () => {
  it("renders the pre-existing section tabs and switches panels", async () => {
    const user = userEvent.setup();
    renderPageWithActor(AdminPage, adminActor(), { path: "/admin" });

    expect(await screen.findByTestId("admin.page")).toBeInTheDocument();
    for (const key of [
      "store",
      "positions",
      "schedule",
      "checklists",
      "template",
      "access",
    ]) {
      expect(screen.getByTestId(`admin.${key}.tab`)).toBeInTheDocument();
    }

    // The default tab is Store settings, and switching to Positions still
    // renders that panel's list.
    expect(await screen.findByTestId("admin.store.app_name.input")).toHaveValue(
      "Roadie Roster",
    );
    await user.click(screen.getByTestId("admin.positions.tab"));
    expect(
      await screen.findByTestId("admin.positions.list"),
    ).toBeInTheDocument();
    expect(screen.getByText("Servers")).toBeInTheDocument();
  });
});

describe("Approvals duplicate-check states survive the row reword", () => {
  it("shows the no-duplicates state when the check finds none", async () => {
    renderPageWithActor(ApprovalsPage, approvalsActor(adultSignup()), {
      path: "/approvals",
    });

    expect(
      await screen.findByTestId("approvals.signup.duplicates.none"),
    ).toBeInTheDocument();
  });

  it("renders the duplicate list container and the archived marker", async () => {
    const actor = approvalsActor(adultSignup());
    actor.findDuplicates = vi.fn<backendInterface["findDuplicates"]>(
      async () => [
        {
          roadieId: 7n,
          name: "Alex Rivera",
          mainPositionName: "Bartender",
          matchedOn: "phone",
          archived: true,
        },
      ],
    );
    renderPageWithActor(ApprovalsPage, actor, { path: "/approvals" });

    expect(
      await screen.findByTestId("approvals.signup.duplicates.list"),
    ).toBeInTheDocument();
    // The archived marker is still shown for an archived match.
    expect(screen.getByText(t("roster.archived"))).toBeInTheDocument();
  });
});

describe("Approvals Crew field default and round-trip survive the pre-selection", () => {
  it("defaults to the No crew placeholder and lists the crews", async () => {
    const user = userEvent.setup();
    renderPageWithActor(ApprovalsPage, approvalsActor(adultSignup()), {
      path: "/approvals",
    });

    const crewSelect = await screen.findByTestId(
      "approvals.signup.crew.select",
    );
    // With no pre-selection the placeholder is the "No crew" copy.
    expect(crewSelect).toHaveTextContent(t("approvals.signup.crew.none"));

    await user.click(crewSelect);
    expect(
      await screen.findByRole("option", { name: "Jordan's Crew" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Sam's Crew" }),
    ).toBeInTheDocument();
  });

  it("reflects a chosen crew in the field and keeps it changeable", async () => {
    const user = userEvent.setup();
    renderPageWithActor(ApprovalsPage, approvalsActor(adultSignup()), {
      path: "/approvals",
    });

    const crewSelect = await screen.findByTestId(
      "approvals.signup.crew.select",
    );

    // Choosing a crew updates the field's displayed value.
    await user.click(crewSelect);
    await user.click(await screen.findByRole("option", { name: "Sam's Crew" }));
    await waitFor(() => expect(crewSelect).toHaveTextContent("Sam's Crew"));

    // The field stays changeable: picking another crew replaces the value.
    await user.click(crewSelect);
    await user.click(
      await screen.findByRole("option", { name: "Jordan's Crew" }),
    );
    await waitFor(() => expect(crewSelect).toHaveTextContent("Jordan's Crew"));
  });
});
