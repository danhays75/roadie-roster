import { renderWithActor } from "@/__tests__/test-utils";
import type { Position, backendInterface } from "@/backend";
import { House } from "@/backend";
import { PositionsPanel } from "@/components/admin/PositionsPanel";
import { I18nContext, translate } from "@/hooks/useI18n";
import type { Locale } from "@/lib/copy";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

/**
 * Characterization baseline for the Admin > Positions panel, protecting the
 * behavior that must survive the accepted change that removes `crewManager`,
 * `shirtsRequired` and `hatsRequired` from the form, the list summary and the
 * template. These tests deliberately assert only the surviving uniform field
 * set (shirtType/shirtQty/hatType/hatQty) and the create-vs-edit routing, never
 * the fields being removed.
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
  // The surviving uniform field set; the removed shirtsRequired/hatsRequired
  // fields are intentionally absent from the Position type.
  shirtType: "Polo",
  shirtQty: 2n,
  hatType: "Cap",
  hatQty: 1n,
  defaultShirts: 2n,
  defaultHats: 1n,
};

function positionsActor(positions: Position[]) {
  const updatePosition = vi.fn<backendInterface["updatePosition"]>(
    async () => undefined,
  );
  return {
    actor: {
      listPositions: vi.fn<backendInterface["listPositions"]>(async () =>
        structuredClone(positions),
      ),
      createPosition: vi.fn<backendInterface["createPosition"]>(async () => 0n),
      updatePosition,
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
    updatePosition,
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

describe("Positions list summary keeps the uniform field set", () => {
  it("shows the shirt and hat type and quantity for a seeded position", async () => {
    const { actor } = positionsActor([SERVERS]);
    renderPositions(actor);

    const summary = await screen.findByTestId(
      "admin.positions.uniform_summary",
    );
    // The surviving uniform fields render: 2× Polo · 1× Cap.
    expect(summary).toHaveTextContent("2× Polo");
    expect(summary).toHaveTextContent("1× Cap");
  });

  it("falls back to the generic type labels when a position has no type", async () => {
    const { actor } = positionsActor([
      { ...SERVERS, shirtType: "", hatType: "" },
    ]);
    renderPositions(actor);

    const summary = await screen.findByTestId(
      "admin.positions.uniform_summary",
    );
    expect(summary).toHaveTextContent("2× Shirt type");
    expect(summary).toHaveTextContent("1× Hat type");
  });
});

describe("Positions edit round-trips the surviving uniform fields", () => {
  it("sends the edited shirt and hat type and quantity on update", async () => {
    const user = userEvent.setup();
    // A non-zero id: the panel treats id 0n as the add-vs-edit sentinel.
    const { actor, updatePosition } = positionsActor([{ ...SERVERS, id: 1n }]);
    renderPositions(actor);

    await user.click(await screen.findByTestId("admin.positions.edit_button"));

    const shirtType = await screen.findByTestId(
      "admin.positions.shirt_type.input",
    );
    expect(shirtType).toHaveValue("Polo");
    await user.clear(shirtType);
    await user.type(shirtType, "Button-up");

    const hatQty = screen.getByTestId("admin.positions.hat_qty.input");
    await user.clear(hatQty);
    await user.type(hatQty, "3");

    await user.click(screen.getByTestId("admin.positions.save_button"));

    await waitFor(() => expect(updatePosition).toHaveBeenCalledTimes(1));
    const [saved] = updatePosition.mock.calls[0];
    expect(saved.id).toBe(1n);
    expect(saved.shirtType).toBe("Button-up");
    expect(saved.shirtQty).toBe(2n);
    expect(saved.hatType).toBe("Cap");
    expect(saved.hatQty).toBe(3n);
  });
});

describe("Positions edit of the seeded id-0 Servers position", () => {
  it("updates the seeded position instead of creating a duplicate", async () => {
    const user = userEvent.setup();
    // The seeded Servers position carries id 0n, the same value a fresh draft
    // uses, so create-vs-update must be decided by the draft's isNew flag.
    const { actor, updatePosition } = positionsActor([SERVERS]);
    renderPositions(actor);

    await user.click(await screen.findByTestId("admin.positions.edit_button"));

    const name = await screen.findByTestId("admin.positions.name.input");
    expect(name).toHaveValue("Servers");
    await user.clear(name);
    await user.type(name, "Servers Lead");
    await user.click(screen.getByTestId("admin.positions.save_button"));

    await waitFor(() => expect(updatePosition).toHaveBeenCalledTimes(1));
    const [saved] = updatePosition.mock.calls[0];
    expect(saved.id).toBe(0n);
    expect(saved.name).toBe("Servers Lead");
    // The seeded position is updated, never re-created.
    expect(actor.createPosition).not.toHaveBeenCalled();
  });
});

describe("Positions edit of the seeded id-0 Servers position updates it", () => {
  it("routes the seeded id-0 edit through updatePosition, never createPosition", async () => {
    const user = userEvent.setup();
    // The seeded Servers position carries id 0n, the same value a fresh draft
    // uses, so create-vs-update must be decided by the draft's isNew flag.
    const { actor, updatePosition } = positionsActor([SERVERS]);
    renderPositions(actor);

    await user.click(await screen.findByTestId("admin.positions.edit_button"));

    const name = await screen.findByTestId("admin.positions.name.input");
    expect(name).toHaveValue("Servers");
    await user.clear(name);
    await user.type(name, "Servers Lead");
    await user.click(screen.getByTestId("admin.positions.save_button"));

    await waitFor(() => expect(updatePosition).toHaveBeenCalledTimes(1));
    const [saved] = updatePosition.mock.calls[0];
    expect(saved.id).toBe(0n);
    expect(saved.name).toBe("Servers Lead");
    // The seeded position is updated, never re-created.
    expect(actor.createPosition).not.toHaveBeenCalled();
  });
});

describe("Positions form and summary drop the removed fields", () => {
  it("shows no crew manager, shirts-required or hats-required control", async () => {
    const user = userEvent.setup();
    const { actor } = positionsActor([SERVERS]);
    renderPositions(actor);

    await user.click(await screen.findByTestId("admin.positions.edit_button"));
    await screen.findByTestId("admin.positions.name.input");

    // The removed fields are gone from the form.
    expect(screen.queryByText("Crew manager")).not.toBeInTheDocument();
    expect(screen.queryByText("Shirts required")).not.toBeInTheDocument();
    expect(screen.queryByText("Hats required")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("admin.positions.crew_manager.input"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("admin.positions.shirts_required.input"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("admin.positions.hats_required.input"),
    ).not.toBeInTheDocument();
  });

  it("keeps the removed fields out of the list summary", async () => {
    const { actor } = positionsActor([SERVERS]);
    renderPositions(actor);

    const summary = await screen.findByTestId(
      "admin.positions.uniform_summary",
    );
    expect(summary).not.toHaveTextContent(/crew manager/i);
    expect(summary).not.toHaveTextContent(/shirts required/i);
    expect(summary).not.toHaveTextContent(/hats required/i);
  });
});
