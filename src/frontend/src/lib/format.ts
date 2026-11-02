import type {
  DateOnly,
  PhotoRef,
  SignatureRef,
  StaffProfile,
  Timestamp,
} from "@/backend";

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

/** The longest edge, in pixels, an uploaded photo or signature is scaled to. */
export const MAX_UPLOAD_EDGE = 800;
/** JPEG quality used when re-encoding an upload. */
export const UPLOAD_JPEG_QUALITY = 0.8;
/** The soft size cap, in bytes, an upload is compressed toward. */
export const MAX_UPLOAD_BYTES = 300 * 1024;

/**
 * How long to wait for an image to decode before falling back to the original
 * file. A real browser decodes a small image in a few milliseconds, so this is
 * only a safety net for an undecodable file; keeping it short means a submit
 * never stalls on an image the browser cannot read.
 */
const IMAGE_LOAD_TIMEOUT_MS = 500;

/** Load a `File` into an `HTMLImageElement` for canvas re-encoding. */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    const timer = setTimeout(() => {
      URL.revokeObjectURL(url);
      reject(new Error("Timed out reading the image"));
    }, IMAGE_LOAD_TIMEOUT_MS);
    image.onload = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      reject(new Error("Could not read the image"));
    };
    image.src = url;
  });
}

/** Draw an image onto a canvas at a scaled size and read it back as a blob. */
function encodeCanvas(
  image: HTMLImageElement,
  width: number,
  height: number,
  quality: number,
): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(image, 0, 0, width, height);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
  });
}

/**
 * Downscale a photo or signature to at most `MAX_UPLOAD_EDGE` on its longest
 * edge, re-encode it as JPEG at `UPLOAD_JPEG_QUALITY`, and step the quality
 * down until the result fits `MAX_UPLOAD_BYTES`. Falls back to the original
 * file when the browser cannot decode or re-encode it.
 */
export async function resizeImageFile(file: File): Promise<File> {
  let image: HTMLImageElement;
  try {
    image = await loadImage(file);
  } catch {
    return file;
  }
  const longest = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = longest > MAX_UPLOAD_EDGE ? MAX_UPLOAD_EDGE / longest : 1;
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  let quality = UPLOAD_JPEG_QUALITY;
  let blob = await encodeCanvas(image, width, height, quality);
  while (blob && blob.size > MAX_UPLOAD_BYTES && quality > 0.4) {
    quality = Math.round((quality - 0.1) * 10) / 10;
    blob = await encodeCanvas(image, width, height, quality);
  }
  if (!blob) return file;
  const name = file.name.replace(/\.[^.]+$/, "") || "upload";
  return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
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

/**
 * Format a backend date-only value as a long date in UTC (e.g. "February 8,
 * 2027"); falls back to an em dash. Used where a calendar day is shown in full,
 * such as the opening-day countdown, and must not shift with the device zone.
 */
export function formatDateOnlyLong(dateOnly: DateOnly): string {
  const date = dateOnlyToDate(dateOnly);
  if (!date) return "—";
  return date.toLocaleDateString(undefined, {
    dateStyle: "long",
    timeZone: "UTC",
  });
}

/**
 * Format a timestamp that represents a calendar day (e.g. a hire date) as a
 * date-only value in UTC, so it reads the same on every device. Delegates to
 * `formatDateOnly` after reducing the instant to its UTC calendar day.
 */
export function formatTimestampDateOnly(timestamp: Timestamp): string {
  const date = timestampToDate(timestamp);
  if (!date) return "—";
  return formatDateOnly(dateToDateOnly(date));
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

/**
 * Format a timestamp as a short month, day and year (e.g. "Jan 30, 2027") in
 * the store's time zone, so the roadie card's hire date reads the same on every
 * device. Falls back to an em dash when invalid.
 */
export function formatTimestampMonthDayYear(
  timestamp: Timestamp,
  timeZone?: string,
): string {
  const date = timestampToDate(timestamp);
  if (!date) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
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

/**
 * Render a staff member's display name and title from their staff profile.
 * Prefers the preferred name over the full name, and appends the title when
 * present. Falls back to `fallback` (the localized "Unnamed user" copy) when no
 * profile exists or it carries no name, so a user approved before profiles
 * existed still renders a readable label.
 */
export function staffDisplayName(
  profile: StaffProfile | undefined | null,
  fallback = "Unnamed user",
): string {
  if (!profile) return fallback;
  const name = profile.preferredName?.trim() || profile.fullName?.trim();
  if (!name) return fallback;
  const title = profile.title?.trim();
  return title ? `${name} · ${title}` : name;
}
