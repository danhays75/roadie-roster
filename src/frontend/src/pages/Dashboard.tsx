import type { Alert, Position, RosterSummary, StoreInfo } from "@/backend";
import { EventKind, createActor } from "@/backend";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { StoreLogo } from "@/components/StoreLogo";
import {
  KpiTiles,
  type OrientationWindow,
} from "@/components/dashboard/KpiTiles";
import { OpeningTimeline } from "@/components/dashboard/OpeningTimeline";
import { PositionPanel } from "@/components/dashboard/PositionPanel";
import { PositionRosterDialog } from "@/components/dashboard/PositionRosterDialog";
import { useDashboardCopy } from "@/components/dashboard/copy";
import { usePaperworkIncompleteMap } from "@/components/roadie/RoadieTile";
import { Button } from "@/components/ui/button";
import { canArchive, useAccessState } from "@/hooks/useAccess";
import { useDemo } from "@/hooks/useDemo";
import {
  useDashboard,
  useRoadies,
  useRosterSummary,
  useSchedule,
  useStoreInfo,
} from "@/hooks/useQueries";
import { useSeedWhenEmpty } from "@/hooks/useSeeding";
import {
  dateOnlyToDate,
  formatDateOnly,
  pretendDateToInstant,
  timestampToDate,
} from "@/lib/format";
import { useActor } from "@caffeineai/core-infrastructure";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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

/** The backend alerts store, readable by Admin and Store Manager only. */
function useAlerts(enabled: boolean) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["alerts"],
    queryFn: async (): Promise<Alert[]> => {
      if (!actor) return [];
      return actor.listAlerts();
    },
    enabled: enabled && !!actor && !isFetching,
  });
}

/**
 * The current instant, refreshed on an interval. When demo mode supplies a
 * pretend date, that instant is returned instead of the real clock so the
 * orientation window follows the pretend date.
 */
function useNow(pretendInstant: number | null, intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return pretendInstant ?? now;
}

/**
 * The orientation window, derived from the schedule and the store's paperwork
 * due date. The window opens on the paperwork due date and closes on the final
 * sign-off date; the orientation session date marks the point after which
 * no-shows are counted. All three dates respect the demo "Pretend it's" date
 * through `now`.
 */
function useOrientationWindow(
  events: { kind: EventKind; start: bigint }[],
  paperworkDueDate: bigint | undefined,
  now: number,
): OrientationWindow {
  return useMemo(() => {
    const dueInstant = paperworkDueDate
      ? (dateOnlyToDate(paperworkDueDate)?.getTime() ?? null)
      : null;

    let orientationInstant: number | null = null;
    let signOffInstant: number | null = null;
    for (const event of events) {
      const date = timestampToDate(event.start);
      if (!date) continue;
      const time = date.getTime();
      if (event.kind === EventKind.orientation) {
        if (orientationInstant === null || time < orientationInstant) {
          orientationInstant = time;
        }
      } else if (event.kind === EventKind.signOff) {
        if (signOffInstant === null || time > signOffInstant) {
          signOffInstant = time;
        }
      }
    }

    const isOpen =
      dueInstant !== null &&
      now >= dueInstant &&
      (signOffInstant === null || now <= signOffInstant);

    return {
      isOpen,
      afterOrientation:
        orientationInstant !== null && now >= orientationInstant,
      afterSignOff: signOffInstant !== null && now >= signOffInstant,
    };
  }, [events, paperworkDueDate, now]);
}

/**
 * The dashboard alerts: a red "Paperwork incomplete" flag for every roadie past
 * the paperwork due date whose paperwork is not 100% complete, plus any
 * unacknowledged backend alerts. Rendered only for managers, who are the roles
 * that may read the check-off and the alerts store.
 */
function DashboardAlerts({
  paperworkNames,
  alerts,
}: {
  paperworkNames: string[];
  alerts: Alert[];
}) {
  const { t } = useDashboardCopy();
  const openAlerts = alerts.filter((alert) => !alert.acknowledged);
  if (paperworkNames.length === 0 && openAlerts.length === 0) return null;

  return (
    <section
      data-ocid="dashboard.alerts"
      className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4"
    >
      <h2 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-widest text-destructive">
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        {t("dashboard.alerts.title")}
      </h2>

      {paperworkNames.length > 0 && (
        <div
          data-ocid="dashboard.alerts.paperwork"
          className="rounded-md border border-destructive/30 bg-card px-3 py-2"
        >
          <p className="font-display text-xs font-semibold uppercase tracking-wider text-destructive">
            {t("dashboard.alerts.paperwork", { count: paperworkNames.length })}
          </p>
          <p className="mt-0.5 text-sm text-foreground">
            {paperworkNames.join(", ")}
          </p>
        </div>
      )}

      {openAlerts.map((alert) => (
        <p
          key={alert.id.toString()}
          data-ocid="dashboard.alerts.item"
          className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
        >
          {alert.message}
        </p>
      ))}
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
  const { data: roadies } = useRoadies();
  const { data: alerts } = useAlerts(canAdjust);

  // The orientation window follows the demo "Pretend it's" date when demo mode
  // supplies one, so the summary phases move with the pretend date.
  const demo = useDemo();
  const pretendInstant = useMemo(() => {
    if (!demo.enabled || !demo.pretendDate) return null;
    return pretendDateToInstant(demo.pretendDate)?.getTime() ?? null;
  }, [demo.enabled, demo.pretendDate]);
  const now = useNow(pretendInstant);
  const orientationWindow = useOrientationWindow(
    schedule ?? [],
    storeInfo?.paperworkDueDate,
    now,
  );

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

  // The paperwork-overdue flag is computed from the orientation check-off,
  // which only Admin and Store Manager may read.
  const paperworkFlags = usePaperworkIncompleteMap(roadies ?? [], canAdjust);
  const paperworkNames = useMemo(() => {
    if (!canAdjust) return [];
    return (roadies ?? [])
      .filter((roadie) => paperworkFlags.get(roadie.id.toString()))
      .map((roadie) => roadie.profile.preferredName || roadie.profile.name);
  }, [canAdjust, roadies, paperworkFlags]);

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

          <DashboardAlerts
            paperworkNames={paperworkNames}
            alerts={alerts ?? []}
          />

          <KpiTiles
            hired={data.hired}
            active={data.active}
            pending={data.pending}
            buildToTotal={data.buildToTotal}
            stillNeeded={data.stillNeeded}
            certified={data.certified}
            window={orientationWindow}
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
                showSplit={orientationWindow.isOpen}
                onOpenRoster={openRoster}
                ocid="dashboard.foh.section"
              />
              <PositionPanel
                titleKey="dashboard.section.boh"
                positions={data.boh}
                summaryByPosition={summaryByPosition}
                adjustMode={adjustMode}
                canAdjust={canAdjust}
                showSplit={orientationWindow.isOpen}
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
