import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Target,
  UserCheck,
  Users,
} from "lucide-react";
import { useDashboardCopy } from "./copy";

interface Tile {
  key: string;
  labelKey: string;
  value: string;
  hintKey: string;
  icon: typeof Users;
  tone: "primary" | "accent" | "muted";
}

/**
 * The Hired → Active funnel: everyone hired, how many have shown up (active)
 * and how many are still pending. The bar splits hired into its active and
 * pending parts so the "showed up" share reads at a glance.
 */
function HiredFunnel({
  hired,
  active,
  pending,
}: {
  hired: number;
  active: number;
  pending: number;
}) {
  const { t } = useDashboardCopy();
  const total = Math.max(hired, 1);
  const activePct = Math.round((active / total) * 100);
  const pendingPct = Math.round((pending / total) * 100);

  return (
    <Card
      data-ocid="dashboard.funnel"
      className="animate-fade-rise rounded-lg border-border py-4 shadow-subtle"
    >
      <CardContent className="px-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {t("dashboard.funnel.title")}
          </span>
          <span className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-foreground">
            <span data-ocid="dashboard.funnel.hired">
              {t("dashboard.funnel.hired", { count: hired })}
            </span>
            <ArrowRight
              className="h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            <span data-ocid="dashboard.funnel.active" className="text-accent">
              {t("dashboard.funnel.active", { count: active })}
            </span>
          </span>
        </div>

        <div
          className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-muted"
          role="img"
          aria-label={t("dashboard.funnel.aria", {
            hired,
            active,
            pending,
          })}
        >
          <span
            className="h-full bg-accent transition-all"
            style={{ width: `${activePct}%` }}
          />
          <span
            className="h-full bg-primary transition-all"
            style={{ width: `${pendingPct}%` }}
          />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full bg-accent"
              aria-hidden="true"
            />
            {t("dashboard.funnel.activeLabel", { count: active })}
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full bg-primary"
              aria-hidden="true"
            />
            {t("dashboard.funnel.pendingLabel", { count: pending })}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

/** The headline hiring tiles plus the Hired → Active funnel. */
export function KpiTiles({
  hired,
  active,
  pending,
  buildToTotal,
  stillNeeded,
  showedAtOrientation,
  certified,
}: {
  hired: bigint;
  active: bigint;
  pending: bigint;
  buildToTotal: bigint;
  stillNeeded: bigint;
  showedAtOrientation?: bigint;
  certified?: bigint;
}) {
  const { t } = useDashboardCopy();

  const tiles: Tile[] = [
    {
      key: "hired",
      labelKey: "dashboard.kpi.hired",
      value: hired.toString(),
      hintKey: "dashboard.kpi.hired.hint",
      icon: UserCheck,
      tone: "accent",
    },
    {
      key: "active",
      labelKey: "dashboard.kpi.active",
      value: active.toString(),
      hintKey: "dashboard.kpi.active.hint",
      icon: CheckCircle2,
      tone: "accent",
    },
    {
      key: "pending",
      labelKey: "dashboard.kpi.pending",
      value: pending.toString(),
      hintKey: "dashboard.kpi.pending.hint",
      icon: Clock,
      tone: "primary",
    },
    {
      key: "build_to",
      labelKey: "dashboard.kpi.buildTo",
      value: buildToTotal.toString(),
      hintKey: "dashboard.kpi.buildTo.hint",
      icon: Target,
      tone: "primary",
    },
    {
      key: "still_needed",
      labelKey: "dashboard.kpi.stillNeeded",
      value: stillNeeded.toString(),
      hintKey: "dashboard.kpi.stillNeeded.hint",
      icon: Users,
      tone: "primary",
    },
    {
      key: "orientation",
      labelKey: "dashboard.kpi.showedAtOrientation",
      value: showedAtOrientation?.toString() ?? "—",
      hintKey: "dashboard.kpi.orientation.hint",
      icon: Clock,
      tone: "muted",
    },
    {
      key: "certified",
      labelKey: "dashboard.kpi.certified",
      value: certified?.toString() ?? "—",
      hintKey: "dashboard.kpi.certified.hint",
      icon: CheckCircle2,
      tone: "muted",
    },
  ];

  const toneClasses: Record<Tile["tone"], string> = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/10 text-accent",
    muted: "bg-muted text-muted-foreground",
  };

  return (
    <div className="space-y-3">
      <HiredFunnel
        hired={Number(hired)}
        active={Number(active)}
        pending={Number(pending)}
      />
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
                  {t(tile.hintKey)}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
