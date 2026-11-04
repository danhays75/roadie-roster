import { renderPageWithActor } from "@/__tests__/router-test-utils";
import { renderWithActor } from "@/__tests__/test-utils";
import type {
  ContactSet,
  Position,
  Roadie,
  RoadieProfile,
  StoreInfo,
  StoreTemplateFile,
  UniformOrderView,
  UniformSettings,
  backendInterface,
} from "@/backend";
import {
  House,
  RoadieStatus,
  Role,
  RosterState,
  UniformHouseFilter,
} from "@/backend";
import { PositionsPanel } from "@/components/admin/PositionsPanel";
import { TemplatePanel } from "@/components/admin/TemplatePanel";
import { I18nContext, translate } from "@/hooks/useI18n";
import type { Locale } from "@/lib/copy";
import KioskPage from "@/pages/Kiosk";
import RoadieCardPage from "@/pages/RoadieCard";
import UniformsPage from "@/pages/Uniforms";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
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

// jsdom 26 does not implement Blob/File `.text()`, which the template panel
// uses to read an uploaded file and the download test uses to read the blob.
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
 * Cover for the accepted uniforms batch: the Admin > Positions uniform defaults
 * (including a zero hat quantity), the Uniforms page size curve, buffer, house
 * filters, Size unknown bucket and the Excel download. The backend is a typed
 * local actor mock; no canister is contacted.
 */

const STORE_INFO: StoreInfo = {
  amShiftEnd: 0n,
  pmShiftStart: 0n,
  storeNumber: "975",
  leaderTalkName: "Leader talk",
  appName: "Roadie Roster",
  leaderTalkSize: 4n,
  amShiftStart: 0n,
  openingDate: BigInt(Date.UTC(2027, 1, 8)) * 1_000_000n,
  pmShiftEnd: 0n,
  trainingGroupSize: 4n,
  address: "1 Main St",
  locationName: "Bake",
  timeZone: "America/Chicago",
  storePhone: "+1-555-0199",
};

const SEEDED_SETTINGS: UniformSettings = {
  sizeCurve: {
    shirts: [
      { size: "XS", percent: 3n },
      { size: "S", percent: 12n },
      { size: "M", percent: 25n },
      { size: "L", percent: 28n },
      { size: "XL", percent: 18n },
      { size: "2XL", percent: 10n },
      { size: "3XL", percent: 4n },
    ],
    hats: [
      { size: "One size", percent: 60n },
      { size: "S/M", percent: 20n },
      { size: "L/XL", percent: 20n },
    ],
  },
  bufferPercent: 10n,
};

const ORDER: UniformOrderView = {
  filter: UniformHouseFilter.all,
  bufferPercent: 10n,
  rows: [
    { item: "Polo", size: "M", hired: 4n, projected: 2n, orderTotal: 7n },
    { item: "Polo", size: "L", hired: 3n, projected: 1n, orderTotal: 5n },
    { item: "Cap", size: "One size", hired: 5n, projected: 2n, orderTotal: 8n },
  ],
  totals: [
    { item: "Polo", hired: 7n, projected: 3n, orderTotal: 12n },
    { item: "Cap", hired: 5n, projected: 2n, orderTotal: 8n },
  ],
  sizeUnknown: [
    { roadieId: 42n, name: "Dana Reed", missingShirt: true, missingHat: false },
  ],
};

function grant(role: Role) {
  return {
    principal: { toText: () => "aaaaa-aa" } as never,
    role,
    approvedAt: 0n,
    approvedBy: { toText: () => "aaaaa-aa" } as never,
    trainerPositionIds: [],
  };
}

/** A Uniforms-page actor with the seeded settings and a fixed order. */
function uniformsActor(role: Role = Role.admin) {
  const updateUniformSettings = vi.fn<
    backendInterface["updateUniformSettings"]
  >(async () => undefined);
  return {
    actor: {
      getUniformSettings: vi.fn<backendInterface["getUniformSettings"]>(
        async () => structuredClone(SEEDED_SETTINGS),
      ),
      getUniformOrder: vi.fn<backendInterface["getUniformOrder"]>(async () =>
        structuredClone(ORDER),
      ),
      updateUniformSettings,
      getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(
        async () => STORE_INFO,
      ),
      getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
        grant: grant(role),
      })),
      getDemoState: vi.fn<backendInterface["getDemoState"]>(async () => ({
        enabled: false,
        demoTrainerStations: [],
      })),
    },
    updateUniformSettings,
  };
}

function renderUniforms(actor: ReturnType<typeof uniformsActor>["actor"]) {
  return renderPageWithActor(UniformsPage, actor, {
    path: "/uniforms",
    initialEntry: "/uniforms",
  });
}

describe("Uniforms page: size curve, buffer and order", () => {
  it("shows the seeded shirt and hat percentages and the default 10% buffer", async () => {
    const { actor } = uniformsActor();
    renderUniforms(actor);

    // The seeded shirt curve renders each size with its percentage.
    const shirts = await screen.findByTestId("uniforms.curve.shirts");
    expect(within(shirts).getByText("XS")).toBeInTheDocument();
    expect(
      within(shirts).getByTestId("uniforms.curve.shirts.input.1"),
    ).toHaveValue(3);
    expect(
      within(shirts).getByTestId("uniforms.curve.shirts.input.4"),
    ).toHaveValue(28);

    const hats = screen.getByTestId("uniforms.curve.hats");
    expect(within(hats).getByText("One size")).toBeInTheDocument();
    expect(within(hats).getByTestId("uniforms.curve.hats.input.1")).toHaveValue(
      60,
    );

    // The buffer defaults to 10.
    expect(screen.getByTestId("uniforms.buffer.input")).toHaveValue(10);
  });

  it("lists a size-unknown roadie by name with a link to their card", async () => {
    const { actor } = uniformsActor();
    renderUniforms(actor);

    const section = await screen.findByTestId("uniforms.size_unknown.section");
    const link = within(section).getByTestId("uniforms.size_unknown.link.1");
    expect(link).toHaveTextContent("Dana Reed");
    expect(link).toHaveAttribute("href", "/roster/42");
  });

  it("warns but still saves when the shirt curve does not total 100%", async () => {
    const user = userEvent.setup();
    const { actor, updateUniformSettings } = uniformsActor();
    renderUniforms(actor);

    const shirts = await screen.findByTestId("uniforms.curve.shirts");
    // Drop XS from 3 to 1, so the shirt curve totals 98%.
    const xs = within(shirts).getByTestId("uniforms.curve.shirts.input.1");
    await user.clear(xs);
    await user.type(xs, "1");

    // The warning appears and the save still succeeds.
    expect(
      within(shirts).getByTestId("uniforms.curve.shirts.warning"),
    ).toBeInTheDocument();

    await user.click(screen.getByTestId("uniforms.save_button"));
    await waitFor(() => expect(updateUniformSettings).toHaveBeenCalledTimes(1));
    const [saved] = updateUniformSettings.mock.calls[0];
    expect(saved.sizeCurve.shirts[0]).toEqual({ size: "XS", percent: 1n });
    expect(
      await screen.findByTestId("uniforms.success_state"),
    ).toBeInTheDocument();
  });

  it("renders Hired, Projected and Order total columns per item and size", async () => {
    const { actor } = uniformsActor();
    renderUniforms(actor);

    // One table per item, keyed by the backend item label.
    const polo = await screen.findByTestId("uniforms.order.polo");
    const poloRow = within(polo).getByTestId("uniforms.order.polo.row.1");
    expect(within(poloRow).getByText("M")).toBeInTheDocument();
    expect(within(poloRow).getByText("4")).toBeInTheDocument();
    expect(within(poloRow).getByText("2")).toBeInTheDocument();
    expect(within(poloRow).getByText("7")).toBeInTheDocument();

    const cap = screen.getByTestId("uniforms.order.cap");
    const capRow = within(cap).getByTestId("uniforms.order.cap.row.1");
    expect(within(capRow).getByText("One size")).toBeInTheDocument();
    expect(within(capRow).getByText("5")).toBeInTheDocument();
    expect(within(capRow).getByText("8")).toBeInTheDocument();

    // The buffer summary reflects the order's buffer percentage.
    expect(screen.getByTestId("uniforms.buffer.summary")).toHaveTextContent(
      "10%",
    );
  });

  it("shows the store name and date in the print area", async () => {
    const { actor } = uniformsActor();
    renderUniforms(actor);

    await screen.findByTestId("uniforms.size_unknown.section");
    // The print block carries the store name and the opening date on one line.
    expect(screen.getByText(/Bake ·/)).toBeInTheDocument();
  });

  it("refetches the order when the house filter changes", async () => {
    const user = userEvent.setup();
    const { actor } = uniformsActor();
    renderUniforms(actor);

    await screen.findByTestId("uniforms.size_unknown.section");
    expect(actor.getUniformOrder).toHaveBeenCalledWith(UniformHouseFilter.all);

    await user.click(screen.getByTestId("uniforms.filter.foh"));
    await waitFor(() =>
      expect(actor.getUniformOrder).toHaveBeenCalledWith(
        UniformHouseFilter.foh,
      ),
    );
  });

  it("downloads an Excel workbook of the uniform order", async () => {
    const user = userEvent.setup();
    const { actor } = uniformsActor();
    const createObjectURL = vi.fn(() => "blob:uniform-order");
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
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    renderUniforms(actor);
    await screen.findByTestId("uniforms.size_unknown.section");

    await user.click(screen.getByTestId("uniforms.download_button"));
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
    expect(click).toHaveBeenCalledTimes(1);

    click.mockRestore();
  });

  it("hides the edit controls for a Training Manager but keeps the order visible", async () => {
    const { actor } = uniformsActor(Role.trainingManager);
    renderUniforms(actor);

    await screen.findByTestId("uniforms.size_unknown.section");
    expect(
      screen.queryByTestId("uniforms.save_button"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("uniforms.buffer.input")).toBeDisabled();
  });
});

describe("Admin > Positions uniform defaults", () => {
  const POSITION: Position = {
    id: 0n,
    name: "Cashier",
    code: "CSH",
    house: House.foh,
    openingBuildTo: 2n,
    afterOpeningBuildTo: 2n,
    minimumAge: 18n,
    needsAlcoholCert: false,
    shirtType: "Polo",
    shirtQty: 2n,
    hatType: "Cap",
    hatQty: 1n,
    defaultShirts: 2n,
    defaultHats: 1n,
  };

  function positionsActor() {
    const createPosition = vi.fn<backendInterface["createPosition"]>(
      async () => 1n,
    );
    return {
      actor: {
        listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
          POSITION,
        ]),
        createPosition,
        updatePosition: vi.fn<backendInterface["updatePosition"]>(
          async () => undefined,
        ),
        deletePosition: vi.fn<backendInterface["deletePosition"]>(
          async () => undefined,
        ),
        adjustBuildTo: vi.fn<backendInterface["adjustBuildTo"]>(
          async () => undefined,
        ),
        getDemoState: vi.fn<backendInterface["getDemoState"]>(async () => ({
          enabled: false,
          demoTrainerStations: [],
        })),
      },
      createPosition,
    };
  }

  function renderPositions(actor: ReturnType<typeof positionsActor>["actor"]) {
    return renderWithActor(
      <I18nContext.Provider
        value={{
          locale: "en" as Locale,
          setLocale: vi.fn(),
          t: (key, vars) => translate("en" as Locale, key, vars),
        }}
      >
        <PositionsPanel />
      </I18nContext.Provider>,
      actor,
    );
  }

  it("saves a position's shirt and hat type and quantity, accepting a zero hat quantity", async () => {
    const user = userEvent.setup();
    const { actor, createPosition } = positionsActor();
    renderPositions(actor);

    await user.click(await screen.findByTestId("admin.positions.add_button"));
    await user.type(
      await screen.findByTestId("admin.positions.name.input"),
      "Greeter",
    );
    await user.type(screen.getByTestId("admin.positions.code.input"), "GRT");
    await user.type(
      screen.getByTestId("admin.positions.shirt_type.input"),
      "Polo",
    );
    await user.type(screen.getByTestId("admin.positions.shirt_qty.input"), "2");
    await user.type(
      screen.getByTestId("admin.positions.hat_type.input"),
      "Cap",
    );
    // A hat quantity of 0 is accepted: clear the default and leave it at zero.
    const hatQty = screen.getByTestId("admin.positions.hat_qty.input");
    await user.clear(hatQty);
    await user.type(hatQty, "0");

    await user.click(screen.getByTestId("admin.positions.save_button"));

    await waitFor(() => expect(createPosition).toHaveBeenCalledTimes(1));
    const [saved] = createPosition.mock.calls[0];
    expect(saved.shirtType).toBe("Polo");
    expect(saved.shirtQty).toBe(2n);
    expect(saved.hatType).toBe("Cap");
    expect(saved.hatQty).toBe(0n);
  });
});

/* ---------------------------------------------------------------------------
   Kiosk sign-up: shirt and hat size fields with English and Spanish labels.
--------------------------------------------------------------------------- */

function kioskActor() {
  return {
    submitSignup: vi.fn<backendInterface["submitSignup"]>(async () => 1n),
  };
}

/** Upload a photo through the kiosk's file-picker fallback. */
async function uploadPhoto(user: ReturnType<typeof userEvent.setup>) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("photo file input not found");
  const file = new File(["photo-bytes"], "photo.png", { type: "image/png" });
  await user.upload(input, file);
}

/** Advance the kiosk from the welcome screen to the details step. */
async function reachDetailsStep(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByTestId("kiosk.start_button"));
  await uploadPhoto(user);
  await user.click(screen.getByTestId("kiosk.next_button"));
  await screen.findByTestId("kiosk.details_step");
}

describe("Kiosk sign-up shirt and hat size fields", () => {
  it("offers the shirt and hat size options with English labels", async () => {
    const user = userEvent.setup();
    renderPageWithActor(KioskPage, kioskActor(), { path: "/kiosk" });
    await reachDetailsStep(user);

    // The shirt size select offers XS through 3XL.
    await user.click(screen.getByTestId("kiosk.shirt_size.select"));
    for (const size of ["XS", "S", "M", "L", "XL", "2XL", "3XL"]) {
      expect(
        await screen.findByRole("option", { name: size }),
      ).toBeInTheDocument();
    }
    await user.keyboard("{Escape}");

    // The hat size select offers One size, S/M and L/XL.
    await user.click(screen.getByTestId("kiosk.hat_size.select"));
    expect(
      await screen.findByRole("option", { name: "One size" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "S/M" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "L/XL" })).toBeInTheDocument();
  });

  it("shows the Spanish shirt and hat size labels after switching language", async () => {
    const user = userEvent.setup();
    // A stateful I18n provider so the kiosk's own language switch takes effect.
    function KioskWithLocale() {
      const [locale, setLocale] = useState<Locale>("en");
      return (
        <I18nContext.Provider
          value={{
            locale,
            setLocale,
            t: (key, vars) => translate(locale, key, vars),
          }}
        >
          <KioskPage />
        </I18nContext.Provider>
      );
    }
    renderWithActor(<KioskWithLocale />, kioskActor());

    // Switch the kiosk to Spanish before starting.
    await user.click(await screen.findByTestId("kiosk.lang.es"));
    await user.click(screen.getByTestId("kiosk.start_button"));
    await uploadPhoto(user);
    await user.click(screen.getByTestId("kiosk.next_button"));
    await screen.findByTestId("kiosk.details_step");

    expect(screen.getByText("Talla de camiseta")).toBeInTheDocument();
    expect(screen.getByText("Talla de gorra")).toBeInTheDocument();

    // The hat options carry their Spanish labels too.
    await user.click(screen.getByTestId("kiosk.hat_size.select"));
    expect(
      await screen.findByRole("option", { name: "Talla única" }),
    ).toBeInTheDocument();
  });
});

/* ---------------------------------------------------------------------------
   Manager tab: shirt and hat size are visible and editable by Admin/SM.
--------------------------------------------------------------------------- */

const MANAGER_POSITION: Position = {
  id: 0n,
  name: "Cashier",
  code: "CSH",
  house: House.foh,
  openingBuildTo: 2n,
  afterOpeningBuildTo: 2n,
  minimumAge: 18n,
  needsAlcoholCert: false,
  shirtType: "Polo",
  shirtQty: 2n,
  hatType: "Cap",
  hatQty: 1n,
  defaultShirts: 2n,
  defaultHats: 1n,
};

const MANAGER_STORE: StoreInfo = {
  amShiftEnd: 0n,
  pmShiftStart: 0n,
  storeNumber: "975",
  leaderTalkName: "Leader talk",
  appName: "Roadie Roster",
  leaderTalkSize: 4n,
  amShiftStart: 0n,
  openingDate: BigInt(Date.UTC(2027, 1, 8)) * 1_000_000n,
  pmShiftEnd: 0n,
  trainingGroupSize: 4n,
  address: "1 Main St",
  locationName: "Bake",
  timeZone: "America/Chicago",
  storePhone: "+1-555-0199",
};

function managerProfile(overrides: Partial<RoadieProfile> = {}): RoadieProfile {
  return {
    name: "Frank George",
    preferredName: "Frank",
    hometown: "Bake",
    hobbies: "Cycling",
    favoriteSnack: "Snickers",
    favoriteTeam: "LSU Tigers",
    favoriteDrink: "Coffee",
    favoriteColor: "Navy blue",
    funFact: "Can juggle",
    goalHere: "Run the fry station",
    shirtSize: "M",
    hatSize: "S/M",
    ...overrides,
  };
}

function managerRoadie(profile: RoadieProfile): Roadie {
  return {
    id: 1n,
    status: RoadieStatus.certified,
    mainPositionId: 0n,
    isMinor: false,
    hiredAt: 0n,
    isDemo: false,
    hireDate: BigInt(Date.UTC(2027, 0, 30, 12, 0, 0)) * 1_000_000n,
    rosterState: RosterState.active,
    profile,
  };
}

const MANAGER_CONTACT_SET: ContactSet = {
  phone: "+1-555-0100",
  email: "frank@example.com",
  emergencyContactName: "Ada",
  emergencyContactPhone: "+1-555-0101",
  dateOfBirth: BigInt(Date.UTC(2000, 0, 1)) * 1_000_000n,
  availability: [],
  availabilityResignPending: false,
};

function managerActor(initial: Roadie, role: Role = Role.storeManager) {
  let current = structuredClone(initial);
  const updateRoadieDetails = vi.fn<backendInterface["updateRoadieDetails"]>(
    async (_id, profile) => {
      current = { ...current, profile: structuredClone(profile) };
    },
  );
  return {
    actor: {
      getRoadie: vi.fn<backendInterface["getRoadie"]>(async () =>
        structuredClone(current),
      ),
      updateRoadieDetails,
      listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
        MANAGER_POSITION,
      ]),
      listCrews: vi.fn<backendInterface["listCrews"]>(async () => []),
      getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(
        async () => MANAGER_STORE,
      ),
      getStoreLogo: vi.fn<backendInterface["getStoreLogo"]>(async () => ({})),
      getPhoto: vi.fn<backendInterface["getPhoto"]>(async () => null),
      isMinor: vi.fn<backendInterface["isMinor"]>(async () => false),
      getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
        grant: grant(role),
      })),
      getContactSet: vi.fn<backendInterface["getContactSet"]>(async () => [
        structuredClone(MANAGER_CONTACT_SET),
      ]),
      getChecklists: vi.fn<backendInterface["getChecklists"]>(async () => ({
        paperwork: [],
        orientationUniform: [],
      })),
      getOrientationCheckoff: vi.fn<backendInterface["getOrientationCheckoff"]>(
        async () => null,
      ),
      listChangeLog: vi.fn<backendInterface["listChangeLog"]>(async () => []),
    },
    updateRoadieDetails,
  };
}

function renderManagerCard(actor: ReturnType<typeof managerActor>["actor"]) {
  return renderPageWithActor(RoadieCardPage, actor, {
    path: "/roster/$roadieId",
    initialEntry: "/roster/1",
  });
}

describe("Manager tab shirt and hat size", () => {
  it("shows the roadie's sizes and saves an edited shirt size", async () => {
    const user = userEvent.setup();
    const { actor, updateRoadieDetails } = managerActor(
      managerRoadie(managerProfile()),
    );
    renderManagerCard(actor);

    await user.click(await screen.findByTestId("roadie.manager.tab"));
    const shirt = await screen.findByTestId("roadie.manager.shirt_size.select");
    expect(shirt).toHaveTextContent("M");
    expect(
      screen.getByTestId("roadie.manager.hat_size.select"),
    ).toHaveTextContent("S/M");

    // Change the shirt size to L.
    await user.click(shirt);
    await user.click(await screen.findByRole("option", { name: "L" }));

    await waitFor(() => expect(updateRoadieDetails).toHaveBeenCalledTimes(1));
    const [, savedProfile] = updateRoadieDetails.mock.calls[0];
    expect(savedProfile.shirtSize).toBe("L");
    // The untouched hat size is preserved.
    expect(savedProfile.hatSize).toBe("S/M");
  });

  it("shows the sizes read-only to a leader who cannot edit", async () => {
    const user = userEvent.setup();
    const { actor } = managerActor(
      managerRoadie(managerProfile()),
      Role.leadership,
    );
    renderManagerCard(actor);

    // A leader has no Manager tab; the sizes still appear on the card back.
    await user.click(await screen.findByTestId("roadie.flip_button"));
    const card = await screen.findByTestId("roadie.flip_card");
    const faces = card.querySelectorAll<HTMLElement>("[aria-hidden]");
    const back = Array.from(faces).find(
      (node) => node.getAttribute("aria-hidden") === "false",
    );
    if (!back) throw new Error("no visible card face");
    expect(within(back).getByText("M")).toBeInTheDocument();
    expect(within(back).getByText("S/M")).toBeInTheDocument();
  });
});

/* ---------------------------------------------------------------------------
   Store template: uniform defaults survive download and load.
--------------------------------------------------------------------------- */

const TEMPLATE_WITH_UNIFORMS: StoreTemplateFile = {
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
  schedule: [],
  checklists: { orientationUniform: [], paperwork: [] },
};

function templateActor() {
  const loadStoreTemplate = vi.fn<backendInterface["loadStoreTemplate"]>(
    async () => ({
      __kind__: "ok",
      ok: {
        leaderTalkName: "10 Minutes with Dan",
        scheduleCount: 0n,
        orientationUniformCount: 0n,
        positionCount: 1n,
        paperworkCount: 0n,
      },
    }),
  );
  return {
    actor: {
      downloadStoreTemplate: vi.fn<backendInterface["downloadStoreTemplate"]>(
        async () => structuredClone(TEMPLATE_WITH_UNIFORMS),
      ),
      loadStoreTemplate,
      getStoreInfo: vi.fn<backendInterface["getStoreInfo"]>(
        async () => MANAGER_STORE,
      ),
      getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
        grant: grant(Role.admin),
      })),
      getDemoState: vi.fn<backendInterface["getDemoState"]>(async () => ({
        enabled: false,
        demoTrainerStations: [],
      })),
    },
    loadStoreTemplate,
  };
}

describe("store template uniform defaults", () => {
  it("downloads a template whose positions carry the uniform defaults", async () => {
    const user = userEvent.setup();
    const { actor } = templateActor();
    const createObjectURL = vi.fn<(blob: Blob) => string>(
      () => "blob:template",
    );
    Object.defineProperty(URL, "createObjectURL", {
      writable: true,
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      writable: true,
      configurable: true,
      value: vi.fn(),
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    renderWithActor(<TemplatePanel />, actor);
    await user.click(
      await screen.findByTestId("admin.template.download_button"),
    );
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));

    const blob = createObjectURL.mock.calls[0]?.[0] as Blob;
    const text = await blob.text();
    const parsed = JSON.parse(text) as {
      positions: Array<Record<string, unknown>>;
    };
    expect(parsed.positions[0]).toMatchObject({
      shirtType: "Polo",
      shirtQty: 2,
      hatType: "Cap",
      hatQty: 1,
    });

    click.mockRestore();
  });

  it("loads a template whose positions carry the uniform defaults", async () => {
    const user = userEvent.setup();
    const { actor, loadStoreTemplate } = templateActor();
    renderWithActor(<TemplatePanel />, actor);

    const fileInput = await screen.findByTestId("admin.template.file_input");
    const file = new File(
      [
        JSON.stringify(TEMPLATE_WITH_UNIFORMS, (_k, v) =>
          typeof v === "bigint" ? Number(v) : v,
        ),
      ],
      "template.json",
      { type: "application/json" },
    );
    await user.upload(fileInput, file);
    await screen.findByTestId("admin.template.preview_panel");
    await user.click(screen.getByTestId("admin.template.confirm_button"));

    await waitFor(() => expect(loadStoreTemplate).toHaveBeenCalledTimes(1));
    const [loaded] = loadStoreTemplate.mock.calls[0];
    expect(loaded.positions[0]).toMatchObject({
      shirtType: "Polo",
      shirtQty: 2n,
      hatType: "Cap",
      hatQty: 1n,
    });
  });

  it("keeps the removed crew-manager and required-count fields out of the downloaded template", async () => {
    const user = userEvent.setup();
    const { actor } = templateActor();
    const createObjectURL = vi.fn<(blob: Blob) => string>(
      () => "blob:template",
    );
    Object.defineProperty(URL, "createObjectURL", {
      writable: true,
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      writable: true,
      configurable: true,
      value: vi.fn(),
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    renderWithActor(<TemplatePanel />, actor);
    await user.click(
      await screen.findByTestId("admin.template.download_button"),
    );
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));

    const blob = createObjectURL.mock.calls[0]?.[0] as Blob;
    const parsed = JSON.parse(await blob.text()) as {
      positions: Array<Record<string, unknown>>;
    };
    // The removed fields never reach the template file.
    expect(parsed.positions[0]).not.toHaveProperty("crewManager");
    expect(parsed.positions[0]).not.toHaveProperty("shirtsRequired");
    expect(parsed.positions[0]).not.toHaveProperty("hatsRequired");

    click.mockRestore();
  });
});
