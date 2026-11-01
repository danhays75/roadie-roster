/** The store's time zone, falling back to Central when it is not yet loaded. */
export const DEFAULT_TIME_ZONE = "America/Chicago";

/** The offset, in milliseconds, of a time zone at a given UTC instant. */
export function timeZoneOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return asUtc - utcMs;
}

/**
 * Build the instant for a wall-clock time on a `YYYY-MM-DD` day in a named
 * time zone. Used to store an access end date at 11:59:59 PM in the store's
 * own time zone.
 */
export function zonedWallTimeToDate(
  dateOnly: string,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date {
  const [year, month, day] = dateOnly.split("-").map(Number);
  const guess = Date.UTC(year, month - 1, day, hour, minute, second);
  const offset = timeZoneOffsetMs(guess, timeZone);
  return new Date(guess - offset);
}

/** The calendar date (year, month, day) of an instant in a named time zone. */
export function calendarInTimeZone(
  instant: Date,
  timeZone: string,
): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  return { year: get("year"), month: get("month"), day: get("day") };
}
