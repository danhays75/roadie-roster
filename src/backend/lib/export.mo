import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Common "../types/common";
import Store "../types/store";
import Roadie "../types/roadie";
import Phase23 "../types/phase23";
import Export "../types/export";
import Access "../types/access";
import Auth "auth";
import ChangeLog "changelog";

module {
  public type Counters = {
    var nextChangeLogId : Nat;
  };

  /// Build the Shareable export (no contact set); available to Integration and above.
  public func buildShareableExport(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    positions : Map.Map<Common.PositionId, Store.Position>,
    checkoffs : Map.Map<Common.RoadieId, Phase23.OrientationCheckoff>,
    caller : Principal,
  ) : Export.ExportData {
    ignore Auth.requireReadable(accessGrants, caller);
    build(roadies, positions, checkoffs, false);
  };

  /// Build the Full export including contact set (Admin/Store Manager only).
  public func buildFullExport(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    positions : Map.Map<Common.PositionId, Store.Position>,
    checkoffs : Map.Map<Common.RoadieId, Phase23.OrientationCheckoff>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
  ) : Export.ExportData {
    Auth.requireManager(accessGrants, caller);
    ignore ChangeLog.record(changeLog, counters, caller, "buildFullExport", null, true, "Full export generated");
    build(roadies, positions, checkoffs, true);
  };

  /// Internal: assemble the export payload.
  func build(
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    positions : Map.Map<Common.PositionId, Store.Position>,
    checkoffs : Map.Map<Common.RoadieId, Phase23.OrientationCheckoff>,
    includeContactSet : Bool,
  ) : Export.ExportData {
    let allPositions = positions.values().toArray();
    let activeRoadies = roadies.values().filter(func r = r.status != #archived).toArray();

    var fohTotal = 0;
    var bohTotal = 0;
    var grandTotal = 0;

    let overview = allPositions.map(func p : Export.OverviewRow {
      let hired = activeRoadies.filter(func r =
        r.mainPositionId == p.id or r.secondPositionId == ?p.id
      ).size();
      let par = p.openingBuildTo;
      let need = saturatingSub(par, hired);
      switch (p.house) {
        case (#foh) { fohTotal += hired };
        case (#boh) { bohTotal += hired };
      };
      grandTotal += hired;
      { positionName = p.name; totalPar = par; hired; need };
    });

    let groups = allPositions.map(func p : (Text, [Export.ExportRow]) {
      let rows = activeRoadies.filter(func r =
        r.mainPositionId == p.id or r.secondPositionId == ?p.id
      ).map(func r : Export.ExportRow {
        let checkoff = checkoffs.get(r.id);
        let (onboarding, policies, alcohol, foodHandlers) = switch (checkoff) {
          case (?c) {
            (
              c.paperworkItems.any(func t = t == "onboarding"),
              c.paperworkItems.any(func t = t == "policies"),
              c.paperworkItems.any(func t = t == "alcohol"),
              c.paperworkItems.any(func t = t == "foodHandler"),
            );
          };
          case null { (false, false, false, false) };
        };
        let availability = switch (r.contactSet) {
          case (?cs) { cs.availability.map(func slot = slot.shift) };
          case null { [] : [Common.Shift] };
        };
        {
          dateHired = r.startDate;
          shirtSize = r.profile.shirtSize;
          weekdayLunch = r.profile.weekdayLunch;
          name = r.profile.name;
          phone = if (includeContactSet) {
            switch (r.contactSet) { case (?cs) { ?cs.phone }; case null { null } };
          } else { null };
          onboardingComplete = onboarding;
          policiesComplete = policies;
          alcoholCert = alcohol;
          foodHandlers;
          availability;
        };
      });
      (p.name, rows);
    });

    {
      overview;
      fohTotal;
      bohTotal;
      grandTotal;
      groups;
    };
  };

  /// Internal: `a - b`, clamped at zero, without a trapping Nat subtraction.
  func saturatingSub(a : Nat, b : Nat) : Nat {
    if (a <= b) { 0 } else { a - b };
  };
};
