import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, Target, UserCheck, type Users } from "lucide-react";
import { useDashboardCopy } from "./copy";

/**
 * The orientation window, derived from the schedule and the store's paperwork
 * due date, with the demo "Pretend it's" date already applied to `now`. The
 * window opens on the paperwork due date and closes on the final sign-off
 * date; `afterOrientation` and `afterSignOff` gate the later summary lines.
 */
export interface OrientationWindow {
  /** Whether now falls inside the paperwork-due-to-sign-off window. */
  isOpen: boolean;
  /** Whether now is at or after the orientation session date. */
  afterOrientation: boolean;
  /** Whether now is at or after the final sign-off date. */
  afterSignOff: boolean;
}

interface Tile {
  key: string;
  labelKey: string;
  value: string;
  hintKey: string;
  icon: typeof Users;
  tone: "primary" | "accent" | "muted";
  /** An extra line under the value, e.g. the showed-up/waiting split. */
  detail?: string;
  /** A link rendered under the value, e.g. the no-shows link. */
  link?: { to: string; label: string };
}

/**
 * The single hiring progress bar: "Hired X of Y", filled to hired/build-to.
 * X is everyone hired (pending + active, archived excluded) and Y is the
 * build-to total, so the bar reads how close the store is to its target.
 */
function HiringProgress({
  hired,
  buildToTotal,
}: {
  hired: number;
  buildToTotal: number;
}) {
  const { t } = useDashboardCopy();
  const total = Math.max(buildToTotal, 1);
  const pct = Math.min(100, Math.round((hired / total) * 100));

  return (
    <Card
      data-ocid="dashboard.progress"
      className="animate-fade-rise rounded-lg border-border py-4 shadow-subtle"
    >
      <CardContent className="px-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {t("dashboard.progress.title", { hired, total: buildToTotal })}
          </span>
          <span className="font-display text-sm font-bold tabular-nums text-foreground">
            {pct}%
          </span>
        </div>

        <div
          className="mt-3 h-3 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          tabIndex={0}
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t("dashboard.progress.aria", {
            hired,
            total: buildToTotal,
          })}
        >
          <span
            className="block h-full rounded-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

/** The headline hiring tiles plus the single hiring progress bar. */
export function KpiTiles({
  hired,
  active,
  pending,
  buildToTotal,
  stillNeeded,
  certified,
  window,
}: {
  hired: bigint;
  active: bigint;
  pending: bigint;
  buildToTotal: bigint;
  stillNeeded: bigint;
  certified?: bigint;
  window: OrientationWindow;
}) {
  const { t } = useDashboardCopy();

  const hiredCount = Number(hired);
  const activeCount = Number(active);
  const pendingCount = Number(pending);
  const certifiedCount = Number(certified ?? 0n);

  const tiles: Tile[] = [
    {
      key: "hired",
      labelKey: "dashboard.kpi.hired",
      value: hiredCount.toString(),
      hintKey: "dashboard.kpi.hired.hint",
      icon: UserCheck,
      tone: "accent",
      // During the orientation window the hired tile also breaks the count
      // into who has shown up and who is still waiting.
      detail: window.isOpen
        ? t("dashboard.kpi.hired.showedWaiting", {
            showed: activeCount,
            waiting: pendingCount,
          })
        : undefined,
    },
    {
      key: "still_needed",
      labelKey: "dashboard.kpi.stillNeeded",
      value: stillNeeded.toString(),
      hintKey: "dashboard.kpi.stillNeeded.toReach",
      icon: Target,
      tone: "primary",
    },
  ];

  // The showed-up tile appears only once the orientation window opens; after
  // the orientation date it also links to the no-shows on the Orientation
  // screen.
  if (window.isOpen) {
    tiles.push({
      key: "showed_up",
      labelKey: "dashboard.kpi.showedUp",
      value: t("dashboard.kpi.showedUp.value", {
        active: activeCount,
        hired: hiredCount,
      }),
      hintKey: "dashboard.kpi.showedUp.hint",
      icon: CheckCircle2,
      tone: "accent",
      link: window.afterOrientation
        ? {
            to: "/orientation",
            label: t("dashboard.kpi.showedUp.noShows", { count: pendingCount }),
          }
        : undefined,
    });
  }

  // The certified tile appears only once the final sign-off date has passed.
  if (window.afterSignOff) {
    tiles.push({
      key: "certified",
      labelKey: "dashboard.kpi.certified",
      value: t("dashboard.kpi.certified.value", {
        certified: certifiedCount,
        hired: hiredCount,
      }),
      hintKey: "dashboard.kpi.certified.hint",
      icon: CheckCircle2,
      tone: "muted",
    });
  }

  const toneClasses: Record<Tile["tone"], string> = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/10 text-accent",
    muted: "bg-muted text-muted-foreground",
  };

  return (
    <div className="space-y-3">
      <HiringProgress hired={hiredCount} buildToTotal={Number(buildToTotal)} />
      <div
        className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4"
        data-ocid="dashboard.kpi.list"
      >
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <Card
              key={tile.key}
              data-ocid={`dashboard.kpi.${tile.key}`}
              className="animate-fade-rise rounded-lg border-border py-4 shadow-subtle"
            >
              <CardContent className="px-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {t(tile.labelKey)}
                  </p>
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                      toneClasses[tile.tone],
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                </div>
                <p className="mt-2 font-display text-3xl font-bold tabular-nums text-foreground">
                  {tile.value}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t(tile.hintKey, { total: Number(buildToTotal) })}
                </p>
                {tile.detail && (
                  <p
                    data-ocid={`dashboard.kpi.${tile.key}.detail`}
                    className="mt-1 text-xs font-medium text-accent"
                  >
                    {tile.detail}
                  </p>
                )}
                {tile.link && (
                  <Link
                    to={tile.link.to}
                    data-ocid={`dashboard.kpi.${tile.key}.link`}
                    className="mt-1 inline-block text-xs font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {tile.link.label}
                  </Link>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
