import Char "mo:core/Char";
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
import Age "age";

module {
  public type Counters = {
    var nextCrewId : Nat;
    var nextChangeLogId : Nat;
  };

  /// The store's default time zone when none is configured.
  let defaultTimeZone : Common.TimeZone = "America/Chicago";

  /// Recompute the non-sensitive derived fields (`isMinor`, `birthdayMonthDay`)
  /// from the contact-set date of birth in store time, so a roadie who turns 18
  /// stops being flagged as a minor on the next read. A roadie with no contact
  /// set keeps the stored values.
  func refreshDerived(roadie : Roadie.Roadie, timeZone : Common.TimeZone) : Roadie.Roadie {
    switch (roadie.contactSet) {
      case (?cs) {
        {
          roadie with
          isMinor = Age.isMinor(cs.dateOfBirth, Time.now(), timeZone);
          birthdayMonthDay = Age.birthdayMonthDay(cs.dateOfBirth);
        };
      };
      case null { roadie };
    };
  };

  /// Strip the contact set and the full photo bytes from a roadie card for
  /// callers that may not see them. The photo is fetched separately via
  /// `getPhoto`.
  func redact(roadie : Roadie.Roadie, canSee : Bool) : Roadie.Roadie {
    let refreshed = refreshDerived(roadie, defaultTimeZone);
    if (canSee) {
      // Managers keep the contact set but never the full photo bytes.
      { refreshed with photo = null };
    } else {
      { refreshed with photo = null; contactSet = null };
    };
  };

  /// List roadie cards visible to the caller, with contact-set fields stripped
  /// for every role except Admin and Store Manager. Integration sees only the
  /// Shareable export, never roadie cards. Full photo bytes are never returned;
  /// fetch a photo with `getPhoto`.
  public func listRoadies(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    caller : Principal,
  ) : [Roadie.Roadie] {
    let role = Auth.requireReadable(accessGrants, caller);
    let canSee = Auth.canSeeContactSet(accessGrants, caller);
    roadies.values()
      .filter(func(r) = visibleToRole(r, role, accessGrants, caller))
      .map(func(r) = redact(r, canSee))
      .toArray();
  };

  /// Read one roadie card, with contact-set fields stripped for non-managers.
  public func getRoadie(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    caller : Principal,
    id : Common.RoadieId,
  ) : ?Roadie.Roadie {
    let role = Auth.requireReadable(accessGrants, caller);
    let canSee = Auth.canSeeContactSet(accessGrants, caller);
    switch (roadies.get(id)) {
      case (?r) {
        if (not visibleToRole(r, role, accessGrants, caller)) {
          Runtime.trap("Access denied: roadie is not visible to this role");
        };
        ?redact(r, canSee);
      };
      case null { null };
    };
  };

  /// Read a roadie's photo bytes by id, for a caller allowed to see the roadie.
  /// Returns null when the roadie has no photo or is not visible to the caller.
  public func getPhoto(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    caller : Principal,
    id : Common.RoadieId,
  ) : ?Common.PhotoRef {
    let role = Auth.requireReadable(accessGrants, caller);
    switch (roadies.get(id)) {
      case (?r) {
        if (not visibleToRole(r, role, accessGrants, caller)) {
          return null;
        };
        r.photo;
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
    let canSee = Auth.canSeeContactSet(accessGrants, caller);
    roadies.values()
      .filter(func(r) = r.mainPositionId == positionId and visibleToRole(r, role, accessGrants, caller))
      .map(func(r) = redact(r, canSee))
      .toArray();
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
    let main = positions.get(mainPositionId) ?? Runtime.trap("Position not found");
    let second = switch (secondPositionId) {
      case (?sid) { ?(positions.get(sid) ?? Runtime.trap("Second position not found")) };
      case null { null };
    };
    // Age gate: the roadie must meet the minimum age of every assigned position.
    switch (roadie.contactSet) {
      case (?cs) {
        let now = Time.now();
        if (not Age.meetsMinimumAge(cs.dateOfBirth, main.minimumAge, now, defaultTimeZone)) {
          Runtime.trap("Roadie is below the minimum age for this position");
        };
        switch (second) {
          case (?p) {
            if (not Age.meetsMinimumAge(cs.dateOfBirth, p.minimumAge, now, defaultTimeZone)) {
              Runtime.trap("Roadie is below the minimum age for the second position");
            };
          };
          case null {};
        };
      };
      case null {};
    };
    roadies.add(id, { roadie with mainPositionId; secondPositionId; crewId });
    ignore ChangeLog.record(changeLog, counters, caller, "changePosition", ?id, false, "Changed position");
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
    roadies.add(id, { roadie with status = #archived; archivedReason = ?reason; archivedAt = ?Time.now() });
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
    let trimmed = switch (reason) {
      case (?r) { r.trim(#predicate(func(c : Char) : Bool { c.isWhitespace() })) };
      case null { "" };
    };
    if (trimmed.size() == 0) {
      Runtime.trap("A rehire reason is required");
    };
    let roadie = roadies.get(id) ?? Runtime.trap("Roadie not found");
    roadies.add(id, { roadie with status = #hired; archivedReason = null; archivedAt = null });
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
    switch (status) {
      case (#archived) { Runtime.trap("Use archiveRoadie to archive a roadie") };
      case (_) {};
    };
    let roadie = roadies.get(id) ?? Runtime.trap("Roadie not found");
    if (roadie.status == #archived) {
      Runtime.trap("Use rehireRoadie to restore an archived roadie");
    };
    roadies.add(id, { roadie with status });
    ignore ChangeLog.record(changeLog, counters, caller, "updateRoadieStatus", ?id, false, "Updated roadie status");
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
    let role = Auth.requireReadable(accessGrants, caller);
    if (not Auth.canSeeContactSet(accessGrants, caller)) {
      return [];
    };
    switch (roadies.get(id)) {
      case (?r) {
        if (not visibleToRole(r, role, accessGrants, caller)) {
          return [];
        };
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
    let active = roadies.values().filter(func r = r.status != #archived).toArray();
    positions.values().map(func(p) {
      let onHand = active.filter(func(r) = r.mainPositionId == p.id).size();
      {
        positionId = p.id;
        positionName = p.name;
        onHand;
        buildTo = p.openingBuildTo;
        openSpots = saturatingSub(p.openingBuildTo, onHand);
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
    let cs = roadie.contactSet ?? Runtime.trap("Roadie has no contact set");
    let updated : Roadie.ContactSet = {
      cs with
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
      return [];
    };
    changeLog.values()
      .filter(func(e) = changeLogVisibleToRole(e, role, accessGrants, caller, roadies))
      .toArray();
  };

  /// Internal: whether a change-log entry is visible to a role. Contact-set
  /// entries are hidden from every non-manager role, consistent with the roadie
  /// contact-set redaction. Trainers are further limited to entries about
  /// roadies in their approved stations.
  func changeLogVisibleToRole(
    entry : Roadie.ChangeLogEntry,
    role : Common.Role,
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    caller : Principal,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
  ) : Bool {
    if (entry.touchesContactSet and not Auth.isManager(accessGrants, caller)) {
      return false;
    };
    if (role != #trainer) {
      return true;
    };
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
        switch (r.contactSet) {
          case (?cs) { Age.isMinor(cs.dateOfBirth, Time.now(), defaultTimeZone) };
          case null { r.isMinor };
        };
      };
      case null { false };
    };
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
      case (#integration) { false };
      case (#trainer) {
        switch (accessGrants.get(caller)) {
          case (?grant) {
            grant.trainerPositionIds.any(func(pid) =
              pid == roadie.mainPositionId or roadie.secondPositionId == ?pid
            );
          };
          case null { false };
        };
      };
      case (_) { true };
    };
  };
};
