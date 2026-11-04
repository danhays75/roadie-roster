import { renderPageWithActor } from "@/__tests__/router-test-utils";
import type { StoreInfo, UniformOrderView, backendInterface } from "@/backend";
import { Role, UniformHouseFilter } from "@/backend";
import UniformsPage from "@/pages/Uniforms";
import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * Cover for the accepted uniform-order changes: the order shows a Totals row
 * per item carrying Hired, Projected and Order total, and a hired roadie with a
 * missing shirt or hat size is still listed under Size unknown by name while
 * their projected share appears in the Projected column. The backend is a typed
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
  paperworkDueDate: 1_800_000_000_000_000_000n,
};

/**
 * An order with two items, each carrying a backend totals row, and a roadie
 * missing both sizes. The projected column on the Polo M row is non-zero, so
 * the missing-size roadie's projected share is observable.
 */
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
    { roadieId: 42n, name: "Dana Reed", missingShirt: true, missingHat: true },
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

function uniformsActor(role: Role = Role.admin) {
  return {
    getUniformSettings: vi.fn<backendInterface["getUniformSettings"]>(
      async () => ({
        sizeCurve: {
          shirts: [{ size: "M", percent: 100n }],
          hats: [{ size: "One size", percent: 100n }],
        },
        bufferPercent: 10n,
      }),
    ),
    getUniformOrder: vi.fn<backendInterface["getUniformOrder"]>(async () =>
      structuredClone(ORDER),
    ),
    updateUniformSettings: vi.fn<backendInterface["updateUniformSettings"]>(
      async () => undefined,
    ),
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
  };
}

function renderUniforms(actor: ReturnType<typeof uniformsActor>) {
  return renderPageWithActor(UniformsPage, actor, {
    path: "/uniforms",
    initialEntry: "/uniforms",
  });
}

describe("Uniforms page: Totals row per item", () => {
  it("shows a Totals row with Hired, Projected and Order total for each item", async () => {
    renderUniforms(uniformsActor());

    const polo = await screen.findByTestId("uniforms.order.polo");
    const poloTotals = within(polo).getByTestId("uniforms.order.polo.totals");
    // The totals row carries the backend's per-item sums.
    expect(within(poloTotals).getByText("7")).toBeInTheDocument();
    expect(within(poloTotals).getByText("3")).toBeInTheDocument();
    expect(within(poloTotals).getByText("12")).toBeInTheDocument();

    const cap = screen.getByTestId("uniforms.order.cap");
    const capTotals = within(cap).getByTestId("uniforms.order.cap.totals");
    expect(within(capTotals).getByText("5")).toBeInTheDocument();
    expect(within(capTotals).getByText("2")).toBeInTheDocument();
    expect(within(capTotals).getByText("8")).toBeInTheDocument();
  });
});

describe("Uniforms page: missing-size roadie is projected and listed", () => {
  it("lists the missing-size roadie under Size unknown and shows a projected share", async () => {
    renderUniforms(uniformsActor());

    // The roadie with no shirt or hat size is listed by name.
    const section = await screen.findByTestId("uniforms.size_unknown.section");
    expect(within(section).getByText("Dana Reed")).toBeInTheDocument();
    expect(
      within(section).getByText("Missing shirt and hat size"),
    ).toBeInTheDocument();

    // Their projected share appears in the Projected column of the order.
    const polo = screen.getByTestId("uniforms.order.polo");
    const poloRow = within(polo).getByTestId("uniforms.order.polo.row.1");
    expect(within(poloRow).getByText("2")).toBeInTheDocument();
  });
});
