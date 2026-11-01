import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Time "mo:core/Time";
import Common "../types/common";
import Roadie "../types/roadie";
import Store "../types/store";
import Access "../types/access";
import Auth "auth";
import ChangeLog "changelog";

module {
  public type Counters = {
    var nextCrewId : Nat;
    var nextChangeLogId : Nat;
  };

  /// Strip the contact set from a roadie card for non-manager callers.
  func redact(roadie : Roadie.Roadie, canSee : Bool) : Roadie.Roadie {
    if (canSee) { roadie } else { { roadie with contactSet = null } };
  };

  /// List roadie cards visible to the caller, with contact-set fields stripped
  /// for every role except Admin and Store Manager. Integration sees only the
  /// Shareable export, never roadie cards.
  public func listRoadies(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    caller : Principal,
  ) : [Roadie.Roadie] {
    let role = Auth.requireReadable(accessGrants, caller);
    if (role == #integration) {
      Runtime.trap("Access denied: Integration may only read the Shareable export");
    };
    let canSee = Auth.canSeeContactSet(accessGrants, caller);
    let visible = roadies.values().filter(func r = visibleToRole(r, role, accessGrants, caller));
    visible.map(func r = redact(r, canSee)).toArray();
  };

  /// Read one roadie card, with contact-set fields stripped for non-managers.
  public func getRoadie(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    caller : Principal,
    id : Common.RoadieId,
  ) : ?Roadie.Roadie {
    let role = Auth.requireReadable(accessGrants, caller);
    if (role == #integration) {
      Runtime.trap("Access denied: Integration may only read the Shareable export");
    };
    switch (roadies.get(id)) {
      case (?r) {
        if (not visibleToRole(r, role, accessGrants, caller)) { null }
        else { ?redact(r, Auth.canSeeContactSet(accessGrants, caller)) };
      };
      case null { null };
    };
  };

  /// List the roster for one position, including archived roadies.
  public func listRosterForPosition(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    caller : Principal,
    positionId : Common.PositionId,
  ) : [Roadie.Roadie] {
    let role = Auth.requireReadable(accessGrants, caller);
    if (role == #integration) {
      Runtime.trap("Access denied: Integration may only read the Shareable export");
    };
    let canSee = Auth.canSeeContactSet(accessGrants, caller);
    let visible = roadies.values().filter(func r =
      (r.mainPositionId == positionId or r.secondPositionId == ?positionId)
      and visibleToRole(r, role, accessGrants, caller)
    );
    visible.map(func r = redact(r, canSee)).toArray();
  };

  /// Edit a roadie's non-contact details (Admin/Store Manager only).
  public func updateRoadieDetails(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    id : Common.RoadieId,
    profile : Roadie.RoadieProfile,
  ) : () {
    Auth.requireManager(accessGrants, caller);
    let roadie = roadies.get(id) ?? Runtime.trap("Roadie not found");
    roadies.add(id, { roadie with profile });
    ignore ChangeLog.record(changeLog, counters, caller, "updateRoadieDetails", ?id, false, "Updated roadie details");
  };

  /// Change a roadie's position or crew, moving the on-hand count (Admin/Store
  /// Manager only). Blocks when the roadie's real age in store time is below
  /// the minimum age of either the main or the second position.
  public func changePosition(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    positions : Map.Map<Common.PositionId, Store.Position>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    id : Common.RoadieId,
    mainPositionId : Common.PositionId,
    secondPositionId : ?Common.PositionId,
    crewId : ?Common.CrewId,
  ) : () {
    Auth.requireManager(accessGrants, caller);
    let roadie = roadies.get(id) ?? Runtime.trap("Roadie not found");
    let target = positions.get(mainPositionId) ?? Runtime.trap("Position not found");
    // Block assigning a roadie below the position's minimum age, for both the
    // main and the second position, using the real age in store time.
    switch (roadieAge(roadie)) {
      case (?age) {
        if (age < target.minimumAge) {
          Runtime.trap("Roadie is below the minimum age for " # target.name);
        };
        switch (secondPositionId) {
          case (?secondId) {
            let second = positions.get(secondId) ?? Runtime.trap("Position not found");
            if (age < second.minimumAge) {
              Runtime.trap("Roadie is below the minimum age for " # second.name);
            };
          };
          case null {};
        };
      };
      case null {};
    };
    roadies.add(id, { roadie with mainPositionId; secondPositionId; crewId });
    ignore ChangeLog.record(changeLog, counters, caller, "changePosition", ?id, false, "Changed position to " # target.name);
  };

  /// Archive a roadie with a required reason (Admin/Store Manager only).
  public func archiveRoadie(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    id : Common.RoadieId,
    reason : Roadie.ArchiveReason,
  ) : () {
    Auth.requireManager(accessGrants, caller);
    let roadie = roadies.get(id) ?? Runtime.trap("Roadie not found");
    if (roadie.status == #archived) {
      Runtime.trap("Roadie is already archived");
    };
    roadies.add(id, {
      roadie with
      status = #archived;
      archivedReason = ?reason;
      archivedAt = ?Time.now();
    });
    ignore ChangeLog.record(changeLog, counters, caller, "archiveRoadie", ?id, false, "Archived roadie");
  };

  /// Rehire an archived roadie (Admin/Store Manager only). A non-blank reason
  /// is always required.
  public func rehireRoadie(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    id : Common.RoadieId,
    reason : ?Text,
  ) : () {
    Auth.requireManager(accessGrants, caller);
    let roadie = roadies.get(id) ?? Runtime.trap("Roadie not found");
    if (roadie.status != #archived) {
      Runtime.trap("Roadie is not archived");
    };
    // A rehire always requires a non-blank reason.
    let trimmed = switch (reason) {
      case (?r) { r.trim(#predicate(func c = c == ' ' or c == '\t' or c == '\n' or c == '\r')) };
      case null { "" };
    };
    if (trimmed == "") {
      Runtime.trap("A reason is required to rehire a roadie");
    };
    roadies.add(id, {
      roadie with
      status = #hired;
      archivedReason = null;
      archivedAt = null;
    });
    ignore ChangeLog.record(changeLog, counters, caller, "rehireRoadie", ?id, false, "Rehired roadie");
  };

  /// Update a roadie's status (Admin/Store Manager only). This never sets or
  /// clears the archived status; only archiveRoadie and rehireRoadie may.
  public func updateRoadieStatus(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    id : Common.RoadieId,
    status : Roadie.RoadieStatus,
  ) : () {
    Auth.requireManager(accessGrants, caller);
    let roadie = roadies.get(id) ?? Runtime.trap("Roadie not found");
    if (status == #archived) {
      Runtime.trap("Use archiveRoadie to archive a roadie");
    };
    if (roadie.status == #archived) {
      Runtime.trap("Use rehireRoadie to change an archived roadie's status");
    };
    roadies.add(id, { roadie with status });
    ignore ChangeLog.record(changeLog, counters, caller, "updateRoadieStatus", ?id, false, "Updated status");
  };

  /// Read a roadie's contact set. Admin and Store Manager receive the contact
  /// set; every other read-capable role receives an empty array (never a trap
  /// and never undefined), so the redaction is observable and consistent.
  public func getContactSet(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    caller : Principal,
    id : Common.RoadieId,
  ) : [Roadie.ContactSet] {
    ignore Auth.requireReadable(accessGrants, caller);
    if (not Auth.canSeeContactSet(accessGrants, caller)) {
      return [];
    };
    switch (roadies.get(id)) {
      case (?r) {
        switch (r.contactSet) {
          case (?cs) { [cs] };
          case null { [] };
        };
      };
      case null { [] };
    };
  };

  /// Per-position roster counts: on-hand roadies and open spots. Each roadie
  /// counts once, under their main position only; the second position is
  /// cross-trained and does not count toward on-hand. Open spots is the
  /// build-to target minus on-hand, clamped at zero.
  public func getRosterSummary(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    positions : Map.Map<Common.PositionId, Store.Position>,
    caller : Principal,
  ) : [Roadie.RosterSummary] {
    ignore Auth.requireReadable(accessGrants, caller);
    // On-hand is derived, never stored: a roadie counts toward exactly one
    // position — its main position — when it is not archived.
    let active = roadies.values().filter(func r = r.status != #archived).toArray();
    positions.values().map(func p : Roadie.RosterSummary {
      let onHand = active.filter(func r = r.mainPositionId == p.id).size();
      let buildTo = p.openingBuildTo;
      {
        positionId = p.id;
        positionName = p.name;
        onHand;
        buildTo = buildTo;
        openSpots = saturatingSub(buildTo, onHand);
      };
    }).toArray();
  };

  /// Internal: `a - b`, clamped at zero, without a trapping Nat subtraction.
  func saturatingSub(a : Nat, b : Nat) : Nat {
    if (a <= b) { 0 } else { a - b };
  };

  /// Update a roadie's contact set (Admin/Store Manager only).
  public func updateContactSet(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    id : Common.RoadieId,
    contactSet : Roadie.ContactSet,
  ) : () {
    Auth.requireManager(accessGrants, caller);
    let roadie = roadies.get(id) ?? Runtime.trap("Roadie not found");
    roadies.add(id, { roadie with contactSet = ?contactSet });
    ignore ChangeLog.record(changeLog, counters, caller, "updateContactSet", ?id, true, "Updated contact set");
  };

  /// Re-sign a roadie's availability (Admin/Store Manager only).
  public func resignAvailability(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    id : Common.RoadieId,
    signature : Common.SignatureRef,
  ) : () {
    Auth.requireManager(accessGrants, caller);
    let roadie = roadies.get(id) ?? Runtime.trap("Roadie not found");
    let contactSet = roadie.contactSet ?? Runtime.trap("Roadie has no contact set");
    let updated : Roadie.ContactSet = {
      contactSet with
      availabilitySignature = ?signature;
      availabilitySignedAt = ?Time.now();
      availabilityResignPending = false;
    };
    roadies.add(id, { roadie with contactSet = ?updated });
    ignore ChangeLog.record(changeLog, counters, caller, "resignAvailability", ?id, true, "Re-signed availability");
  };

  /// List crews (any role except Kiosk).
  public func listCrews(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    crews : Map.Map<Common.CrewId, Roadie.Crew>,
    caller : Principal,
  ) : [Roadie.Crew] {
    ignore Auth.requireReadable(accessGrants, caller);
    crews.values().toArray();
  };

  /// Create a crew (Admin/Store Manager only).
  public func createCrew(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    crews : Map.Map<Common.CrewId, Roadie.Crew>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    name : Text,
  ) : Common.CrewId {
    Auth.requireManager(accessGrants, caller);
    let id = counters.nextCrewId;
    counters.nextCrewId := id + 1;
    crews.add(id, { id; name });
    ignore ChangeLog.record(changeLog, counters, caller, "createCrew", null, false, "Created crew " # name);
    id;
  };

  /// List change-log entries visible to the caller. Integration sees only the
  /// Shareable export, so it receives no change log. A trainer sees only
  /// entries about roadies in their approved stations.
  public func listChangeLog(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    caller : Principal,
  ) : [Roadie.ChangeLogEntry] {
    let role = Auth.requireReadable(accessGrants, caller);
    if (role == #integration) {
      Runtime.trap("Access denied: Integration may only read the Shareable export");
    };
    let canSee = Auth.canSeeContactSet(accessGrants, caller);
    changeLog.values().filter(func e =
      (canSee or not e.touchesContactSet)
      and changeLogVisibleToRole(e, role, accessGrants, caller, roadies)
    ).toArray();
  };

  /// Internal: whether a change-log entry is visible to a role. Trainers are
  /// limited to entries about roadies in their approved stations.
  func changeLogVisibleToRole(
    entry : Roadie.ChangeLogEntry,
    role : Common.Role,
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    caller : Principal,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
  ) : Bool {
    switch (role) {
      case (#trainer) {
        switch (entry.subjectRoadieId) {
          case (?rid) {
            switch (roadies.get(rid)) {
              case (?r) { visibleToRole(r, role, accessGrants, caller) };
              case null { false };
            };
          };
          case null { false };
        };
      };
      case _ { true };
    };
  };

  /// Compute whether a roadie is a minor as of now, in store time.
  public func isMinor(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    caller : Principal,
    id : Common.RoadieId,
  ) : Bool {
    ignore Auth.requireReadable(accessGrants, caller);
    switch (roadies.get(id)) {
      case (?r) {
        switch (roadieAge(r)) {
          case (?age) { age < 18 };
          case null { false };
        };
      };
      case null { false };
    };
  };

  /// Internal: a roadie's real age in years as of now, in store time
  /// (America/Chicago), or null when there is no date of birth.
  func roadieAge(roadie : Roadie.Roadie) : ?Nat {
    switch (roadie.contactSet) {
      case (?cs) { ageInYears(cs.dateOfBirth, Time.now()) };
      case null { null };
    };
  };

  /// Shared age helper: real age in whole years between a date of birth and a
  /// moment, both UTC nanosecond timestamps, evaluated in store time
  /// (America/Chicago) with leap years. Returns null for a non-positive date of
  /// birth or a birth date in the future.
  public func ageInYears(dateOfBirth : Common.DateOnly, at : Common.Timestamp) : ?Nat {
    if (dateOfBirth <= 0) { return null };
    let (by, bm, bd) = storeCivilDate(dateOfBirth);
    let (cy, cm, cd) = storeCivilDate(at);
    if (cy < by) { return null };
    var age = cy - by;
    // Subtract a year when this year's birthday has not yet occurred.
    if (cm < bm or (cm == bm and cd < bd)) {
      age -= 1;
    };
    if (age < 0) { null } else { ?age.toNat() };
  };

  /// Internal: the store-local civil (year, month, day) for a UTC nanosecond
  /// timestamp, applying the America/Chicago offset (CST −6h, CDT −5h).
  func storeCivilDate(ts : Common.Timestamp) : (Int, Int, Int) {
    let offsetSeconds = chicagoOffsetSeconds(ts);
    let localSeconds = ts / 1_000_000_000 + offsetSeconds;
    let days = floorDiv(localSeconds, 86_400);
    civilFromDays(days);
  };

  /// Internal: the America/Chicago UTC offset in seconds for a UTC instant.
  /// DST runs from the second Sunday of March to the first Sunday of November.
  func chicagoOffsetSeconds(ts : Common.Timestamp) : Int {
    let utcSeconds = ts / 1_000_000_000;
    let utcDays = floorDiv(utcSeconds, 86_400);
    let (year, _, _) = civilFromDays(utcDays);
    let dstStart = nthSundayOfMarch(year, 2) * 86_400 + 8 * 3600;
    let dstEnd = firstSundayOfNovember(year) * 86_400 + 7 * 3600;
    if (utcSeconds >= dstStart and utcSeconds < dstEnd) {
      -5 * 3600;
    } else {
      -6 * 3600;
    };
  };

  /// Internal: days since the Unix epoch of the nth (1-based) Sunday of March.
  func nthSundayOfMarch(year : Int, n : Int) : Int {
    let march1 = daysFromCivil(year, 3, 1);
    let weekday = weekdayOf(march1);
    // weekday: 0 = Sunday. First Sunday is on or after March 1.
    let firstSunday = march1 + (7 - weekday) % 7;
    firstSunday + (n - 1) * 7;
  };

  /// Internal: days since the Unix epoch of the first Sunday of November.
  func firstSundayOfNovember(year : Int) : Int {
    let nov1 = daysFromCivil(year, 11, 1);
    let weekday = weekdayOf(nov1);
    nov1 + (7 - weekday) % 7;
  };

  /// Internal: weekday (0 = Sunday) for days since the Unix epoch.
  func weekdayOf(days : Int) : Int {
    // 1970-01-01 was a Thursday (4).
    let w = (days + 4) % 7;
    if (w < 0) { w + 7 } else { w };
  };

  /// Internal: floor division for Int (rounds toward negative infinity).
  func floorDiv(a : Int, b : Int) : Int {
    let q = a / b;
    if (a % b != 0 and (a < 0) != (b < 0)) { q - 1 } else { q };
  };

  /// Internal: civil (year, month, day) from days since the Unix epoch
  /// (Howard Hinnant's algorithm), all in UTC.
  func civilFromDays(days : Int) : (Int, Int, Int) {
    let z = days + 719_468;
    let era = (if (z >= 0) { z } else { z - 146_096 }) / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if (mp < 10) { mp + 3 } else { mp - 9 };
    let year = if (m <= 2) { y + 1 } else { y };
    (year, m, d);
  };

  /// Internal: days since the Unix epoch for a civil (year, month, day)
  /// (Howard Hinnant's algorithm).
  func daysFromCivil(year : Int, month : Int, day : Int) : Int {
    let y = if (month <= 2) { year - 1 } else { year };
    let era = (if (y >= 0) { y } else { y - 399 }) / 400;
    let yoe = y - era * 400;
    let mp = if (month > 2) { month - 3 } else { month + 9 };
    let doy = (153 * mp + 2) / 5 + day - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468;
  };

  /// Internal: whether a roadie is visible to a role. A trainer sees only
  /// roadies in their approved stations; a trainer with no approved stations
  /// sees no roadies. Integration sees only the Shareable export.
  func visibleToRole(
    roadie : Roadie.Roadie,
    role : Common.Role,
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    caller : Principal,
  ) : Bool {
    switch (role) {
      case (#trainer) {
        // Trainers see only roadies in their approved stations. A trainer with
        // no stations configured sees no roadies.
        switch (accessGrants.get(caller)) {
          case (?grant) {
            grant.trainerPositionIds.any(func pid =
              pid == roadie.mainPositionId or roadie.secondPositionId == ?pid
            );
          };
          case null { false };
        };
      };
      case (#integration) { false };
      case _ { true };
    };
  };
};
