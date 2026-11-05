import { DemoShift } from "@/backend";
import {
  storeTimeToTimestamp,
  timestampToStoreTime,
} from "@/components/checkin/time";
import { effectiveNow } from "@/components/groups/shiftOptions";
import {
  dateOnlyToDate,
  dateOnlyToInputValue,
  dateToDateOnly,
  inputValueToDateOnly,
  pretendDateToInstant,
} from "@/lib/format";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Characterization for the store-local time conversion seam in
 * `components/checkin/time.ts`. These helpers already convert between a backend
 * nanosecond timestamp and the store's local `HH:MM`; the accepted shift-window
 * and Today work builds on the same store-local day semantics, so this pins the
 * working conversion behavior that must not regress. Pure functions, no actor.
 */

const CHICAGO = "America/Chicago";
const UTC = "UTC";

/** A backend timestamp (ns) for a UTC instant. */
function ns(iso: string): bigint {
  return BigInt(Date.parse(iso)) * 1_000_000n;
}

describe("timestampToStoreTime reads the store-local wall clock", () => {
  it("renders a UTC instant in the store time zone, not UTC", () => {
    // 2026-07-15T15:00:00Z is 10:00 in Chicago (CDT, UTC-5).
    expect(timestampToStoreTime(ns("2026-07-15T15:00:00Z"), CHICAGO)).toBe(
      "10:00",
    );
    // The same instant read in UTC is 15:00, proving the zone is applied.
    expect(timestampToStoreTime(ns("2026-07-15T15:00:00Z"), UTC)).toBe("15:00");
  });

  it("applies the winter offset (CST, UTC-6) for a January instant", () => {
    // 2026-01-15T16:00:00Z is 10:00 in Chicago (CST, UTC-6).
    expect(timestampToStoreTime(ns("2026-01-15T16:00:00Z"), CHICAGO)).toBe(
      "10:00",
    );
  });

  it("reads the Unix epoch in the store time zone", () => {
    // 1970-01-01T00:00:00Z is 1969-12-31 18:00 in Chicago (CST, UTC-6).
    expect(timestampToStoreTime(0n, CHICAGO)).toBe("18:00");
  });
});

describe("storeTimeToTimestamp builds a store-local instant", () => {
  it("round-trips a store-local 10:00 AM through the store time zone", () => {
    const base = ns("2026-07-15T15:00:00Z");
    const built = storeTimeToTimestamp(base, "10:00", CHICAGO);
    expect(built).not.toBeNull();
    expect(timestampToStoreTime(built as bigint, CHICAGO)).toBe("10:00");
  });

  it("anchors the built instant to the store-local day of the base", () => {
    // The base is 2026-07-15T02:00:00Z, which is 2026-07-14 21:00 in Chicago.
    // A 10:00 store-local time therefore lands on July 14, not July 15.
    const base = ns("2026-07-15T02:00:00Z");
    const built = storeTimeToTimestamp(base, "10:00", CHICAGO);
    expect(built).not.toBeNull();
    // 2026-07-14 10:00 CDT == 2026-07-14T15:00:00Z.
    expect(built).toBe(ns("2026-07-14T15:00:00Z"));
  });

  it("uses the winter offset for a January store-local time", () => {
    const base = ns("2026-01-15T16:00:00Z");
    const built = storeTimeToTimestamp(base, "10:00", CHICAGO);
    expect(built).not.toBeNull();
    // 2026-01-15 10:00 CST == 2026-01-15T16:00:00Z.
    expect(built).toBe(ns("2026-01-15T16:00:00Z"));
  });

  it("rejects an out-of-range or malformed time", () => {
    const base = ns("2026-07-15T15:00:00Z");
    expect(storeTimeToTimestamp(base, "24:00", CHICAGO)).toBeNull();
    expect(storeTimeToTimestamp(base, "10:60", CHICAGO)).toBeNull();
    expect(storeTimeToTimestamp(base, "nope", CHICAGO)).toBeNull();
  });
});

/**
 * Characterization for the date-only helpers the demo pretend-date work builds
 * on. A `DateOnly` is a UTC calendar day, so these conversions must round-trip
 * the same calendar day regardless of the device time zone. These are the
 * working behaviors the pretend-date change must not disturb; the pretend
 * instant itself is intentionally not asserted here.
 */
describe("date-only helpers round-trip a UTC calendar day", () => {
  it("converts a DateOnly to its UTC calendar day and back", () => {
    const dateOnly = BigInt(Date.UTC(2026, 6, 15)) * 1_000_000n;
    const date = dateOnlyToDate(dateOnly);
    expect(date).not.toBeNull();
    expect(date?.getUTCFullYear()).toBe(2026);
    expect(date?.getUTCMonth()).toBe(6);
    expect(date?.getUTCDate()).toBe(15);
    expect(dateToDateOnly(date as Date)).toBe(dateOnly);
  });

  it("renders a DateOnly as the YYYY-MM-DD an input expects", () => {
    const dateOnly = BigInt(Date.UTC(2026, 0, 5)) * 1_000_000n;
    expect(dateOnlyToInputValue(dateOnly)).toBe("2026-01-05");
  });

  it("parses a valid input value back to the same UTC midnight", () => {
    expect(inputValueToDateOnly("2026-01-05")).toBe(
      BigInt(Date.UTC(2026, 0, 5)) * 1_000_000n,
    );
  });

  it("rejects an empty or impossible input value", () => {
    expect(inputValueToDateOnly("")).toBeNull();
    expect(inputValueToDateOnly("2026-02-30")).toBeNull();
    expect(inputValueToDateOnly("not-a-date")).toBeNull();
  });
});

describe("effectiveNow falls back to the real clock without a pretend date", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the current time when no pretend date is set", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-15T15:00:00Z"));
    expect(effectiveNow(null)).toBe(Date.parse("2026-07-15T15:00:00Z"));
  });

  it("returns null for a pretend day outside the representable range", () => {
    // A day far beyond the JS Date range cannot resolve to an instant, so the
    // helper reports null rather than an Invalid Date.
    expect(
      pretendDateToInstant({
        day: 10n ** 30n,
        shift: DemoShift.am,
      }),
    ).toBeNull();
  });
});

/**
 * Cover for the accepted pretend-instant change: the frontend pretend instant
 * must equal the backend `effectiveNow` for the same pretend date and shift.
 * The backend computes local midnight of the pretend calendar date in the store
 * time zone plus the shift start plus 30 minutes; these assertions pin the same
 * arithmetic on the frontend helper the Dashboard, OpeningTimeline, CheckInRow
 * and Kiosk all call. The backend lane proves the real canister agrees.
 */
describe("pretendDateToInstant matches the backend effectiveNow", () => {
  /** A `DateOnly` (UTC midnight) for a calendar day. */
  function dayOnly(year: number, month: number, day: number): bigint {
    return BigInt(Date.UTC(year, month - 1, day)) * 1_000_000n;
  }

  it("resolves an AM pretend date to local midnight plus the AM start plus 30 minutes", () => {
    // 2026-07-15 is CDT (UTC-5), so local midnight is 2026-07-15T05:00:00Z.
    // The seeded AM start is 10:00, so the pretend instant is 10:30 local ==
    // 2026-07-15T15:30:00Z.
    const instant = pretendDateToInstant({
      day: dayOnly(2026, 7, 15),
      shift: DemoShift.am,
    });
    expect(instant).not.toBeNull();
    expect(instant?.toISOString()).toBe("2026-07-15T15:30:00.000Z");
  });

  it("resolves a PM pretend date to local midnight plus the PM start plus 30 minutes", () => {
    // The seeded PM start is 16:00, so the pretend instant is 16:30 local ==
    // 2026-07-15T21:30:00Z.
    const instant = pretendDateToInstant({
      day: dayOnly(2026, 7, 15),
      shift: DemoShift.pm,
    });
    expect(instant).not.toBeNull();
    expect(instant?.toISOString()).toBe("2026-07-15T21:30:00.000Z");
  });

  it("keeps the same local calendar date in the store time zone, not one day early", () => {
    // The pretend day is 2026-01-15; the resolved instant must read back as
    // January 15 in America/Chicago (CST, UTC-6), never January 14.
    const instant = pretendDateToInstant({
      day: dayOnly(2026, 1, 15),
      shift: DemoShift.am,
    });
    expect(instant).not.toBeNull();
    const localDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: CHICAGO,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(instant as Date);
    expect(localDate).toBe("2026-01-15");
  });

  it("honors the store's own shift starts and time zone", () => {
    // A store with an 08:00 AM start in UTC: local midnight plus 08:30.
    const instant = pretendDateToInstant(
      { day: dayOnly(2026, 7, 15), shift: DemoShift.am },
      { timeZone: UTC, amShiftStart: 480n, pmShiftStart: 1020n },
    );
    expect(instant).not.toBeNull();
    expect(instant?.toISOString()).toBe("2026-07-15T08:30:00.000Z");
  });

  it("forwards the store fields through effectiveNow", () => {
    // effectiveNow must pass the store's zone and shift starts to the helper so
    // the component instant matches the backend clock.
    const instant = effectiveNow(
      { day: dayOnly(2026, 7, 15), shift: DemoShift.am },
      { timeZone: UTC, amShiftStart: 480n, pmShiftStart: 1020n },
    );
    expect(instant).toBe(Date.parse("2026-07-15T08:30:00.000Z"));
  });
});
