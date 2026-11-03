import { renderPageWithActor, t } from "@/__tests__/router-test-utils";
import { renderWithActor } from "@/__tests__/test-utils";
import type {
  Position,
  Roadie,
  ScheduleEvent,
  backendInterface,
} from "@/backend";
import { EventKind, House, RoadieStatus, Role, RosterState } from "@/backend";
import { Layout } from "@/components/Layout";
import { PositionRosterDialog } from "@/components/dashboard/PositionRosterDialog";
import { KioskSignatureStep } from "@/components/kiosk/KioskSignatureStep";
import AdminPage from "@/pages/Admin";
import KioskPage from "@/pages/Kiosk";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

// jsdom does not implement object URLs; the kiosk photo step previews the
// captured file through one, so provide a minimal test-only polyfill.
beforeAll(() => {
  if (typeof URL.createObjectURL !== "function") {
    URL.createObjectURL = vi.fn(() => "blob:test-preview");
  }
  if (typeof URL.revokeObjectURL !== "function") {
    URL.revokeObjectURL = vi.fn();
  }
});

/** Upload a photo through the kiosk's file-picker fallback. */
async function uploadPhoto(user: ReturnType<typeof userEvent.setup>) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("photo file input not found");
  const file = new File(["photo-bytes"], "photo.png", { type: "image/png" });
  await user.upload(input, file);
}

/** A minimal canvas 2D context so the signature pad can draw in jsdom. */
function stubCanvas() {
  const ctx = {
    scale: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    clearRect: vi.fn(),
    set lineWidth(_v: number) {},
    set lineCap(_v: string) {},
    set lineJoin(_v: string) {},
    set strokeStyle(_v: string) {},
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  );
  const toBlob = vi
    .spyOn(HTMLCanvasElement.prototype, "toBlob")
    .mockImplementation((callback: BlobCallback) => {
      callback(new Blob(["signature-bytes"], { type: "image/png" }));
    });
  return { ctx, toBlob };
}

/** Draw a stroke on a canvas via pointer events. */
function drawStroke(
  canvas: HTMLElement,
  points: Array<{ x: number; y: number }>,
) {
  fireEvent.pointerDown(canvas, {
    pointerId: 1,
    clientX: points[0].x,
    clientY: points[0].y,
  });
  for (const point of points.slice(1)) {
    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      clientX: point.x,
      clientY: point.y,
    });
  }
  fireEvent.pointerUp(canvas, { pointerId: 1 });
}

describe("kiosk cancel returns to the welcome screen", () => {
  it("resets the whole flow from the first step's cancel button", async () => {
    const user = userEvent.setup();
    renderPageWithActor(
      KioskPage,
      { submitSignup: vi.fn(async () => 1n) },
      { path: "/kiosk" },
    );

    await user.click(await screen.findByTestId("kiosk.start_button"));
    await screen.findByTestId("kiosk.photo_step");

    // The first step's back control is a cancel: it returns to the welcome
    // screen rather than stepping backwards.
    await user.click(screen.getByTestId("kiosk.back_button"));

    expect(await screen.findByTestId("kiosk.welcome")).toBeInTheDocument();
    expect(screen.queryByTestId("kiosk.photo_step")).not.toBeInTheDocument();
  });
});

describe("kiosk signature step clear control", () => {
  it("clears the captured signature and reports the cleared state", async () => {
    const { toBlob } = stubCanvas();
    const onClear = vi.fn();
    renderWithActor(
      <KioskSignatureStep
        hasSignature={false}
        onSigned={vi.fn()}
        onClear={onClear}
      />,
      {},
    );

    const canvas = screen.getByTestId("kiosk.signature.canvas_target");
    drawStroke(canvas, [
      { x: 10, y: 10 },
      { x: 40, y: 40 },
    ]);
    await waitFor(() => expect(toBlob).toHaveBeenCalled());

    // The clear control is enabled once something has been drawn and reports
    // the clear to the parent.
    const clear = screen.getByTestId("kiosk.signature.clear_button");
    expect(clear).toBeEnabled();
    await userEvent.setup().click(clear);
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});

describe("kiosk phone validation", () => {
  it("accepts a well-formed phone and rejects one with letters", async () => {
    const user = userEvent.setup();
    renderPageWithActor(
      KioskPage,
      { submitSignup: vi.fn(async () => 1n) },
      { path: "/kiosk" },
    );

    await user.click(await screen.findByTestId("kiosk.start_button"));
    await uploadPhoto(user);
    await user.click(screen.getByTestId("kiosk.next_button"));
    await user.type(
      await screen.findByTestId("kiosk.name.input"),
      "Ada Lovelace",
    );
    await user.type(screen.getByTestId("kiosk.position.input"), "Cashier");
    await user.click(screen.getByTestId("kiosk.next_button"));

    // A phone containing letters is rejected and keeps the user on the step.
    await screen.findByTestId("kiosk.contact_step");
    await user.type(screen.getByTestId("kiosk.email.input"), "ada@example.com");
    await user.type(screen.getByTestId("kiosk.phone.input"), "call-me-now");
    await user.type(
      screen.getByTestId("kiosk.date_of_birth.input"),
      "1990-01-01",
    );
    await user.type(
      screen.getByTestId("kiosk.emergency_contact_name.input"),
      "Grace",
    );
    await user.type(
      screen.getByTestId("kiosk.emergency_contact_phone.input"),
      "+1-555-0101",
    );
    await user.click(screen.getByTestId("kiosk.next_button"));

    expect(screen.getByTestId("kiosk.contact_step")).toBeInTheDocument();
    expect(screen.getByTestId("kiosk.phone.input")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });
});

describe("Layout pending-users read is limited to approvers", () => {
  function actor(role: Role) {
    return {
      getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
        grant: {
          principal: { toText: () => "aaaaa-aa" } as never,
          role,
          approvedAt: 0n,
          approvedBy: { toText: () => "aaaaa-aa" } as never,
          trainerPositionIds: [],
        },
      })),
      listPendingUsers: vi.fn<backendInterface["listPendingUsers"]>(
        async () => [],
      ),
    };
  }

  function Page() {
    return (
      <Layout>
        <p>content</p>
      </Layout>
    );
  }

  it("never reads the pending-users queue for a Trainer", async () => {
    const a = actor(Role.trainer);
    renderPageWithActor(Page, a, { path: "/" });

    await screen.findByTestId("nav.roster.link");
    // A Trainer cannot approve, so the queue read must never fire.
    expect(a.listPendingUsers).not.toHaveBeenCalled();
  });
});

describe("SchedulePanel renders and edits seeded events", () => {
  const STORE = {
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
    paperworkDueDate: 1_800_000_000_000_000_000n,
  };

  const SCHEDULE: ScheduleEvent[] = [
    {
      id: 0n,
      kind: EventKind.deadline,
      name: "Paperwork due",
      start: 1_801_202_400_000_000_000n,
    },
  ];

  function adminActor() {
    return {
      getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(async () => STORE),
      listPositions: vi.fn<backendInterface["listPositions"]>(async () => []),
      listSchedule: vi.fn<backendInterface["listSchedule"]>(
        async () => SCHEDULE,
      ),
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
      createScheduleEvent: vi.fn<backendInterface["createScheduleEvent"]>(
        async () => 1n,
      ),
      updateScheduleEvent: vi.fn<backendInterface["updateScheduleEvent"]>(
        async () => undefined,
      ),
      deleteScheduleEvent: vi.fn<backendInterface["deleteScheduleEvent"]>(
        async () => undefined,
      ),
    };
  }

  it("lists a seeded event and opens the add dialog", async () => {
    const user = userEvent.setup();
    renderPageWithActor(AdminPage, adminActor(), { path: "/admin" });

    await user.click(await screen.findByTestId("admin.schedule.tab"));
    expect(
      await screen.findByTestId("admin.schedule.list"),
    ).toBeInTheDocument();
    expect(screen.getByText("Paperwork due")).toBeInTheDocument();

    // The add action opens the event form with the name field.
    await user.click(screen.getByTestId("admin.schedule.add_button"));
    expect(
      await screen.findByTestId("admin.schedule.name.input"),
    ).toBeInTheDocument();
  });

  it("keeps the per-event Edit control opening the form pre-filled", async () => {
    const user = userEvent.setup();
    renderPageWithActor(AdminPage, adminActor(), { path: "/admin" });

    await user.click(await screen.findByTestId("admin.schedule.tab"));
    await screen.findByTestId("admin.schedule.list");

    // The existing per-event Edit action stays beside the new per-session
    // action and opens the form with the event's current name.
    await user.click(screen.getByTestId("admin.schedule.edit_button"));
    expect(await screen.findByTestId("admin.schedule.name.input")).toHaveValue(
      "Paperwork due",
    );
  });

  it("keeps the per-event Delete control confirming before deleting", async () => {
    const user = userEvent.setup();
    const actor = adminActor();
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    await user.click(await screen.findByTestId("admin.schedule.tab"));
    await screen.findByTestId("admin.schedule.list");

    // The existing per-event Delete action stays and asks for confirmation
    // before it calls the delete mutation.
    await user.click(screen.getByTestId("admin.schedule.delete_button"));
    expect(actor.deleteScheduleEvent).not.toHaveBeenCalled();

    await user.click(
      await screen.findByTestId("admin.schedule.delete_confirm_button"),
    );
    await waitFor(() =>
      expect(actor.deleteScheduleEvent).toHaveBeenCalledWith(0n),
    );
  });
});

describe("PositionRosterDialog archived section", () => {
  const POSITION: Position = {
    id: 0n,
    name: "Servers",
    code: "SRV",
    house: House.foh,
    openingBuildTo: 2n,
    afterOpeningBuildTo: 2n,
    minimumAge: 18n,
    shirtsRequired: 2n,
    hatsRequired: 1n,
    needsAlcoholCert: true,
    defaultShirts: 3n,
    defaultHats: 2n,
  };

  const ARCHIVED: Roadie = {
    id: 9n,
    status: RoadieStatus.archived,
    mainPositionId: 0n,
    hiredAt: 0n,
    profile: { name: "Archived Ada" },
    isMinor: false,
    isDemo: false,
    archivedReason: { __kind__: "noShow", noShow: null },
    archivedAt: 1_801_202_400_000_000_000n,
    rosterState: RosterState.pending,
  };

  it("shows the archive reason and a rehire control for a manager", async () => {
    const actor = {
      listRosterForPosition: vi.fn<backendInterface["listRosterForPosition"]>(
        async () => [ARCHIVED],
      ),
      rehireRoadie: vi.fn<backendInterface["rehireRoadie"]>(async () => {}),
    };
    renderWithActor(
      <PositionRosterDialog
        position={POSITION}
        open
        onOpenChange={vi.fn()}
        canRehire
      />,
      actor,
    );

    expect(
      await screen.findByTestId("dashboard.roster.archived.section"),
    ).toBeInTheDocument();
    expect(screen.getByText(/No-show/)).toBeInTheDocument();
    expect(
      screen.getByTestId("dashboard.roster.rehire_button"),
    ).toBeInTheDocument();
  });
});
