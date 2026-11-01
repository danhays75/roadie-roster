import type { Role } from "@/backend";
import { SignOutButton } from "@/components/InternetIdentity";
import { StoreLogo } from "@/components/StoreLogo";
import { Button } from "@/components/ui/button";
import {
  NAV_ITEMS,
  canAdmin,
  canSeeNavItem,
  useAccessState,
} from "@/hooks/useAccess";
import { useI18n } from "@/hooks/useI18n";
import { usePendingSignups, usePendingUsers } from "@/hooks/useQueries";
import { cn } from "@/lib/utils";
import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useState } from "react";

function useCurrentRole(): Role | undefined {
  const access = useAccessState();
  return access.kind === "granted" ? access.grant.role : undefined;
}

function NavLinks({
  onNavigate,
  className,
}: {
  onNavigate?: () => void;
  className?: string;
}) {
  const { t } = useI18n();
  const role = useCurrentRole();
  // The badge reflects the pending sign-ups queue, which Store Managers and
  // Admins may read. The pending-users queue is admin-only, so it is read only
  // for an admin and never for a Store Manager.
  const { data: pendingSignups } = usePendingSignups();
  usePendingUsers(canAdmin(role));
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const pendingCount = pendingSignups?.length ?? 0;

  return (
    <nav aria-label="Primary" className={className}>
      <ul className="flex flex-col gap-1 lg:flex-row lg:items-center lg:gap-1">
        {NAV_ITEMS.filter((item) => canSeeNavItem(item, role)).map((item) => {
          const active =
            pathname === item.to || pathname.startsWith(`${item.to}/`);
          const showBadge =
            item.badge === "pendingApprovals" && pendingCount > 0;
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                onClick={onNavigate}
                data-ocid={`nav.${item.to.replace("/", "")}.link`}
                className={cn(
                  "touch-target flex items-center justify-between gap-2 rounded-md px-3 py-2 font-display text-sm font-medium uppercase tracking-wider transition-colors",
                  active
                    ? "bg-white/10 text-white"
                    : "text-white/75 hover:bg-white/10 hover:text-white",
                )}
              >
                <span>{t(item.labelKey)}</span>
                {showBadge && (
                  <span
                    data-ocid="nav.approvals.badge"
                    className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-semibold text-primary-foreground"
                  >
                    {pendingCount}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** The shared app shell: navy masthead, flag stripe, content area, footer. */
export function Layout({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const year = new Date().getFullYear();

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-40 bg-secondary text-secondary-foreground">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <Link
            to="/dashboard"
            data-ocid="header.home_link"
            className="flex min-w-0 items-center gap-3"
          >
            <StoreLogo className="h-10 w-10" />
            <span className="min-w-0">
              <span className="block font-display text-xl font-bold uppercase leading-none tracking-wide">
                {t("app.name")}
              </span>
              <span className="mt-0.5 block truncate text-xs text-white/70">
                {t("app.tagline")}
              </span>
            </span>
          </Link>

          <NavLinks className="hidden lg:block" />

          <div className="flex items-center gap-1">
            <SignOutButton
              label={t("nav.signOut")}
              ocid="nav.sign_out_button"
              className="touch-target hidden items-center gap-2 rounded-md px-3 py-2 font-display text-sm font-medium uppercase tracking-wider text-white/75 transition-colors hover:bg-white/10 hover:text-white lg:inline-flex"
            />

            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={menuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
              aria-expanded={menuOpen}
              data-ocid="nav.menu.toggle"
              className="touch-target text-white hover:bg-white/10 hover:text-white lg:hidden"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? (
                <X className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Menu className="h-5 w-5" aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t border-white/10 px-4 pb-4 pt-2 lg:hidden">
            <NavLinks onNavigate={() => setMenuOpen(false)} />
            <SignOutButton
              label={t("nav.signOut")}
              ocid="nav.sign_out_button.mobile"
              className="touch-target mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 font-display text-sm font-medium uppercase tracking-wider text-white/75 transition-colors hover:bg-white/10 hover:text-white"
            />
          </div>
        )}

        <div className="stripe-flag" aria-hidden="true" />
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-6 md:py-8">
        {children}
      </main>

      <footer className="border-t border-border bg-muted/40">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row md:px-6">
          <span>
            © {year}.{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              {t("footer.attribution")}
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
