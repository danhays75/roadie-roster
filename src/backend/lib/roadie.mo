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
import StoreLib "store";

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
  /// set keeps the stored values. `now` is the effective clock (the pretend date
  /// while demo mode is on).
  func refreshDerived(roadie : Roadie.Roadie, now : Common.Timestamp, timeZone : Common.TimeZone) : Roadie.Roadie {
    switch (roadie.contactSet) {
      case (?cs) {
        {
          roadie with
          isMinor = Age.isMinor(cs.dateOfBirth, now, timeZone);
          birthdayMonthDay = Age.birthdayMonthDay(cs.dateOfBirth);
        };
      };
      case null { roadie };
    };
  };

  /// Strip the contact set and the full photo bytes from a roadie card for
  /// callers that may not see them. The photo is fetched separately via
  /// `getPhoto`.
  func redact(roadie : Roadie.Roadie, canSee : Bool, now : Common.Timestamp) : Roadie.Roadie {
    let refreshed = refreshDerived(roadie, now, defaultTimeZone);
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
  /// fetch a photo with `getPhoto`. While demo mode is on only demo records are
  /// returned; while it is off demo records are invisible.
  public func listRoadies(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    caller : Principal,
  ) : [Roadie.Roadie] {
    let role = Auth.requireReadable(accessGrants, demoState, caller);
    let canSee = Auth.canSeeContactSet(accessGrants, demoState, caller);
    let now = effectiveNow(demoState);
    roadies.values()
      .filter(func(r) = r.isDemo == Auth.demoActive(demoState) and visibleToRole(r, role, accessGrants, demoState, caller))
      .map(func(r) = redact(r, canSee, now))
      .toArray();
  };

  /// Read one roadie card, with contact-set fields stripped for non-managers.
  public func getRoadie(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    caller : Principal,
    id : Common.RoadieId,
  ) : ?Roadie.Roadie {
    let role = Auth.requireReadable(accessGrants, demoState, caller);
    let canSee = Auth.canSeeContactSet(accessGrants, demoState, caller);
    let now = effectiveNow(demoState);
    switch (roadies.get(id)) {
      case (?r) {
        if (r.isDemo != Auth.demoActive(demoState) or not visibleToRole(r, role, accessGrants, demoState, caller)) {
          Runtime.trap("Access denied: roadie is not visible to this role");
        };
        ?redact(r, canSee, now);
      };
      case null { null };
    };
  };

  /// Read a roadie's photo bytes by id, for a caller allowed to see the roadie.
  /// Returns null when the roadie has no photo or is not visible to the caller.
  public func getPhoto(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    caller : Principal,
    id : Common.RoadieId,
  ) : ?Common.PhotoRef {
    let role = Auth.requireReadable(accessGrants, demoState, caller);
    switch (roadies.get(id)) {
      case (?r) {
        if (r.isDemo != Auth.demoActive(demoState) or not visibleToRole(r, role, accessGrants, demoState, caller)) {
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
    demoState : Common.DemoState,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    caller : Principal,
    positionId : Common.PositionId,
  ) : [Roadie.Roadie] {
    let role = Auth.requireReadable(accessGrants, demoState, caller);
    let canSee = Auth.canSeeContactSet(accessGrants, demoState, caller);
    let now = effectiveNow(demoState);
    roadies.values()
      .filter(func(r) = r.isDemo == Auth.demoActive(demoState) and r.mainPositionId == positionId and visibleToRole(r, role, accessGrants, demoState, caller))
      .map(func(r) = redact(r, canSee, now))
      .toArray();
  };

  /// Edit a roadie's non-contact details (Admin/Store Manager only).
  public func updateRoadieDetails(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    id : Common.RoadieId,
    profile : Roadie.RoadieProfile,
  ) : () {
    Auth.requireManager(accessGrants, demoState, caller);
    let roadie = requireVisibleRoadie(roadies, demoState, id);
    roadies.add(id, { roadie with profile });
    logWrite(changeLog, counters, demoState, caller, "updateRoadieDetails", ?id, false, "Updated roadie details");
  };

  /// Change a roadie's position or crew, moving the on-hand count (Admin/Store
  /// Manager only). Blocks when the roadie's real age in store time is below
  /// the minimum age of either the main or the second position.
  public func changePosition(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
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
    Auth.requireManager(accessGrants, demoState, caller);
    let roadie = requireVisibleRoadie(roadies, demoState, id);
    let main = positions.get(mainPositionId) ?? Runtime.trap("Position not found");
    let second = switch (secondPositionId) {
      case (?sid) { ?(positions.get(sid) ?? Runtime.trap("Second position not found")) };
      case null { null };
    };
    // Age gate: the roadie must meet the minimum age of every assigned position.
    switch (roadie.contactSet) {
      case (?cs) {
        let now = effectiveNow(demoState);
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
    logWrite(changeLog, counters, demoState, caller, "changePosition", ?id, false, "Changed position");
  };

  /// Archive a roadie with a required reason (Admin/Store Manager only).
  public func archiveRoadie(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    id : Common.RoadieId,
    reason : Roadie.ArchiveReason,
  ) : () {
    Auth.requireManager(accessGrants, demoState, caller);
    let roadie = requireVisibleRoadie(roadies, demoState, id);
    roadies.add(id, { roadie with status = #archived; archivedReason = ?reason; archivedAt = ?effectiveNow(demoState) });
    logWrite(changeLog, counters, demoState, caller, "archiveRoadie", ?id, false, "Archived roadie");
  };

  /// Rehire an archived roadie (Admin/Store Manager only). A non-blank reason
  /// is always required. The roadie returns to pending and is assigned to the
  /// next upcoming orientation session; the rehire is logged with who and the
  /// reason.
  public func rehireRoadie(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    schedule : Map.Map<Common.EventId, Store.ScheduleEvent>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    id : Common.RoadieId,
    reason : ?Text,
  ) : () {
    Auth.requireManager(accessGrants, demoState, caller);
    let trimmed = switch (reason) {
      case (?r) { r.trim(#predicate(func(c : Char) : Bool { c.isWhitespace() })) };
      case null { "" };
    };
    if (trimmed.size() == 0) {
      Runtime.trap("A rehire reason is required");
    };
    let roadie = requireVisibleRoadie(roadies, demoState, id);
    let nextSession = switch (StoreLib.nextOrientationEvent(schedule, effectiveNow(demoState))) {
      case (?event) { ?event.id };
      case null { roadie.orientationEventId };
    };
    roadies.add(id, {
      roadie with
      status = #hired;
      archivedReason = null;
      archivedAt = null;
      rosterState = #pending;
      orientationEventId = nextSession;
    });
    logWrite(changeLog, counters, demoState, caller, "rehireRoadie", ?id, false, "Rehired roadie: " # trimmed);
  };

  /// Update a roadie's status (Admin/Store Manager only). This never sets or
  /// clears the archived status; only archiveRoadie and rehireRoadie may.
  public func updateRoadieStatus(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    id : Common.RoadieId,
    status : Roadie.RoadieStatus,
  ) : () {
    Auth.requireManager(accessGrants, demoState, caller);
    switch (status) {
      case (#archived) { Runtime.trap("Use archiveRoadie to archive a roadie") };
      case (_) {};
    };
    let roadie = requireVisibleRoadie(roadies, demoState, id);
    if (roadie.status == #archived) {
      Runtime.trap("Use rehireRoadie to restore an archived roadie");
    };
    roadies.add(id, { roadie with status });
    logWrite(changeLog, counters, demoState, caller, "updateRoadieStatus", ?id, false, "Updated roadie status");
  };

  /// Read a roadie's contact set. Admin and Store Manager receive the contact
  /// set; every other read-capable role receives an empty array (never a trap
  /// and never undefined), so the redaction is observable and consistent.
  public func getContactSet(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    caller : Principal,
    id : Common.RoadieId,
  ) : [Roadie.ContactSet] {
    let role = Auth.requireReadable(accessGrants, demoState, caller);
    if (not Auth.canSeeContactSet(accessGrants, demoState, caller)) {
      return [];
    };
    switch (roadies.get(id)) {
      case (?r) {
        if (r.isDemo != Auth.demoActive(demoState) or not visibleToRole(r, role, accessGrants, demoState, caller)) {
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
  /// build-to target minus on-hand, clamped at zero. Demo records count only
  /// while demo mode is on.
  public func getRosterSummary(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    positions : Map.Map<Common.PositionId, Store.Position>,
    caller : Principal,
  ) : [Roadie.RosterSummary] {
    ignore Auth.requireReadable(accessGrants, demoState, caller);
    let active = roadies.values().filter(func r = r.isDemo == Auth.demoActive(demoState) and r.status != #archived).toArray();
    positions.values().map(func(p) {
      let forPosition = active.filter(func(r) = r.mainPositionId == p.id);
      let onHand = forPosition.size();
      let pending = forPosition.filter(func(r) = r.rosterState == #pending).size();
      let activeCount = forPosition.filter(func(r) = r.rosterState == #active).size();
      {
        positionId = p.id;
        positionName = p.name;
        onHand;
        pending;
        active = activeCount;
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
    demoState : Common.DemoState,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    id : Common.RoadieId,
    contactSet : Roadie.ContactSet,
  ) : () {
    Auth.requireManager(accessGrants, demoState, caller);
    let roadie = requireVisibleRoadie(roadies, demoState, id);
    roadies.add(id, { roadie with contactSet = ?contactSet });
    logWrite(changeLog, counters, demoState, caller, "updateContactSet", ?id, true, "Updated contact set");
  };

  /// Re-sign a roadie's availability (Admin/Store Manager only).
  public func resignAvailability(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    id : Common.RoadieId,
    signature : Common.SignatureRef,
  ) : () {
    Auth.requireManager(accessGrants, demoState, caller);
    let roadie = requireVisibleRoadie(roadies, demoState, id);
    let cs = roadie.contactSet ?? Runtime.trap("Roadie has no contact set");
    let updated : Roadie.ContactSet = {
      cs with
      availabilitySignature = ?signature;
      availabilitySignedAt = ?effectiveNow(demoState);
      availabilityResignPending = false;
    };
    roadies.add(id, { roadie with contactSet = ?updated });
    logWrite(changeLog, counters, demoState, caller, "resignAvailability", ?id, true, "Re-signed availability");
  };

  /// List crews (any role except Kiosk). Demo crews are visible only while demo
  /// mode is on.
  public func listCrews(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    crews : Map.Map<Common.CrewId, Roadie.Crew>,
    caller : Principal,
  ) : [Roadie.Crew] {
    ignore Auth.requireReadable(accessGrants, demoState, caller);
    crews.values().filter(func c = c.isDemo == Auth.demoActive(demoState)).toArray();
  };

  /// Create a crew (Admin/Store Manager only). A crew created while demo mode
  /// is on is a demo crew.
  public func createCrew(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    crews : Map.Map<Common.CrewId, Roadie.Crew>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    name : Text,
  ) : Common.CrewId {
    Auth.requireManager(accessGrants, demoState, caller);
    let id = counters.nextCrewId;
    counters.nextCrewId := id + 1;
    crews.add(id, { id; name; leaderPrincipal = null; isDemo = Auth.demoActive(demoState) });
    logWrite(changeLog, counters, demoState, caller, "createCrew", null, false, "Created crew " # name);
    id;
  };

  /// Rename a crew and/or change its leader (Admin/Store Manager only).
  public func updateCrew(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    crews : Map.Map<Common.CrewId, Roadie.Crew>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    id : Common.CrewId,
    name : Text,
    leaderPrincipal : ?Principal,
  ) : () {
    Auth.requireManager(accessGrants, demoState, caller);
    let crew = requireVisibleCrew(crews, demoState, id);
    crews.add(id, { crew with name; leaderPrincipal });
    logWrite(changeLog, counters, demoState, caller, "updateCrew", null, false, "Updated crew " # name);
  };

  /// Delete a crew (Admin/Store Manager only). Refuses while any roadie is
  /// assigned to the crew.
  public func deleteCrew(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    crews : Map.Map<Common.CrewId, Roadie.Crew>,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    id : Common.CrewId,
  ) : () {
    Auth.requireManager(accessGrants, demoState, caller);
    let crew = requireVisibleCrew(crews, demoState, id);
    let hasMembers = roadies.values().any(func(r) = r.isDemo == Auth.demoActive(demoState) and r.crewId == ?id);
    if (hasMembers) {
      Runtime.trap("Move its roadies first.");
    };
    crews.remove(id);
    logWrite(changeLog, counters, demoState, caller, "deleteCrew", null, false, "Deleted crew " # crew.name);
  };

  /// List change-log entries visible to the caller. Integration sees only the
  /// Shareable export, so it receives no change log. A trainer sees only
  /// entries about roadies in their approved stations. Demo entries are visible
  /// only while demo mode is on.
  public func listChangeLog(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    caller : Principal,
  ) : [Roadie.ChangeLogEntry] {
    let role = Auth.requireReadable(accessGrants, demoState, caller);
    if (role == #integration) {
      return [];
    };
    changeLog.values()
      .filter(func(e) = e.isDemo == Auth.demoActive(demoState) and changeLogVisibleToRole(e, role, accessGrants, demoState, caller, roadies))
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
    demoState : Common.DemoState,
    caller : Principal,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
  ) : Bool {
    if (entry.touchesContactSet and not Auth.isManager(accessGrants, demoState, caller)) {
      return false;
    };
    if (role != #trainer) {
      return true;
    };
    switch (entry.subjectRoadieId) {
      case (?rid) {
        switch (roadies.get(rid)) {
          case (?r) { visibleToRole(r, role, accessGrants, demoState, caller) };
          case null { false };
        };
      };
      case null { false };
    };
  };

  /// Compute whether a roadie is a minor as of now, in store time. While demo
  /// mode is on, the pretend date drives the age math.
  public func isMinor(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    caller : Principal,
    id : Common.RoadieId,
  ) : Bool {
    ignore Auth.requireReadable(accessGrants, demoState, caller);
    switch (roadies.get(id)) {
      case (?r) {
        if (r.isDemo != Auth.demoActive(demoState)) {
          return false;
        };
        switch (r.contactSet) {
          case (?cs) { Age.isMinor(cs.dateOfBirth, effectiveNow(demoState), defaultTimeZone) };
          case null { r.isMinor };
        };
      };
      case null { false };
    };
  };

  /// Internal: the effective clock. While demo mode is on with a pretend date
  /// set, the pretend timestamp is returned; otherwise the real clock.
  func effectiveNow(demoState : Common.DemoState) : Common.Timestamp {
    if (not Auth.demoActive(demoState)) {
      return Time.now();
    };
    switch (demoState.pretendDate) {
      case (?pd) {
        let hourOffset : Int = switch (pd.shift) {
          case (#am) { 9 };
          case (#pm) { 15 };
        };
        pd.day + hourOffset * 3_600_000_000_000;
      };
      case null { Time.now() };
    };
  };

  /// Internal: fetch a roadie that belongs to the active demo/real partition,
  /// or trap.
  func requireVisibleRoadie(
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    demoState : Common.DemoState,
    id : Common.RoadieId,
  ) : Roadie.Roadie {
    let roadie = roadies.get(id) ?? Runtime.trap("Roadie not found");
    if (roadie.isDemo != Auth.demoActive(demoState)) {
      Runtime.trap("Roadie not found");
    };
    roadie;
  };

  /// Internal: fetch a crew that belongs to the active demo/real partition, or
  /// trap.
  func requireVisibleCrew(
    crews : Map.Map<Common.CrewId, Roadie.Crew>,
    demoState : Common.DemoState,
    id : Common.CrewId,
  ) : Roadie.Crew {
    let crew = crews.get(id) ?? Runtime.trap("Crew not found");
    if (crew.isDemo != Auth.demoActive(demoState)) {
      Runtime.trap("Crew not found");
    };
    crew;
  };

  /// Internal: write a change-log entry into the active partition.
  func logWrite(
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    demoState : Common.DemoState,
    by : Principal,
    action : Text,
    subjectRoadieId : ?Common.RoadieId,
    touchesContactSet : Bool,
    detail : Text,
  ) : () {
    if (Auth.demoActive(demoState)) {
      ignore ChangeLog.recordDemo(changeLog, counters, by, action, subjectRoadieId, touchesContactSet, detail);
    } else {
      ignore ChangeLog.record(changeLog, counters, by, action, subjectRoadieId, touchesContactSet, detail);
    };
  };

  /// Internal: whether a roadie is visible to a role. Every read role except
  /// Integration sees every roadie card (names, photos and card fields);
  /// contact-set fields are still stripped for non-managers by `redact`.
  /// Integration sees only the Shareable export, never roadie cards.
  func visibleToRole(
    roadie : Roadie.Roadie,
    role : Common.Role,
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    caller : Principal,
  ) : Bool {
    switch (role) {
      case (#integration) { false };
      case (_) { true };
    };
  };
};
