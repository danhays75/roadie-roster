import { renderWithActor } from "@/__tests__/test-utils";
import type { backendInterface } from "@/backend";
import { I18nContext, translate } from "@/hooks/useI18n";
import type { Locale } from "@/lib/copy";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import type { ReactElement } from "react";
import { vi } from "vitest";

export const t = (key: string, vars?: Record<string, string | number>) =>
  translate("en" as Locale, key, vars);

function I18n({ children }: { children: React.ReactNode }) {
  return (
    <I18nContext.Provider value={{ locale: "en", setLocale: vi.fn(), t }}>
      {children}
    </I18nContext.Provider>
  );
}

/**
 * Render a page component inside a real memory-history router so that
 * `Link`, `useParams` and `useRouterState` resolve. The page is mounted at
 * `path`; `params` supplies dynamic segments such as `$roadieId`.
 */
export function renderPageWithActor<K extends keyof backendInterface>(
  Page: () => ReactElement,
  actor: Pick<backendInterface, K>,
  options: { path?: string; initialEntry?: string } = {},
) {
  const path = options.path ?? "/";
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const pageRoute = createRoute({
    getParentRoute: () => rootRoute,
    path,
    component: Page,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([pageRoute]),
    history: createMemoryHistory({
      initialEntries: [options.initialEntry ?? path],
    }),
  });
  return renderWithActor(
    <I18n>
      <RouterProvider router={router} />
    </I18n>,
    actor,
  );
}
