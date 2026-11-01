import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, Target, UserCheck, Users } from "lucide-react";
import { useDashboardCopy } from "./copy";

interface Tile {
  key: string;
  labelKey: string;
  value: string;
  hintKey: string;
  icon: typeof Users;
  tone: "primary" | "accent" | "muted";
}

/** The five headline hiring tiles. */
export function KpiTiles({
  hired,
  buildToTotal,
  stillNeeded,
  showedAtOrientation,
  certified,
}: {
  hired: bigint;
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
    <div
      className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5"
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
  );
}
