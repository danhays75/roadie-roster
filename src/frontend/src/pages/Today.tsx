import type {
  GroupChangeNotice,
  MyCrewRoadieRow,
  MyGroupView,
  NextEventView,
  Roadie,
  ShiftBoardRoadie,
  ShiftCheckInSummary,
} from "@/backend";
import { Role, RosterState } from "@/backend";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { StatusBadge } from "@/components/StatusBadge";
import { AbsentAlertsList } from "@/components/alerts/AbsentAlertsList";
import { CheckInBoard } from "@/components/checkin/CheckInBoard";
import { useDashboardCopy } from "@/components/dashboard/copy";
import {
  type CardEntry,
  RoadieCardModal,
} from "@/components/roadie/RoadieCardModal";
import { RoadiePhoto } from "@/components/roadie/RoadiePhoto";
import { Button } from "@/components/ui/button";
import {
  canCheckIn,
  canSeeManagerToday,
  isTodayReadOnly,
  useAccessState,
} from "@/hooks/useAccess";
import {
  useDismissGroupChangeNotice,
  useGroupChangeNotices,
  useMyCrew,
  useMyGroup,
  useRoadies,
  useToday,
} from "@/hooks/useQueries";
import { formatTimestamp } from "@/lib/format";
import { Link } from "@tanstack/react-router";
import {
  BellRing,
  CalendarClock,
  ChevronRight,
  Clock,
  Loader2,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

/**
 * One dismissible "Your group changed" notice: the shift label, the added and
 * removed roadie names and the editor's name, with a Dismiss action that hides
 * it for the signed-in trainer.
 */
function GroupChangeNoticeCard({ notice }: { notice: GroupChangeNotice }) {
  const { t } = useDashboardCopy();
  const dismiss = useDismissGroupChangeNotice();
  const [error, setError] = useState<string | null>(null);

  return (
    <section
      data-ocid="today.notice.card"
      aria-label={t("groups.notice.title")}
      className="rounded-lg border border-primary/40 bg-primary/5 p-4 shadow-subtle"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <BellRing className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-sm font-bold uppercase tracking-widest text-foreground">
              {t("groups.notice.title")}
            </h2>
            <span
              data-ocid="today.notice.shift"
              className="inline-flex items-center rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
            >
              {notice.shiftLabel}
            </span>
          </div>
          {notice.addedNames.length > 0 && (
            <p
              data-ocid="today.notice.added"
              className="mt-2 text-sm text-foreground"
            >
              {t("groups.notice.added", {
                names: notice.addedNames.join(", "),
              })}
            </p>
          )}
          {notice.removedNames.length > 0 && (
            <p
              data-ocid="today.notice.removed"
              className="mt-1 text-sm text-foreground"
            >
              {t("groups.notice.removed", {
                names: notice.removedNames.join(", "),
              })}
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            {t("groups.notice.by", { name: notice.editorName })}
          </p>
          {error && (
            <p className="mt-1 text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="touch-target shrink-0"
          aria-label={t("groups.notice.dismiss")}
          data-ocid="today.notice.dismiss_button"
          disabled={dismiss.isPending}
          onClick={() => {
            setError(null);
            dismiss.mutate(notice.id, {
              onError: (err) =>
                setError(
                  err instanceof Error
                    ? err.message
                    : t("groups.notice.dismissError"),
                ),
            });
          }}
        >
          {dismiss.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <X className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      </div>
    </section>
  );
}

/** One roadie in the trainer's group: photo and name, tappable to open the card. */
function GroupRoadieCard({
  roadie,
  index,
  onOpen,
}: {
  roadie: ShiftBoardRoadie;
  index: number;
  onOpen: () => void;
}) {
  return (
    <li data-ocid={`today.myGroup.item.${index}`} className="h-full">
      <button
        type="button"
        data-ocid={`today.myGroup.item.${index}.link`}
        onClick={onOpen}
        className="group flex h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-card text-left shadow-subtle transition-smooth hover:-translate-y-0.5 hover:shadow-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <RoadiePhoto
          id={roadie.roadieId}
          name={roadie.name}
          className="aspect-[4/3] w-full rounded-none border-0 border-b-2 border-primary"
          iconClassName="h-8 w-8"
          ocid={`today.myGroup.item.${index}.photo`}
          fallback={
            <span
              className="flex h-full w-full items-center justify-center font-display text-2xl font-bold uppercase tracking-wide text-[#14284B]"
              aria-hidden="true"
            >
              {roadie.name.slice(0, 2).toUpperCase()}
            </span>
          }
        />
        <span className="flex min-w-0 flex-1 flex-col gap-1 p-3">
          <span className="truncate font-display text-sm font-semibold uppercase tracking-wide text-foreground">
            {roadie.name}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {roadie.positionCode}
          </span>
        </span>
      </button>
    </li>
  );
}

/**
 * One roadie in the caller's crew: photo, name, position, Pending/Active
 * status and paperwork "x of y", with a red "Absent today" tag when the roadie
 * is absent today and a red "Paperwork overdue" tag when their paperwork is
 * incomplete after the due date. Tapping the row opens the shared card pop-up.
 * No contact information is shown here.
 */
function MyCrewRow({
  row,
  index,
  onOpen,
}: {
  row: MyCrewRoadieRow;
  index: number;
  onOpen: () => void;
}) {
  const { t } = useDashboardCopy();
  const isPending = row.rosterState === RosterState.pending;

  return (
    <li data-ocid={`today.myCrew.item.${index}`}>
      <button
        type="button"
        data-ocid={`today.myCrew.item.${index}.link`}
        onClick={onOpen}
        aria-label={`Open ${row.name}'s card`}
        className="group flex min-h-[44px] w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left shadow-subtle transition-smooth hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <RoadiePhoto
          id={row.roadieId}
          name={row.name}
          demoPhotoUrl={row.demoPhotoUrl}
          className="h-12 w-12 shrink-0"
          iconClassName="h-6 w-6"
          ocid={`today.myCrew.item.${index}.photo`}
          fallback={
            <span
              className="flex h-full w-full items-center justify-center font-display text-base font-bold uppercase tracking-wide text-[#14284B]"
              aria-hidden="true"
            >
              {row.name.slice(0, 2).toUpperCase()}
            </span>
          }
        />

        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span
            data-ocid={`today.myCrew.item.${index}.name`}
            className="truncate font-display text-sm font-semibold uppercase tracking-wide text-foreground"
          >
            {row.name}
          </span>
          <span
            data-ocid={`today.myCrew.item.${index}.position`}
            className="truncate text-xs text-muted-foreground"
          >
            {row.positionName}
          </span>
          <span className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <StatusBadge
              tone={isPending ? "pending" : "hired"}
              ocid={`today.myCrew.item.${index}.status`}
            >
              {isPending
                ? t("roster.filter.pending")
                : t("roster.filter.active")}
            </StatusBadge>
            <span
              data-ocid={`today.myCrew.item.${index}.paperwork`}
              className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground"
            >
              {`${Number(row.paperworkDone)} of ${Number(row.paperworkTotal)}`}
            </span>
            {row.absentToday && (
              <StatusBadge
                tone="danger"
                ocid={`today.myCrew.item.${index}.absent`}
              >
                Absent today
              </StatusBadge>
            )}
            {row.paperworkOverdue && (
              <StatusBadge
                tone="danger"
                ocid={`today.myCrew.item.${index}.overdue`}
              >
                Paperwork overdue
              </StatusBadge>
            )}
          </span>
        </span>

        <ChevronRight
          className="h-4 w-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      </button>
    </li>
  );
}

/**
 * The caller's own crew: the "My crew · N roadies" heading and one row per
 * roadie with their photo, name, position, Pending/Active status and paperwork
 * "x of y", plus a red "Absent today" tag when absent and a red "Paperwork
 * overdue" tag when overdue. Tapping a row opens the shared card pop-up. The
 * section renders nothing when the caller owns no crew, so it is safe to mount
 * for any role.
 */
function MyCrewSection() {
  const { data: crew, isLoading, isError, refetch } = useMyCrew();
  const { data: allRoadies } = useRoadies();
  const [cardIndex, setCardIndex] = useState<number | null>(null);

  const roadieById = useMemo(() => {
    const map = new Map<string, Roadie>();
    for (const roadie of allRoadies ?? []) {
      map.set(roadie.id.toString(), roadie);
    }
    return map;
  }, [allRoadies]);

  const crewRoadies = crew?.roadies ?? [];

  // The card pop-up needs full Roadie records; a crew row whose roadie is not
  // in the roster read is skipped, so the modal never opens on a missing entry.
  const entries: CardEntry[] = useMemo(() => {
    const list: CardEntry[] = [];
    for (const row of crewRoadies) {
      const roadie = roadieById.get(row.roadieId.toString());
      if (roadie) list.push({ key: roadie.id.toString(), roadie });
    }
    return list;
  }, [crewRoadies, roadieById]);

  const entryIndexById = useMemo(() => {
    const map = new Map<string, number>();
    entries.forEach((entry, index) => map.set(entry.key, index));
    return map;
  }, [entries]);

  if (!isLoading && !isError && !crew) return null;

  return (
    <section className="space-y-4" data-ocid="today.myCrew.section">
      <h2 className="font-display text-xl font-bold uppercase tracking-wide text-foreground">
        {`My crew · ${crewRoadies.length} roadies`}
      </h2>

      {isLoading && (
        <LoadingState
          label="Loading your crew…"
          ocid="today.myCrew.loading_state"
        />
      )}

      {isError && (
        <ErrorState
          message="We couldn't load your crew."
          onRetry={() => void refetch()}
          ocid="today.myCrew.error_state"
        />
      )}

      {!isLoading && !isError && crewRoadies.length === 0 && (
        <EmptyState
          title="No roadies in your crew yet."
          ocid="today.myCrew.empty_state"
        />
      )}

      {!isLoading && !isError && crewRoadies.length > 0 && (
        <ul className="space-y-3" data-ocid="today.myCrew.list">
          {crewRoadies.map((row, index) => (
            <MyCrewRow
              key={row.roadieId.toString()}
              row={row}
              index={index}
              onOpen={() =>
                setCardIndex(
                  entryIndexById.get(row.roadieId.toString()) ?? null,
                )
              }
            />
          ))}
        </ul>
      )}

      <RoadieCardModal
        entries={entries}
        index={cardIndex ?? 0}
        open={cardIndex !== null}
        onOpenChange={(next) => {
          if (!next) setCardIndex(null);
        }}
        onIndexChange={setCardIndex}
      />
    </section>
  );
}

/**
 * The trainer's own group for the current or next shift: the shift label, the
 * filled-of-capacity count, the roadies' photos and names, and a link to all
 * groups. Tapping a roadie opens the shared card pop-up.
 */
function MyGroupSection({ group }: { group: MyGroupView }) {
  const { t } = useDashboardCopy();
  const { data: allRoadies } = useRoadies();
  const [cardIndex, setCardIndex] = useState<number | null>(null);

  const roadieById = useMemo(() => {
    const map = new Map<string, Roadie>();
    for (const roadie of allRoadies ?? []) {
      map.set(roadie.id.toString(), roadie);
    }
    return map;
  }, [allRoadies]);

  const groupRoadies = group.roadies;
  const entries: CardEntry[] = useMemo(() => {
    const list: CardEntry[] = [];
    for (const boardRoadie of groupRoadies) {
      const roadie = roadieById.get(boardRoadie.roadieId.toString());
      if (roadie) list.push({ key: roadie.id.toString(), roadie });
    }
    return list;
  }, [groupRoadies, roadieById]);

  // Map each board roadie to its position in `entries`, so a card opens the
  // matching entry even if a roadie is missing from the visible list.
  const entryIndexById = useMemo(() => {
    const map = new Map<string, number>();
    entries.forEach((entry, index) => map.set(entry.key, index));
    return map;
  }, [entries]);

  return (
    <section className="space-y-4" data-ocid="today.myGroup.section">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide text-foreground">
            {t("today.myGroup.shift", { shift: group.shiftLabel })}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("today.myGroup.capacity", {
              count: groupRoadies.length,
              capacity: Number(group.capacity),
            })}
          </p>
        </div>
        <Button asChild variant="outline" className="touch-target">
          <Link to="/groups" data-ocid="today.myGroup.view_all_link">
            <Users className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("today.myGroup.viewAll")}
          </Link>
        </Button>
      </div>

      {groupRoadies.length === 0 ? (
        <EmptyState
          title={t("today.myGroup.empty")}
          ocid="today.myGroup.empty_state"
        />
      ) : (
        <ul
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
          data-ocid="today.myGroup.list"
        >
          {groupRoadies.map((roadie, index) => (
            <GroupRoadieCard
              key={roadie.roadieId.toString()}
              roadie={roadie}
              index={index}
              onOpen={() =>
                setCardIndex(
                  entryIndexById.get(roadie.roadieId.toString()) ?? null,
                )
              }
            />
          ))}
        </ul>
      )}

      <RoadieCardModal
        entries={entries}
        index={cardIndex ?? 0}
        open={cardIndex !== null}
        onOpenChange={(next) => {
          if (!next) setCardIndex(null);
        }}
        onIndexChange={setCardIndex}
      />
    </section>
  );
}

/**
 * The trainer-facing Today content: the undismissed "Your group changed"
 * notices at the top, then the trainer check-in board for the caller's own
 * group on the current or next shift, then the group's roadie tiles. Only
 * mounted for roles that may read the shift boards, so the group and notice
 * reads never run for a role the backend would reject.
 */
function TrainerToday({ mayCheckIn }: { mayCheckIn: boolean }) {
  const { t } = useDashboardCopy();
  const { data: group, isLoading, isError, refetch } = useMyGroup();
  const { data: notices } = useGroupChangeNotices();
  const { data: today } = useToday();

  return (
    <>
      {(notices ?? []).map((notice) => (
        <GroupChangeNoticeCard key={notice.id.toString()} notice={notice} />
      ))}

      {isLoading && (
        <LoadingState
          label={t("today.myGroup.loading")}
          ocid="today.myGroup.loading_state"
        />
      )}

      {isError && (
        <ErrorState
          message={t("today.myGroup.error")}
          onRetry={() => void refetch()}
          ocid="today.myGroup.error_state"
        />
      )}

      {!isLoading && !isError && group && (
        <>
          {mayCheckIn && (
            <CheckInBoard
              eventId={group.eventId}
              shift={group.shift}
              shiftLabel={group.shiftLabel}
            />
          )}
          <MyGroupSection group={group} />
        </>
      )}

      {!isLoading && !isError && !group && today?.nextEvent && (
        <NextEventCard event={today.nextEvent} />
      )}

      {!isLoading && !isError && !group && !today?.nextEvent && (
        <section
          data-ocid="today.placeholder"
          className="rounded-lg border border-dashed border-border bg-card p-8 text-center"
        >
          <h2 className="font-display text-xl font-semibold uppercase tracking-wide">
            {t("today.noGroup.title")}
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            {t("today.noGroup.body")}
          </p>
        </section>
      )}
    </>
  );
}

/** Format a millisecond span as a compact "2h 15m" / "45m" countdown. */
function formatCountdown(ms: bigint): string {
  const totalMinutes = Math.max(0, Math.floor(Number(ms) / 60_000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * The next upcoming event with a live countdown, shown when no shift is
 * scheduled today. The countdown is derived from the backend's `startsInMs`
 * so it respects the demo "Pretend it's" date.
 */
function NextEventCard({ event }: { event: NextEventView }) {
  const { t } = useDashboardCopy();
  const startsInMs = event.startsInMs;
  const happeningNow = startsInMs <= 0n;

  return (
    <section
      data-ocid="today.nextEvent.card"
      className="rounded-lg border border-border bg-card p-6 shadow-subtle"
    >
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <CalendarClock className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {t("today.nextEvent.title")}
          </p>
          <h2
            data-ocid="today.nextEvent.name"
            className="mt-1 truncate font-display text-xl font-bold uppercase tracking-wide text-foreground"
          >
            {event.name}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("today.nextEvent.startsAt", {
              time: formatTimestamp(event.start),
            })}
          </p>
          <p
            data-ocid="today.nextEvent.countdown"
            className="mt-3 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/5 px-3 py-1 font-display text-sm font-semibold uppercase tracking-wide text-primary"
          >
            <Clock className="h-4 w-4" aria-hidden="true" />
            {happeningNow
              ? t("today.nextEvent.now")
              : t("today.nextEvent.startsIn", {
                  time: formatCountdown(startsInMs),
                })}
          </p>
        </div>
      </div>
    </section>
  );
}

/**
 * One shift's check-in summary row for managers: the shift label, the
 * "x / y checked in" count and a tappable link that opens that shift's
 * check-in board on the Groups page.
 */
function ShiftSummaryRow({
  summary,
  index,
}: {
  summary: ShiftCheckInSummary;
  index: number;
}) {
  const { t } = useDashboardCopy();
  const checkedIn = Number(summary.present) + Number(summary.late);
  const total = Number(summary.total);

  return (
    <li data-ocid={`today.shifts.item.${index}`}>
      <Link
        to="/groups"
        data-ocid={`today.shifts.item.${index}.link`}
        className="group flex min-h-[44px] items-center gap-4 rounded-lg border border-border bg-card p-4 shadow-subtle transition-smooth hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-display text-sm font-bold uppercase text-primary">
          {summary.shift === "am" ? "AM" : "PM"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-base font-semibold uppercase tracking-wide text-foreground">
            {summary.shiftLabel}
          </span>
          <span
            data-ocid={`today.shifts.item.${index}.count`}
            className="mt-0.5 block text-sm text-muted-foreground"
          >
            {t("today.shifts.checkedIn", { checkedIn, total })}
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary">
          {t("today.shifts.open")}
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </Link>
    </li>
  );
}

/**
 * One shift's read-only attendance summary for Leadership and Visiting
 * Managers: the shift label and the present, late and absent counts.
 */
function ShiftAttendanceRow({
  summary,
  index,
}: {
  summary: ShiftCheckInSummary;
  index: number;
}) {
  const { t } = useDashboardCopy();

  return (
    <li
      data-ocid={`today.shifts.item.${index}`}
      className="rounded-lg border border-border bg-card p-4 shadow-subtle"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-display text-base font-semibold uppercase tracking-wide text-foreground">
          {summary.shiftLabel}
        </span>
        <span
          data-ocid={`today.shifts.item.${index}.read_only`}
          className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
        >
          {t("today.shifts.readOnly")}
        </span>
      </div>
      <p
        data-ocid={`today.shifts.item.${index}.summary`}
        className="mt-2 text-sm text-muted-foreground"
      >
        {t("today.shifts.summary", {
          present: Number(summary.present),
          late: Number(summary.late),
          absent: Number(summary.absent),
        })}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("today.shifts.total", { total: Number(summary.total) })}
      </p>
    </li>
  );
}

/**
 * The manager-facing Today content: the caller's own crew (when they own one)
 * first, then the absent alerts list, then today's shifts with an "x / y
 * checked in" count per shift, each tappable to open that shift's check-in
 * board on the Groups page.
 */
function ManagerToday({ role }: { role: Role | undefined }) {
  const { t } = useDashboardCopy();
  const { data: today, isLoading, isError, refetch } = useToday();
  const summaries = today?.shiftSummaries ?? [];

  return (
    <>
      <MyCrewSection />

      <AbsentAlertsList role={role} />

      <section className="space-y-4" data-ocid="today.shifts.section">
        <h2 className="font-display text-xl font-bold uppercase tracking-wide text-foreground">
          {t("today.shifts.title")}
        </h2>

        {isLoading && (
          <LoadingState
            label={t("today.loading")}
            ocid="today.shifts.loading_state"
          />
        )}

        {isError && (
          <ErrorState
            message={t("today.error")}
            onRetry={() => void refetch()}
            ocid="today.shifts.error_state"
          />
        )}

        {!isLoading && !isError && summaries.length === 0 && (
          <EmptyState
            title={t("today.shifts.empty")}
            ocid="today.shifts.empty_state"
          />
        )}

        {!isLoading && !isError && summaries.length > 0 && (
          <ul className="space-y-3" data-ocid="today.shifts.list">
            {summaries.map((summary, index) => (
              <ShiftSummaryRow
                key={`${summary.eventId.toString()}-${summary.shift}`}
                summary={summary}
                index={index}
              />
            ))}
          </ul>
        )}
      </section>

      {!isLoading && !isError && today?.nextEvent && summaries.length === 0 && (
        <NextEventCard event={today.nextEvent} />
      )}
    </>
  );
}

/**
 * The read-only Today content for Leadership and Visiting Managers: today's
 * attendance summary per shift with present, late and absent counts, plus the
 * next upcoming event when no shift is scheduled today.
 */
function ReadOnlyToday() {
  const { t } = useDashboardCopy();
  const { data: today, isLoading, isError, refetch } = useToday();
  const summaries = today?.shiftSummaries ?? [];

  return (
    <section className="space-y-4" data-ocid="today.shifts.section">
      <h2 className="font-display text-xl font-bold uppercase tracking-wide text-foreground">
        {t("today.shifts.title")}
      </h2>

      {isLoading && (
        <LoadingState
          label={t("today.loading")}
          ocid="today.shifts.loading_state"
        />
      )}

      {isError && (
        <ErrorState
          message={t("today.error")}
          onRetry={() => void refetch()}
          ocid="today.shifts.error_state"
        />
      )}

      {!isLoading && !isError && summaries.length === 0 && (
        <EmptyState
          title={t("today.shifts.empty")}
          ocid="today.shifts.empty_state"
        />
      )}

      {!isLoading && !isError && summaries.length > 0 && (
        <ul className="space-y-3" data-ocid="today.shifts.list">
          {summaries.map((summary, index) => (
            <ShiftAttendanceRow
              key={`${summary.eventId.toString()}-${summary.shift}`}
              summary={summary}
              index={index}
            />
          ))}
        </ul>
      )}

      {!isLoading && !isError && today?.nextEvent && summaries.length === 0 && (
        <NextEventCard event={today.nextEvent} />
      )}
    </section>
  );
}

/**
 * The Today page. A trainer sees the check-in board for their own group on the
 * current or next shift — one row per roadie with Present / Late / Absent — plus
 * their roadies' photos and names and any undismissed "Your group changed"
 * notices at the top. Admin, Store Manager and Training Manager see the absent
 * alerts list first, then today's shifts with an "x / y checked in" count per
 * shift. Leadership and Visiting Managers see a read-only attendance summary per
 * shift. When no shift is scheduled today, the next upcoming event and a
 * countdown are shown.
 */
export default function TodayPage() {
  const { t } = useDashboardCopy();
  const access = useAccessState();
  const role = access.kind === "granted" ? access.grant.role : undefined;
  const isTrainer = role === Role.trainer;
  const mayCheckIn = canCheckIn(role);
  const maySeeManager = canSeeManagerToday(role);
  const readOnly = isTodayReadOnly(role);

  return (
    <div className="space-y-6" data-ocid="today.page">
      <PageHeader title={t("today.title")} subtitle={t("app.tagline")} />

      {isTrainer ? (
        <TrainerToday mayCheckIn={mayCheckIn} />
      ) : maySeeManager ? (
        <ManagerToday role={role} />
      ) : readOnly ? (
        <ReadOnlyToday />
      ) : (
        <section
          data-ocid="today.placeholder"
          className="rounded-lg border border-dashed border-border bg-card p-8 text-center"
        >
          <h2 className="font-display text-xl font-semibold uppercase tracking-wide">
            {t("today.placeholder.title")}
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            {t("today.placeholder.body")}
          </p>
        </section>
      )}
    </div>
  );
}
