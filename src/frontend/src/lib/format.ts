import type { DateOnly, PhotoRef, SignatureRef, Timestamp } from "@/backend";

/**
 * A stored photo/signature reference is the raw uploaded bytes. Render it as a
 * data URL so an `<img>` can display it without a round trip to storage.
 * Returns null for an empty or missing reference.
 */
export function refToDataUrl(
  ref: PhotoRef | SignatureRef | undefined | null,
  contentType = "image/png",
): string | null {
  if (!ref || ref.length === 0) return null;
  let binary = "";
  for (let i = 0; i < ref.length; i += 1) {
    binary += String.fromCharCode(ref[i]);
  }
  return `data:${contentType};base64,${btoa(binary)}`;
}

/** Read a browser `File` into the raw bytes the backend stores as a ref. */
export async function fileToRef(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

/** Motoko `Time.now()` nanoseconds -> JS Date. Returns null when invalid. */
export function timestampToDate(timestamp: Timestamp): Date | null {
  const date = new Date(Number(timestamp / 1_000_000n));
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Motoko `DateOnly` (nanoseconds at UTC midnight) -> JS Date. The returned Date
 * is the UTC instant of that calendar day, so its `getUTC*` accessors are the
 * intended calendar values regardless of the device time zone.
 */
export function dateOnlyToDate(dateOnly: DateOnly): Date | null {
  const date = new Date(Number(dateOnly / 1_000_000n));
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Format a backend timestamp for display in the store's time zone; falls back
 * to an em dash. Pass `timeZone` (an IANA name such as `America/Chicago`) so a
 * schedule time reads the same on every device.
 */
export function formatTimestamp(
  timestamp: Timestamp,
  timeZone?: string,
): string {
  const date = timestampToDate(timestamp);
  if (!date) return "—";
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  });
}

/**
 * Format a backend date-only value for display in UTC; falls back to an em
 * dash. A date-only value is a calendar day, so it must not shift with the
 * device time zone.
 */
export function formatDateOnly(dateOnly: DateOnly): string {
  const date = dateOnlyToDate(dateOnly);
  if (!date) return "—";
  return date.toLocaleDateString(undefined, {
    dateStyle: "medium",
    timeZone: "UTC",
  });
}

/** Convert a JS Date to a Motoko `Timestamp` (nanoseconds since epoch). */
export function dateToTimestamp(date: Date): Timestamp {
  return BigInt(date.getTime()) * 1_000_000n;
}

/** Convert a JS Date to a Motoko `DateOnly` (nanoseconds at UTC midnight). */
export function dateToDateOnly(date: Date): DateOnly {
  const utcMidnight = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
  return BigInt(utcMidnight) * 1_000_000n;
}

/**
 * Format a date-only value as a short month and day (e.g. "Mar 14") in UTC, so
 * a birthday reads the same calendar day on every device.
 */
export function formatDateOnlyMonthDay(dateOnly: DateOnly): string | null {
  const date = dateOnlyToDate(dateOnly);
  if (!date) return null;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Format a timestamp as a long date in the store's time zone (e.g. for the
 * opening-day countdown). Falls back to an em dash when invalid.
 */
export function formatTimestampLongDate(
  timestamp: Timestamp,
  timeZone?: string,
): string {
  const date = timestampToDate(timestamp);
  if (!date) return "—";
  return date.toLocaleDateString(undefined, {
    dateStyle: "long",
    timeZone,
  });
}

/**
 * Format a timestamp as a medium date in the store's time zone (e.g. for the
 * opening timeline). Falls back to an em dash when invalid.
 */
export function formatTimestampMediumDate(
  timestamp: Timestamp,
  timeZone?: string,
): string {
  const date = timestampToDate(timestamp);
  if (!date) return "—";
  return date.toLocaleDateString(undefined, {
    dateStyle: "medium",
    timeZone,
  });
}

/** Human label for a roadie status enum value. */
export function roadieStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    hired: "Hired",
    paperworkDone: "Paperwork done",
    oriented: "Oriented",
    inTraining: "In training",
    certified: "Certified",
    needsMoreTime: "Needs more time",
    active: "Active",
    archived: "Archived",
  };
  return labels[status] ?? status;
}

/** Human label for a role enum value. */
export function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    admin: "Admin",
    storeManager: "Store Manager",
    trainingManager: "Training Manager",
    leadership: "Leadership",
    visitingManager: "Visiting Manager",
    trainer: "Trainer",
    kiosk: "Kiosk",
    integration: "Integration",
  };
  return labels[role] ?? role;
}

/** Shorten a principal for display. */
export function shortPrincipal(principal: { toText(): string }): string {
  const text = principal.toText();
  return text.length > 12 ? `${text.slice(0, 5)}…${text.slice(-4)}` : text;
}
