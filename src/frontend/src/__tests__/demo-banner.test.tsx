import { t } from "@/__tests__/router-test-utils";
import { renderWithActor } from "@/__tests__/test-utils";
import type {
  AccessGrant,
  DemoStateView,
  LeaderSummary,
  Position,
  StaffProfile,
  backendInterface,
} from "@/backend";
import { DemoRole, DemoShift, House, Role } from "@/backend";
import { DemoBanner } from "@/components/DemoBanner";
import { I18nContext, translate } from "@/hooks/useI18n";
import type { Locale } from "@/lib/copy";
import type { Principal } from "@icp-sdk/core/principal";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

/**
 * Characterization baseline for the demo banner. The Crews request adds a
 * "Manager:" picker for the Store Manager and Training Manager demo roles. This
 * file deliberately does NOT assert that new picker (it does not exist yet). It
 * protects the adjacent banner behavior that must survive: the "View as" role
 * picker, the "Pretend it's" date picker, and the NSO Trainer's "Trainer:"
 * picker. The actor is a typed local mock; no live backend or identity runs.
 */

function fakePrincipal(text: string): Principal {
  return {
    toText: () => text,
    toString: () => text,
  } as unknown as Principal;
}

const ADMIN_PRINCIPAL = fakePrincipal("aaaaa-aa");
const TRAINER_PRINCIPAL = fakePrincipal("trainer-aa");

const STORE_POSITION: Position = {
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

function staffProfile(fullName: string): StaffProfile {
  return {
    fullName,
    title: "NSO Trainer",
    requestedRole: Role.trainer,
    homeStoreNumber: "975",
    homeStoreCity: "Lake Charles",
    trainerPositionIds: [0n],
  };
}

const TRAINER: LeaderSummary = {
  principal: TRAINER_PRINCIPAL,
  role: Role.trainer,
  title: "NSO Trainer",
  staffProfile: staffProfile("Kristen Marcotte"),
  trainerPositionIds: [0n],
};

function adminGrant(): AccessGrant {
  return {
    principal: ADMIN_PRINCIPAL,
    approvedAt: 0n,
    approvedBy: ADMIN_PRINCIPAL,
    role: Role.admin,
    trainerPositionIds: [],
  };
}

function demoState(overrides: Partial<DemoStateView> = {}): DemoStateView {
  return {
    enabled: true,
    demoTrainerStations: [],
    ...overrides,
  };
}

/** The actor the demo banner tree reads. */
function bannerActor(state: DemoStateView) {
  return {
    getDemoState: vi.fn<backendInterface["getDemoState"]>(async () => state),
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: adminGrant(),
    })),
    listLeaders: vi.fn<backendInterface["listLeaders"]>(async () => [TRAINER]),
    listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
      STORE_POSITION,
    ]),
    setDemoRole: vi.fn<backendInterface["setDemoRole"]>(async () => ({
      __kind__: "ok",
      ok: state,
    })),
    setDemoTrainerAs: vi.fn<backendInterface["setDemoTrainerAs"]>(async () => ({
      __kind__: "ok",
      ok: state,
    })),
    setPretendDate: vi.fn<backendInterface["setPretendDate"]>(async () => ({
      __kind__: "ok",
      ok: state,
    })),
  };
}

function renderBanner(actor: ReturnType<typeof bannerActor>) {
  return renderWithActor(
    <I18nContext.Provider
      value={{
        locale: "en",
        setLocale: vi.fn(),
        t: (key: string, vars?: Record<string, string | number>) =>
          translate("en" as Locale, key, vars),
      }}
    >
      <DemoBanner />
    </I18nContext.Provider>,
    actor,
  );
}

describe("Demo banner keeps its View as and Pretend it's pickers", () => {
  it("renders the banner and lists every demo role in the View as picker", async () => {
    const user = userEvent.setup();
    renderBanner(bannerActor(demoState()));

    expect(await screen.findByTestId("demo.banner")).toBeInTheDocument();

    await user.click(screen.getByTestId("demo.view_as.open_button"));
    const popover = await screen.findByTestId("demo.view_as.popover");
    await user.click(within(popover).getByTestId("demo.view_as.select"));

    expect(
      await screen.findByRole("option", { name: t("demo.banner.role.admin") }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: t("demo.banner.role.storeManager") }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: t("demo.banner.role.trainer") }),
    ).toBeInTheDocument();
  });

  it("shows the Pretend it's picker defaulting to Now and applies a date", async () => {
    const user = userEvent.setup();
    const actor = bannerActor(demoState());
    renderBanner(actor);

    const openButton = await screen.findByTestId("demo.pretend.open_button");
    expect(openButton).toHaveTextContent(t("demo.banner.now"));

    await user.click(openButton);
    const dateInput = await screen.findByTestId("demo.pretend.date_input");
    await user.type(dateInput, "2026-07-15");
    await user.click(screen.getByTestId("demo.pretend.apply_button"));

    await waitFor(() => expect(actor.setPretendDate).toHaveBeenCalledTimes(1));
    const [pretendDate] = actor.setPretendDate.mock.calls[0] ?? [];
    expect(pretendDate?.shift).toBe(DemoShift.am);
  });
});

describe("Demo banner keeps the NSO Trainer picker", () => {
  it("shows the Trainer picker for the NSO Trainer demo role and defaults to the first trainer", async () => {
    const user = userEvent.setup();
    const actor = bannerActor(demoState({ demoRole: DemoRole.trainer }));
    renderBanner(actor);

    await user.click(await screen.findByTestId("demo.view_as.open_button"));

    // The Trainer picker is present and defaults to the first demo trainer.
    const trainerSelect = await screen.findByTestId(
      "demo.view_as.trainer_select",
    );
    expect(trainerSelect).toHaveTextContent("Kristen Marcotte");
    await waitFor(() =>
      expect(actor.setDemoTrainerAs).toHaveBeenCalledWith(TRAINER_PRINCIPAL),
    );
  });

  it("does not show the Trainer picker for a non-trainer demo role", async () => {
    const user = userEvent.setup();
    renderBanner(bannerActor(demoState({ demoRole: DemoRole.storeManager })));

    await user.click(await screen.findByTestId("demo.view_as.open_button"));

    expect(
      screen.queryByTestId("demo.view_as.trainer_select"),
    ).not.toBeInTheDocument();
  });
});
