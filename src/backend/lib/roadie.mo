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
  /// for every role except Admin and Store Manager.
  public func listRoadies(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    caller : Principal,
  ) : [Roadie.Roadie] {
    let role = Auth.requireReadable(accessGrants, caller);
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

  /// Change a roadie's position or crew, moving the on-hand count (Admin/Store Manager only).
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
    // Block assigning a minor to a position whose minimum age is higher.
    if (isMinorRoadie(roadie) and target.minimumAge > 18) {
      Runtime.trap("Cannot assign a minor to a position with a higher minimum age");
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

  /// Rehire an archived roadie (Admin/Store Manager only).
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
    // Warn-and-require-reason for no-show or let-go archives.
    switch (roadie.archivedReason) {
      case (?#noShow) {
        if (reason == null) {
          Runtime.trap("A reason is required to rehire a no-show or let-go roadie");
        };
      };
      case (?#letGo) {
        if (reason == null) {
          Runtime.trap("A reason is required to rehire a no-show or let-go roadie");
        };
      };
      case _ {};
    };
    roadies.add(id, {
      roadie with
      status = #hired;
      archivedReason = null;
      archivedAt = null;
    });
    ignore ChangeLog.record(changeLog, counters, caller, "rehireRoadie", ?id, false, "Rehired roadie");
  };

  /// Update a roadie's status (Admin/Store Manager only).
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

  /// Per-position roster counts: on-hand roadies and open spots. On-hand is
  /// derived from non-archived roadies assigned to the position; open spots is
  /// the build-to target minus on-hand, clamped at zero.
  public func getRosterSummary(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    positions : Map.Map<Common.PositionId, Store.Position>,
    caller : Principal,
  ) : [Roadie.RosterSummary] {
    ignore Auth.requireReadable(accessGrants, caller);
    // On-hand is derived, never stored: a roadie counts toward a position when
    // it is not archived and is assigned to that position as main or second.
    let active = roadies.values().filter(func r = r.status != #archived).toArray();
    positions.values().map(func p : Roadie.RosterSummary {
      let onHand = active.filter(func r =
        r.mainPositionId == p.id or r.secondPositionId == ?p.id
      ).size();
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

  /// List change-log entries visible to the caller.
  public func listChangeLog(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    caller : Principal,
  ) : [Roadie.ChangeLogEntry] {
    ignore Auth.requireReadable(accessGrants, caller);
    let canSee = Auth.canSeeContactSet(accessGrants, caller);
    changeLog.values().filter(func e = canSee or not e.touchesContactSet).toArray();
  };

  /// Compute whether a roadie is a minor as of now.
  public func isMinor(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    caller : Principal,
    id : Common.RoadieId,
  ) : Bool {
    ignore Auth.requireReadable(accessGrants, caller);
    switch (roadies.get(id)) {
      case (?r) { isMinorRoadie(r) };
      case null { false };
    };
  };

  /// Internal: minor status from date of birth (18 years in nanoseconds).
  func isMinorRoadie(roadie : Roadie.Roadie) : Bool {
    switch (roadie.contactSet) {
      case (?cs) {
        let eighteenYearsNs : Int = 18 * 365 * 24 * 60 * 60 * 1_000_000_000;
        Time.now() < cs.dateOfBirth + eighteenYearsNs;
      };
      case null { false };
    };
  };

  /// Internal: whether a roadie is visible to a role.
  func visibleToRole(
    roadie : Roadie.Roadie,
    role : Common.Role,
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    caller : Principal,
  ) : Bool {
    switch (role) {
      case (#trainer) {
        // Trainers see only roadies in their approved stations. A trainer with
        // no stations configured is unrestricted, so the contact-set redaction
        // stays observable rather than hiding the record entirely.
        switch (accessGrants.get(caller)) {
          case (?grant) {
            if (grant.trainerPositionIds.size() == 0) {
              true;
            } else {
              grant.trainerPositionIds.any(func pid =
                pid == roadie.mainPositionId or roadie.secondPositionId == ?pid
              );
            };
          };
          case null { false };
        };
      };
      case (#integration) { true };
      case _ { true };
    };
  };
};
