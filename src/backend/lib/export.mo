import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Nat "mo:core/Nat";
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
    ignore ChangeLog.record(changeLog, counters, caller, "buildFullExport", null, true, "Built the Full export");
    build(roadies, positions, checkoffs, true);
  };

  /// Internal: assemble the export payload. Availability (by shift and by day)
  /// is filled only when `includeContactSet` is true; the Shareable export
  /// returns empty availability arrays so it never leaks availability.
  func build(
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    positions : Map.Map<Common.PositionId, Store.Position>,
    checkoffs : Map.Map<Common.RoadieId, Phase23.OrientationCheckoff>,
    includeContactSet : Bool,
  ) : Export.ExportData {
    let allPositions = positions.values().toArray();
    let active = roadies.values().filter(func r = r.status != #archived).toArray();

    // Overview rows: one per position, in position-id order.
    let sortedPositions = allPositions.sort(func(a, b) = Nat.compare(a.id, b.id));
    var fohTotal = 0;
    var bohTotal = 0;
    var fohTotalPar = 0;
    var bohTotalPar = 0;
    let overview = sortedPositions.map(func(p) {
      let hired = active.filter(func(r) = r.mainPositionId == p.id).size();
      let par = p.openingBuildTo;
      switch (p.house) {
        case (#foh) { fohTotal += hired; fohTotalPar += par };
        case (#boh) { bohTotal += hired; bohTotalPar += par };
      };
      {
        positionName = p.name;
        totalPar = par;
        hired;
        need = saturatingSub(par, hired);
      };
    });

    // Group rows by position name, in position-id order.
    let groups = sortedPositions.map(func(p) {
      let rows = active.filter(func(r) = r.mainPositionId == p.id).map(func(r) {
        toRow(r, p, checkoffs.get(r.id), includeContactSet);
      });
      (p.name, rows);
    });

    {
      overview;
      fohTotal;
      bohTotal;
      grandTotal = fohTotal + bohTotal;
      fohTotalPar;
      fohNeed = saturatingSub(fohTotalPar, fohTotal);
      bohTotalPar;
      bohNeed = saturatingSub(bohTotalPar, bohTotal);
      grandTotalPar = fohTotalPar + bohTotalPar;
      grandNeed = saturatingSub(fohTotalPar + bohTotalPar, fohTotal + bohTotal);
      groups;
    };
  };

  /// Internal: one export row. Contact fields and availability are filled only
  /// when `includeContactSet` is true.
  func toRow(
    roadie : Roadie.Roadie,
    position : Store.Position,
    checkoff : ?Phase23.OrientationCheckoff,
    includeContactSet : Bool,
  ) : Export.ExportRow {
    let contact = roadie.contactSet;
    let availability : [Common.Shift] = if (includeContactSet) {
      switch (contact) {
        case (?cs) { cs.availability.map(func(s) = s.shift) };
        case null { [] };
      };
    } else {
      [];
    };
    let availabilityByDay : [(Common.Weekday, [Common.Shift])] = if (includeContactSet) {
      switch (contact) {
        case (?cs) { groupByDay(cs.availability) };
        case null { [] };
      };
    } else {
      [];
    };
    let onboardingComplete = switch (checkoff) {
      case (?c) { c.paperworkItems.size() > 0 };
      case null { false };
    };
    {
      dateHired = roadie.startDate;
      shirtSize = roadie.profile.shirtSize;
      weekdayLunch = roadie.profile.weekdayLunch;
      name = roadie.profile.name;
      phone = if (includeContactSet) { switch (contact) { case (?cs) { ?cs.phone }; case null { null } } } else { null };
      email = if (includeContactSet) { switch (contact) { case (?cs) { ?cs.email }; case null { null } } } else { null };
      emergencyContactName = if (includeContactSet) { switch (contact) { case (?cs) { ?cs.emergencyContactName }; case null { null } } } else { null };
      emergencyContactPhone = if (includeContactSet) { switch (contact) { case (?cs) { ?cs.emergencyContactPhone }; case null { null } } } else { null };
      dateOfBirth = if (includeContactSet) { switch (contact) { case (?cs) { ?cs.dateOfBirth }; case null { null } } } else { null };
      availabilityByDay;
      onboardingComplete;
      policiesComplete = onboardingComplete;
      alcoholCert = position.needsAlcoholCert;
      foodHandlers = false;
      availability;
    };
  };

  /// Internal: `a - b`, clamped at zero, without a trapping Nat subtraction.
  func saturatingSub(a : Nat, b : Nat) : Nat {
    if (a <= b) { 0 } else { a - b };
  };

  /// Internal: group availability slots by weekday, in the fixed Wed–Tue order.
  func groupByDay(slots : [Roadie.AvailabilitySlot]) : [(Common.Weekday, [Common.Shift])] {
    let order : [Common.Weekday] = [#wed, #thu, #fri, #sat, #sun, #mon, #tue];
    order.map(func(day) {
      let shifts = slots.filter(func(s) = s.day == day).map(func(s) = s.shift);
      (day, shifts);
    });
  };
};
