import { type EventId, EventKind, type ScheduleEvent, Shift } from "@/backend";
import type { PretendDate } from "@/backend";
import { pretendDateToInstant } from "@/lib/format";

/** One selectable shift: an event plus AM or PM. */
export interface ShiftOption {
  eventId: EventId;
  shift: Shift;
  /** The event kind, so the picker can render F&F chips differently. */
  kind: EventKind;
  /** The event's display name. */
  name: string;
  /** The chronological training-day number, when the event is a training day. */
  trainingDay?: number;
  /** The event start instant, for ordering and default selection. */
  start: bigint;
}

/** Whether an event kind contributes a shift board. */
function isShiftEvent(kind: EventKind): boolean {
  return kind === EventKind.trainingDay || kind === EventKind.friendsAndFamily;
}

/**
 * Build the ordered list of selectable shifts from the schedule. Training days
 * are numbered chronologically (Training Day 1, 2, …) so the labels renumber
 * when a day is added or removed. Friends & Family nights are PM only, so they
 * contribute a single PM option. Every other event kind is ignored.
 */
export function buildShiftOptions(schedule: ScheduleEvent[]): ShiftOption[] {
  const trainingDays = schedule
    .filter((event) => event.kind === EventKind.trainingDay)
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  const trainingNumber = new Map<string, number>();
  trainingDays.forEach((event, index) => {
    trainingNumber.set(event.id.toString(), index + 1);
  });

  const options: ShiftOption[] = [];
  for (const event of schedule) {
    if (!isShiftEvent(event.kind)) continue;
    if (event.kind === EventKind.friendsAndFamily) {
      options.push({
        eventId: event.id,
        shift: Shift.pm,
        kind: event.kind,
        name: event.name,
        start: event.start,
      });
      continue;
    }
    const day = trainingNumber.get(event.id.toString());
    options.push({
      eventId: event.id,
      shift: Shift.am,
      kind: event.kind,
      name: event.name,
      trainingDay: day,
      start: event.start,
    });
    options.push({
      eventId: event.id,
      shift: Shift.pm,
      kind: event.kind,
      name: event.name,
      trainingDay: day,
      start: event.start,
    });
  }

  options.sort((a, b) => {
    if (a.start !== b.start) return a.start < b.start ? -1 : 1;
    return a.shift === Shift.am ? -1 : 1;
  });
  return options;
}

/** The instant "now" stands for, honoring the demo pretend date. */
export function effectiveNow(pretendDate: PretendDate | null): number {
  if (pretendDate) {
    const instant = pretendDateToInstant(pretendDate);
    if (instant) return instant.getTime();
  }
  return Date.now();
}

/**
 * The default shift: the current or next shift relative to `now`. A shift is
 * "current" while its event day is today; otherwise the earliest shift whose
 * event start is at or after now. Falls back to the first option.
 */
export function defaultShiftOption(
  options: ShiftOption[],
  now: number,
): ShiftOption | undefined {
  if (options.length === 0) return undefined;
  const nowNs = BigInt(now) * 1_000_000n;
  const upcoming = options.find((option) => option.start >= nowNs);
  if (upcoming) return upcoming;
  return options[options.length - 1];
}

/** The label for a shift option, e.g. "Training Day 2 · AM" or "F&F · PM". */
export function shiftOptionLabel(
  option: ShiftOption,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  const shiftLabel =
    option.shift === Shift.am
      ? t("groups.board.shiftAm")
      : t("groups.board.shiftPm");
  if (option.kind === EventKind.friendsAndFamily) {
    return `${t("groups.board.friendsFamilyChip")} · ${shiftLabel}`;
  }
  const day =
    option.trainingDay !== undefined
      ? t("groups.board.dayChip", { day: option.trainingDay })
      : option.name;
  return `${day} · ${shiftLabel}`;
}

/** The short chip label for a shift option's day, without the AM/PM suffix. */
export function shiftOptionDayLabel(
  option: ShiftOption,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  if (option.kind === EventKind.friendsAndFamily) {
    return t("groups.board.friendsFamilyChip");
  }
  return option.trainingDay !== undefined
    ? t("groups.board.dayChip", { day: option.trainingDay })
    : option.name;
}

/** A stable key for a shift option, matching the backend board key. */
export function shiftOptionKey(option: ShiftOption): string {
  return `${option.eventId.toString()}:${option.shift}`;
}
