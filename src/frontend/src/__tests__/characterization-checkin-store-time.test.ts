import {
  storeTimeToTimestamp,
  timestampToStoreTime,
} from "@/components/checkin/time";
import { describe, expect, it } from "vitest";

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
