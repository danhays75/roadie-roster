import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Common "../types/common";
import Store "../types/store";
import Roadie "../types/roadie";
import Phase23 "../types/phase23";
import Export "../types/export";
import Access "../types/access";
import ExportLib "../lib/export";

mixin (
  accessGrants : Map.Map<Principal, Access.AccessGrant>,
  roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
  positions : Map.Map<Common.PositionId, Store.Position>,
  checkoffs : Map.Map<Common.RoadieId, Phase23.OrientationCheckoff>,
  changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
  counters : ExportLib.Counters,
  demoState : Common.DemoState,
) {
  /// Build the Shareable export (no contact set).
  public query ({ caller }) func buildShareableExport() : async Export.ExportData {
    ExportLib.buildShareableExport(accessGrants, demoState, roadies, positions, checkoffs, caller);
  };

  /// Build the Full export including contact set (Admin/Store Manager only).
  public shared ({ caller }) func buildFullExport() : async Export.ExportData {
    ExportLib.buildFullExport(accessGrants, demoState, roadies, positions, checkoffs, changeLog, counters, caller);
  };
};
