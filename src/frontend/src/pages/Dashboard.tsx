import type { Position, RosterSummary, StoreInfo } from "@/backend";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { StoreLogo } from "@/components/StoreLogo";
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
import { formatDateOnly } from "@/lib/format";
import { SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

/**
 * The dashboard hero banner: a navy panel with the red-and-white flag stripe,
 * the store's secondary logo at about 96px on phones and 120px from the small
 * breakpoint up, and the store name and opening date beside it. On phones the
 * logo is centered above the name and date; from the small breakpoint up it
 * sits on the left alongside them. When no secondary logo has been uploaded the
 * banner shows just the name and date, with no star fallback.
 */
function DashboardHero({ storeInfo }: { storeInfo: StoreInfo | null }) {
  const storeName = storeInfo?.locationName || storeInfo?.appName || "";
  const openingDate = storeInfo ? formatDateOnly(storeInfo.openingDate) : null;
  const hasOpeningDate = !!openingDate && openingDate !== "—";

  return (
    <section
      data-ocid="dashboard.hero"
      className="overflow-hidden rounded-lg bg-secondary text-secondary-foreground shadow-subtle"
    >
      <div className="flex flex-col items-center gap-4 px-5 py-6 text-center sm:flex-row sm:items-center sm:gap-6 sm:px-8 sm:py-7 sm:text-left">
        {/* The secondary logo sits on the left of the store name and date. It
            renders nothing when no secondary logo has been uploaded, so the
            banner falls back to just the name and date. */}
        <StoreLogo
          variant="secondary"
          className="h-24 shrink-0 sm:h-[120px]"
          title={storeName || "Roadie store"}
        />
        <div className="min-w-0">
          {storeName && (
            <h2 className="font-display text-2xl font-bold uppercase leading-tight tracking-wide text-white md:text-3xl">
              {storeName}
            </h2>
          )}
          {hasOpeningDate && (
            <p className="mt-1 text-sm text-white/80 md:text-base">
              <span className="font-display uppercase tracking-wider text-white/60">
                Opening
              </span>{" "}
              <span className="font-medium text-white">{openingDate}</span>
            </p>
          )}
        </div>
      </div>
      <div className="stripe-flag" aria-hidden="true" />
    </section>
  );
}

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

  const openRoster = (position: Position) => {
    setSelected(position);
    setRosterOpen(true);
  };

  return (
    <div className="space-y-6" data-ocid="dashboard.page">
      <DashboardHero storeInfo={storeInfo ?? null} />

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
          <OpeningTimeline
            events={schedule ?? []}
            openingDate={storeInfo?.openingDate ?? null}
          />

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
