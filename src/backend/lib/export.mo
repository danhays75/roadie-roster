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
    var fohTotalPar = 0;
    var bohTotalPar = 0;
    var grandTotalPar = 0;

    // On-hand counts each roadie once, under their main position only. A second
    // position is cross-trained and never adds to a position's on-hand count.
    let overview = allPositions.map(func p : Export.OverviewRow {
      let hired = activeRoadies.filter(func r = r.mainPositionId == p.id).size();
      let par = p.openingBuildTo;
      let need = saturatingSub(par, hired);
      switch (p.house) {
        case (#foh) {
          fohTotal += hired;
          fohTotalPar += par;
        };
        case (#boh) {
          bohTotal += hired;
          bohTotalPar += par;
        };
      };
      grandTotal += hired;
      grandTotalPar += par;
      { positionName = p.name; totalPar = par; hired; need };
    });

    let groups = allPositions.map(func p : (Text, [Export.ExportRow]) {
      let rows = activeRoadies.filter(func r = r.mainPositionId == p.id).map(func r : Export.ExportRow {
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
        let availabilityByDay = switch (r.contactSet) {
          case (?cs) { groupByDay(cs.availability) };
          case null { [] : [(Common.Weekday, [Common.Shift])] };
        };
        let contact = if (includeContactSet) { r.contactSet } else { null };
        {
          dateHired = r.startDate;
          shirtSize = r.profile.shirtSize;
          weekdayLunch = r.profile.weekdayLunch;
          name = r.profile.name;
          phone = switch (contact) { case (?cs) { ?cs.phone }; case null { null } };
          email = switch (contact) { case (?cs) { ?cs.email }; case null { null } };
          emergencyContactName = switch (contact) { case (?cs) { ?cs.emergencyContactName }; case null { null } };
          emergencyContactPhone = switch (contact) { case (?cs) { ?cs.emergencyContactPhone }; case null { null } };
          dateOfBirth = switch (contact) { case (?cs) { ?cs.dateOfBirth }; case null { null } };
          availabilityByDay;
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
      fohTotalPar;
      fohNeed = saturatingSub(fohTotalPar, fohTotal);
      bohTotalPar;
      bohNeed = saturatingSub(bohTotalPar, bohTotal);
      grandTotalPar;
      grandNeed = saturatingSub(grandTotalPar, grandTotal);
      groups;
    };
  };

  /// Internal: `a - b`, clamped at zero, without a trapping Nat subtraction.
  func saturatingSub(a : Nat, b : Nat) : Nat {
    if (a <= b) { 0 } else { a - b };
  };

  /// Internal: group availability slots by weekday, in the fixed Wed–Tue order.
  func groupByDay(slots : [Roadie.AvailabilitySlot]) : [(Common.Weekday, [Common.Shift])] {
    let order : [Common.Weekday] = [#wed, #thu, #fri, #sat, #sun, #mon, #tue];
    order.filterMap(func day {
      let shifts = slots.filter(func slot = slot.day == day).map(func slot = slot.shift);
      if (shifts.size() == 0) { null } else { ?(day, shifts) };
    });
  };
};
