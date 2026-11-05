import Common "../types/common";

/// Real age computation in store time. Dates of birth are stored as UTC
/// midnight nanoseconds (`DateOnly`); "now" is a UTC nanosecond timestamp.
/// Age is compared by calendar month and day in the store's time zone, so a
/// birthday is recognized on the correct local day and leap years are handled
/// by the civil-date conversion. All arithmetic is signed `Int`, so a date of
/// birth before 1970 (a negative timestamp) is handled correctly.
module {
  /// Nanoseconds in one day.
  let dayNs : Int = 86_400_000_000_000;

  /// The store's default time zone when none is configured.
  let defaultTimeZone : Text = "America/Chicago";

  /// The real age in whole years of someone born on `dateOfBirth`, as of `now`,
  /// evaluated in `timeZone`. Returns null for an unset date of birth (exactly
  /// zero) or a birth date in the future. Uses signed Int math so a pre-1970
  /// date of birth (a negative timestamp) is a real date, not 0 or null.
  public func ageInYears(dateOfBirth : Common.DateOnly, now : Common.Timestamp, timeZone : Common.TimeZone) : ?Nat {
    if (dateOfBirth == 0) {
      return null;
    };
    let (by, bm, bd) = civilFromDays(floorDiv(dateOfBirth, dayNs));
    let (ny, nm, nd) = civilFromDays(localDays(now, timeZone));
    // A birth date in the future is not a valid age.
    if (by > ny or (by == ny and (bm > nm or (bm == nm and bd > nd)))) {
      return null;
    };
    var age = ny - by;
    // The birthday has not yet occurred this year.
    if (nm < bm or (nm == bm and nd < bd)) {
      age -= 1;
    };
    if (age < 0) { null } else { ?age.toNat() };
  };

  /// True when the person's real age is at least `minimumAge`. An unset or
  /// future date of birth is treated as not meeting the minimum.
  public func meetsMinimumAge(
    dateOfBirth : Common.DateOnly,
    minimumAge : Nat,
    now : Common.Timestamp,
    timeZone : Common.TimeZone,
  ) : Bool {
    switch (ageInYears(dateOfBirth, now, timeZone)) {
      case (?age) { age >= minimumAge };
      case null { false };
    };
  };

  /// True when the person is under 18 in store time. An unset or future date of
  /// birth is treated as a minor.
  public func isMinor(dateOfBirth : Common.DateOnly, now : Common.Timestamp, timeZone : Common.TimeZone) : Bool {
    switch (ageInYears(dateOfBirth, now, timeZone)) {
      case (?age) { age < 18 };
      case null { true };
    };
  };

  /// The non-sensitive "MM-DD" birthday (store-local calendar date) for display,
  /// or null for an unset date of birth (exactly zero).
  public func birthdayMonthDay(dateOfBirth : Common.DateOnly) : ?Text {
    if (dateOfBirth == 0) {
      return null;
    };
    let (_, month, day) = civilFromDays(floorDiv(dateOfBirth, dayNs));
    ?(pad2(month) # "-" # pad2(day));
  };

  /// Internal: zero-pad a positive integer to two digits.
  func pad2(n : Int) : Text {
    if (n < 10) { "0" # n.toText() } else { n.toText() };
  };

  /// Internal: whole days since the Unix epoch for `now` in `timeZone`.
  func localDays(now : Common.Timestamp, timeZone : Common.TimeZone) : Int {
    floorDiv(now + utcOffsetSeconds(now, timeZone) * 1_000_000_000, dayNs);
  };

  /// The UTC timestamp of local midnight of `ts`'s local calendar date in
  /// `timeZone`, using the offset in effect on that date. The local date is
  /// derived from `ts` with the offset at `ts`, then the offset at that local
  /// midnight is applied so a DST transition on the date is respected.
  public func localDayStart(ts : Common.Timestamp, timeZone : Common.TimeZone) : Int {
    let localDaysSinceEpoch = localDays(ts, timeZone);
    let utcMidnight = localDaysSinceEpoch * dayNs;
    utcMidnight - utcOffsetSeconds(utcMidnight, timeZone) * 1_000_000_000;
  };

  /// The UTC timestamp of local midnight of the same calendar date a
  /// `DateOnly` represents. A `DateOnly` is nanoseconds at UTC midnight of the
  /// calendar date, so subtracting the zone's UTC offset in seconds (converted
  /// to nanoseconds) yields local midnight of that same calendar date.
  public func localMidnightOfDate(dateOnly : Common.Timestamp, timeZone : Common.TimeZone) : Int {
    dateOnly - utcOffsetSeconds(dateOnly, timeZone) * 1_000_000_000;
  };

  /// The UTC offset in seconds for `timeZone` at `now`. Only
  /// America/Chicago is modeled; every other zone falls back to the default.
  public func utcOffsetSeconds(now : Common.Timestamp, timeZone : Common.TimeZone) : Int {
    let zone = if (timeZone == "") { defaultTimeZone } else { timeZone };
    if (zone != "America/Chicago") {
      return -6 * 3600;
    };
    let (y, m, d) = civilFromDays(floorDiv(now, dayNs));
    // US DST: second Sunday in March to first Sunday in November.
    let dstStart = daysFromCivil(y, 3, nthSundayOfMonth(y, 3, 2));
    let dstEnd = daysFromCivil(y, 11, nthSundayOfMonth(y, 11, 1));
    let today = daysFromCivil(y, m, d);
    if (today >= dstStart and today < dstEnd) {
      -5 * 3600;
    } else {
      -6 * 3600;
    };
  };

  /// Internal: day-of-month of the `n`th Sunday in `month` of `year`.
  func nthSundayOfMonth(year : Int, month : Int, n : Int) : Int {
    let firstWeekday = weekdayOf(year, month, 1);
    // Days to add to the 1st to reach the first Sunday (0 = Sunday).
    let toFirstSunday = (7 - firstWeekday) % 7;
    1 + toFirstSunday + (n - 1) * 7;
  };

  /// Internal: weekday (0 = Sunday) of a civil date.
  func weekdayOf(year : Int, month : Int, day : Int) : Int {
    let z = daysFromCivil(year, month, day);
    // 1970-01-01 was a Thursday (4).
    let w = (z + 4) % 7;
    if (w < 0) { w + 7 } else { w };
  };

  /// Internal: civil (year, month, day) from days since the Unix epoch.
  /// Howard Hinnant's civil_from_days algorithm.
  func civilFromDays(days : Int) : (Int, Int, Int) {
    let z = days + 719_468;
    let era = floorDiv(z, 146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if (mp < 10) { mp + 3 } else { mp - 9 };
    let year = if (m <= 2) { y + 1 } else { y };
    (year, m, d);
  };

  /// Internal: days since the Unix epoch from a civil date.
  /// Howard Hinnant's days_from_civil algorithm.
  func daysFromCivil(year : Int, month : Int, day : Int) : Int {
    let y = if (month <= 2) { year - 1 } else { year };
    let era = floorDiv(y, 400);
    let yoe = y - era * 400;
    let mp = if (month > 2) { month - 3 } else { month + 9 };
    let doy = (153 * mp + 2) / 5 + day - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468;
  };

  /// Internal: floor division that works for negative numerators.
  func floorDiv(a : Int, b : Int) : Int {
    let q = a / b;
    if (a % b != 0 and (a < 0) != (b < 0)) { q - 1 } else { q };
  };
};
