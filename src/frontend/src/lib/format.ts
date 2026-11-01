import type { DateOnly, Timestamp } from "@/backend";

/** Motoko `Time.now()` nanoseconds -> JS Date. Returns null when invalid. */
export function timestampToDate(timestamp: Timestamp): Date | null {
  const date = new Date(Number(timestamp / 1_000_000n));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Motoko `DateOnly` (days since epoch, nanoseconds) -> JS Date. */
export function dateOnlyToDate(dateOnly: DateOnly): Date | null {
  const date = new Date(Number(dateOnly / 1_000_000n));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Format a backend timestamp for display; falls back to an em dash. */
export function formatTimestamp(timestamp: Timestamp): string {
  const date = timestampToDate(timestamp);
  if (!date) return "—";
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** Format a backend date-only value for display; falls back to an em dash. */
export function formatDateOnly(dateOnly: DateOnly): string {
  const date = dateOnlyToDate(dateOnly);
  if (!date) return "—";
  return date.toLocaleDateString(undefined, { dateStyle: "medium" });
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
