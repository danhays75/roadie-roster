import { renderPageWithActor, t } from "@/__tests__/router-test-utils";
import { setActorForTest } from "@/__tests__/setup";
import type { Position, Roadie, backendInterface } from "@/backend";
import { House, RoadieStatus, Role, RosterState } from "@/backend";
import { I18nContext } from "@/hooks/useI18n";
import type { Locale } from "@/lib/copy";
import RoadieCardPage from "@/pages/RoadieCard";
import RosterPage from "@/pages/Roster";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

/**
 * Render a page inside a real memory router, i18n provider and a caller-supplied
 * QueryClient, returning the wrapped element. Passing the same QueryClient to a
 * second render lets a test observe cache reuse across a re-render.
 */
function pageElement(
  Page: () => ReactElement,
  path: string,
  initialEntry: string,
  queryClient: QueryClient,
): ReactElement {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const pageRoute = createRoute({
    getParentRoute: () => rootRoute,
    path,
    component: Page,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([pageRoute]),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  });
  return (
    <QueryClientProvider client={queryClient}>
      <I18nContext.Provider
        value={{ locale: "en" as Locale, setLocale: vi.fn(), t }}
      >
        <RouterProvider router={router} />
      </I18nContext.Provider>
    </QueryClientProvider>
  );
}

function newQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

/**
 * Cover for the accepted on-demand photo change: the roster list and the roadie
 * card fetch a roadie's photo with `getPhoto(id)` (the list payload no longer
 * carries photo bytes), cache it per id, and show the placeholder icon when the
 * roadie has no photo. The backend is mocked, so this proves the frontend
 * consumer contract, not real canister behavior.
 */

const POSITION: Position = {
  id: 10n,
  name: "Cashier",
  code: "CSH",
  house: House.foh,
  openingBuildTo: 4n,
  afterOpeningBuildTo: 2n,
  minimumAge: 16n,
  shirtsRequired: 2n,
  hatsRequired: 1n,
  needsAlcoholCert: false,
  defaultShirts: 3n,
  defaultHats: 2n,
};

/** A single byte is enough to produce a non-empty data URL. */
const PHOTO_BYTES = new Uint8Array([1, 2, 3, 4]);

/** A roadie as the list payload returns it: no photo bytes on the record. */
function roadie(overrides: Partial<Roadie> = {}): Roadie {
  return {
    id: 1n,
    status: RoadieStatus.hired,
    mainPositionId: 10n,
    hiredAt: 0n,
    isMinor: false,
    isDemo: false,
    profile: { name: "Ada Lovelace", preferredName: "Ada" },
    rosterState: RosterState.pending,
    ...overrides,
  };
}

function rosterActor(
  roadies: Roadie[],
  getPhoto: backendInterface["getPhoto"],
) {
  return {
    listRoadies: vi.fn<backendInterface["listRoadies"]>(async () => roadies),
    listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
      POSITION,
    ]),
    listCrews: vi.fn<backendInterface["listCrews"]>(async () => []),
    getPhoto,
  };
}

function cardActor(
  record: Roadie,
  role: Role,
  getPhoto: backendInterface["getPhoto"],
) {
  return {
    getRoadie: vi.fn<backendInterface["getRoadie"]>(async () => record),
    listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
      POSITION,
    ]),
    listCrews: vi.fn<backendInterface["listCrews"]>(async () => []),
    isMinor: vi.fn<backendInterface["isMinor"]>(async () => false),
    getMyAccess: vi.fn<backendInterface["getMyAccess"]>(async () => ({
      grant: {
        principal: { toText: () => "aaaaa-aa" } as never,
        role,
        approvedAt: 0n,
        approvedBy: { toText: () => "aaaaa-aa" } as never,
        trainerPositionIds: [],
      },
    })),
    getContactSet: vi.fn<backendInterface["getContactSet"]>(async () => []),
    getChecklists: vi.fn<backendInterface["getChecklists"]>(async () => ({
      paperwork: [],
      orientationUniform: [],
    })),
    listChangeLog: vi.fn<backendInterface["listChangeLog"]>(async () => []),
    getPhoto,
  };
}

describe("roster list photo", () => {
  it("fetches the photo on demand and renders it as an image", async () => {
    const getPhoto = vi.fn<backendInterface["getPhoto"]>(
      async () => PHOTO_BYTES,
    );
    renderPageWithActor(RosterPage, rosterActor([roadie()], getPhoto), {
      path: "/roster",
    });

    await screen.findByText("Ada");
    const img = await screen.findByRole("img", { name: "Ada" });
    expect(img).toHaveAttribute("src", expect.stringContaining("data:image/"));
    expect(getPhoto).toHaveBeenCalledWith(1n);
  });

  it("does not carry photo bytes in the list payload", async () => {
    const getPhoto = vi.fn<backendInterface["getPhoto"]>(
      async () => PHOTO_BYTES,
    );
    const listRoadies = vi.fn<backendInterface["listRoadies"]>(async () => [
      roadie(),
    ]);
    renderPageWithActor(
      RosterPage,
      {
        listRoadies,
        listPositions: vi.fn<backendInterface["listPositions"]>(async () => [
          POSITION,
        ]),
        listCrews: vi.fn<backendInterface["listCrews"]>(async () => []),
        getPhoto,
      },
      { path: "/roster" },
    );

    await screen.findByText("Ada");
    // The record the list returns has no `photo` field; the image can only come
    // from the on-demand getPhoto read.
    const [returned] = await listRoadies.mock.results[0].value;
    expect(returned.photo).toBeUndefined();
    expect(getPhoto).toHaveBeenCalledTimes(1);
  });

  it("shows the placeholder icon, not a broken image, when there is no photo", async () => {
    const getPhoto = vi.fn<backendInterface["getPhoto"]>(async () => null);
    renderPageWithActor(RosterPage, rosterActor([roadie()], getPhoto), {
      path: "/roster",
    });

    await screen.findByText("Ada");
    await waitFor(() => expect(getPhoto).toHaveBeenCalledWith(1n));
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("reuses the cached photo across a re-render without re-fetching", async () => {
    const getPhoto = vi.fn<backendInterface["getPhoto"]>(
      async () => PHOTO_BYTES,
    );
    setActorForTest(rosterActor([roadie()], getPhoto));
    const queryClient = newQueryClient();
    const { rerender } = render(
      pageElement(RosterPage, "/roster", "/roster", queryClient),
    );

    await screen.findByRole("img", { name: "Ada" });
    expect(getPhoto).toHaveBeenCalledTimes(1);

    rerender(pageElement(RosterPage, "/roster", "/roster", queryClient));
    await screen.findByRole("img", { name: "Ada" });
    expect(getPhoto).toHaveBeenCalledTimes(1);
  });
});

describe("roadie card photo", () => {
  it("fetches the card photo on demand and renders it", async () => {
    const getPhoto = vi.fn<backendInterface["getPhoto"]>(
      async () => PHOTO_BYTES,
    );
    renderPageWithActor(
      RoadieCardPage,
      cardActor(roadie(), Role.admin, getPhoto),
      { path: "/roster/$roadieId", initialEntry: "/roster/1" },
    );

    const card = await screen.findByTestId("roadie.flip_card");
    const img = await screen.findByRole("img", { name: "Ada" });
    expect(card).toContainElement(img);
    expect(getPhoto).toHaveBeenCalledWith(1n);
  });

  it("shows the placeholder icon on the card when there is no photo", async () => {
    const getPhoto = vi.fn<backendInterface["getPhoto"]>(async () => null);
    renderPageWithActor(
      RoadieCardPage,
      cardActor(roadie(), Role.admin, getPhoto),
      { path: "/roster/$roadieId", initialEntry: "/roster/1" },
    );

    await screen.findByTestId("roadie.flip_card");
    await waitFor(() => expect(getPhoto).toHaveBeenCalledWith(1n));
    // The photo container shows the placeholder icon, not a broken <img>. The
    // store logo is also role="img", so scope the check to the photo container.
    const photo = screen.getByTestId("roadie.card.photo");
    expect(photo.querySelector("img")).toBeNull();
  });

  it("does not re-fetch the photo when the card re-renders", async () => {
    const getPhoto = vi.fn<backendInterface["getPhoto"]>(
      async () => PHOTO_BYTES,
    );
    setActorForTest(cardActor(roadie(), Role.admin, getPhoto));
    const queryClient = newQueryClient();
    const { rerender } = render(
      pageElement(
        RoadieCardPage,
        "/roster/$roadieId",
        "/roster/1",
        queryClient,
      ),
    );

    await screen.findByRole("img", { name: "Ada" });
    expect(getPhoto).toHaveBeenCalledTimes(1);

    rerender(
      pageElement(
        RoadieCardPage,
        "/roster/$roadieId",
        "/roster/1",
        queryClient,
      ),
    );
    await screen.findByRole("img", { name: "Ada" });
    expect(getPhoto).toHaveBeenCalledTimes(1);
  });
});
