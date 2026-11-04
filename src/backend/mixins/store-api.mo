import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Common "../types/common";
import Store "../types/store";
import Roadie "../types/roadie";
import Phase23 "../types/phase23";
import Access "../types/access";
import StoreLib "../lib/store";

mixin (
  accessGrants : Map.Map<Principal, Access.AccessGrant>,
  storeInfo : { var value : Store.StoreInfo },
  positions : Map.Map<Common.PositionId, Store.Position>,
  buildToAdjustments : Map.Map<Nat, Store.BuildToAdjustment>,
  schedule : Map.Map<Common.EventId, Store.ScheduleEvent>,
  checklists : { var value : Store.Checklists },
  retention : { var value : Store.RetentionSettings },
  uniformSettings : { var value : Store.UniformSettings },
  storeTemplates : Map.Map<Text, Store.StoreTemplate>,
  roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
  attendance : Map.Map<Nat, Phase23.AttendanceRecord>,
  changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
  counters : StoreLib.Counters,
  demoState : Common.DemoState,
) {
  /// Read the store configuration.
  public query ({ caller }) func getStoreInfo() : async Store.StoreInfo {
    StoreLib.getStoreInfo(accessGrants, demoState, storeInfo, caller);
  };

  /// Read both store logos (main and secondary). Any caller, including Kiosk
  /// and unregistered users.
  public query func getStoreLogo() : async Store.StoreLogos {
    StoreLib.getStoreLogo(storeInfo);
  };

  /// Update the store configuration (Admin only).
  public shared ({ caller }) func updateStoreInfo(info : Store.StoreInfo) : async () {
    StoreLib.updateStoreInfo(accessGrants, demoState, storeInfo, changeLog, counters, caller, info);
  };

  /// List all positions.
  public query ({ caller }) func listPositions() : async [Store.Position] {
    StoreLib.listPositions(accessGrants, demoState, positions, caller);
  };

  /// Create a position (Admin only).
  public shared ({ caller }) func createPosition(position : Store.Position) : async Common.PositionId {
    StoreLib.createPosition(accessGrants, demoState, positions, changeLog, counters, caller, position);
  };

  /// Update a position (Admin only).
  public shared ({ caller }) func updatePosition(position : Store.Position) : async () {
    StoreLib.updatePosition(accessGrants, demoState, positions, changeLog, counters, caller, position);
  };

  /// Delete a position (Admin only).
  public shared ({ caller }) func deletePosition(id : Common.PositionId) : async () {
    StoreLib.deletePosition(accessGrants, demoState, positions, roadies, changeLog, counters, caller, id);
  };

  /// Apply a +1/−1 build-to adjustment (Store Manager/Admin only).
  public shared ({ caller }) func adjustBuildTo(
    positionId : Common.PositionId,
    openingDelta : Int,
    afterOpeningDelta : Int,
  ) : async () {
    StoreLib.adjustBuildTo(accessGrants, demoState, positions, buildToAdjustments, changeLog, counters, caller, positionId, openingDelta, afterOpeningDelta);
  };

  /// List the opening schedule.
  public query ({ caller }) func listSchedule() : async [Store.ScheduleEvent] {
    StoreLib.listSchedule(accessGrants, demoState, schedule, caller);
  };

  /// Create a schedule event (Admin only).
  public shared ({ caller }) func createScheduleEvent(event : Store.ScheduleEvent) : async Common.EventId {
    StoreLib.createScheduleEvent(accessGrants, demoState, schedule, changeLog, counters, caller, event);
  };

  /// Update a schedule event (Admin only).
  public shared ({ caller }) func updateScheduleEvent(event : Store.ScheduleEvent) : async () {
    StoreLib.updateScheduleEvent(accessGrants, demoState, schedule, changeLog, counters, caller, event);
  };

  /// Delete a schedule event (Admin only).
  public shared ({ caller }) func deleteScheduleEvent(id : Common.EventId) : async () {
    StoreLib.deleteScheduleEvent(accessGrants, demoState, schedule, roadies, attendance, changeLog, counters, caller, id);
  };

  /// Read the editable checklists.
  public query ({ caller }) func getChecklists() : async Store.Checklists {
    StoreLib.getChecklists(accessGrants, demoState, checklists, caller);
  };

  /// Update the editable checklists (Admin only).
  public shared ({ caller }) func updateChecklists(value : Store.Checklists) : async () {
    StoreLib.updateChecklists(accessGrants, demoState, checklists, changeLog, counters, caller, value);
  };

  /// Read retention settings.
  public query ({ caller }) func getRetentionSettings() : async Store.RetentionSettings {
    StoreLib.getRetentionSettings(accessGrants, demoState, retention, caller);
  };

  /// Update retention settings (Admin only).
  public shared ({ caller }) func updateRetentionSettings(settings : Store.RetentionSettings) : async () {
    StoreLib.updateRetentionSettings(accessGrants, demoState, retention, changeLog, counters, caller, settings);
  };

  /// Save the current store configuration as a template (Admin only).
  public shared ({ caller }) func saveStoreTemplate(name : Text) : async () {
    StoreLib.saveStoreTemplate(accessGrants, demoState, storeInfo, positions, schedule, checklists, storeTemplates, changeLog, counters, caller, name);
  };

  /// Build the downloadable store template file (Admin only).
  public query ({ caller }) func downloadStoreTemplate() : async Store.StoreTemplateFile {
    StoreLib.downloadStoreTemplate(accessGrants, demoState, storeInfo, positions, schedule, checklists, caller);
  };

  /// Load a store template file, replacing positions, schedule and checklists
  /// (Admin only). Refuses when any roadie exists.
  public shared ({ caller }) func loadStoreTemplate(file : Store.StoreTemplateFile) : async Store.TemplateLoadResult {
    StoreLib.loadStoreTemplate(accessGrants, demoState, storeInfo, positions, schedule, checklists, roadies, changeLog, counters, caller, file);
  };

  /// Read the uniform settings (size curve and order buffer). Admin, Store
  /// Manager and Training Manager.
  public query ({ caller }) func getUniformSettings() : async Store.UniformSettings {
    StoreLib.getUniformSettings(accessGrants, demoState, uniformSettings, caller);
  };

  /// Update the uniform settings (Admin or Store Manager only, logged).
  public shared ({ caller }) func updateUniformSettings(settings : Store.UniformSettings) : async () {
    StoreLib.updateUniformSettings(accessGrants, demoState, uniformSettings, changeLog, counters, caller, settings);
  };

  /// Build the uniform order for one house filter (Admin, Store Manager or
  /// Training Manager).
  public query ({ caller }) func getUniformOrder(filter : Store.UniformHouseFilter) : async Store.UniformOrderView {
    StoreLib.getUniformOrder(accessGrants, demoState, roadies, positions, uniformSettings, caller, filter);
  };
};
