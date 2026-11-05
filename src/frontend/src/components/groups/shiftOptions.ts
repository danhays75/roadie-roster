import { type EventId, EventKind, type ScheduleEvent, Shift } from "@/backend";
import type { PretendDate } from "@/backend";
import {
  type PretendStoreTimes,
  dateToDateOnly,
  formatDateOnlyMonthDay,
  pretendDateToInstant,
  timestampToDate,
} from "@/lib/format";

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
  /**
   * True when another option shares this option's day label (for example two
   * Friends & Family nights). The tab label then adds the short date so the two
   * shifts can be told apart.
   */
  duplicateDayLabel?: boolean;
}

/** Whether an event kind contributes a shift board. */
function isShiftEvent(kind: EventKind): boolean {
  return kind === EventKind.trainingDay || kind === EventKind.friendsAndFamily;
}

/**
 * The structural identity of an option's day label, independent of the active
 * language. Two options with the same key render the same day label: every
 * Friends & Family night shares one label, a training day is unique per number,
 * and any other option falls back to its event name.
 */
function dayLabelKey(option: ShiftOption): string {
  if (option.kind === EventKind.friendsAndFamily) return "friendsAndFamily";
  if (option.trainingDay !== undefined)
    return `trainingDay:${option.trainingDay}`;
  return `name:${option.name}`;
}

/**
 * Build the ordered list of selectable shifts from the schedule. Training days
 * are numbered chronologically (Training Day 1, 2, …) so the labels renumber
 * when a day is added or removed. Friends & Family nights are PM only, so they
 * contribute a single PM option. Every other event kind is ignored. Options
 * whose day label collides with another option are flagged so the tab label can
 * add the short date.
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

  const labelCounts = new Map<string, number>();
  for (const option of options) {
    const key = dayLabelKey(option);
    labelCounts.set(key, (labelCounts.get(key) ?? 0) + 1);
  }
  for (const option of options) {
    if ((labelCounts.get(dayLabelKey(option)) ?? 0) > 1) {
      option.duplicateDayLabel = true;
    }
  }

  return options;
}

/**
 * The instant "now" stands for, honoring the demo pretend date. Pass the store
 * shift times and time zone so the pretend instant matches the backend clock.
 */
export function effectiveNow(
  pretendDate: PretendDate | null,
  store?: PretendStoreTimes,
): number {
  if (pretendDate) {
    const instant = pretendDateToInstant(pretendDate, store);
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

/** The short date ("Feb 5") of an option's event start, or null when invalid. */
function shiftOptionShortDate(option: ShiftOption): string | null {
  const date = timestampToDate(option.start);
  if (!date) return null;
  return formatDateOnlyMonthDay(dateToDateOnly(date));
}

/**
 * The label for a shift option, e.g. "Training Day 2 · AM" or "F&F · PM". When
 * another option shares the same day label, the short date replaces the shift
 * suffix so the two read apart, e.g. "Friends & Family · Feb 5".
 */
export function shiftOptionLabel(
  option: ShiftOption,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  const shiftLabel =
    option.shift === Shift.am
      ? t("groups.board.shiftAm")
      : t("groups.board.shiftPm");
  const day =
    option.kind === EventKind.friendsAndFamily
      ? t("groups.board.friendsFamilyChip")
      : option.trainingDay !== undefined
        ? t("groups.board.dayChip", { day: option.trainingDay })
        : option.name;
  if (option.duplicateDayLabel) {
    const shortDate = shiftOptionShortDate(option);
    if (shortDate) return `${day} · ${shortDate}`;
  }
  return `${day} · ${shiftLabel}`;
}

/**
 * The short chip label for a shift option's day, without the AM/PM suffix. When
 * another option shares the same day label, the short date is appended so the
 * two chips read apart, e.g. "Friends & Family · Feb 5".
 */
export function shiftOptionDayLabel(
  option: ShiftOption,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  const day =
    option.kind === EventKind.friendsAndFamily
      ? t("groups.board.friendsFamilyChip")
      : option.trainingDay !== undefined
        ? t("groups.board.dayChip", { day: option.trainingDay })
        : option.name;
  if (option.duplicateDayLabel) {
    const shortDate = shiftOptionShortDate(option);
    if (shortDate) return `${day} · ${shortDate}`;
  }
  return day;
}

/** A stable key for a shift option, matching the backend board key. */
export function shiftOptionKey(option: ShiftOption): string {
  return `${option.eventId.toString()}:${option.shift}`;
}
