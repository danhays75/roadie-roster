import { renderPageWithActor, t } from "@/__tests__/router-test-utils";
import type {
  CrewSummary,
  Position,
  ScheduleEvent,
  SignupSubmission,
  StoreInfo,
  backendInterface,
} from "@/backend";
import { EventKind, House, Role } from "@/backend";
import { calendarInTimeZone } from "@/components/approvals/timeZone";
import ApprovalsPage from "@/pages/Approvals";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

/** A pending sign-up whose date of birth makes the applicant a minor. */
function minorSignup(): SignupSubmission {
  const now = Date.now();
  const tenYearsAgo = new Date(now - 10 * 365 * 24 * 60 * 60 * 1000);
  return {
    id: 1n,
    status: { __kind__: "pending", pending: null },
    submittedAt: BigInt(now) * 1_000_000n,
    profile: { name: "Young Applicant" },
    isDemo: false,
    contactSet: {
      email: "young@example.com",
      phone: "+1-555-0199",
      dateOfBirth: BigInt(tenYearsAgo.getTime()) * 1_000_000n,
      emergencyContactName: "Parent",
      emergencyContactPhone: "+1-555-0101",
      availability: [],
      availabilityResignPending: false,
    },
  };
}

function baseActor(signup: SignupSubmission) {
  return {
    listPendingUsers: vi.fn(async () => []),
    listPendingSignups: vi.fn(async () => [signup]),
    listPositions: vi.fn(async () => [
      {
        id: 10n,
        name: "Bartender",
        code: "BAR",
        house: House.foh,
        openingBuildTo: 2n,
        afterOpeningBuildTo: 1n,
        minimumAge: 21n,
        shirtsRequired: 1n,
        hatsRequired: 1n,
        needsAlcoholCert: true,
        shirtType: "Polo",
        shirtQty: 2n,
        hatType: "Cap",
        hatQty: 1n,
        defaultShirts: 2n,
        defaultHats: 1n,
      },
    ]),
    listCrews: vi.fn(async () => []),
    listSchedule: vi.fn(async () => []),
    findDuplicates: vi.fn(async () => [
      {
        roadieId: 7n,
        name: "Alex Rivera",
        mainPositionName: "Bartender",
        matchedOn: "phone",
        archived: false,
      },
    ]),
  };
}

describe("ApprovalsPage duplicate check and minor block", () => {
  it("flags a duplicate match for a pending sign-up", async () => {
    renderPageWithActor(ApprovalsPage, baseActor(minorSignup()), {
      path: "/approvals",
    });

    expect(
      await screen.findByTestId("approvals.signup.duplicates.list"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        t("approvals.signup.duplicates.row", {
          name: "Alex Rivera",
          position: "Bartender",
          field: t("approvals.signup.duplicates.match.phone"),
        }),
      ),
    ).toBeInTheDocument();
  });

  it("shows no-duplicates when the check finds none", async () => {
    const actor = baseActor(minorSignup());
    actor.findDuplicates = vi.fn(async () => []);
    renderPageWithActor(ApprovalsPage, actor, { path: "/approvals" });

    expect(
      await screen.findByTestId("approvals.signup.duplicates.none"),
    ).toBeInTheDocument();
  });

  it("blocks approving a minor into a position with a higher minimum age", async () => {
    const user = userEvent.setup();
    renderPageWithActor(ApprovalsPage, baseActor(minorSignup()), {
      path: "/approvals",
    });

    // The minor badge is shown for the applicant.
    expect(
      await screen.findByTestId("approvals.signup.minor_badge"),
    ).toBeInTheDocument();

    // Choose the 21+ position; the age block then disables approval.
    await user.click(screen.getByTestId("approvals.signup.main.select"));
    const option = await screen.findByRole("option", { name: "Bartender" });
    await user.click(option);

    expect(
      await screen.findByTestId("approvals.signup.minor.error"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("approvals.signup.approve_button"),
    ).toBeDisabled();
  });
});

/**
 * Characterization baseline for the Approvals page behavior the photo,
 * start-date and copy changes must not disturb. These tests deliberately do
 * NOT assert the old subtitle, section headings or orientation hint text, nor
 * the old empty Start date default: the request intentionally changes those.
 * They protect the surrounding working behavior instead.
 */

const SERVERS: Position = {
  id: 10n,
  name: "Servers",
  code: "SRV",
  house: House.foh,
  openingBuildTo: 2n,
  afterOpeningBuildTo: 1n,
  minimumAge: 18n,
  needsAlcoholCert: false,
  shirtType: "Polo",
  shirtQty: 2n,
  hatType: "Cap",
  hatQty: 1n,
  defaultShirts: 2n,
  defaultHats: 1n,
};

const CREW_SUMMARIES: CrewSummary[] = [
  { id: 0n, name: "Jordan's Crew", roadieCount: 0n, isDemo: false },
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

/** Two upcoming orientation sessions, soonest first, plus a past one. */
function orientationSessions(): ScheduleEvent[] {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  return [
    {
      id: 100n,
      kind: EventKind.orientation,
      name: "Orientation A",
      start: BigInt(now + 2 * day) * 1_000_000n,
    },
    {
      id: 101n,
      kind: EventKind.orientation,
      name: "Orientation B",
      start: BigInt(now + 5 * day) * 1_000_000n,
    },
    {
      id: 99n,
      kind: EventKind.orientation,
      name: "Past Orientation",
      start: BigInt(now - 3 * day) * 1_000_000n,
    },
  ];
}

/** The actor methods the approvals page tree reads for these journeys. */
function approvalsActor(sessions: ScheduleEvent[] = []) {
  return {
    listPendingUsers: vi.fn<backendInterface["listPendingUsers"]>(
      async () => [],
    ),
    listPendingSignups: vi.fn<backendInterface["listPendingSignups"]>(
      async () => [adultSignup()],
    ),
    listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
      SERVERS,
    ]),
    listCrewSummaries: vi.fn<backendInterface["listCrewSummaries"]>(
      async () => CREW_SUMMARIES,
    ),
    listSchedule: vi.fn<backendInterface["listSchedule"]>(async () => sessions),
    findDuplicates: vi.fn<backendInterface["findDuplicates"]>(async () => []),
    approveSignup: vi.fn<backendInterface["approveSignup"]>(async () => 0n),
  };
}

/**
 * Draw a stroke on the manager signature pad so approval is unblocked. jsdom
 * has no canvas implementation, so the 2D context and the PNG blob are stubbed
 * exactly as the kiosk signature tests do.
 */
async function signManagerPad() {
  const ctx = {
    scale: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    set lineWidth(_v: number) {},
    set lineCap(_v: string) {},
    set lineJoin(_v: string) {},
    set strokeStyle(_v: string) {},
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
    (callback: BlobCallback) => {
      // jsdom's Blob has no arrayBuffer(); the pad reads the bytes through it.
      const bytes = new Uint8Array([1, 2, 3, 4]);
      const blob = {
        arrayBuffer: async () => bytes.buffer,
      } as unknown as Blob;
      callback(blob);
    },
  );

  const { fireEvent } = await import("@testing-library/react");
  const canvas = await screen.findByTestId(
    "approvals.signup.signature.canvas_target",
  );
  fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 10, clientY: 10 });
  fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 40, clientY: 40 });
  fireEvent.pointerUp(canvas, { pointerId: 1 });
}

describe("Approvals orientation session list survives the copy change", () => {
  it("lists only upcoming orientation sessions, soonest first", async () => {
    const user = userEvent.setup();
    renderPageWithActor(ApprovalsPage, approvalsActor(orientationSessions()), {
      path: "/approvals",
    });

    await user.click(
      await screen.findByTestId("approvals.signup.orientation.select"),
    );

    // Both upcoming sessions are offered; the past one is hidden.
    expect(
      await screen.findByRole("option", { name: /Orientation A/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /Orientation B/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /Past Orientation/ }),
    ).not.toBeInTheDocument();
  });

  it("defaults the session field to the soonest upcoming session", async () => {
    renderPageWithActor(ApprovalsPage, approvalsActor(orientationSessions()), {
      path: "/approvals",
    });

    const select = await screen.findByTestId(
      "approvals.signup.orientation.select",
    );
    await waitFor(() => expect(select).toHaveTextContent("Orientation A"));
  });
});

describe("Approvals Start date stays editable and optional", () => {
  it("accepts a hand-typed date and carries it into the approval decision", async () => {
    const user = userEvent.setup();
    const actor = approvalsActor(orientationSessions());
    renderPageWithActor(ApprovalsPage, actor, { path: "/approvals" });

    // Choose a main position so approval is allowed.
    await user.click(await screen.findByTestId("approvals.signup.main.select"));
    await user.click(await screen.findByRole("option", { name: "Servers" }));

    // The manager types a start date by hand, replacing the prefilled value.
    const startInput = screen.getByTestId("approvals.signup.start.input");
    await user.clear(startInput);
    await user.type(startInput, "2026-03-15");
    expect(startInput).toHaveValue("2026-03-15");

    await signManagerPad();
    await user.click(screen.getByTestId("approvals.signup.approve_button"));

    await waitFor(() => expect(actor.approveSignup).toHaveBeenCalledTimes(1));
    const [id, decision] = actor.approveSignup.mock.calls[0] ?? [];
    expect(id).toBe(1n);
    // The typed date is sent as a DateOnly at UTC midnight of that day.
    expect(decision?.startDate).toBe(
      BigInt(Date.UTC(2026, 2, 15)) * 1_000_000n,
    );
    expect(decision?.mainPositionId).toBe(10n);
  });

  it("sends the prefilled session date when the manager does not edit it", async () => {
    const user = userEvent.setup();
    const actor = approvalsActor(orientationSessions());
    renderPageWithActor(ApprovalsPage, actor, { path: "/approvals" });

    await user.click(await screen.findByTestId("approvals.signup.main.select"));
    await user.click(await screen.findByRole("option", { name: "Servers" }));

    await signManagerPad();
    await user.click(screen.getByTestId("approvals.signup.approve_button"));

    await waitFor(() => expect(actor.approveSignup).toHaveBeenCalledTimes(1));
    const [, decision] = actor.approveSignup.mock.calls[0] ?? [];
    // The prefilled session date is carried into the decision.
    expect(decision?.startDate).toBeDefined();
  });

  it("stays optional: clearing Start date sends no startDate", async () => {
    const user = userEvent.setup();
    const actor = approvalsActor(orientationSessions());
    renderPageWithActor(ApprovalsPage, actor, { path: "/approvals" });

    await user.click(await screen.findByTestId("approvals.signup.main.select"));
    await user.click(await screen.findByRole("option", { name: "Servers" }));

    // The manager clears the prefilled date; the field stays optional.
    await user.clear(screen.getByTestId("approvals.signup.start.input"));

    await signManagerPad();
    await user.click(screen.getByTestId("approvals.signup.approve_button"));

    await waitFor(() => expect(actor.approveSignup).toHaveBeenCalledTimes(1));
    const [, decision] = actor.approveSignup.mock.calls[0] ?? [];
    expect(decision?.startDate).toBeUndefined();
  });
});

describe("Approvals signature gate survives the photo change", () => {
  it("blocks approval until the manager signs", async () => {
    const user = userEvent.setup();
    const actor = approvalsActor(orientationSessions());
    renderPageWithActor(ApprovalsPage, actor, { path: "/approvals" });

    await user.click(await screen.findByTestId("approvals.signup.main.select"));
    await user.click(await screen.findByRole("option", { name: "Servers" }));

    // Without a signature the approval is refused with the required message.
    await user.click(screen.getByTestId("approvals.signup.approve_button"));
    expect(
      await screen.findByTestId("approvals.signup.error_state"),
    ).toHaveTextContent(t("approvals.signup.signature.required"));
    expect(actor.approveSignup).not.toHaveBeenCalled();
  });
});

describe("Approvals duplicate box keeps its container and link", () => {
  it("renders each match as a link to the roadie's card", async () => {
    const actor = approvalsActor(orientationSessions());
    actor.findDuplicates = vi.fn<backendInterface["findDuplicates"]>(
      async () => [
        {
          roadieId: 7n,
          name: "Casey Morgan",
          mainPositionName: "Servers",
          matchedOn: "phone",
          archived: false,
        },
      ],
    );
    renderPageWithActor(ApprovalsPage, actor, { path: "/approvals" });

    const list = await screen.findByTestId("approvals.signup.duplicates.list");
    const link = within(list).getByTestId("approvals.signup.duplicates.link");
    expect(link).toHaveAttribute("href", "/roster/7");
  });
});

/**
 * Cover for the accepted Approve New Hires changes: the applicant photo (or
 * initials), the duplicate-match photo, the Start date prefill that follows the
 * selected session until edited, and the reworded subtitle, section headings
 * and orientation hint. The actor is a typed local mock; no live backend,
 * identity or storage is exercised.
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

/** A non-empty photo ref so `refToDataUrl` produces a displayable data URL. */
const PHOTO_BYTES = new Uint8Array([137, 80, 78, 71]);

/** The store-local `YYYY-MM-DD` calendar date of a session's start instant. */
function storeLocalDate(start: bigint): string {
  const { year, month, day } = calendarInTimeZone(
    new Date(Number(start / 1_000_000n)),
    STORE.timeZone,
  );
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** The approvals actor with store info and photo reads wired for these tests. */
function photoActor(sessions: ScheduleEvent[] = []) {
  return {
    ...approvalsActor(sessions),
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({})),
    getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(async () => STORE),
    getSignupPhoto: vi.fn<backendInterface["getSignupPhoto"]>(
      async () => PHOTO_BYTES,
    ),
    getPhoto: vi.fn<backendInterface["getPhoto"]>(async () => PHOTO_BYTES),
  };
}

describe("Approvals applicant photo and initials", () => {
  it("shows the kiosk photo at the top of a pending sign-up card", async () => {
    const actor = photoActor(orientationSessions());
    renderPageWithActor(ApprovalsPage, actor, { path: "/approvals" });

    const photo = await screen.findByTestId("approvals.signup.photo");
    const img = within(photo).getByRole("img", { name: "Adult Applicant" });
    expect(img).toHaveAttribute("src", expect.stringContaining("data:image/"));
    expect(actor.getSignupPhoto).toHaveBeenCalledWith(1n);
  });

  it("falls back to the applicant's initials when there is no photo", async () => {
    const actor = photoActor(orientationSessions());
    actor.getSignupPhoto = vi.fn<backendInterface["getSignupPhoto"]>(
      async () => null,
    );
    renderPageWithActor(ApprovalsPage, actor, { path: "/approvals" });

    const photo = await screen.findByTestId("approvals.signup.photo");
    await waitFor(() => expect(photo).toHaveTextContent("AA"));
    expect(within(photo).queryByRole("img")).not.toBeInTheDocument();
  });
});

describe("Approvals duplicate match photo", () => {
  it("shows a small photo next to each matching roadie", async () => {
    const actor = photoActor(orientationSessions());
    actor.findDuplicates = vi.fn<backendInterface["findDuplicates"]>(
      async () => [
        {
          roadieId: 7n,
          name: "Casey Morgan",
          mainPositionName: "Servers",
          matchedOn: "phone",
          archived: false,
        },
      ],
    );
    renderPageWithActor(ApprovalsPage, actor, { path: "/approvals" });

    const list = await screen.findByTestId("approvals.signup.duplicates.list");
    const photo = within(list).getByTestId("approvals.signup.duplicates.photo");
    const img = await within(photo).findByRole("img", { name: "Casey Morgan" });
    expect(img).toHaveAttribute("src", expect.stringContaining("data:image/"));
    expect(actor.getPhoto).toHaveBeenCalledWith(7n);
  });
});

describe("Approvals Start date prefill follows the orientation session", () => {
  it("prefills Start date with the selected session's store-local date", async () => {
    const sessions = orientationSessions();
    const actor = photoActor(sessions);
    renderPageWithActor(ApprovalsPage, actor, { path: "/approvals" });

    const startInput = await screen.findByTestId(
      "approvals.signup.start.input",
    );
    // The default session is the soonest upcoming one (Orientation A).
    await waitFor(() =>
      expect(startInput).toHaveValue(storeLocalDate(sessions[0].start)),
    );
  });

  it("updates Start date when the manager changes the session", async () => {
    const user = userEvent.setup();
    const sessions = orientationSessions();
    const actor = photoActor(sessions);
    renderPageWithActor(ApprovalsPage, actor, { path: "/approvals" });

    const startInput = await screen.findByTestId(
      "approvals.signup.start.input",
    );
    await waitFor(() =>
      expect(startInput).toHaveValue(storeLocalDate(sessions[0].start)),
    );

    await user.click(screen.getByTestId("approvals.signup.orientation.select"));
    await user.click(
      await screen.findByRole("option", { name: /Orientation B/ }),
    );

    await waitFor(() =>
      expect(startInput).toHaveValue(storeLocalDate(sessions[1].start)),
    );
  });

  it("keeps a hand-edited Start date when the session changes", async () => {
    const user = userEvent.setup();
    const sessions = orientationSessions();
    const actor = photoActor(sessions);
    renderPageWithActor(ApprovalsPage, actor, { path: "/approvals" });

    const startInput = await screen.findByTestId(
      "approvals.signup.start.input",
    );
    await waitFor(() =>
      expect(startInput).toHaveValue(storeLocalDate(sessions[0].start)),
    );

    // The manager edits Start date by hand.
    await user.clear(startInput);
    await user.type(startInput, "2026-03-15");
    expect(startInput).toHaveValue("2026-03-15");

    // Changing the session must not overwrite the hand-edited value.
    await user.click(screen.getByTestId("approvals.signup.orientation.select"));
    await user.click(
      await screen.findByRole("option", { name: /Orientation B/ }),
    );

    await waitFor(() =>
      expect(
        screen.getByTestId("approvals.signup.orientation.select"),
      ).toHaveTextContent("Orientation B"),
    );
    expect(startInput).toHaveValue("2026-03-15");
  });
});

describe("Approvals reworded copy", () => {
  it("shows the new subtitle and section headings", async () => {
    const actor = photoActor(orientationSessions());
    renderPageWithActor(ApprovalsPage, actor, { path: "/approvals" });

    expect(
      await screen.findByText("Approve new roadies and give leaders access"),
    ).toBeInTheDocument();
    expect(screen.getByText("New roadies from the kiosk")).toBeInTheDocument();
  });

  it("shows the new orientation hint text", async () => {
    const actor = photoActor(orientationSessions());
    renderPageWithActor(ApprovalsPage, actor, { path: "/approvals" });

    expect(
      await screen.findByText(
        "Past sessions are hidden. Defaults to the next orientation.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the reworded pending sign-in section for an admin", async () => {
    const actor = photoActor(orientationSessions());
    actor.getMyAccess = vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: {
        principal: { toText: () => "aaaaa-aa" } as never,
        role: Role.admin,
        approvedAt: 0n,
        approvedBy: { toText: () => "aaaaa-aa" } as never,
        trainerPositionIds: [],
      },
    }));
    renderPageWithActor(ApprovalsPage, actor, { path: "/approvals" });

    expect(
      await screen.findByText("Managers & trainers waiting for access"),
    ).toBeInTheDocument();
  });
});
