import { renderPageWithActor, t } from "@/__tests__/router-test-utils";
import type {
  AccessGrant,
  Crew,
  CrewSummary,
  DuplicateMatch,
  LeaderSummary,
  Position,
  Roadie,
  SignupSubmission,
  StaffProfile,
  StoreInfo,
  backendInterface,
} from "@/backend";
import { House, RoadieStatus, Role, RosterState } from "@/backend";
import AdminPage from "@/pages/Admin";
import ApprovalsPage from "@/pages/Approvals";
import type { Principal } from "@icp-sdk/core/principal";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

/**
 * Cover for the accepted Crews and duplicate-warning changes. The actor is a
 * typed local mock; no live backend, identity or storage is exercised. The
 * backend lane is the only place the real canister methods run.
 */

function fakePrincipal(text: string): Principal {
  return {
    toText: () => text,
    toString: () => text,
  } as unknown as Principal;
}

const ADMIN_PRINCIPAL = fakePrincipal("aaaaa-aa");
const JORDAN_PRINCIPAL = fakePrincipal("jordan-aa");
const SAM_PRINCIPAL = fakePrincipal("sam-aa");

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

function grant(
  role: Role,
  principal: Principal = ADMIN_PRINCIPAL,
): AccessGrant {
  return {
    principal,
    role,
    approvedAt: 0n,
    approvedBy: ADMIN_PRINCIPAL,
    trainerPositionIds: [],
  };
}

function staffProfile(fullName: string, preferredName?: string): StaffProfile {
  return {
    fullName,
    preferredName,
    title: "Manager",
    requestedRole: Role.storeManager,
    homeStoreNumber: "975",
    homeStoreCity: "Lake Charles",
    trainerPositionIds: [],
  };
}

function leader(
  principal: Principal,
  role: Role,
  profile: StaffProfile,
): LeaderSummary {
  return {
    principal,
    role,
    title: profile.title,
    staffProfile: profile,
    trainerPositionIds: [],
  };
}

const JORDAN = leader(
  JORDAN_PRINCIPAL,
  Role.storeManager,
  staffProfile("Jordan Rivera", "Jordan"),
);
const SAM = leader(
  SAM_PRINCIPAL,
  Role.trainingManager,
  staffProfile("Sam Lee"),
);

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

function roadie(
  id: bigint,
  crewId: bigint | undefined,
  status: RoadieStatus,
): Roadie {
  return {
    id,
    status,
    mainPositionId: 0n,
    crewId,
    isMinor: false,
    hiredAt: 0n,
    isDemo: false,
    profile: { name: `Roadie ${id}` },
    rosterState: RosterState.pending,
  };
}

/** The actor methods the admin page tree reads across its tabs. */
function adminActor(role: Role, crews: Crew[], roadies: Roadie[] = []) {
  return {
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: grant(role),
    })),
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
    listCrews: vi.fn<backendInterface["listCrews"]>(async () =>
      crews.map((crew) => ({ ...crew })),
    ),
    listLeaders: vi.fn<backendInterface["listLeaders"]>(async () => [
      JORDAN,
      SAM,
    ]),
    listRoadies: vi.fn<backendInterface["listRoadies"]>(async () =>
      roadies.map((r) => ({ ...r })),
    ),
    createCrew: vi.fn<backendInterface["createCrew"]>(async () => 9n),
    updateCrew: vi.fn<backendInterface["updateCrew"]>(async () => {}),
    deleteCrew: vi.fn<backendInterface["deleteCrew"]>(async () => {}),
  };
}

/** The actor methods the approvals page tree reads. */
function approvalsActor(
  signup: SignupSubmission,
  crews: CrewSummary[],
  approver: Principal,
  duplicates: DuplicateMatch[] = [],
  photos: {
    getSignupPhoto?: backendInterface["getSignupPhoto"];
    getPhoto?: backendInterface["getPhoto"];
  } = {},
) {
  return {
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: grant(Role.storeManager, approver),
    })),
    listPendingUsers: vi.fn<backendInterface["listPendingUsers"]>(
      async () => [],
    ),
    listPendingSignups: vi.fn<backendInterface["listPendingSignups"]>(
      async () => [signup],
    ),
    listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
      SERVERS,
    ]),
    listCrewSummaries: vi.fn<backendInterface["listCrewSummaries"]>(async () =>
      crews.map((crew) => ({ ...crew })),
    ),
    listSchedule: vi.fn<backendInterface["listSchedule"]>(async () => []),
    getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(async () => STORE),
    findDuplicates: vi.fn<backendInterface["findDuplicates"]>(
      async () => duplicates,
    ),
    approveSignup: vi.fn<backendInterface["approveSignup"]>(async () => 0n),
    getSignupPhoto:
      photos.getSignupPhoto ??
      vi.fn<backendInterface["getSignupPhoto"]>(async () => null),
    getPhoto:
      photos.getPhoto ?? vi.fn<backendInterface["getPhoto"]>(async () => null),
  };
}

describe("Crews tab visibility", () => {
  it("shows the Crews tab to an Admin", async () => {
    renderPageWithActor(AdminPage, adminActor(Role.admin, []), {
      path: "/admin",
    });
    expect(await screen.findByTestId("admin.crews.tab")).toBeInTheDocument();
  });

  it("shows the Crews tab to a Store Manager", async () => {
    renderPageWithActor(AdminPage, adminActor(Role.storeManager, []), {
      path: "/admin",
    });
    expect(await screen.findByTestId("admin.crews.tab")).toBeInTheDocument();
  });

  it("hides the Crews tab from a Training Manager", async () => {
    renderPageWithActor(AdminPage, adminActor(Role.trainingManager, []), {
      path: "/admin",
    });
    expect(await screen.findByTestId("admin.page")).toBeInTheDocument();
    expect(screen.queryByTestId("admin.crews.tab")).not.toBeInTheDocument();
  });
});

describe("Crews tab listing", () => {
  it("lists each crew's name, leader name and member count", async () => {
    const user = userEvent.setup();
    const crews: Crew[] = [
      {
        id: 0n,
        name: "Jordan's Crew",
        leaderPrincipal: JORDAN_PRINCIPAL,
        isDemo: false,
      },
      {
        id: 1n,
        name: "Sam's Crew",
        leaderPrincipal: SAM_PRINCIPAL,
        isDemo: false,
      },
    ];
    const roadies = [
      roadie(1n, 0n, RoadieStatus.active),
      roadie(2n, 0n, RoadieStatus.hired),
      // An archived roadie is not a member.
      roadie(3n, 0n, RoadieStatus.archived),
    ];
    renderPageWithActor(AdminPage, adminActor(Role.admin, crews, roadies), {
      path: "/admin",
    });

    await user.click(await screen.findByTestId("admin.crews.tab"));

    const items = await screen.findAllByTestId("admin.crews.item");
    expect(items).toHaveLength(2);

    const jordanRow = items[0];
    expect(within(jordanRow).getByText("Jordan's Crew")).toBeInTheDocument();
    // The leader is shown by preferred name and title.
    expect(within(jordanRow).getByText("Jordan · Manager")).toBeInTheDocument();
    expect(
      within(jordanRow).getByTestId("admin.crews.member_count"),
    ).toHaveTextContent("2 members");

    const samRow = items[1];
    expect(within(samRow).getByText("Sam's Crew")).toBeInTheDocument();
    expect(within(samRow).getByText(/Sam Lee/)).toBeInTheDocument();
    expect(
      within(samRow).getByTestId("admin.crews.member_count"),
    ).toHaveTextContent("No members");
  });

  it("falls back to initials when the leader has no photo", async () => {
    const user = userEvent.setup();
    const crews: Crew[] = [
      {
        id: 0n,
        name: "Jordan's Crew",
        leaderPrincipal: JORDAN_PRINCIPAL,
        isDemo: false,
      },
    ];
    renderPageWithActor(AdminPage, adminActor(Role.admin, crews), {
      path: "/admin",
    });

    await user.click(await screen.findByTestId("admin.crews.tab"));

    const photo = await screen.findByTestId("admin.crews.leader.photo");
    // Initials come from the displayed name ("Jordan · Manager").
    expect(photo).toHaveTextContent("JM");
  });
});

describe("Adding a crew", () => {
  it("auto-fills the name from the chosen leader and keeps it editable", async () => {
    const user = userEvent.setup();
    const actor = adminActor(Role.admin, []);
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    await user.click(await screen.findByTestId("admin.crews.tab"));
    await user.click(await screen.findByTestId("admin.crews.add_button"));

    const nameInput = await screen.findByTestId("admin.crews.name.input");
    expect(nameInput).toHaveValue("");

    // Choosing a leader suggests "<preferred or first name>'s Crew".
    await user.click(screen.getByTestId("admin.crews.leader.select"));
    await user.click(await screen.findByRole("option", { name: /Jordan/ }));
    await waitFor(() => expect(nameInput).toHaveValue("Jordan's Crew"));

    // The suggested name stays editable before saving.
    await user.clear(nameInput);
    await user.type(nameInput, "Front of House");
    expect(nameInput).toHaveValue("Front of House");

    await user.click(screen.getByTestId("admin.crews.save_button"));
    await waitFor(() => expect(actor.createCrew).toHaveBeenCalledTimes(1));
    // A new crew is created with its chosen owner.
    const [name, owner] = actor.createCrew.mock.calls[0] ?? [];
    expect(name).toBe("Front of House");
    expect(owner).toBe(JORDAN_PRINCIPAL);
  });
});

describe("Renaming a crew and changing its leader", () => {
  it("persists both through updateCrew", async () => {
    const user = userEvent.setup();
    const crews: Crew[] = [
      {
        id: 1n,
        name: "Jordan's Crew",
        leaderPrincipal: JORDAN_PRINCIPAL,
        isDemo: false,
      },
    ];
    const actor = adminActor(Role.admin, crews);
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    await user.click(await screen.findByTestId("admin.crews.tab"));
    await user.click(await screen.findByTestId("admin.crews.edit_button"));

    const nameInput = await screen.findByTestId("admin.crews.name.input");
    expect(nameInput).toHaveValue("Jordan's Crew");
    await user.clear(nameInput);
    await user.type(nameInput, "Opening Crew");
    await waitFor(() => expect(nameInput).toHaveValue("Opening Crew"));

    await user.click(screen.getByTestId("admin.crews.leader.select"));
    await user.click(await screen.findByRole("option", { name: /Sam Lee/ }));
    // The select closes on selection; wait for the popover to unmount so it
    // cannot intercept the save click.
    await waitFor(() =>
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
    );

    const saveButton = screen.getByTestId("admin.crews.save_button");
    await waitFor(() => expect(saveButton).toBeEnabled());
    await user.click(saveButton);
    await waitFor(() => expect(actor.updateCrew).toHaveBeenCalledTimes(1));
    const [id, name, leaderPrincipal] = actor.updateCrew.mock.calls[0] ?? [];
    expect(id).toBe(1n);
    expect(name).toBe("Opening Crew");
    expect(leaderPrincipal).toBe(SAM_PRINCIPAL);
  });
});

describe("Deleting a crew", () => {
  it("blocks deletion while the crew has members and shows the message", async () => {
    const user = userEvent.setup();
    const crews: Crew[] = [
      {
        id: 0n,
        name: "Jordan's Crew",
        leaderPrincipal: JORDAN_PRINCIPAL,
        isDemo: false,
      },
    ];
    const actor = adminActor(Role.admin, crews, [
      roadie(1n, 0n, RoadieStatus.active),
    ]);
    actor.deleteCrew = vi.fn<backendInterface["deleteCrew"]>(async () => {
      throw new Error("crew has members");
    });
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    await user.click(await screen.findByTestId("admin.crews.tab"));
    await user.click(await screen.findByTestId("admin.crews.delete_button"));
    await user.click(
      await screen.findByTestId("admin.crews.delete_confirm_button"),
    );

    expect(
      await screen.findByTestId("admin.crews.delete_error_state"),
    ).toHaveTextContent(t("admin.crews.deleteBlocked"));
  });

  it("deletes an empty crew", async () => {
    const user = userEvent.setup();
    const crews: Crew[] = [
      {
        id: 0n,
        name: "Jordan's Crew",
        leaderPrincipal: JORDAN_PRINCIPAL,
        isDemo: false,
      },
    ];
    const actor = adminActor(Role.admin, crews);
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    await user.click(await screen.findByTestId("admin.crews.tab"));
    await user.click(await screen.findByTestId("admin.crews.delete_button"));
    await user.click(
      await screen.findByTestId("admin.crews.delete_confirm_button"),
    );

    await waitFor(() => expect(actor.deleteCrew).toHaveBeenCalledWith(0n));
  });
});

describe("Approvals crew pre-selection", () => {
  it("pre-selects the crew with the fewest roadies", async () => {
    const crews: CrewSummary[] = [
      {
        id: 0n,
        name: "Jordan's Crew",
        leaderPrincipal: JORDAN_PRINCIPAL,
        roadieCount: 3n,
        isDemo: false,
      },
      {
        id: 1n,
        name: "Sam's Crew",
        leaderPrincipal: SAM_PRINCIPAL,
        roadieCount: 1n,
        isDemo: false,
      },
    ];
    renderPageWithActor(
      ApprovalsPage,
      approvalsActor(adultSignup(), crews, JORDAN_PRINCIPAL),
      { path: "/approvals" },
    );

    const crewSelect = await screen.findByTestId(
      "approvals.signup.crew.select",
    );
    // The crew with the fewest roadies is preselected, not the approver's own.
    await waitFor(() => expect(crewSelect).toHaveTextContent("Sam's Crew"));
  });

  it("defaults to No crew when there are no crews", async () => {
    renderPageWithActor(
      ApprovalsPage,
      approvalsActor(adultSignup(), [], JORDAN_PRINCIPAL),
      { path: "/approvals" },
    );

    const crewSelect = await screen.findByTestId(
      "approvals.signup.crew.select",
    );
    expect(crewSelect).toHaveTextContent(t("approvals.signup.crew.none"));
  });

  it("keeps the pre-selected crew changeable", async () => {
    const user = userEvent.setup();
    const crews: CrewSummary[] = [
      {
        id: 0n,
        name: "Jordan's Crew",
        leaderPrincipal: JORDAN_PRINCIPAL,
        roadieCount: 3n,
        isDemo: false,
      },
      {
        id: 1n,
        name: "Sam's Crew",
        leaderPrincipal: SAM_PRINCIPAL,
        roadieCount: 1n,
        isDemo: false,
      },
    ];
    renderPageWithActor(
      ApprovalsPage,
      approvalsActor(adultSignup(), crews, JORDAN_PRINCIPAL),
      { path: "/approvals" },
    );

    const crewSelect = await screen.findByTestId(
      "approvals.signup.crew.select",
    );
    await waitFor(() => expect(crewSelect).toHaveTextContent("Sam's Crew"));

    await user.click(crewSelect);
    await user.click(
      await screen.findByRole("option", { name: "Jordan's Crew · 3 roadies" }),
    );
    await waitFor(() => expect(crewSelect).toHaveTextContent("Jordan's Crew"));
  });
});

describe("Duplicate warning wording", () => {
  it("names the matched roadie, position, match type and archived state", async () => {
    const duplicates: DuplicateMatch[] = [
      {
        roadieId: 7n,
        name: "Casey Morgan",
        mainPositionName: "Servers",
        matchedOn: "both",
        archived: true,
      },
    ];
    renderPageWithActor(
      ApprovalsPage,
      approvalsActor(adultSignup(), [], JORDAN_PRINCIPAL, duplicates),
      { path: "/approvals" },
    );

    const list = await screen.findByTestId("approvals.signup.duplicates.list");
    // The row names the roadie, their main position and what matched.
    expect(
      within(list).getByText(
        t("approvals.signup.duplicates.row", {
          name: "Casey Morgan",
          position: "Servers",
          field: t("approvals.signup.duplicates.match.both"),
        }),
      ),
    ).toBeInTheDocument();
    expect(within(list).getByText(t("roster.archived"))).toBeInTheDocument();
    // The raw id is never shown.
    expect(within(list).queryByText(/7/)).not.toBeInTheDocument();
  });

  it("links the match to the roadie's card", async () => {
    const duplicates: DuplicateMatch[] = [
      {
        roadieId: 7n,
        name: "Casey Morgan",
        mainPositionName: "Servers",
        matchedOn: "phone",
        archived: false,
      },
    ];
    renderPageWithActor(
      ApprovalsPage,
      approvalsActor(adultSignup(), [], JORDAN_PRINCIPAL, duplicates),
      { path: "/approvals" },
    );

    const link = await screen.findByTestId("approvals.signup.duplicates.link");
    expect(link).toHaveAttribute("href", "/roster/7");
  });
});

/**
 * Cover for the accepted demo-photo change on the Approve New Hires card and
 * the Possible duplicates box. A demo sign-up and a demo duplicate match now
 * carry a demo-only photo URL, shown only when no stored kiosk photo exists.
 * The actor is a typed local mock; the backend lane is the only place the real
 * canister methods run.
 */

/** A single byte is enough to produce a non-empty data URL. */
const SIGNUP_PHOTO_BYTES = new Uint8Array([1, 2, 3, 4]);

/** A demo-only photo URL, as Load demo data writes onto a demo record. */
const DEMO_PHOTO_URL = "https://cdn.example.test/demo/applicant.webp";

describe("Approvals sign-up card demo photo", () => {
  it("shows the demo photo URL when no stored kiosk photo exists", async () => {
    const getSignupPhoto = vi.fn<backendInterface["getSignupPhoto"]>(
      async () => null,
    );
    renderPageWithActor(
      ApprovalsPage,
      approvalsActor(
        { ...adultSignup(), demoPhotoUrl: DEMO_PHOTO_URL },
        [],
        JORDAN_PRINCIPAL,
        [],
        { getSignupPhoto },
      ),
      { path: "/approvals" },
    );

    const photo = await screen.findByTestId("approvals.signup.photo");
    const img = await within(photo).findByRole("img");
    expect(img).toHaveAttribute("src", DEMO_PHOTO_URL);
    expect(getSignupPhoto).toHaveBeenCalledWith(1n);
  });

  it("prefers the stored kiosk photo over the demo photo URL", async () => {
    const getSignupPhoto = vi.fn<backendInterface["getSignupPhoto"]>(
      async () => SIGNUP_PHOTO_BYTES,
    );
    renderPageWithActor(
      ApprovalsPage,
      approvalsActor(
        { ...adultSignup(), demoPhotoUrl: DEMO_PHOTO_URL },
        [],
        JORDAN_PRINCIPAL,
        [],
        { getSignupPhoto },
      ),
      { path: "/approvals" },
    );

    const photo = await screen.findByTestId("approvals.signup.photo");
    const img = await within(photo).findByRole("img");
    expect(img).toHaveAttribute("src", expect.stringContaining("data:image/"));
    expect(img).not.toHaveAttribute("src", DEMO_PHOTO_URL);
  });
});

describe("Possible duplicates demo photo", () => {
  it("shows the matched roadie's demo photo instead of initials", async () => {
    const duplicates: DuplicateMatch[] = [
      {
        roadieId: 7n,
        name: "Casey Morgan",
        mainPositionName: "Servers",
        matchedOn: "phone",
        archived: false,
        demoPhotoUrl: DEMO_PHOTO_URL,
      },
    ];
    renderPageWithActor(
      ApprovalsPage,
      approvalsActor(adultSignup(), [], JORDAN_PRINCIPAL, duplicates, {
        getPhoto: vi.fn<backendInterface["getPhoto"]>(async () => null),
      }),
      { path: "/approvals" },
    );

    const photo = await screen.findByTestId(
      "approvals.signup.duplicates.photo",
    );
    const img = await within(photo).findByRole("img");
    expect(img).toHaveAttribute("src", DEMO_PHOTO_URL);
    // The initials fallback is not shown when a demo photo exists.
    expect(photo).not.toHaveTextContent("CM");
  });

  it("prefers the matched roadie's stored photo over the demo photo URL", async () => {
    const duplicates: DuplicateMatch[] = [
      {
        roadieId: 7n,
        name: "Casey Morgan",
        mainPositionName: "Servers",
        matchedOn: "phone",
        archived: false,
        demoPhotoUrl: DEMO_PHOTO_URL,
      },
    ];
    renderPageWithActor(
      ApprovalsPage,
      approvalsActor(adultSignup(), [], JORDAN_PRINCIPAL, duplicates, {
        getPhoto: vi.fn<backendInterface["getPhoto"]>(
          async () => SIGNUP_PHOTO_BYTES,
        ),
      }),
      { path: "/approvals" },
    );

    const photo = await screen.findByTestId(
      "approvals.signup.duplicates.photo",
    );
    const img = await within(photo).findByRole("img");
    expect(img).toHaveAttribute("src", expect.stringContaining("data:image/"));
    expect(img).not.toHaveAttribute("src", DEMO_PHOTO_URL);
  });
});
