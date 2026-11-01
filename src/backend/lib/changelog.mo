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

  /// Append a change-log entry and return its id.
  public func record(
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    by : Principal,
    action : Text,
    subjectRoadieId : ?Common.RoadieId,
    touchesContactSet : Bool,
    detail : Text,
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
    });
    id;
  };
};
