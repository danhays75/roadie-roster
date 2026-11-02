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

  /// Read both store logos (main and secondary). Callable by any caller,
  /// including Kiosk-role and unregistered users, so it deliberately applies no
  /// role gate.
  public func getStoreLogo(
    storeInfo : { var value : Store.StoreInfo },
  ) : Store.StoreLogos {
    {
      logo = storeInfo.value.logo;
      secondaryLogo = storeInfo.value.secondaryLogo;
    };
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
    ignore ChangeLog.record(changeLog, counters, caller, "updateStoreInfo", null, false, "Updated store info");
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
    let referenced = roadies.values().any(func(r) =
      r.mainPositionId == id or r.secondPositionId == ?id or r.crossTrainedPositionId == ?id
    );
    if (referenced) {
      Runtime.trap("Position is referenced by one or more roadies");
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
    let newOpening = position.openingBuildTo.toInt() + openingDelta;
    let newAfter = position.afterOpeningBuildTo.toInt() + afterOpeningDelta;
    if (newOpening < 0 or newAfter < 0) {
      Runtime.trap("Build-to target cannot go below zero");
    };
    positions.add(positionId, {
      position with
      openingBuildTo = newOpening.toNat();
      afterOpeningBuildTo = newAfter.toNat();
    });
    let id = counters.nextBuildToAdjustmentId;
    counters.nextBuildToAdjustmentId := id + 1;
    buildToAdjustments.add(id, {
      positionId;
      openingDelta;
      afterOpeningDelta;
      at = Time.now();
      by = caller;
    });
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
    ignore ChangeLog.record(changeLog, counters, caller, "createScheduleEvent", null, false, "Created schedule event " # event.name);
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
    ignore ChangeLog.record(changeLog, counters, caller, "updateScheduleEvent", null, false, "Updated schedule event " # event.name);
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
    let referencedByRoadie = roadies.values().any(func(r) = r.orientationEventId == ?id);
    let referencedByAttendance = attendance.values().any(func(a) = a.eventId == ?id);
    if (referencedByRoadie or referencedByAttendance) {
      Runtime.trap("Schedule event is referenced by one or more records");
    };
    schedule.remove(id);
    ignore ChangeLog.record(changeLog, counters, caller, "deleteScheduleEvent", null, false, "Deleted schedule event " # event.name);
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
    ignore ChangeLog.record(changeLog, counters, caller, "updateChecklists", null, false, "Updated checklists");
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
    ignore ChangeLog.record(changeLog, counters, caller, "updateRetentionSettings", null, false, "Updated retention settings");
  };

  /// Nanoseconds in one day.
  let nsPerDay : Int = 86_400_000_000_000;

  /// Build the downloadable store template file from the current positions,
  /// schedule, checklists and leader-talk settings (Admin only). Schedule events
  /// are expressed as whole days relative to the store's opening date. The file
  /// deliberately carries no people data, logos, store number, city or opening
  /// date.
  public func downloadStoreTemplate(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    storeInfo : { var value : Store.StoreInfo },
    positions : Map.Map<Common.PositionId, Store.Position>,
    schedule : Map.Map<Common.EventId, Store.ScheduleEvent>,
    checklists : { var value : Store.Checklists },
    caller : Principal,
  ) : Store.StoreTemplateFile {
    Auth.requireAdmin(accessGrants, caller);
    let opening = storeInfo.value.openingDate;
    {
      version = 1;
      schedule = schedule.values().map(func(e) {
        {
          kind = e.kind;
          name = e.name;
          startOffsetDays = (e.start - opening) / nsPerDay;
          endOffsetDays = switch (e.end) {
            case (?end) { ?((end - opening) / nsPerDay) };
            case null { null };
          };
        };
      }).toArray();
      positions = positions.values().map(func(p) {
        {
          name = p.name;
          house = p.house;
          code = p.code;
          openingBuildTo = p.openingBuildTo;
          afterOpeningBuildTo = p.afterOpeningBuildTo;
          minimumAge = p.minimumAge;
          needsAlcoholCert = p.needsAlcoholCert;
        };
      }).toArray();
      checklists = checklists.value;
      leaderTalkName = storeInfo.value.leaderTalkName;
      leaderTalkSize = storeInfo.value.leaderTalkSize;
      trainingGroupSize = storeInfo.value.trainingGroupSize;
    };
  };

  /// Load a store template file (Admin only). Refuses when any roadie exists.
  /// Otherwise replaces positions, schedule and checklists, recomputing schedule
  /// dates from this store's opening date, and updates the leader-talk name and
  /// sizes. Returns the applied preview, or an error explaining the refusal.
  public func loadStoreTemplate(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    storeInfo : { var value : Store.StoreInfo },
    positions : Map.Map<Common.PositionId, Store.Position>,
    schedule : Map.Map<Common.EventId, Store.ScheduleEvent>,
    checklists : { var value : Store.Checklists },
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    file : Store.StoreTemplateFile,
  ) : Store.TemplateLoadResult {
    Auth.requireAdmin(accessGrants, caller);
    if (roadies.size() > 0) {
      return #err("Cannot load a template once roadies exist");
    };
    let opening = storeInfo.value.openingDate;
    // Replace positions, assigning fresh sequential ids.
    positions.clear();
    var nextPositionId = 0;
    for (p in file.positions.values()) {
      positions.add(nextPositionId, {
        id = nextPositionId;
        name = p.name;
        house = p.house;
        code = p.code;
        openingBuildTo = p.openingBuildTo;
        afterOpeningBuildTo = p.afterOpeningBuildTo;
        needsAlcoholCert = p.needsAlcoholCert;
        minimumAge = p.minimumAge;
        shirtsRequired = 2;
        hatsRequired = 1;
        crewManager = null;
      });
      nextPositionId += 1;
    };
    // Replace schedule, recomputing each date from this store's opening date.
    schedule.clear();
    var nextEventId = 0;
    for (e in file.schedule.values()) {
      schedule.add(nextEventId, {
        id = nextEventId;
        kind = e.kind;
        name = e.name;
        start = opening + e.startOffsetDays * nsPerDay;
        end = switch (e.endOffsetDays) {
          case (?offset) { ?(opening + offset * nsPerDay) };
          case null { null };
        };
      });
      nextEventId += 1;
    };
    checklists.value := file.checklists;
    storeInfo.value := {
      storeInfo.value with
      leaderTalkName = file.leaderTalkName;
      leaderTalkSize = file.leaderTalkSize;
      trainingGroupSize = file.trainingGroupSize;
    };
    counters.nextPositionId := nextPositionId;
    counters.nextEventId := nextEventId;
    ignore ChangeLog.record(changeLog, counters, caller, "loadStoreTemplate", null, false, "Loaded store template");
    #ok({
      positionCount = file.positions.size();
      scheduleCount = file.schedule.size();
      orientationUniformCount = file.checklists.orientationUniform.size();
      paperworkCount = file.checklists.paperwork.size();
      leaderTalkName = file.leaderTalkName;
    });
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
};
