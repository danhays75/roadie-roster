import Common "../types/common";

/// Real age computation in store time. Dates of birth are stored as UTC
/// midnight nanoseconds (`DateOnly`); "now" is a UTC nanosecond timestamp.
/// Age is compared by calendar month and day in the store's time zone, so a
/// birthday is recognized on the correct local day and leap years are handled
/// by the civil-date conversion.
module {
  /// Nanoseconds in one day.
  let dayNs : Int = 86_400_000_000_000;

  /// The store's default time zone when none is configured.
  let defaultTimeZone : Text = "America/Chicago";

  /// The real age in whole years of someone born on `dateOfBirth`, as of `now`,
  /// evaluated in `timeZone`. Returns 0 for a non-positive date of birth.
  public func ageInYears(dateOfBirth : Common.DateOnly, now : Common.Timestamp, timeZone : Common.TimeZone) : Nat {
    if (dateOfBirth <= 0) { return 0 };
    let (birthYear, birthMonth, birthDay) = civilFromDays(dateOfBirth / dayNs);
    let (nowYear, nowMonth, nowDay) = civilFromDays(localDays(now, timeZone));
    // Age is the year difference, minus one until this year's birthday arrives.
    let hadBirthday = nowMonth > birthMonth or (nowMonth == birthMonth and nowDay >= birthDay);
    let years = if (hadBirthday) { nowYear - birthYear } else { nowYear - birthYear - 1 };
    if (years <= 0) { 0 } else { years.toNat() };
  };

  /// True when the person's real age is at least `minimumAge`.
  public func meetsMinimumAge(
    dateOfBirth : Common.DateOnly,
    minimumAge : Nat,
    now : Common.Timestamp,
    timeZone : Common.TimeZone,
  ) : Bool {
    ageInYears(dateOfBirth, now, timeZone) >= minimumAge;
  };

  /// True when the person is under 18 in store time.
  public func isMinor(dateOfBirth : Common.DateOnly, now : Common.Timestamp, timeZone : Common.TimeZone) : Bool {
    ageInYears(dateOfBirth, now, timeZone) < 18;
  };

  /// The non-sensitive "MM-DD" birthday (store-local calendar date) for display,
  /// or null for a non-positive date of birth.
  public func birthdayMonthDay(dateOfBirth : Common.DateOnly) : ?Text {
    if (dateOfBirth <= 0) { return null };
    let (_, month, day) = civilFromDays(dateOfBirth / dayNs);
    let mm = if (month < 10) { "0" # month.toText() } else { month.toText() };
    let dd = if (day < 10) { "0" # day.toText() } else { day.toText() };
    ?(mm # "-" # dd);
  };

  /// Internal: whole days since the Unix epoch for `now` in `timeZone`.
  func localDays(now : Common.Timestamp, timeZone : Common.TimeZone) : Int {
    let offsetSeconds = utcOffsetSeconds(now, timeZone);
    (now + offsetSeconds * 1_000_000_000) / dayNs;
  };

  /// Internal: the UTC offset in seconds for `timeZone` at `now`. Only
  /// America/Chicago is recognized (US Central); every other zone is treated as
  /// UTC. US daylight saving runs from the second Sunday in March to the first
  /// Sunday in November.
  func utcOffsetSeconds(now : Common.Timestamp, timeZone : Common.TimeZone) : Int {
    if (timeZone != defaultTimeZone) { return 0 };
    let days = now / dayNs;
    let (year, month, day) = civilFromDays(days);
    let dstStart = nthSundayOfMonth(year, 3, 2);
    let dstEnd = nthSundayOfMonth(year, 11, 1);
    let inDst = (month > 3 and month < 11)
      or (month == 3 and day >= dstStart)
      or (month == 11 and day < dstEnd);
    if (inDst) { -5 * 3600 } else { -6 * 3600 };
  };

  /// Internal: day-of-month of the `n`th Sunday in `month` of `year`.
  func nthSundayOfMonth(year : Int, month : Int, n : Int) : Int {
    let firstWeekday = weekdayOf(year, month, 1);
    // weekdayOf returns 0 = Sunday.
    let firstSunday = if (firstWeekday == 0) { 1 } else { 8 - firstWeekday };
    firstSunday + (n - 1) * 7;
  };

  /// Internal: weekday (0 = Sunday) of a civil date.
  func weekdayOf(year : Int, month : Int, day : Int) : Int {
    let days = daysFromCivil(year, month, day);
    let w = (days + 4) % 7; // 1970-01-01 was a Thursday (4).
    if (w < 0) { w + 7 } else { w };
  };

  /// Internal: civil (year, month, day) from days since the Unix epoch
  /// (Howard Hinnant's algorithm).
  func civilFromDays(days : Int) : (Int, Int, Int) {
    let z = days + 719_468;
    let era = (if (z >= 0) { z } else { z - 146_096 }) / 146_097;
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
  func daysFromCivil(year : Int, month : Int, day : Int) : Int {
    let y = if (month <= 2) { year - 1 } else { year };
    let era = (if (y >= 0) { y } else { y - 399 }) / 400;
    let yoe = y - era * 400;
    let mp = if (month > 2) { month - 3 } else { month + 9 };
    let doy = (153 * mp + 2) / 5 + day - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468;
  };
};
