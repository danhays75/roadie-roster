import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Time "mo:core/Time";
import Common "../types/common";
import Store "../types/store";
import Roadie "../types/roadie";
import Phase23 "../types/phase23";
import Access "../types/access";
import Auth "auth";
import ChangeLog "changelog";

module {
  public type Counters = {
    var nextPositionId : Nat;
    var nextEventId : Nat;
    var nextBuildToAdjustmentId : Nat;
    var nextChangeLogId : Nat;
  };

  /// Read the current store configuration (any role except Kiosk).
  public func getStoreInfo(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    storeInfo : { var value : Store.StoreInfo },
    caller : Principal,
  ) : Store.StoreInfo {
    ignore Auth.requireReadable(accessGrants, caller);
    storeInfo.value;
  };

  /// Update the store configuration (Admin only).
  public func updateStoreInfo(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    storeInfo : { var value : Store.StoreInfo },
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    info : Store.StoreInfo,
  ) : () {
    Auth.requireAdmin(accessGrants, caller);
    storeInfo.value := info;
    ignore ChangeLog.record(changeLog, counters, caller, "updateStoreInfo", null, false, "Store configuration updated");
  };

  /// List all positions (any role except Kiosk).
  public func listPositions(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    positions : Map.Map<Common.PositionId, Store.Position>,
    caller : Principal,
  ) : [Store.Position] {
    ignore Auth.requireReadable(accessGrants, caller);
    positions.values().toArray();
  };

  /// Create a position (Admin only).
  public func createPosition(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    positions : Map.Map<Common.PositionId, Store.Position>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    position : Store.Position,
  ) : Common.PositionId {
    Auth.requireAdmin(accessGrants, caller);
    let id = counters.nextPositionId;
    counters.nextPositionId := id + 1;
    positions.add(id, { position with id });
    ignore ChangeLog.record(changeLog, counters, caller, "createPosition", null, false, "Created position " # position.name);
    id;
  };

  /// Update a position (Admin only).
  public func updatePosition(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    positions : Map.Map<Common.PositionId, Store.Position>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    position : Store.Position,
  ) : () {
    Auth.requireAdmin(accessGrants, caller);
    if (not positions.containsKey(position.id)) {
      Runtime.trap("Position not found");
    };
    positions.add(position.id, position);
    ignore ChangeLog.record(changeLog, counters, caller, "updatePosition", null, false, "Updated position " # position.name);
  };

  /// Delete a position; fails when active roadies reference it (Admin only).
  public func deletePosition(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    positions : Map.Map<Common.PositionId, Store.Position>,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    id : Common.PositionId,
  ) : () {
    Auth.requireAdmin(accessGrants, caller);
    let position = positions.get(id) ?? Runtime.trap("Position not found");
    let inUse = roadies.values().any(func r =
      r.status != #archived and (r.mainPositionId == id or r.secondPositionId == ?id)
    );
    if (inUse) {
      Runtime.trap("Cannot delete a position with active roadies");
    };
    positions.remove(id);
    ignore ChangeLog.record(changeLog, counters, caller, "deletePosition", null, false, "Deleted position " # position.name);
  };

  /// Apply a +1/−1 build-to adjustment (Store Manager/Admin only).
  public func adjustBuildTo(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    positions : Map.Map<Common.PositionId, Store.Position>,
    buildToAdjustments : Map.Map<Nat, Store.BuildToAdjustment>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    positionId : Common.PositionId,
    openingDelta : Int,
    afterOpeningDelta : Int,
  ) : () {
    Auth.requireManager(accessGrants, caller);
    let position = positions.get(positionId) ?? Runtime.trap("Position not found");
    let adjId = counters.nextBuildToAdjustmentId;
    counters.nextBuildToAdjustmentId := adjId + 1;
    buildToAdjustments.add(adjId, {
      positionId;
      openingDelta;
      afterOpeningDelta;
      at = Time.now();
      by = caller;
    });
    // Apply the delta to the stored build-to targets.
    let newOpening = applyDelta(position.openingBuildTo, openingDelta);
    let newAfter = applyDelta(position.afterOpeningBuildTo, afterOpeningDelta);
    positions.add(positionId, { position with openingBuildTo = newOpening; afterOpeningBuildTo = newAfter });
    ignore ChangeLog.record(changeLog, counters, caller, "adjustBuildTo", null, false, "Adjusted build-to for " # position.name);
  };

  /// List the opening schedule (any role except Kiosk).
  public func listSchedule(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    schedule : Map.Map<Common.EventId, Store.ScheduleEvent>,
    caller : Principal,
  ) : [Store.ScheduleEvent] {
    ignore Auth.requireReadable(accessGrants, caller);
    schedule.values().toArray();
  };

  /// Create a schedule event (Admin only).
  public func createScheduleEvent(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    schedule : Map.Map<Common.EventId, Store.ScheduleEvent>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    event : Store.ScheduleEvent,
  ) : Common.EventId {
    Auth.requireAdmin(accessGrants, caller);
    let id = counters.nextEventId;
    counters.nextEventId := id + 1;
    schedule.add(id, { event with id });
    ignore ChangeLog.record(changeLog, counters, caller, "createScheduleEvent", null, false, "Created event " # event.name);
    id;
  };

  /// Update a schedule event (Admin only).
  public func updateScheduleEvent(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    schedule : Map.Map<Common.EventId, Store.ScheduleEvent>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    event : Store.ScheduleEvent,
  ) : () {
    Auth.requireAdmin(accessGrants, caller);
    if (not schedule.containsKey(event.id)) {
      Runtime.trap("Schedule event not found");
    };
    schedule.add(event.id, event);
    ignore ChangeLog.record(changeLog, counters, caller, "updateScheduleEvent", null, false, "Updated event " # event.name);
  };

  /// Delete a schedule event; fails when records reference it (Admin only).
  public func deleteScheduleEvent(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    schedule : Map.Map<Common.EventId, Store.ScheduleEvent>,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    attendance : Map.Map<Nat, Phase23.AttendanceRecord>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    id : Common.EventId,
  ) : () {
    Auth.requireAdmin(accessGrants, caller);
    let event = schedule.get(id) ?? Runtime.trap("Schedule event not found");
    let referenced = roadies.values().any(func r = r.orientationEventId == ?id)
      or attendance.values().any(func a = a.eventId == ?id);
    if (referenced) {
      Runtime.trap("Cannot delete an event with records");
    };
    schedule.remove(id);
    ignore ChangeLog.record(changeLog, counters, caller, "deleteScheduleEvent", null, false, "Deleted event " # event.name);
  };

  /// Read the editable checklists (any role except Kiosk).
  public func getChecklists(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    checklists : { var value : Store.Checklists },
    caller : Principal,
  ) : Store.Checklists {
    ignore Auth.requireReadable(accessGrants, caller);
    checklists.value;
  };

  /// Update the editable checklists (Admin only).
  public func updateChecklists(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    checklists : { var value : Store.Checklists },
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    value : Store.Checklists,
  ) : () {
    Auth.requireAdmin(accessGrants, caller);
    checklists.value := value;
    ignore ChangeLog.record(changeLog, counters, caller, "updateChecklists", null, false, "Checklists updated");
  };

  /// Read retention settings (any role except Kiosk).
  public func getRetentionSettings(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    retention : { var value : Store.RetentionSettings },
    caller : Principal,
  ) : Store.RetentionSettings {
    ignore Auth.requireReadable(accessGrants, caller);
    retention.value;
  };

  /// Update retention settings (Admin only).
  public func updateRetentionSettings(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    retention : { var value : Store.RetentionSettings },
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    settings : Store.RetentionSettings,
  ) : () {
    Auth.requireAdmin(accessGrants, caller);
    retention.value := settings;
    ignore ChangeLog.record(changeLog, counters, caller, "updateRetentionSettings", null, false, "Retention settings updated");
  };

  /// Save the current store configuration as a template (Admin only).
  public func saveStoreTemplate(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    storeInfo : { var value : Store.StoreInfo },
    positions : Map.Map<Common.PositionId, Store.Position>,
    schedule : Map.Map<Common.EventId, Store.ScheduleEvent>,
    checklists : { var value : Store.Checklists },
    storeTemplates : Map.Map<Text, Store.StoreTemplate>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    name : Text,
  ) : () {
    Auth.requireAdmin(accessGrants, caller);
    storeTemplates.add(name, {
      name;
      schedule = schedule.values().toArray();
      positions = positions.values().toArray();
      checklists = checklists.value;
      leaderTalkName = storeInfo.value.leaderTalkName;
    });
    ignore ChangeLog.record(changeLog, counters, caller, "saveStoreTemplate", null, false, "Saved store template " # name);
  };

  /// Internal: apply a signed delta to a Nat target, clamping at zero.
  func applyDelta(base : Nat, delta : Int) : Nat {
    if (delta >= 0) {
      base + delta.toNat();
    } else {
      let magnitude = (-delta).toNat();
      if (magnitude >= base) { 0 } else { base - magnitude };
    };
  };
};
