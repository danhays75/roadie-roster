import { Role } from "@/backend";
import { ApprovalGate } from "@/components/ApprovalGate";
import { AuthenticatedApp } from "@/components/InternetIdentity";
import { Layout } from "@/components/Layout";
import { LoadingState } from "@/components/States";
import { useAccessState } from "@/hooks/useAccess";
import { I18nContext, translate, useI18n } from "@/hooks/useI18n";
import type { Locale } from "@/lib/copy";
import AdminPage from "@/pages/Admin";
import ApprovalsPage from "@/pages/Approvals";
import DashboardPage from "@/pages/Dashboard";
import ExportPage from "@/pages/Export";
import KioskPage from "@/pages/Kiosk";
import RoadieCardPage from "@/pages/RoadieCard";
import RosterPage from "@/pages/Roster";
import TodayPage from "@/pages/Today";
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

/**
 * Root shell: gates on an approved access grant, then renders the app chrome.
 *
 * A Kiosk login has no read access to the roster, dashboard or store config —
 * every one of those reads traps on the backend. As soon as its grant is known
 * it is sent straight to the sign-up welcome screen, and the app chrome is not
 * rendered on the way so no trapping read ever fires.
 */
function RootShell() {
  const { t } = useI18n();
  const access = useAccessState();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isKiosk = access.kind === "granted" && access.grant.role === Role.kiosk;
  const redirecting = isKiosk && pathname !== "/kiosk";

  useEffect(() => {
    if (redirecting) {
      void navigate({ to: "/kiosk", replace: true });
    }
  }, [redirecting, navigate]);

  return (
    <ApprovalGate>
      {redirecting ? (
        <div
          data-ocid="kiosk.redirect_state"
          className="flex min-h-dvh items-center justify-center bg-background px-6"
        >
          <LoadingState label={t("common.loading")} />
        </div>
      ) : (
        <Layout>
          <Outlet />
        </Layout>
      )}
    </ApprovalGate>
  );
}

const rootRoute = createRootRoute({ component: RootShell });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: DashboardPage,
});

const todayRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/today",
  component: TodayPage,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  component: DashboardPage,
});

const rosterRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/roster",
  component: RosterPage,
});

const roadieRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/roster/$roadieId",
  component: RoadieCardPage,
});

const approvalsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/approvals",
  component: ApprovalsPage,
});

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: AdminPage,
});

const kioskRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/kiosk",
  component: KioskPage,
});

const exportRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/export",
  component: ExportPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  todayRoute,
  dashboardRoute,
  rosterRoute,
  roadieRoute,
  approvalsRoute,
  adminRoute,
  kioskRoute,
  exportRoute,
]);

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export default function App() {
  const [locale, setLocale] = useState<Locale>("en");
  const i18n = useMemo(
    () => ({
      locale,
      setLocale,
      t: (key: string, vars?: Record<string, string | number>) =>
        translate(locale, key, vars),
    }),
    [locale],
  );

  return (
    <I18nContext.Provider value={i18n}>
      <AuthenticatedApp
        title={i18n.t("auth.title")}
        description={i18n.t("auth.description")}
        className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground"
        buttonClassName="touch-target rounded-md bg-primary px-5 py-3 font-display font-semibold uppercase tracking-wider text-primary-foreground transition-smooth hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
      >
        <RouterProvider router={router} />
      </AuthenticatedApp>
    </I18nContext.Provider>
  );
}
