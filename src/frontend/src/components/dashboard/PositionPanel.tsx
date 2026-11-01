import type { Position, RosterSummary } from "@/backend";
import { RoadieStatus } from "@/backend";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ChevronRight, Loader2, Minus, Plus } from "lucide-react";
import { useState } from "react";
import { useDashboardCopy } from "./copy";
import { useAdjustBuildTo, useRosterForPosition } from "./hooks";

type AdjustField = "opening" | "afterOpening";

function AdjustStepper({
  label,
  value,
  disabled,
  onDelta,
  ocid,
}: {
  label: string;
  value: number;
  disabled: boolean;
  onDelta: (delta: bigint) => void;
  ocid: string;
}) {
  const { t } = useDashboardCopy();
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t("dashboard.adjust.decrease", { label })}
          data-ocid={`${ocid}.minus_button`}
          className="touch-target"
          disabled={disabled || value <= 0}
          onClick={() => onDelta(-1n)}
        >
          <Minus className="h-4 w-4" aria-hidden="true" />
        </Button>
        <span className="w-8 text-center font-display text-base font-bold tabular-nums">
          {value}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t("dashboard.adjust.increase", { label })}
          data-ocid={`${ocid}.plus_button`}
          className="touch-target"
          disabled={disabled}
          onClick={() => onDelta(1n)}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

function PositionRow({
  position,
  summary,
  adjustMode,
  canAdjust,
  onOpenRoster,
}: {
  position: Position;
  summary?: RosterSummary;
  adjustMode: boolean;
  canAdjust: boolean;
  onOpenRoster: (position: Position) => void;
}) {
  const { t } = useDashboardCopy();
  const { data: roster } = useRosterForPosition(position.id);
  const adjust = useAdjustBuildTo();
  const [error, setError] = useState<string | null>(null);

  // On-hand and open spots come from the backend roster summary; the position's
  // own roster read is the fallback while the summary is still loading.
  const rosterOnHand = (roster ?? []).filter(
    (r) => r.status !== RoadieStatus.archived,
  ).length;
  const onHand = summary ? Number(summary.onHand) : rosterOnHand;
  const target = summary
    ? Number(summary.buildTo)
    : Number(position.openingBuildTo);
  const pct =
    target > 0 ? Math.min(100, Math.round((onHand / target) * 100)) : 0;
  const needed = target - onHand;
  const openSpots = summary ? Number(summary.openSpots) : Math.max(0, needed);
  const over = needed < 0;

  const applyDelta = (field: AdjustField, delta: bigint) => {
    setError(null);
    adjust.mutate(
      {
        positionId: position.id,
        openingDelta: field === "opening" ? delta : 0n,
        afterOpeningDelta: field === "afterOpening" ? delta : 0n,
      },
      {
        onError: (err) =>
          setError(
            err instanceof Error ? err.message : t("dashboard.adjust.error"),
          ),
      },
    );
  };

  return (
    <li
      data-ocid="dashboard.position.item"
      className="rounded-md border border-border bg-card p-3"
    >
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          data-ocid="dashboard.position.open_button"
          onClick={() => onOpenRoster(position)}
          className="group flex min-w-0 flex-1 items-center gap-2 rounded text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span className="min-w-0">
            <span className="block truncate font-display text-sm font-semibold uppercase tracking-wide text-foreground group-hover:text-primary">
              {position.name}
            </span>
            <span className="block text-xs text-muted-foreground">
              {t("dashboard.position.onHandOf", {
                onHand,
                target,
              })}
            </span>
          </span>
          <ChevronRight
            className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
            aria-hidden="true"
          />
        </button>

        <span
          data-ocid="dashboard.position.needed"
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 font-display text-[11px] font-semibold uppercase tracking-wider",
            over
              ? "bg-accent/10 text-accent"
              : needed === 0
                ? "bg-muted text-muted-foreground"
                : "bg-primary/10 text-primary",
          )}
        >
          {over
            ? t("dashboard.position.over", { count: Math.abs(needed) })
            : openSpots === 0
              ? t("dashboard.position.filled")
              : t("dashboard.position.needed", { count: openSpots })}
        </span>
      </div>

      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        tabIndex={0}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t("dashboard.position.progressLabel", {
          name: position.name,
          onHand,
          target,
        })}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all",
            over ? "bg-accent" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      {adjustMode && canAdjust && (
        <div
          className="mt-3 space-y-2 rounded-md border border-border bg-muted/30 p-3"
          data-ocid="dashboard.adjust.panel"
        >
          <AdjustStepper
            label={t("dashboard.adjust.opening")}
            value={Number(position.openingBuildTo)}
            disabled={adjust.isPending}
            onDelta={(delta) => applyDelta("opening", delta)}
            ocid="dashboard.adjust.opening"
          />
          <AdjustStepper
            label={t("dashboard.adjust.afterOpening")}
            value={Number(position.afterOpeningBuildTo)}
            disabled={adjust.isPending}
            onDelta={(delta) => applyDelta("afterOpening", delta)}
            ocid="dashboard.adjust.after_opening"
          />
          {adjust.isPending && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              {t("dashboard.adjust.saving")}
            </p>
          )}
          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

/** One house panel (front of house / back of house) with its position rows. */
export function PositionPanel({
  titleKey,
  positions,
  summaryByPosition,
  adjustMode,
  canAdjust,
  onOpenRoster,
  ocid,
}: {
  titleKey: string;
  positions: Position[];
  summaryByPosition: Map<string, RosterSummary>;
  adjustMode: boolean;
  canAdjust: boolean;
  onOpenRoster: (position: Position) => void;
  ocid: string;
}) {
  const { t } = useDashboardCopy();
  return (
    <Card
      data-ocid={ocid}
      className="rounded-lg border-border py-5 shadow-subtle"
    >
      <CardContent className="space-y-3 px-5">
        <h2 className="font-display text-lg font-bold uppercase tracking-wide text-foreground">
          {t(titleKey)}
        </h2>
        {positions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("dashboard.panel.empty")}
          </p>
        ) : (
          <ul className="space-y-2">
            {positions.map((position) => (
              <PositionRow
                key={position.id.toString()}
                position={position}
                summary={summaryByPosition.get(position.id.toString())}
                adjustMode={adjustMode}
                canAdjust={canAdjust}
                onOpenRoster={onOpenRoster}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
