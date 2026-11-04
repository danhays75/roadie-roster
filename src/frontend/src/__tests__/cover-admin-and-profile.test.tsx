import { renderPageWithActor, t } from "@/__tests__/router-test-utils";
import { renderWithActor } from "@/__tests__/test-utils";
import type {
  AccessGrant,
  Checklists,
  Position,
  RetentionSettings,
  StaffProfile,
  StoreInfo,
  StoreTemplateFile,
  backendInterface,
} from "@/backend";
import { EventKind, House, Role, UniformItemType } from "@/backend";
import { ApprovalGate } from "@/components/ApprovalGate";
import { I18nContext } from "@/hooks/useI18n";
import type { Locale } from "@/lib/copy";
import AdminPage from "@/pages/Admin";
import MyProfilePage from "@/pages/MyProfile";
import type { Principal } from "@icp-sdk/core/principal";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// jsdom 26 does not implement Blob/File `.text()`, which the template panel
// uses to read an uploaded file. Provide it for this suite only.
if (typeof Blob.prototype.text !== "function") {
  Blob.prototype.text = function text(this: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}

/**
 * Cover for the accepted admin/profile changes: editable build-to inputs that
 * keep their steppers, the renamed checklist toggles with their hint, the store
 * template download/load flow with its no-roadies guard, the post-sign-in
 * profile form, and the name/title display with an admin-only Show ID toggle.
 * The actor is a typed local mock; no live backend or identity is exercised.
 */

const PRINCIPAL = { toText: () => "aaaaa-aa" } as unknown as Principal;

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

const CHECKLISTS: Checklists = {
  orientationUniform: [
    {
      id: 0n,
      text: "Non-slip shoes",
      requiresAlcoholCert: false,
      minorOnly: false,
      itemType: UniformItemType.checkbox,
    },
  ],
  paperwork: [
    {
      id: 0n,
      text: "Onboarding",
      requiresAlcoholCert: false,
      minorOnly: false,
      itemType: UniformItemType.checkbox,
    },
  ],
};

const RETENTION: RetentionSettings = {
  archivedContactSetDays: 90n,
  notesDays: 365n,
  archivedPhotoDays: 365n,
  changeLogDays: 730n,
};

const TEMPLATE_FILE: StoreTemplateFile = {
  version: 1n,
  leaderTalkName: "10 Minutes with Dan",
  leaderTalkSize: 10n,
  trainingGroupSize: 5n,
  positions: [
    {
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
    },
  ],
  schedule: [
    { kind: EventKind.openingDay, name: "Opening day", startOffsetDays: 0n },
  ],
  checklists: CHECKLISTS,
};

const PROFILE: StaffProfile = {
  fullName: "Jordan Rivera",
  preferredName: "Jordan",
  title: "Store Manager",
  requestedRole: Role.storeManager,
  homeStoreNumber: "975",
  homeStoreCity: "Lake Charles",
  trainerPositionIds: [],
};

/** Read a Blob's text; jsdom's Blob has no `.text()` method. */
function blobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

/** Serialize a template file the way the panel does: bigints become numbers. */
function templateJson(file: StoreTemplateFile): string {
  return JSON.stringify(file, (_key, value) =>
    typeof value === "bigint" ? Number(value) : value,
  );
}

function grant(role: Role, staffProfile?: StaffProfile): AccessGrant {
  return {
    principal: PRINCIPAL,
    role,
    approvedAt: 0n,
    approvedBy: PRINCIPAL,
    trainerPositionIds: [],
    staffProfile,
  };
}

/** The actor methods the admin page tree reads across its tabs. */
function baseActor() {
  return {
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: grant(Role.admin, PROFILE),
    })),
    getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(async () => STORE),
    listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
      SERVERS,
    ]),
    listSchedule: vi.fn<backendInterface["listSchedule"]>(async () => []),
    getChecklists: vi.fn<backendInterface["getChecklists"]>(
      async () => CHECKLISTS,
    ),
    getRetentionSettings: vi.fn<backendInterface["getRetentionSettings"]>(
      async () => RETENTION,
    ),
    listAccessGrants: vi.fn<backendInterface["listAccessGrants"]>(
      async () => [],
    ),
    adminCount: vi.fn<backendInterface["adminCount"]>(async () => 1n),
    adjustBuildTo: vi.fn<backendInterface["adjustBuildTo"]>(async () => {}),
    updateChecklists: vi.fn<backendInterface["updateChecklists"]>(
      async () => {},
    ),
    saveStoreTemplate: vi.fn<backendInterface["saveStoreTemplate"]>(
      async () => {},
    ),
    downloadStoreTemplate: vi.fn<backendInterface["downloadStoreTemplate"]>(
      async () => TEMPLATE_FILE,
    ),
    loadStoreTemplate: vi.fn<backendInterface["loadStoreTemplate"]>(
      async () => ({
        __kind__: "ok",
        ok: {
          leaderTalkName: "10 Minutes with Dan",
          scheduleCount: 1n,
          orientationUniformCount: 1n,
          positionCount: 1n,
          paperworkCount: 1n,
        },
      }),
    ),
  };
}

describe("editable build-to inputs keep the steppers", () => {
  it("saves a typed value on Enter as a delta from the saved target", async () => {
    const user = userEvent.setup();
    const actor = baseActor();
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    await user.click(await screen.findByTestId("admin.positions.tab"));
    const input = await screen.findByTestId(
      "admin.positions.opening_build_to.input",
    );
    expect(input).toHaveValue("65");

    await user.clear(input);
    await user.type(input, "70{Enter}");

    await waitFor(() =>
      expect(actor.adjustBuildTo).toHaveBeenCalledWith(0n, 5n, 0n),
    );
  });

  it("saves a typed value on blur", async () => {
    const user = userEvent.setup();
    const actor = baseActor();
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    await user.click(await screen.findByTestId("admin.positions.tab"));
    const input = await screen.findByTestId(
      "admin.positions.after_opening_build_to.input",
    );
    await user.clear(input);
    await user.type(input, "60");
    await user.tab();

    await waitFor(() =>
      expect(actor.adjustBuildTo).toHaveBeenCalledWith(0n, 0n, -5n),
    );
  });

  it("reverts an invalid entry instead of saving", async () => {
    const user = userEvent.setup();
    const actor = baseActor();
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    await user.click(await screen.findByTestId("admin.positions.tab"));
    const input = await screen.findByTestId(
      "admin.positions.opening_build_to.input",
    );
    await user.clear(input);
    await user.type(input, "1000{Enter}");

    // The field snaps back to the saved value and no delta is sent.
    await waitFor(() => expect(input).toHaveValue("65"));
    expect(actor.adjustBuildTo).not.toHaveBeenCalled();
  });

  it("still sends single-unit deltas from the minus and plus buttons", async () => {
    const user = userEvent.setup();
    const actor = baseActor();
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    await user.click(await screen.findByTestId("admin.positions.tab"));
    await user.click(
      await screen.findByTestId("admin.positions.opening_build_to.plus_button"),
    );
    await waitFor(() =>
      expect(actor.adjustBuildTo).toHaveBeenCalledWith(0n, 1n, 0n),
    );

    await user.click(
      screen.getByTestId("admin.positions.after_opening_build_to.minus_button"),
    );
    await waitFor(() =>
      expect(actor.adjustBuildTo).toHaveBeenCalledWith(0n, 0n, -1n),
    );
  });
});

describe("renamed checklist toggles and hint", () => {
  it("shows the new toggle labels and the hint under each list heading", async () => {
    const user = userEvent.setup();
    renderPageWithActor(AdminPage, baseActor(), { path: "/admin" });

    await user.click(await screen.findByTestId("admin.checklists.tab"));

    await screen.findByTestId("admin.checklists.section");
    expect(
      screen.getAllByLabelText("Only alcohol positions").length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      screen.getAllByLabelText("Only under 18").length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      screen.getAllByText("Leave both off if the item applies to everyone.")
        .length,
    ).toBeGreaterThanOrEqual(2);
  });
});

describe("store template download and load", () => {
  it("downloads a .json file with the schedule, positions and leader talk", async () => {
    const user = userEvent.setup();
    const actor = baseActor();
    const createObjectURL = vi.fn<(blob: Blob) => string>(
      () => "blob:template",
    );
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      writable: true,
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      writable: true,
      configurable: true,
      value: revokeObjectURL,
    });
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    renderPageWithActor(AdminPage, actor, { path: "/admin" });
    await user.click(await screen.findByTestId("admin.template.tab"));
    await user.click(
      await screen.findByTestId("admin.template.download_button"),
    );

    await waitFor(() =>
      expect(actor.downloadStoreTemplate).toHaveBeenCalledTimes(1),
    );
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
    const blob = createObjectURL.mock.calls[0]?.[0] as Blob;
    const text = await blobText(blob);
    const parsed = JSON.parse(text) as Record<string, unknown>;
    expect(parsed.version).toBe(1);
    expect(parsed.leaderTalkName).toBe("10 Minutes with Dan");
    expect(Array.isArray(parsed.positions)).toBe(true);
    expect(Array.isArray(parsed.schedule)).toBe(true);
    // No people data, logos, store number, city or opening date.
    expect(parsed).not.toHaveProperty("roadies");
    expect(parsed).not.toHaveProperty("logo");
    expect(parsed).not.toHaveProperty("storeNumber");
    expect(parsed).not.toHaveProperty("locationName");
    expect(parsed).not.toHaveProperty("openingDate");
    clickSpy.mockRestore();
  });

  it("validates an uploaded file and shows a preview with counts before confirming", async () => {
    const user = userEvent.setup();
    const actor = baseActor();
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    await user.click(await screen.findByTestId("admin.template.tab"));
    const fileInput = await screen.findByTestId("admin.template.file_input");
    const file = new File([templateJson(TEMPLATE_FILE)], "template.json", {
      type: "application/json",
    });
    await user.upload(fileInput, file);

    const preview = await screen.findByTestId("admin.template.preview_panel");
    expect(preview).toBeInTheDocument();
    expect(within(preview).getByText("Positions")).toBeInTheDocument();
    expect(within(preview).getByText("Schedule events")).toBeInTheDocument();
    // The load is not sent until the admin confirms.
    expect(actor.loadStoreTemplate).not.toHaveBeenCalled();

    await user.click(screen.getByTestId("admin.template.confirm_button"));
    await waitFor(() =>
      expect(actor.loadStoreTemplate).toHaveBeenCalledTimes(1),
    );
    expect(
      await screen.findByTestId("admin.template.load_success_state"),
    ).toBeInTheDocument();
  });

  it("shows an error when the backend refuses because roadies exist", async () => {
    const user = userEvent.setup();
    const actor = baseActor();
    actor.loadStoreTemplate.mockResolvedValueOnce({
      __kind__: "err",
      err: "Cannot load a template once roadies exist",
    });
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    await user.click(await screen.findByTestId("admin.template.tab"));
    const fileInput = await screen.findByTestId("admin.template.file_input");
    await user.upload(
      fileInput,
      new File([templateJson(TEMPLATE_FILE)], "template.json", {
        type: "application/json",
      }),
    );
    await screen.findByTestId("admin.template.preview_panel");
    await user.click(screen.getByTestId("admin.template.confirm_button"));

    expect(
      await screen.findByTestId("admin.template.load_error_state"),
    ).toHaveTextContent("Cannot load a template once roadies exist.");
  });

  it("rejects an invalid file without calling the backend", async () => {
    const user = userEvent.setup();
    const actor = baseActor();
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    await user.click(await screen.findByTestId("admin.template.tab"));
    const fileInput = await screen.findByTestId("admin.template.file_input");
    await user.upload(
      fileInput,
      new File(["not json"], "bad.json", { type: "application/json" }),
    );

    expect(
      await screen.findByTestId("admin.template.load_error_state"),
    ).toBeInTheDocument();
    expect(actor.loadStoreTemplate).not.toHaveBeenCalled();
  });
});

describe("post-sign-in profile form", () => {
  function wrap(ui: React.ReactElement) {
    return (
      <I18nContext.Provider
        value={{ locale: "en" as Locale, setLocale: vi.fn(), t }}
      >
        {ui}
      </I18nContext.Provider>
    );
  }

  it("shows the 'Tell us who you are' form before the waiting screen", async () => {
    const getMyAccess = vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: undefined,
    }));
    const requestAccess = vi.fn<backendInterface["requestAccess"]>(
      async () => false,
    );
    const bootstrapAdmin = vi.fn<backendInterface["bootstrapAdmin"]>(
      async () => false,
    );
    const submitStaffProfile = vi.fn<backendInterface["submitStaffProfile"]>(
      async () => {},
    );

    renderWithActor(wrap(<ApprovalGate />), {
      getMyAccess,
      requestAccess,
      bootstrapAdmin,
      submitStaffProfile,
    } satisfies Pick<
      backendInterface,
      "getMyAccess" | "requestAccess" | "bootstrapAdmin" | "submitStaffProfile"
    >);

    expect(await screen.findByTestId("gate.profile_state")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: t("profile.title") }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("gate.pending_state")).not.toBeInTheDocument();
  });

  it("carries the submitted profile onto the pending request", async () => {
    const user = userEvent.setup();
    const getMyAccess = vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: undefined,
    }));
    const requestAccess = vi.fn<backendInterface["requestAccess"]>(
      async () => false,
    );
    const bootstrapAdmin = vi.fn<backendInterface["bootstrapAdmin"]>(
      async () => false,
    );
    const submitStaffProfile = vi.fn<backendInterface["submitStaffProfile"]>(
      async () => {},
    );

    renderWithActor(wrap(<ApprovalGate />), {
      getMyAccess,
      requestAccess,
      bootstrapAdmin,
      submitStaffProfile,
    } satisfies Pick<
      backendInterface,
      "getMyAccess" | "requestAccess" | "bootstrapAdmin" | "submitStaffProfile"
    >);

    await screen.findByTestId("gate.profile_state");
    await user.type(
      screen.getByTestId("profile.full_name.input"),
      "Jordan Rivera",
    );
    await user.type(screen.getByTestId("profile.title.input"), "Store Manager");
    await user.type(
      screen.getByTestId("profile.home_store_number.input"),
      "975",
    );
    await user.type(
      screen.getByTestId("profile.home_store_city.input"),
      "Lake Charles",
    );
    await user.click(screen.getByTestId("profile.role.select"));
    await user.click(
      await screen.findByRole("option", { name: "Store Manager" }),
    );
    await user.click(screen.getByTestId("profile.submit_button"));

    await waitFor(() => expect(submitStaffProfile).toHaveBeenCalledTimes(1));
    const submitted = submitStaffProfile.mock.calls[0]?.[0];
    expect(submitted?.fullName).toBe("Jordan Rivera");
    expect(submitted?.title).toBe("Store Manager");
    expect(submitted?.requestedRole).toBe(Role.storeManager);
    // Once submitted, the waiting screen replaces the form.
    expect(await screen.findByTestId("gate.pending_state")).toBeInTheDocument();
  });
});

describe("access grants show names and titles with an admin-only Show ID", () => {
  it("shows the preferred name and title instead of the principal", async () => {
    const user = userEvent.setup();
    const actor = {
      ...baseActor(),
      getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
        grant: grant(Role.admin, PROFILE),
      })),
      listAccessGrants: vi.fn<backendInterface["listAccessGrants"]>(
        async () => [grant(Role.storeManager, PROFILE)],
      ),
    };
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    await user.click(await screen.findByTestId("admin.access.tab"));

    expect(
      await screen.findByText("Jordan · Store Manager"),
    ).toBeInTheDocument();
    // The principal is hidden until the admin reveals it.
    expect(
      screen.queryByTestId("admin.access.principal"),
    ).not.toBeInTheDocument();

    await user.click(screen.getByTestId("admin.access.show_id.toggle"));
    expect(
      await screen.findByTestId("admin.access.principal"),
    ).toHaveTextContent("aaaaa-aa");
  });

  it("shows 'Unnamed user' for a grant with no profile", async () => {
    const user = userEvent.setup();
    const actor = {
      ...baseActor(),
      getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
        grant: grant(Role.admin, PROFILE),
      })),
      listAccessGrants: vi.fn<backendInterface["listAccessGrants"]>(
        async () => [grant(Role.storeManager)],
      ),
    };
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    await user.click(await screen.findByTestId("admin.access.tab"));
    expect(await screen.findByText("Unnamed user")).toBeInTheDocument();
  });
});

describe("My profile editor", () => {
  it("seeds the form from the grant and saves an edited profile", async () => {
    const user = userEvent.setup();
    const updateMyStaffProfile = vi.fn<
      backendInterface["updateMyStaffProfile"]
    >(async () => {});
    const actor = {
      ...baseActor(),
      getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
        grant: grant(Role.storeManager, PROFILE),
      })),
      updateMyStaffProfile,
    };
    renderPageWithActor(MyProfilePage, actor, { path: "/my-profile" });

    const fullName = await screen.findByTestId("my_profile.full_name.input");
    expect(fullName).toHaveValue("Jordan Rivera");

    await user.clear(fullName);
    await user.type(fullName, "Jordan R. Rivera");
    await user.click(screen.getByTestId("my_profile.submit_button"));

    await waitFor(() => expect(updateMyStaffProfile).toHaveBeenCalledTimes(1));
    expect(updateMyStaffProfile.mock.calls[0]?.[0]?.fullName).toBe(
      "Jordan R. Rivera",
    );
    expect(
      await screen.findByTestId("my_profile.success_state"),
    ).toBeInTheDocument();
  });
});
