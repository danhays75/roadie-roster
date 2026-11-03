import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Time "mo:core/Time";
import Common "../types/common";
import Roadie "../types/roadie";

/// Shared change-log writer. Every mutation records who did what and when, and
/// flags entries that touch the contact set so reads can filter them.
module {
  public type Counters = {
    var nextChangeLogId : Nat;
  };

  /// Append a real (non-demo) change-log entry and return its id.
  public func record(
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    by : Principal,
    action : Text,
    subjectRoadieId : ?Common.RoadieId,
    touchesContactSet : Bool,
    detail : Text,
  ) : Common.ChangeLogId {
    append(changeLog, counters, by, action, subjectRoadieId, touchesContactSet, detail, false);
  };

  /// Append a demo change-log entry and return its id. Demo entries are
  /// invisible while demo mode is off.
  public func recordDemo(
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    by : Principal,
    action : Text,
    subjectRoadieId : ?Common.RoadieId,
    touchesContactSet : Bool,
    detail : Text,
  ) : Common.ChangeLogId {
    append(changeLog, counters, by, action, subjectRoadieId, touchesContactSet, detail, true);
  };

  func append(
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    by : Principal,
    action : Text,
    subjectRoadieId : ?Common.RoadieId,
    touchesContactSet : Bool,
    detail : Text,
    isDemo : Bool,
  ) : Common.ChangeLogId {
    let id = counters.nextChangeLogId;
    counters.nextChangeLogId := id + 1;
    changeLog.add(id, {
      id;
      at = Time.now();
      by;
      action;
      subjectRoadieId;
      touchesContactSet;
      detail;
      isDemo;
    });
    id;
  };
};
