import type { Timestamp } from "@/backend";
import { timestampToDate } from "@/lib/format";

/**
 * The store-local `HH:MM` for a backend timestamp, or null when the timestamp
 * is invalid. Used to pre-fill the editable late-time input so it reads the
 * same on every device regardless of the device time zone.
 */
export function timestampToStoreTime(
  timestamp: Timestamp,
  timeZone: string,
): string | null {
  const date = timestampToDate(timestamp);
  if (!date) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour === "24" ? "00" : hour}:${minute}`;
}

/** The store's UTC offset in milliseconds at the given instant. */
function storeOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
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
  return asUtc - date.getTime();
}

/**
 * Build a backend timestamp for the store-local calendar day of `base` at the
 * given `HH:MM`, or null when the time is invalid. The store's UTC offset is
 * resolved at the target instant so the value round-trips through
 * `timestampToStoreTime`.
 */
export function storeTimeToTimestamp(
  base: Timestamp,
  hhmm: string,
  timeZone: string,
): Timestamp | null {
  const date = timestampToDate(base);
  if (!date) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  const dayParts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) =>
    Number(dayParts.find((part) => part.type === type)?.value ?? "0");
  const guess = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    hour,
    minute,
  );
  const offset = storeOffsetMs(new Date(guess), timeZone);
  return BigInt(guess - offset) * 1_000_000n;
}
