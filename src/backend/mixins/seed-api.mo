import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Common "../types/common";
import Store "../types/store";
import Roadie "../types/roadie";
import Access "../types/access";
import SeedLib "../lib/seed";

mixin (
  accessGrants : Map.Map<Principal, Access.AccessGrant>,
  demoState : Common.DemoState,
  storeInfo : { var value : Store.StoreInfo },
  positions : Map.Map<Common.PositionId, Store.Position>,
  schedule : Map.Map<Common.EventId, Store.ScheduleEvent>,
  checklists : { var value : Store.Checklists },
  retention : { var value : Store.RetentionSettings },
  uniformSettings : { var value : Store.UniformSettings },
  counters : SeedLib.Counters,
) {
  /// Re-seed the store when it has no positions yet. Idempotent; returns true
  /// when a seed was applied, false when the store already had positions.
  public shared ({ caller }) func ensureSeeded() : async Bool {
    SeedLib.ensureSeeded(accessGrants, demoState, storeInfo, positions, schedule, checklists, retention, uniformSettings, counters, caller);
  };
};
