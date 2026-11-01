import type { EventKind, ScheduleEvent } from "@/backend";
import { EventKind as EventKindEnum } from "@/backend";
import { Card, CardContent } from "@/components/ui/card";
import { timestampToDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CalendarClock, Flag } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
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

/**
 * Countdown to opening day plus the opening timeline, with the phase the store
 * is currently in highlighted.
 */
export function OpeningTimeline({
  events,
  openingDate,
}: {
  events: ScheduleEvent[];
  openingDate: Date | null;
}) {
  const { t } = useDashboardCopy();
  const now = useNow();

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

  const openingMs = openingDate ? openingDate.getTime() - now : null;
  const countdown = openingMs !== null ? splitCountdown(openingMs) : null;

  return (
    <Card
      data-ocid="dashboard.countdown.card"
      className="rounded-lg border-border py-5 shadow-subtle"
    >
      <CardContent className="space-y-5 px-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Flag className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {t("dashboard.countdown.label")}
              </p>
              <p className="font-display text-lg font-bold uppercase tracking-wide text-foreground">
                {openingDate
                  ? openingDate.toLocaleDateString(undefined, {
                      dateStyle: "long",
                    })
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
        </div>

        {ordered.length > 0 ? (
          <ol
            className="relative space-y-1 border-l border-border pl-5"
            data-ocid="dashboard.timeline.list"
          >
            {ordered.map((event, index) => {
              const date = timestampToDate(event.start);
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
                        {date
                          ? date.toLocaleDateString(undefined, {
                              dateStyle: "medium",
                            })
                          : "—"}
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
      </CardContent>
    </Card>
  );
}
