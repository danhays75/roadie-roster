import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Time "mo:core/Time";
import Common "../types/common";
import Store "../types/store";
import Roadie "../types/roadie";
import Phase23 "../types/phase23";
import Access "../types/access";
import Auth "auth";
import ChangeLog "changelog";

module {
  public type Counters = {
    var nextTrainingGroupId : Nat;
    var nextLeaderTalkId : Nat;
    var nextAlertId : Nat;
    var nextAttendanceId : Nat;
    var nextTrainerNoteId : Nat;
    var nextChangeLogId : Nat;
  };

  /// Dashboard summary tiles and per-position progress. Demo records count only
  /// while demo mode is on.
  public func getDashboard(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    positions : Map.Map<Common.PositionId, Store.Position>,
    caller : Principal,
  ) : {
    hired : Nat;
    buildToTotal : Nat;
    stillNeeded : Nat;
    showedAtOrientation : ?Nat;
    certified : ?Nat;
    foh : [Store.Position];
    boh : [Store.Position];
  } {
    ignore Auth.requireReadable(accessGrants, demoState, caller);
    let active = roadies.values().filter(func r = r.isDemo == Auth.demoActive(demoState) and r.status != #archived).toArray();
    let hired = active.size();
    let allPositions = positions.values().toArray();
    let buildToTotal = allPositions.foldLeft(0, func(acc, p) = acc + p.openingBuildTo);
    let stillNeeded = saturatingSub(buildToTotal, hired);
    let foh = allPositions.filter(func p = p.house == #foh);
    let boh = allPositions.filter(func p = p.house == #boh);
    {
      hired;
      buildToTotal;
      stillNeeded;
      showedAtOrientation = null;
      certified = null;
      foh;
      boh;
    };
  };

  /// Read the orientation check-off for a roadie (Admin/Store Manager only).
  public func getOrientationCheckoff(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    checkoffs : Map.Map<Common.RoadieId, Phase23.OrientationCheckoff>,
    caller : Principal,
    roadieId : Common.RoadieId,
  ) : ?Phase23.OrientationCheckoff {
    Auth.requireManager(accessGrants, demoState, caller);
    checkoffs.get(roadieId);
  };

  /// Update the orientation check-off for a roadie (Admin/Store Manager only).
  public func updateOrientationCheckoff(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    checkoffs : Map.Map<Common.RoadieId, Phase23.OrientationCheckoff>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    checkoff : Phase23.OrientationCheckoff,
  ) : () {
    Auth.requireManager(accessGrants, demoState, caller);
    checkoffs.add(checkoff.roadieId, { checkoff with updatedAt = effectiveNow(demoState) });
    logWrite(changeLog, counters, demoState, caller, "updateOrientationCheckoff", ?checkoff.roadieId, false, "Updated orientation check-off");
  };

  /// Record attendance for a roadie at an event or shift (Admin/Store Manager
  /// only). A check-in recorded while demo mode is on is a demo check-in.
  public func recordAttendance(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    attendance : Map.Map<Nat, Phase23.AttendanceRecord>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    record : Phase23.AttendanceRecord,
  ) : () {
    Auth.requireManager(accessGrants, demoState, caller);
    let id = counters.nextAttendanceId;
    counters.nextAttendanceId := id + 1;
    attendance.add(id, { record with recordedAt = effectiveNow(demoState); recordedBy = caller; isDemo = Auth.demoActive(demoState) });
    logWrite(changeLog, counters, demoState, caller, "recordAttendance", ?record.roadieId, false, "Recorded attendance");
  };

  /// List attendance records for an event (Admin/Store Manager only). Demo
  /// check-ins are visible only while demo mode is on.
  public func listAttendanceForEvent(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    attendance : Map.Map<Nat, Phase23.AttendanceRecord>,
    caller : Principal,
    eventId : Common.EventId,
  ) : [Phase23.AttendanceRecord] {
    Auth.requireManager(accessGrants, demoState, caller);
    attendance.values()
      .filter(func a = a.isDemo == Auth.demoActive(demoState) and a.eventId == ?eventId)
      .toArray();
  };

  /// Read a training group with its unassigned and off-shift lists (Admin/Store
  /// Manager/Trainer).
  public func getTrainingGroup(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    trainingGroups : Map.Map<Common.TrainingGroupId, Phase23.TrainingGroup>,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    caller : Principal,
    id : Common.TrainingGroupId,
  ) : ?Phase23.TrainingGroupView {
    ignore Auth.requireReadable(accessGrants, demoState, caller);
    switch (trainingGroups.get(id)) {
      case (?group) {
        let active = roadies.values().filter(func r = r.isDemo == Auth.demoActive(demoState) and r.status != #archived).toArray();
        let unassigned = active.filter(func r =
          r.mainPositionId == group.positionId
          and not group.memberRoadieIds.any(func m = m == r.id)
        ).map(func r = r.id);
        let offThisShift = active.filter(func r =
          r.mainPositionId != group.positionId
          and not group.memberRoadieIds.any(func m = m == r.id)
        ).map(func r = r.id);
        ?{ group; unassigned; offThisShift };
      };
      case null { null };
    };
  };

  /// Create a training group (Admin/Store Manager only).
  public func createTrainingGroup(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    trainingGroups : Map.Map<Common.TrainingGroupId, Phase23.TrainingGroup>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    group : Phase23.TrainingGroup,
  ) : Common.TrainingGroupId {
    Auth.requireManager(accessGrants, demoState, caller);
    let id = counters.nextTrainingGroupId;
    counters.nextTrainingGroupId := id + 1;
    trainingGroups.add(id, { group with id });
    logWrite(changeLog, counters, demoState, caller, "createTrainingGroup", null, false, "Created training group");
    id;
  };

  /// Update a training group's membership (Admin/Store Manager only).
  public func updateTrainingGroup(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    trainingGroups : Map.Map<Common.TrainingGroupId, Phase23.TrainingGroup>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    group : Phase23.TrainingGroup,
  ) : () {
    Auth.requireManager(accessGrants, demoState, caller);
    if (not trainingGroups.containsKey(group.id)) {
      Runtime.trap("Training group not found");
    };
    trainingGroups.add(group.id, group);
    logWrite(changeLog, counters, demoState, caller, "updateTrainingGroup", null, false, "Updated training group");
  };

  /// Add a trainer note (Trainer/Admin/Store Manager only). A note added while
  /// demo mode is on is a demo note.
  public func addTrainerNote(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    trainerNotes : Map.Map<Nat, Phase23.TrainerNote>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    note : Phase23.TrainerNote,
  ) : Nat {
    let role = Auth.requireReadable(accessGrants, demoState, caller);
    if (role != #trainer and role != #admin and role != #storeManager) {
      Runtime.trap("Access denied: Trainer, Admin or Store Manager role required");
    };
    let id = counters.nextTrainerNoteId;
    counters.nextTrainerNoteId := id + 1;
    trainerNotes.add(id, { note with id; author = caller; createdAt = effectiveNow(demoState); isDemo = Auth.demoActive(demoState) });
    logWrite(changeLog, counters, demoState, caller, "addTrainerNote", ?note.roadieId, false, "Added trainer note");
    id;
  };

  /// Edit a trainer note within its 24-hour lock window (author only).
  public func updateTrainerNote(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    trainerNotes : Map.Map<Nat, Phase23.TrainerNote>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    note : Phase23.TrainerNote,
  ) : () {
    ignore Auth.requireReadable(accessGrants, demoState, caller);
    let existing = trainerNotes.get(note.id) ?? Runtime.trap("Trainer note not found");
    if (existing.isDemo != Auth.demoActive(demoState)) {
      Runtime.trap("Trainer note not found");
    };
    if (existing.author != caller) {
      Runtime.trap("Access denied: only the author may edit a trainer note");
    };
    let twentyFourHoursNs : Int = 24 * 60 * 60 * 1_000_000_000;
    if (effectiveNow(demoState) > existing.createdAt + twentyFourHoursNs) {
      Runtime.trap("Trainer note is locked after 24 hours");
    };
    trainerNotes.add(note.id, { existing with didWell = note.didWell; workOn = note.workOn });
    logWrite(changeLog, counters, demoState, caller, "updateTrainerNote", ?note.roadieId, false, "Edited trainer note");
  };

  /// List trainer notes for a roadie. Restricted the same way roadies are:
  /// Integration sees nothing, and a trainer sees notes only for roadies in
  /// their assigned stations. Admin, Store Manager, Training Manager,
  /// Leadership and visiting managers can see all notes. Demo notes are visible
  /// only while demo mode is on.
  public func listTrainerNotes(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    trainerNotes : Map.Map<Nat, Phase23.TrainerNote>,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    caller : Principal,
    roadieId : Common.RoadieId,
  ) : [Phase23.TrainerNote] {
    let role = Auth.requireReadable(accessGrants, demoState, caller);
    // Integration sees only the Shareable export, so it sees no notes.
    if (role == #integration) {
      return [];
    };
    // A trainer sees notes only for roadies in their assigned stations.
    if (role == #trainer) {
      switch (roadies.get(roadieId)) {
        case (?roadie) {
          if (roadie.isDemo != Auth.demoActive(demoState) or not roadieVisibleToRole(roadie, role, accessGrants, demoState, caller)) {
            return [];
          };
        };
        case null { return [] };
      };
    };
    trainerNotes.values()
      .filter(func(n) = n.isDemo == Auth.demoActive(demoState) and n.roadieId == roadieId)
      .toArray();
  };

  /// Internal: whether a roadie is visible to a role. A trainer sees only
  /// roadies in their approved stations; a trainer with no approved stations
  /// sees no roadies. Integration sees only the Shareable export. While demo
  /// mode is on, a demo NSO Trainer sees only the chosen demo stations.
  func roadieVisibleToRole(
    roadie : Roadie.Roadie,
    role : Common.Role,
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    caller : Principal,
  ) : Bool {
    switch (role) {
      case (#integration) { false };
      case (#trainer) {
        let stations = if (Auth.demoActive(demoState)) {
          Auth.demoTrainerStationsFor(demoState, caller);
        } else {
          switch (accessGrants.get(caller)) {
            case (?grant) { grant.trainerPositionIds };
            case null { [] };
          };
        };
        stations.any(func(pid) =
          pid == roadie.mainPositionId or roadie.secondPositionId == ?pid
        );
      };
      case (_) { true };
    };
  };

  /// Create a leader talk (Admin/Store Manager only).
  public func createLeaderTalk(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    leaderTalks : Map.Map<Common.LeaderTalkId, Phase23.LeaderTalk>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    talk : Phase23.LeaderTalk,
  ) : Common.LeaderTalkId {
    Auth.requireManager(accessGrants, demoState, caller);
    let id = counters.nextLeaderTalkId;
    counters.nextLeaderTalkId := id + 1;
    leaderTalks.add(id, { talk with id });
    logWrite(changeLog, counters, demoState, caller, "createLeaderTalk", null, false, "Created leader talk");
    id;
  };

  /// Record per-roadie attendance for a leader talk (Admin/Store Manager only).
  public func setLeaderTalkAttendance(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    leaderTalks : Map.Map<Common.LeaderTalkId, Phase23.LeaderTalk>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    id : Common.LeaderTalkId,
    attendees : [Common.RoadieId],
  ) : () {
    Auth.requireManager(accessGrants, demoState, caller);
    let talk = leaderTalks.get(id) ?? Runtime.trap("Leader talk not found");
    leaderTalks.add(id, { talk with attendees });
    logWrite(changeLog, counters, demoState, caller, "setLeaderTalkAttendance", null, false, "Recorded leader talk attendance");
  };

  /// Record a final sign-off for a roadie (Admin/Store Manager only).
  public func recordFinalSignOff(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    finalSignOffs : Map.Map<Common.RoadieId, Phase23.FinalSignOff>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    signOff : Phase23.FinalSignOff,
  ) : () {
    Auth.requireManager(accessGrants, demoState, caller);
    finalSignOffs.add(signOff.roadieId, { signOff with signedBy = caller; signedAt = effectiveNow(demoState) });
    logWrite(changeLog, counters, demoState, caller, "recordFinalSignOff", ?signOff.roadieId, false, "Recorded final sign-off");
  };

  /// List alerts (Admin/Store Manager only).
  public func listAlerts(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    alerts : Map.Map<Common.AlertId, Phase23.Alert>,
    caller : Principal,
  ) : [Phase23.Alert] {
    Auth.requireManager(accessGrants, demoState, caller);
    alerts.values().toArray();
  };

  /// Acknowledge an alert (Admin/Store Manager only).
  public func acknowledgeAlert(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    alerts : Map.Map<Common.AlertId, Phase23.Alert>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    id : Common.AlertId,
  ) : () {
    Auth.requireManager(accessGrants, demoState, caller);
    let alert = alerts.get(id) ?? Runtime.trap("Alert not found");
    alerts.add(id, { alert with acknowledged = true });
    logWrite(changeLog, counters, demoState, caller, "acknowledgeAlert", null, false, "Acknowledged alert");
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

  /// Internal: `a - b`, clamped at zero, without a trapping Nat subtraction.
  func saturatingSub(a : Nat, b : Nat) : Nat {
    if (a <= b) { 0 } else { a - b };
  };
};
