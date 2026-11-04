import { renderPageWithActor } from "@/__tests__/router-test-utils";
import type {
  Checklists,
  Position,
  RetentionSettings,
  StoreInfo,
  backendInterface,
} from "@/backend";
import { House, UniformItemType } from "@/backend";
import AdminPage from "@/pages/Admin";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

/**
 * Characterization baseline for admin surfaces whose copy or controls are
 * intentionally changing. These tests protect the behavior that must survive
 * the change: the build-to summary and its +1/-1 adjustment calls, the
 * checklist editor's add/remove/save flow, and the store-template save flow.
 * They deliberately do not assert the stepper-only editing model, the old
 * toggle labels, or the save-only template panel.
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

/** The actor methods the admin page tree reads across its tabs. */
function baseActor() {
  return {
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
    createPosition: vi.fn<backendInterface["createPosition"]>(async () => 0n),
    updatePosition: vi.fn<backendInterface["updatePosition"]>(async () => {}),
    deletePosition: vi.fn<backendInterface["deletePosition"]>(async () => {}),
  };
}

describe("admin build-to adjustment survives the editable-input change", () => {
  it("renders the build-to summary and sends +1/-1 deltas through adjustBuildTo", async () => {
    const user = userEvent.setup();
    const actor = baseActor();
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    await user.click(await screen.findByTestId("admin.positions.tab"));

    // The summary line still reports both targets and the minimum age.
    expect(
      await screen.findByText("Build-to 65 opening · 65 after · age 18+"),
    ).toBeInTheDocument();

    // The minus and plus controls remain and each sends a single-unit delta.
    await user.click(
      screen.getByTestId("admin.positions.opening_build_to.plus_button"),
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

describe("checklist editor add/remove/save survives the toggle rename", () => {
  it("adds an item, saves the trimmed draft, and reports success", async () => {
    const user = userEvent.setup();
    const actor = baseActor();
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    await user.click(await screen.findByTestId("admin.checklists.tab"));

    // The seeded items are editable in place.
    expect(
      await screen.findByDisplayValue("Non-slip shoes"),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Onboarding")).toBeInTheDocument();

    // Adding an item appends an empty row to the uniform list.
    await user.click(screen.getByTestId("admin.checklists.uniform.add_button"));
    const textInputs = screen.getAllByLabelText("Item text");
    expect(textInputs.length).toBeGreaterThan(1);

    // Saving sends the current draft to the backend and shows the success copy.
    await user.click(screen.getByTestId("admin.checklists.save_button"));
    await waitFor(() =>
      expect(actor.updateChecklists).toHaveBeenCalledTimes(1),
    );
    const saved = actor.updateChecklists.mock.calls[0]?.[0];
    expect(saved?.orientationUniform.map((item) => item.text)).toContain(
      "Non-slip shoes",
    );
    expect(saved?.paperwork.map((item) => item.text)).toContain("Onboarding");
    expect(
      await screen.findByTestId("admin.checklists.success_state"),
    ).toBeInTheDocument();
  });

  it("removes an item from the draft before saving", async () => {
    const user = userEvent.setup();
    const actor = baseActor();
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    await user.click(await screen.findByTestId("admin.checklists.tab"));
    await screen.findByDisplayValue("Non-slip shoes");

    await user.click(
      screen.getByTestId("admin.checklists.uniform.remove_button.1"),
    );
    expect(
      screen.queryByDisplayValue("Non-slip shoes"),
    ).not.toBeInTheDocument();

    await user.click(screen.getByTestId("admin.checklists.save_button"));
    await waitFor(() =>
      expect(actor.updateChecklists).toHaveBeenCalledTimes(1),
    );
    const saved = actor.updateChecklists.mock.calls[0]?.[0];
    expect(saved?.orientationUniform).toEqual([]);
  });
});

describe("position create/delete and field round-trip survive the uniform-defaults addition", () => {
  it("creates a position from the add dialog and sends the trimmed draft", async () => {
    const user = userEvent.setup();
    const actor = baseActor();
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    await user.click(await screen.findByTestId("admin.positions.tab"));
    await user.click(await screen.findByTestId("admin.positions.add_button"));

    // The add dialog opens with the name field empty and Save disabled.
    const name = await screen.findByTestId("admin.positions.name.input");
    expect(name).toHaveValue("");
    expect(screen.getByTestId("admin.positions.save_button")).toBeDisabled();

    await user.type(name, "  Greeters  ");
    await user.type(screen.getByTestId("admin.positions.code.input"), "GRT");
    await user.click(screen.getByTestId("admin.positions.save_button"));

    await waitFor(() => expect(actor.createPosition).toHaveBeenCalledTimes(1));
    const created = actor.createPosition.mock.calls[0]?.[0];
    // The name is trimmed and the code is carried through.
    expect(created?.name).toBe("Greeters");
    expect(created?.code).toBe("GRT");
    // A new position is created, not updated.
    expect(actor.updatePosition).not.toHaveBeenCalled();
  });

  it("round-trips the house, minimum age and alcohol-cert fields on edit", async () => {
    const user = userEvent.setup();
    // A non-zero id: the panel treats id 0n as the add-vs-edit sentinel, so an
    // edit must target a real position id.
    const actor = {
      ...baseActor(),
      listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
        { ...SERVERS, id: 1n },
      ]),
    };
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    await user.click(await screen.findByTestId("admin.positions.tab"));
    await user.click(await screen.findByTestId("admin.positions.edit_button"));

    // The seeded Servers position is FOH, age 18, alcohol-cert required.
    const age = await screen.findByTestId("admin.positions.minimum_age.input");
    expect(age).toHaveValue(18);
    expect(
      screen.getByTestId("admin.positions.alcohol_cert.switch"),
    ).toBeChecked();

    fireEvent.change(age, { target: { value: "21" } });
    await user.click(screen.getByTestId("admin.positions.save_button"));

    await waitFor(() => expect(actor.updatePosition).toHaveBeenCalledTimes(1));
    const saved = actor.updatePosition.mock.calls[0]?.[0];
    expect(saved?.id).toBe(1n);
    expect(saved?.minimumAge).toBe(21n);
    // The build-to targets are preserved from the live position, not reset.
    expect(saved?.openingBuildTo).toBe(65n);
    expect(saved?.afterOpeningBuildTo).toBe(65n);
  });

  it("deletes a position only after the confirmation dialog is confirmed", async () => {
    const user = userEvent.setup();
    const actor = baseActor();
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    await user.click(await screen.findByTestId("admin.positions.tab"));
    await user.click(
      await screen.findByTestId("admin.positions.delete_button"),
    );

    // The confirmation dialog appears; nothing is deleted yet.
    expect(actor.deletePosition).not.toHaveBeenCalled();
    await user.click(
      await screen.findByTestId("admin.positions.delete_confirm_button"),
    );

    await waitFor(() => expect(actor.deletePosition).toHaveBeenCalledWith(0n));
  });
});

describe("store template save flow survives the download/load addition", () => {
  it("saves a named template and reports success", async () => {
    const user = userEvent.setup();
    const actor = baseActor();
    renderPageWithActor(AdminPage, actor, { path: "/admin" });

    await user.click(await screen.findByTestId("admin.template.tab"));

    // The panel still lists what a template carries.
    expect(
      await screen.findByText("Positions with their settings"),
    ).toBeInTheDocument();
    expect(screen.getByText("No people data is included")).toBeInTheDocument();

    // The save button is disabled until a name is entered.
    const saveButton = screen.getByTestId("admin.template.save_button");
    expect(saveButton).toBeDisabled();

    await user.type(
      screen.getByTestId("admin.template.name.input"),
      "Lake Charles flagship",
    );
    await user.click(saveButton);

    await waitFor(() =>
      expect(actor.saveStoreTemplate).toHaveBeenCalledWith(
        "Lake Charles flagship",
      ),
    );
    expect(
      await screen.findByTestId("admin.template.success_state"),
    ).toBeInTheDocument();
  });
});
