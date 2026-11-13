import Time "mo:core/Time";
import Common "../types/common";
import Store "../types/store";
import Auth "auth";
import Age "age";

/// The single clock for the whole backend. Every schedule window, countdown,
/// check-in availability check, Today selection and age computation reads the
/// effective clock from here so the demo "Pretend it's" date is honoured
/// everywhere and no module keeps its own copy of the time math.
module {
  /// Nanoseconds in one minute.
  let minuteNs : Int = 60_000_000_000;

  /// The effective clock. While demo mode is on with a pretend date set, the
  /// pretend timestamp is returned; otherwise the real clock. The pretend
  /// date's `day` is a local calendar date in the store time zone, and the
  /// pretend time is 30 minutes after the store's AM or PM shift start
  /// (local), so "Pretend it's Feb 2 AM" lands just inside the AM shift.
  public func effectiveNow(demoState : Common.DemoState, storeInfo : Store.StoreInfo) : Common.Timestamp {
    if (not Auth.demoActive(demoState)) {
      return Time.now();
    };
    switch (demoState.pretendDate) {
      case (?pd) {
        let dayStart = Age.localMidnightOfDate(pd.day, storeInfo.timeZone);
        let shiftStartMin = switch (pd.shift) {
          case (#am) { storeInfo.amShiftStart };
          case (#pm) { storeInfo.pmShiftStart };
        };
        dayStart + (shiftStartMin.toInt() + 30) * minuteNs;
      };
      case null { Time.now() };
    };
  };

  /// The UTC nanosecond timestamp of local midnight on the store-local calendar
  /// date that contains `ts`. Two timestamps fall on the same store-local
  /// calendar date exactly when their `localDayStart` values are equal.
  public func localDayStart(ts : Common.Timestamp, timeZone : Common.TimeZone) : Common.Timestamp {
    Age.localDayStart(ts, timeZone);
  };

  /// Whether a schedule event's local calendar date in the store time zone is
  /// the effective clock's local calendar date.
  public func isToday(event : Store.ScheduleEvent, now : Common.Timestamp, timeZone : Common.TimeZone) : Bool {
    localDayStart(event.start, timeZone) == localDayStart(now, timeZone);
  };

  /// The start and end of a shift as UTC nanosecond timestamps. The shift's
  /// date is the event's local calendar date in the store time zone; the start
  /// and end times are the store's AM or PM shift times (store-local minutes
  /// since midnight). A Friends & Family night uses the PM times.
  public func shiftWindow(
    event : Store.ScheduleEvent,
    shift : Common.Shift,
    storeInfo : Store.StoreInfo,
  ) : (Common.Timestamp, Common.Timestamp) {
    let dayStart = localDayStart(event.start, storeInfo.timeZone);
    let usePm = shift == #pm or event.kind == #friendsAndFamily;
    let startMin = if (usePm) { storeInfo.pmShiftStart } else { storeInfo.amShiftStart };
    let endMin = if (usePm) { storeInfo.pmShiftEnd } else { storeInfo.amShiftEnd };
    let start = dayStart + startMin.toInt() * minuteNs;
    let end = dayStart + endMin.toInt() * minuteNs;
    (start, end);
  };
};
