import {
  type EventId,
  EventKind,
  type RoadieId,
  type ScheduleEvent,
} from "@/backend";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import {
  DEFAULT_TIME_ZONE,
  calendarInTimeZone,
} from "@/components/approvals/timeZone";
import { ArchiveNoShowsDialog } from "@/components/orientation/ArchiveNoShowsDialog";
import { MoveSessionDialog } from "@/components/orientation/MoveSessionDialog";
import { OrientationRoadieRow } from "@/components/orientation/OrientationRoadieRow";
import { OverridePresentDialog } from "@/components/orientation/OverridePresentDialog";
import { UnassignedSection } from "@/components/orientation/UnassignedSection";
import { UniformCheckoffDialog } from "@/components/orientation/UniformCheckoffDialog";
import { fill, useOrientationCopy } from "@/components/orientation/copy";
import { useArchiveRoadie } from "@/components/roadie/useRoadieActions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { canArchive, canOrientation, useAccessState } from "@/hooks/useAccess";
import {
  useArchiveNoShows,
  useMarkPresent,
  useOrientationSessionView,
  useOrientationSessions,
  useSchedule,
  useStoreInfo,
  useUndoPresent,
} from "@/hooks/useQueries";
import { formatTimestamp } from "@/lib/format";
import { Archive, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

/** The orientation sessions, soonest first. */
function orientationSessions(schedule: ScheduleEvent[]): ScheduleEvent[] {
  return schedule
    .filter((event) => event.kind === EventKind.orientation)
    .sort((a, b) => Number(a.start - b.start));
}

/**
 * The session to select by default: today's session in the store's time zone,
 * otherwise the next upcoming one, otherwise the most recent past one.
 */
function defaultSessionId(sessions: ScheduleEvent[], timeZone: string): string {
  if (sessions.length === 0) return "";
  const now = new Date();
  const today = calendarInTimeZone(now, timeZone);
  const sameDay = sessions.find((session) => {
    const day = calendarInTimeZone(
      new Date(Number(session.start / 1_000_000n)),
      timeZone,
    );
    return (
      day.year === today.year &&
      day.month === today.month &&
      day.day === today.day
    );
  });
  if (sameDay) return sameDay.id.toString();
  const upcoming = sessions.find(
    (session) => Number(session.start / 1_000_000n) >= now.getTime(),
  );
  if (upcoming) return upcoming.id.toString();
  return sessions[sessions.length - 1].id.toString();
}

export default function OrientationPage() {
  const c = useOrientationCopy();
  const access = useAccessState();
  const role = access.kind === "granted" ? access.grant.role : undefined;
  const canManage = canArchive(role);
  const mayView = canOrientation(role);
  // Marking a roadie present is allowed for every role that may view the
  // orientation surface (admin, store manager, training manager, visiting
  // manager); the archive, move, undo and override controls stay Admin/Store
  // Manager only via canManage.
  const canPresent = mayView;

  const { data: storeInfo } = useStoreInfo();
  const timeZone = storeInfo?.timeZone || DEFAULT_TIME_ZONE;
  const { data: schedule } = useSchedule();
  const { data: sessionOptions } = useOrientationSessions(mayView);

  const sessions = useMemo(
    () => orientationSessions(schedule ?? []),
    [schedule],
  );

  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [uniformRoadie, setUniformRoadie] = useState<{
    id: RoadieId;
    name: string;
  } | null>(null);
  const [moveRoadie, setMoveRoadie] = useState<{
    id: RoadieId;
    name: string;
  } | null>(null);
  const [overrideRoadie, setOverrideRoadie] = useState<{
    id: RoadieId;
    name: string;
  } | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);

  // Default to today's or the next session once the schedule loads, unless the
  // manager has already chosen one.
  useEffect(() => {
    if (selectedId === "" && sessions.length > 0) {
      setSelectedId(defaultSessionId(sessions, timeZone));
    }
  }, [selectedId, sessions, timeZone]);

  const selectedEventId: EventId | undefined = selectedId
    ? BigInt(selectedId)
    : undefined;

  const {
    data: view,
    isLoading,
    isError,
    refetch,
  } = useOrientationSessionView(selectedEventId, mayView);

  // Several managers may check roadies in at once, so the session view is
  // polled every 10 seconds to pick up other managers' marks. Every role that
  // may read the session view polls, not only those who may write.
  useEffect(() => {
    if (!mayView) return;
    const timer = window.setInterval(() => {
      void refetch();
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [mayView, refetch]);

  const markPresent = useMarkPresent();
  const undoPresent = useUndoPresent();
  const archiveNoShows = useArchiveNoShows();
  const archiveRoadie = useArchiveRoadie();

  const roadies = view?.roadies ?? [];
  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return roadies;
    return roadies.filter((row) => {
      const haystack = `${row.name} ${row.positionName} ${row.crewName ?? ""}`;
      return haystack.toLowerCase().includes(q);
    });
  }, [roadies, q]);

  const noShows = useMemo(() => roadies.filter((row) => row.noShow), [roadies]);

  const presentCount = Number(view?.presentCount ?? 0n);
  const assignedCount = Number(view?.assignedCount ?? 0n);

  const onMarkPresent = (roadieId: RoadieId) => {
    if (selectedEventId === undefined) return;
    markPresent.mutate({ roadieId, eventId: selectedEventId });
  };

  const onUndoPresent = (roadieId: RoadieId) => {
    if (selectedEventId === undefined) return;
    undoPresent.mutate({ roadieId, eventId: selectedEventId });
  };

  const onArchiveIncomplete = (roadieId: RoadieId) => {
    archiveRoadie.mutate({
      id: roadieId,
      reason: { __kind__: "paperworkIncomplete", paperworkIncomplete: null },
    });
  };

  return (
    <div className="space-y-6" data-ocid="orientation.page">
      <PageHeader title={c.title} subtitle={c.subtitle} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full space-y-1.5 sm:max-w-sm">
          <Label htmlFor="orientation-session">{c.sessionLabel}</Label>
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger
              id="orientation-session"
              data-ocid="orientation.session.select"
              className="touch-target w-full"
            >
              <SelectValue placeholder={c.sessionPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {sessions.map((session) => (
                <SelectItem
                  key={session.id.toString()}
                  value={session.id.toString()}
                >
                  {session.name} · {formatTimestamp(session.start, timeZone)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{c.sessionHint}</p>
        </div>

        {canManage && (
          <Button
            type="button"
            variant="destructive"
            className="touch-target"
            data-ocid="orientation.archive_no_shows_button"
            disabled={noShows.length === 0 || archiveNoShows.isPending}
            onClick={() => setArchiveOpen(true)}
          >
            {archiveNoShows.isPending ? (
              <Loader2
                className="mr-2 h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Archive className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            {c.archiveNoShows}
          </Button>
        )}
      </div>

      {sessions.length === 0 && (
        <EmptyState
          title={c.noSessions}
          ocid="orientation.no_sessions.empty_state"
        />
      )}

      {sessions.length > 0 && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full sm:max-w-sm">
              <label htmlFor="orientation-search" className="sr-only">
                {c.searchLabel}
              </label>
              <Input
                id="orientation-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={c.searchPlaceholder}
                data-ocid="orientation.search_input"
                className="touch-target"
              />
            </div>
            <p
              data-ocid="orientation.present_count"
              className="font-display text-sm font-bold uppercase tracking-widest text-muted-foreground"
            >
              {fill(c.presentCount, {
                present: presentCount,
                total: assignedCount,
              })}
            </p>
          </div>

          {isLoading && <LoadingState label={c.loading} />}
          {isError && (
            <ErrorState message={c.error} onRetry={() => void refetch()} />
          )}

          {!isLoading && !isError && filtered.length === 0 && (
            <EmptyState title={c.empty} ocid="orientation.empty_state" />
          )}

          {!isLoading && !isError && filtered.length > 0 && (
            <ul className="space-y-3" data-ocid="orientation.list">
              {filtered.map((row, index) => (
                <OrientationRoadieRow
                  key={row.roadieId.toString()}
                  row={row}
                  index={index}
                  canManage={canManage}
                  canPresent={canPresent}
                  canOverride={canManage}
                  presentPending={
                    markPresent.isPending &&
                    markPresent.variables?.roadieId === row.roadieId
                  }
                  onMarkPresent={onMarkPresent}
                  onUndoPresent={onUndoPresent}
                  onArchiveIncomplete={onArchiveIncomplete}
                  onOverride={(roadieId) =>
                    setOverrideRoadie({ id: roadieId, name: row.name })
                  }
                  onMove={(roadieId) =>
                    setMoveRoadie({ id: roadieId, name: row.name })
                  }
                  onOpenUniform={(roadieId) =>
                    setUniformRoadie({ id: roadieId, name: row.name })
                  }
                />
              ))}
            </ul>
          )}
        </>
      )}

      {mayView && (
        <UnassignedSection
          sessions={sessionOptions ?? []}
          timeZone={timeZone}
          canManage={canManage}
          enabled={mayView}
        />
      )}

      <UniformCheckoffDialog
        roadieId={uniformRoadie?.id}
        roadieName={uniformRoadie?.name ?? ""}
        open={uniformRoadie !== null}
        onOpenChange={(open) => {
          if (!open) setUniformRoadie(null);
        }}
      />

      <MoveSessionDialog
        roadieId={moveRoadie?.id}
        roadieName={moveRoadie?.name ?? ""}
        currentEventId={selectedEventId}
        sessions={sessions}
        timeZone={timeZone}
        open={moveRoadie !== null}
        onOpenChange={(open) => {
          if (!open) setMoveRoadie(null);
        }}
      />

      <OverridePresentDialog
        roadieId={overrideRoadie?.id}
        roadieName={overrideRoadie?.name ?? ""}
        eventId={selectedEventId}
        open={overrideRoadie !== null}
        onOpenChange={(open) => {
          if (!open) setOverrideRoadie(null);
        }}
      />

      <ArchiveNoShowsDialog
        eventId={selectedEventId}
        names={noShows.map((row) => row.name)}
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
      />
    </div>
  );
}
