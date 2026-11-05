import type { DateOnly, EventKind, ScheduleEvent } from "@/backend";
import { EventKind as EventKindEnum } from "@/backend";
import { Card, CardContent } from "@/components/ui/card";
import { useDemo } from "@/hooks/useDemo";
import { useStoreInfo } from "@/hooks/useQueries";
import {
  dateOnlyToDate,
  formatDateOnlyLong,
  formatTimestampMediumDate,
  pretendDateToInstant,
  timestampToDate,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { CalendarClock, ChevronDown, Flag } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDashboardCopy } from "./copy";

/** Human label for a schedule event kind. */
export function eventKindLabel(kind: EventKind): string {
  const labels: Record<EventKind, string> = {
    [EventKindEnum.deadline]: "Deadline",
    [EventKindEnum.orientation]: "Orientation",
    [EventKindEnum.trainingDay]: "Training day",
    [EventKindEnum.friendsAndFamily]: "Friends & family",
    [EventKindEnum.openingDay]: "Opening day",
    [EventKindEnum.signOff]: "Sign-off",
    [EventKindEnum.other]: "Event",
  };
  return labels[kind] ?? "Event";
}

/**
 * The current instant, refreshed on an interval. When demo mode supplies a
 * pretend date, that instant is returned instead of the real clock so the
 * countdown and schedule windows follow the pretend date.
 */
function useNow(pretendInstant: number | null, intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return pretendInstant ?? now;
}

function splitCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3_600),
    minutes: Math.floor((total % 3_600) / 60),
  };
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex min-w-16 flex-col items-center rounded-md bg-secondary px-3 py-2 text-secondary-foreground">
      <span className="font-display text-3xl font-bold leading-none tabular-nums">
        {value}
      </span>
      <span className="mt-1 font-display text-[10px] font-semibold uppercase tracking-widest text-white/70">
        {label}
      </span>
    </div>
  );
}

/** localStorage key remembering whether the schedule is expanded on this device. */
const SCHEDULE_STORAGE_KEY = "roadie-roster.dashboard.schedule-expanded";

/** Read the remembered schedule state, defaulting to collapsed. */
function readStoredExpanded(): boolean {
  try {
    return window.localStorage.getItem(SCHEDULE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/** Persist the schedule state, ignoring unavailable storage. */
function storeExpanded(expanded: boolean): void {
  try {
    window.localStorage.setItem(SCHEDULE_STORAGE_KEY, String(expanded));
  } catch {
    // Storage is unavailable (private mode, quota); the state stays in memory.
  }
}

/**
 * Countdown to opening day plus the opening timeline, with the phase the store
 * is currently in highlighted. The milestone list is collapsible; the flag,
 * label, opening date and countdown boxes always stay visible.
 */
export function OpeningTimeline({
  events,
  openingDate,
}: {
  events: ScheduleEvent[];
  openingDate: DateOnly | null;
}) {
  const { t } = useDashboardCopy();
  const { data: storeInfo } = useStoreInfo();
  const demo = useDemo();
  // Schedule times are wall-clock times in the store's zone, so they must be
  // formatted with that zone rather than the device's.
  const timeZone = storeInfo?.timeZone;
  // While demo mode is on with a pretend date, the countdown and schedule
  // windows follow that instant instead of the real clock.
  const pretendInstant = useMemo(() => {
    if (!demo.enabled || !demo.pretendDate || !storeInfo) return null;
    return (
      pretendDateToInstant(
        demo.pretendDate,
        storeInfo.timeZone,
        storeInfo.amShiftStart,
        storeInfo.pmShiftStart,
      )?.getTime() ?? null
    );
  }, [demo.enabled, demo.pretendDate, storeInfo]);
  const now = useNow(pretendInstant);

  const [expanded, setExpanded] = useState(readStoredExpanded);

  const toggle = useCallback(() => {
    setExpanded((current) => {
      const next = !current;
      storeExpanded(next);
      return next;
    });
  }, []);

  const ordered = useMemo(
    () =>
      [...events]
        .sort((a, b) => Number(a.start - b.start))
        .filter((event) => {
          const date = timestampToDate(event.start);
          return date !== null;
        }),
    [events],
  );

  const currentIndex = useMemo(() => {
    let index = -1;
    for (let i = 0; i < ordered.length; i += 1) {
      const date = timestampToDate(ordered[i].start);
      if (date && date.getTime() <= now) index = i;
    }
    return index;
  }, [ordered, now]);

  // The next milestone strictly after now, used for the collapsed summary line.
  const nextEvent = useMemo(() => {
    for (const event of ordered) {
      const date = timestampToDate(event.start);
      if (date && date.getTime() > now) return event;
    }
    return null;
  }, [ordered, now]);

  // The opening date is a calendar day (UTC midnight); its instant drives the
  // countdown, while the label is formatted as a date-only value in UTC.
  const openingInstant =
    openingDate !== null ? dateOnlyToDate(openingDate) : null;
  const openingMs = openingInstant ? openingInstant.getTime() - now : null;
  const countdown = openingMs !== null ? splitCountdown(openingMs) : null;

  const regionId = "dashboard.timeline.region";
  const toggleLabel = expanded ? "Hide schedule" : "Show schedule";

  return (
    <Card
      data-ocid="dashboard.countdown.card"
      className="rounded-lg border-border py-5 shadow-subtle"
    >
      <CardContent className="space-y-5 px-5">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={expanded}
          aria-controls={regionId}
          data-ocid="dashboard.countdown.header_toggle"
          className="flex w-full flex-col gap-4 rounded-md text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Flag className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {t("dashboard.countdown.label")}
              </p>
              <p className="font-display text-lg font-bold uppercase tracking-wide text-foreground">
                {openingDate !== null
                  ? formatDateOnlyLong(openingDate)
                  : t("dashboard.countdown.noDate")}
              </p>
            </div>
          </div>

          {countdown ? (
            <div
              className="flex items-center gap-2"
              data-ocid="dashboard.countdown.timer"
            >
              <CountdownUnit
                value={countdown.days}
                label={t("dashboard.countdown.days")}
              />
              <CountdownUnit
                value={countdown.hours}
                label={t("dashboard.countdown.hours")}
              />
              <CountdownUnit
                value={countdown.minutes}
                label={t("dashboard.countdown.minutes")}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("dashboard.countdown.noDate")}
            </p>
          )}
        </button>

        {!expanded && nextEvent && (
          <p
            className="text-sm text-muted-foreground"
            data-ocid="dashboard.timeline.next"
          >
            <span className="font-display text-xs font-semibold uppercase tracking-widest text-primary">
              Next:
            </span>{" "}
            <span className="font-medium text-foreground">
              {nextEvent.name}
            </span>
            {" · "}
            {formatTimestampMediumDate(nextEvent.start, timeZone)}
          </p>
        )}

        <div
          id={regionId}
          data-ocid="dashboard.timeline.region"
          className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
            expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="overflow-hidden">
            {ordered.length > 0 ? (
              <ol
                className="relative space-y-1 border-l border-border pl-5"
                data-ocid="dashboard.timeline.list"
              >
                {ordered.map((event, index) => {
                  const isCurrent = index === currentIndex;
                  const isPast = index < currentIndex;
                  return (
                    <li
                      key={event.id.toString()}
                      data-ocid={`dashboard.timeline.item.${index + 1}`}
                      className="relative py-2"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "absolute -left-[26px] top-3.5 h-3 w-3 rounded-full border-2",
                          isCurrent
                            ? "border-primary bg-primary"
                            : isPast
                              ? "border-accent bg-accent"
                              : "border-border bg-card",
                        )}
                      />
                      <div
                        className={cn(
                          "flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md px-3 py-2",
                          isCurrent && "bg-primary/5 ring-1 ring-primary/30",
                        )}
                      >
                        <div className="min-w-0">
                          <p
                            className={cn(
                              "truncate font-display text-sm font-semibold uppercase tracking-wide",
                              isCurrent ? "text-primary" : "text-foreground",
                            )}
                          >
                            {event.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {eventKindLabel(event.kind)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {isCurrent && (
                            <span className="rounded-full bg-primary px-2 py-0.5 font-display text-[10px] font-semibold uppercase tracking-widest text-primary-foreground">
                              {t("dashboard.timeline.now")}
                            </span>
                          )}
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CalendarClock
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                            {formatTimestampMediumDate(event.start, timeZone)}
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("dashboard.timeline.empty")}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={toggle}
          aria-expanded={expanded}
          aria-controls={regionId}
          data-ocid="dashboard.timeline.toggle"
          className="touch-target flex w-full items-center justify-center gap-2 rounded-md border border-border bg-muted/40 px-4 py-3 font-display text-xs font-semibold uppercase tracking-widest text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {toggleLabel}
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "h-4 w-4 transition-transform duration-300 ease-out motion-reduce:transition-none",
              expanded && "rotate-180",
            )}
          />
        </button>
      </CardContent>
    </Card>
  );
}
