import type { Position, RosterSummary } from "@/backend";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { KpiTiles } from "@/components/dashboard/KpiTiles";
import { OpeningTimeline } from "@/components/dashboard/OpeningTimeline";
import { PositionPanel } from "@/components/dashboard/PositionPanel";
import { PositionRosterDialog } from "@/components/dashboard/PositionRosterDialog";
import { useDashboardCopy } from "@/components/dashboard/copy";
import { Button } from "@/components/ui/button";
import { canArchive, useAccessState } from "@/hooks/useAccess";
import {
  useDashboard,
  useRosterSummary,
  useSchedule,
  useStoreInfo,
} from "@/hooks/useQueries";
import { useSeedWhenEmpty } from "@/hooks/useSeeding";
import { dateOnlyToDate } from "@/lib/format";
import { SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

export default function DashboardPage() {
  const { t } = useDashboardCopy();
  const access = useAccessState();
  const role = access.kind === "granted" ? access.grant.role : undefined;
  const canAdjust = canArchive(role);
  const canRehire = canArchive(role);

  const { data, isLoading, isError, refetch } = useDashboard();
  const { data: schedule } = useSchedule();
  const { data: storeInfo } = useStoreInfo();
  const { data: rosterSummary } = useRosterSummary();

  // A fresh install (or a store with no positions yet) is seeded once so the
  // dashboard shows the 18 seeded positions instead of an empty shell.
  const hasNoPositions =
    !!data && data.foh.length === 0 && data.boh.length === 0;
  useSeedWhenEmpty(!!data, hasNoPositions);

  const summaryByPosition = useMemo(() => {
    const map = new Map<string, RosterSummary>();
    for (const row of rosterSummary ?? []) {
      map.set(row.positionId.toString(), row);
    }
    return map;
  }, [rosterSummary]);

  const [adjustMode, setAdjustMode] = useState(false);
  const [selected, setSelected] = useState<Position | null>(null);
  const [rosterOpen, setRosterOpen] = useState(false);

  const openingDate = storeInfo ? dateOnlyToDate(storeInfo.openingDate) : null;

  const openRoster = (position: Position) => {
    setSelected(position);
    setRosterOpen(true);
  };

  return (
    <div className="space-y-6" data-ocid="dashboard.page">
      <PageHeader
        title={t("dashboard.title")}
        subtitle={t("dashboard.subtitle")}
        action={
          canAdjust ? (
            <Button
              type="button"
              variant={adjustMode ? "default" : "outline"}
              className="touch-target"
              aria-pressed={adjustMode}
              data-ocid="dashboard.adjust.toggle"
              onClick={() => setAdjustMode((on) => !on)}
            >
              <SlidersHorizontal className="mr-2 h-4 w-4" aria-hidden="true" />
              {adjustMode
                ? t("dashboard.adjust.done")
                : t("dashboard.adjust.mode")}
            </Button>
          ) : undefined
        }
      />

      {isLoading && <LoadingState label={t("dashboard.loading")} />}
      {isError && (
        <ErrorState
          message={t("dashboard.error")}
          onRetry={() => void refetch()}
        />
      )}

      {data && (
        <>
          <OpeningTimeline events={schedule ?? []} openingDate={openingDate} />

          <KpiTiles
            hired={data.hired}
            buildToTotal={data.buildToTotal}
            stillNeeded={data.stillNeeded}
            showedAtOrientation={data.showedAtOrientation}
            certified={data.certified}
          />

          {adjustMode && canAdjust && (
            <p
              className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground"
              data-ocid="dashboard.adjust.hint"
            >
              {t("dashboard.adjust.hint")}
            </p>
          )}

          {data.foh.length === 0 && data.boh.length === 0 ? (
            <EmptyState title={t("dashboard.empty")} />
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <PositionPanel
                titleKey="dashboard.section.foh"
                positions={data.foh}
                summaryByPosition={summaryByPosition}
                adjustMode={adjustMode}
                canAdjust={canAdjust}
                onOpenRoster={openRoster}
                ocid="dashboard.foh.section"
              />
              <PositionPanel
                titleKey="dashboard.section.boh"
                positions={data.boh}
                summaryByPosition={summaryByPosition}
                adjustMode={adjustMode}
                canAdjust={canAdjust}
                onOpenRoster={openRoster}
                ocid="dashboard.boh.section"
              />
            </div>
          )}
        </>
      )}

      <PositionRosterDialog
        position={selected}
        open={rosterOpen}
        onOpenChange={setRosterOpen}
        canRehire={canRehire}
      />
    </div>
  );
}
