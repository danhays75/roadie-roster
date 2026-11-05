import { Role, createActor } from "@/backend";
import { ApprovalGate } from "@/components/ApprovalGate";
import { DemoBannerHost } from "@/components/DemoBanner";
import { AuthenticatedApp, useSignOut } from "@/components/InternetIdentity";
import { Layout } from "@/components/Layout";
import { EmptyState, LoadingState } from "@/components/States";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  canAdmin,
  canApprove,
  canExport,
  canGiftBags,
  canGroups,
  canLeaders,
  canOrientation,
  canUniforms,
  useAccessState,
} from "@/hooks/useAccess";
import { I18nContext, translate, useI18n } from "@/hooks/useI18n";
import type { Locale } from "@/lib/copy";
import AdminPage from "@/pages/Admin";
import ApprovalsPage from "@/pages/Approvals";
import DashboardPage from "@/pages/Dashboard";
import ExportPage from "@/pages/Export";
import GiftBagsPage from "@/pages/GiftBags";
import GroupsPage from "@/pages/Groups";
import KioskPage from "@/pages/Kiosk";
import LeaderCardPage from "@/pages/LeaderCard";
import LeadersPage from "@/pages/Leaders";
import MyProfilePage from "@/pages/MyProfile";
import OrientationPage from "@/pages/Orientation";
import RoadieCardPage from "@/pages/RoadieCard";
import RosterPage from "@/pages/Roster";
import TodayPage from "@/pages/Today";
import UniformsPage from "@/pages/Uniforms";
import { useActor } from "@caffeineai/core-infrastructure";
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

/**
 * A discreet, PIN-protected staff sign-out for the kiosk shell. The kiosk
 * renders without the app header, so this is the only way to end the session
 * on a shared device. The PIN is verified by the backend against the stored
 * hash, never compared to a constant in the client.
 */
function KioskSignOut() {
  const { t } = useI18n();
  const signOut = useSignOut();
  const { actor } = useActor(createActor);
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);

  const submit = async () => {
    if (!actor || checking) return;
    setChecking(true);
    try {
      const ok = await actor.checkKioskPin(pin.trim());
      if (!ok) {
        setError(true);
        return;
      }
      setError(false);
      setPin("");
      setOpen(false);
      signOut();
    } catch {
      setError(true);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex justify-end">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        data-ocid="kiosk.sign_out.open_button"
        className="touch-target text-muted-foreground hover:text-foreground"
        onClick={() => {
          setPin("");
          setError(false);
          setOpen(true);
        }}
      >
        <Lock className="mr-2 h-4 w-4" aria-hidden="true" />
        {t("kiosk.signOut.open")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-ocid="kiosk.sign_out.dialog">
          <DialogHeader>
            <DialogTitle>{t("kiosk.signOut.title")}</DialogTitle>
            <DialogDescription>{t("kiosk.signOut.body")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="kiosk-staff-pin">
              {t("kiosk.signOut.pinLabel")}
            </Label>
            <Input
              id="kiosk-staff-pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              aria-invalid={error}
              placeholder={t("kiosk.signOut.pinPlaceholder")}
              data-ocid="kiosk.sign_out.pin_input"
              className="touch-target"
              onChange={(event) => {
                setError(false);
                setPin(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") void submit();
              }}
            />
            {error && (
              <p
                role="alert"
                data-ocid="kiosk.sign_out.error_state"
                className="text-sm text-destructive"
              >
                {t("kiosk.signOut.error")}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="touch-target"
              data-ocid="kiosk.sign_out.cancel_button"
              onClick={() => setOpen(false)}
            >
              {t("kiosk.signOut.cancel")}
            </Button>
            <Button
              type="button"
              className="touch-target"
              data-ocid="kiosk.sign_out.confirm_button"
              onClick={() => void submit()}
              disabled={checking}
            >
              {t("kiosk.signOut.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Block a page a role cannot use. The guard renders the app chrome (so the
 * header and navigation stay usable) with a clear message instead of the page,
 * so a role that reaches a guarded route by URL never triggers its reads.
 */
function RouteGuard({
  allowed,
  children,
}: {
  allowed: boolean;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  if (allowed) return <>{children}</>;
  return (
    <div data-ocid="guard.blocked_state">
      <EmptyState
        title={t("guard.title")}
        message={t("guard.body")}
        ocid="guard.blocked_state"
      />
    </div>
  );
}

/**
 * Root shell: gates on an approved access grant, then renders the app chrome.
 *
 * A Kiosk login has no read access to the roster, dashboard or store config —
 * every one of those reads traps on the backend. As soon as its grant is known
 * it is sent straight to the sign-up welcome screen, and the app chrome is not
 * rendered on the way so no trapping read ever fires. The kiosk surface itself
 * also renders without the app header and navigation.
 */
function RootShell() {
  const { t } = useI18n();
  const access = useAccessState();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isKiosk = access.kind === "granted" && access.grant.role === Role.kiosk;
  const redirecting = isKiosk && pathname !== "/kiosk";
  const onKioskRoute = pathname === "/kiosk";

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
      ) : onKioskRoute ? (
        // The kiosk is a shared device: no app header or navigation, but a
        // PIN-protected staff sign-out so the session can be ended.
        <main className="min-h-dvh bg-background px-4 py-6 md:px-6 md:py-8">
          <KioskSignOut />
          <Outlet />
        </main>
      ) : (
        <Layout>
          <Outlet />
        </Layout>
      )}
    </ApprovalGate>
  );
}

const rootRoute = createRootRoute({ component: RootShell });

/** The caller's role, or undefined while the grant is unknown. */
function useRole(): Role | undefined {
  const access = useAccessState();
  return access.kind === "granted" ? access.grant.role : undefined;
}

/** The Admin page, blocked for roles that cannot use it. */
function GuardedAdmin() {
  const role = useRole();
  return (
    <RouteGuard allowed={canAdmin(role)}>
      <AdminPage />
    </RouteGuard>
  );
}

/** The approvals queue, blocked for roles that cannot use it. */
function GuardedApprovals() {
  const role = useRole();
  return (
    <RouteGuard allowed={canApprove(role)}>
      <ApprovalsPage />
    </RouteGuard>
  );
}

/** The export surface, blocked for roles that cannot use it. */
function GuardedExport() {
  const role = useRole();
  return (
    <RouteGuard allowed={canExport(role)}>
      <ExportPage />
    </RouteGuard>
  );
}

/** The Gift Bags surface, blocked for roles that cannot use it. */
function GuardedGiftBags() {
  const role = useRole();
  return (
    <RouteGuard allowed={canGiftBags(role)}>
      <GiftBagsPage />
    </RouteGuard>
  );
}

/** The Leaders surface, blocked for roles that cannot use it. */
function GuardedLeaders() {
  const role = useRole();
  return (
    <RouteGuard allowed={canLeaders(role)}>
      <LeadersPage />
    </RouteGuard>
  );
}

/** The Groups shift boards, blocked for roles that cannot view them. */
function GuardedGroups() {
  const role = useRole();
  return (
    <RouteGuard allowed={canGroups(role)}>
      <GroupsPage />
    </RouteGuard>
  );
}

/** A single leader card, blocked for roles that cannot read leaders. */
function GuardedLeaderCard() {
  const role = useRole();
  return (
    <RouteGuard allowed={canLeaders(role)}>
      <LeaderCardPage />
    </RouteGuard>
  );
}

/** The Orientation check-in surface, blocked for roles that cannot use it. */
function GuardedOrientation() {
  const role = useRole();
  return (
    <RouteGuard allowed={canOrientation(role)}>
      <OrientationPage />
    </RouteGuard>
  );
}

/** The Uniforms surface, blocked for roles that cannot view it. */
function GuardedUniforms() {
  const role = useRole();
  return (
    <RouteGuard allowed={canUniforms(role)}>
      <UniformsPage />
    </RouteGuard>
  );
}

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: TodayPage,
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

const myProfileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/my-profile",
  component: MyProfilePage,
});

const roadieRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/roster/$roadieId",
  component: RoadieCardPage,
});

const approvalsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/approvals",
  component: GuardedApprovals,
});

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: GuardedAdmin,
});

const kioskRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/kiosk",
  component: KioskPage,
});

const exportRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/export",
  component: GuardedExport,
});

const giftBagsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/gift-bags",
  component: GuardedGiftBags,
});

const leadersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/leaders",
  component: GuardedLeaders,
});

const groupsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/groups",
  component: GuardedGroups,
});

const leaderCardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/leaders/$leaderId",
  component: GuardedLeaderCard,
});

const orientationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/orientation",
  component: GuardedOrientation,
});

const uniformsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/uniforms",
  component: GuardedUniforms,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  todayRoute,
  dashboardRoute,
  rosterRoute,
  myProfileRoute,
  roadieRoute,
  approvalsRoute,
  adminRoute,
  kioskRoute,
  exportRoute,
  giftBagsRoute,
  leadersRoute,
  leaderCardRoute,
  groupsRoute,
  orientationRoute,
  uniformsRoute,
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
      <DemoBannerHost>
        <AuthenticatedApp
          title={i18n.t("auth.title")}
          description={i18n.t("auth.description")}
          className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground"
          buttonClassName="touch-target rounded-md bg-primary px-5 py-3 font-display font-semibold uppercase tracking-wider text-primary-foreground transition-smooth hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
        >
          <RouterProvider router={router} />
        </AuthenticatedApp>
      </DemoBannerHost>
    </I18nContext.Provider>
  );
}
