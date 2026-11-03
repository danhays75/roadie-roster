import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Common "../types/common";
import Store "../types/store";
import Roadie "../types/roadie";
import Phase23 "../types/phase23";
import Access "../types/access";
import Phase23Lib "../lib/phase23";

mixin (
  accessGrants : Map.Map<Principal, Access.AccessGrant>,
  roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
  positions : Map.Map<Common.PositionId, Store.Position>,
  crews : Map.Map<Common.CrewId, Roadie.Crew>,
  schedule : Map.Map<Common.EventId, Store.ScheduleEvent>,
  checklists : { var value : Store.Checklists },
  orientationCheckoffs : Map.Map<Common.RoadieId, Phase23.OrientationCheckoff>,
  attendance : Map.Map<Nat, Phase23.AttendanceRecord>,
  trainingGroups : Map.Map<Common.TrainingGroupId, Phase23.TrainingGroup>,
  trainerNotes : Map.Map<Nat, Phase23.TrainerNote>,
  leaderTalks : Map.Map<Common.LeaderTalkId, Phase23.LeaderTalk>,
  finalSignOffs : Map.Map<Common.RoadieId, Phase23.FinalSignOff>,
  alerts : Map.Map<Common.AlertId, Phase23.Alert>,
  changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
  counters : Phase23Lib.Counters,
  demoState : Common.DemoState,
) {
  /// Dashboard summary tiles and per-position progress, including the
  /// pending/active breakdown and the Hired → Active funnel.
  public query ({ caller }) func getDashboard() : async Phase23.DashboardView {
    Phase23Lib.getDashboard(accessGrants, demoState, roadies, positions, caller);
  };

  /// Read the orientation check-off for a roadie (Admin/Store Manager only).
  public query ({ caller }) func getOrientationCheckoff(roadieId : Common.RoadieId) : async ?Phase23.OrientationCheckoff {
    Phase23Lib.getOrientationCheckoff(accessGrants, demoState, orientationCheckoffs, caller, roadieId);
  };

  /// Update the orientation check-off for a roadie (Admin/Store Manager only).
  public shared ({ caller }) func updateOrientationCheckoff(checkoff : Phase23.OrientationCheckoff) : async () {
    Phase23Lib.updateOrientationCheckoff(accessGrants, demoState, orientationCheckoffs, changeLog, counters, caller, checkoff);
  };

  /// Record attendance for a roadie (Admin/Store Manager only).
  public shared ({ caller }) func recordAttendance(record : Phase23.AttendanceRecord) : async () {
    Phase23Lib.recordAttendance(accessGrants, demoState, attendance, changeLog, counters, caller, record);
  };

  /// List attendance records for an event (Admin/Store Manager only).
  public query ({ caller }) func listAttendanceForEvent(eventId : Common.EventId) : async [Phase23.AttendanceRecord] {
    Phase23Lib.listAttendanceForEvent(accessGrants, demoState, attendance, caller, eventId);
  };

  /// The orientation check-in screen for one session: assigned roadies with
  /// photo, name, position, crew and paperwork status, plus Present x / y
  /// counts. Admin, Store Manager, Training Manager and Visiting Manager.
  public query ({ caller }) func getOrientationSessionView(eventId : Common.EventId) : async ?Phase23.OrientationSessionView {
    Phase23Lib.getOrientationSessionView(accessGrants, demoState, roadies, positions, crews, schedule, checklists, orientationCheckoffs, attendance, caller, eventId);
  };

  /// Mark a roadie Present at an orientation session (Admin/Store Manager
  /// only). Idempotent so concurrent managers converge.
  public shared ({ caller }) func markPresent(roadieId : Common.RoadieId, eventId : Common.EventId) : async () {
    Phase23Lib.markPresent(accessGrants, demoState, roadies, attendance, changeLog, counters, caller, roadieId, eventId);
  };

  /// Undo a roadie's Present mark at an orientation session (Admin/Store
  /// Manager only, logged). Returns the roadie to pending.
  public shared ({ caller }) func undoPresent(roadieId : Common.RoadieId, eventId : Common.EventId) : async () {
    Phase23Lib.undoPresent(accessGrants, demoState, roadies, attendance, changeLog, counters, caller, roadieId, eventId);
  };

  /// Move a roadie to another orientation session (Admin/Store Manager only).
  public shared ({ caller }) func moveRoadieToSession(roadieId : Common.RoadieId, eventId : Common.EventId) : async () {
    Phase23Lib.moveRoadieToSession(accessGrants, demoState, roadies, schedule, changeLog, counters, caller, roadieId, eventId);
  };

  /// Archive every no-show at a session as NCNS Orientation (Admin/Store
  /// Manager only). Returns the archived roadie ids.
  public shared ({ caller }) func archiveNoShows(eventId : Common.EventId) : async [Common.RoadieId] {
    Phase23Lib.archiveNoShows(accessGrants, demoState, roadies, schedule, changeLog, counters, caller, eventId);
  };

  /// The uniform check-off for a roadie (Admin/Store Manager only). Locked
  /// until the roadie's paperwork is 100% complete.
  public query ({ caller }) func getUniformCheckoff(roadieId : Common.RoadieId) : async ?Phase23.UniformCheckoffView {
    Phase23Lib.getUniformCheckoff(accessGrants, demoState, roadies, positions, checklists, orientationCheckoffs, caller, roadieId);
  };

  /// Save the uniform check-off for a roadie (Admin/Store Manager only).
  public shared ({ caller }) func saveUniformCheckoff(checkoff : Phase23.OrientationCheckoff) : async () {
    Phase23Lib.saveUniformCheckoff(accessGrants, demoState, roadies, positions, checklists, orientationCheckoffs, changeLog, counters, caller, checkoff);
  };

  /// Read a training group with its unassigned and off-shift lists.
  public query ({ caller }) func getTrainingGroup(id : Common.TrainingGroupId) : async ?Phase23.TrainingGroupView {
    Phase23Lib.getTrainingGroup(accessGrants, demoState, trainingGroups, roadies, caller, id);
  };

  /// Create a training group (Admin/Store Manager only).
  public shared ({ caller }) func createTrainingGroup(group : Phase23.TrainingGroup) : async Common.TrainingGroupId {
    Phase23Lib.createTrainingGroup(accessGrants, demoState, trainingGroups, changeLog, counters, caller, group);
  };

  /// Update a training group's membership (Admin/Store Manager only).
  public shared ({ caller }) func updateTrainingGroup(group : Phase23.TrainingGroup) : async () {
    Phase23Lib.updateTrainingGroup(accessGrants, demoState, trainingGroups, changeLog, counters, caller, group);
  };

  /// Add a trainer note (Trainer/Admin/Store Manager only).
  public shared ({ caller }) func addTrainerNote(note : Phase23.TrainerNote) : async Nat {
    Phase23Lib.addTrainerNote(accessGrants, demoState, trainerNotes, changeLog, counters, caller, note);
  };

  /// Edit a trainer note within its 24-hour lock window (author only).
  public shared ({ caller }) func updateTrainerNote(note : Phase23.TrainerNote) : async () {
    Phase23Lib.updateTrainerNote(accessGrants, demoState, trainerNotes, changeLog, counters, caller, note);
  };

  /// List trainer notes for a roadie. Restricted the same way roadies are:
  /// Integration sees nothing, and a trainer sees notes only for roadies in
  /// their assigned stations.
  public query ({ caller }) func listTrainerNotes(roadieId : Common.RoadieId) : async [Phase23.TrainerNote] {
    Phase23Lib.listTrainerNotes(accessGrants, demoState, trainerNotes, roadies, caller, roadieId);
  };

  /// Create a leader talk (Admin/Store Manager only).
  public shared ({ caller }) func createLeaderTalk(talk : Phase23.LeaderTalk) : async Common.LeaderTalkId {
    Phase23Lib.createLeaderTalk(accessGrants, demoState, leaderTalks, changeLog, counters, caller, talk);
  };

  /// Record per-roadie attendance for a leader talk (Admin/Store Manager only).
  public shared ({ caller }) func setLeaderTalkAttendance(id : Common.LeaderTalkId, attendees : [Common.RoadieId]) : async () {
    Phase23Lib.setLeaderTalkAttendance(accessGrants, demoState, leaderTalks, changeLog, counters, caller, id, attendees);
  };

  /// Record a final sign-off for a roadie (Admin/Store Manager only).
  public shared ({ caller }) func recordFinalSignOff(signOff : Phase23.FinalSignOff) : async () {
    Phase23Lib.recordFinalSignOff(accessGrants, demoState, finalSignOffs, changeLog, counters, caller, signOff);
  };

  /// List alerts (Admin/Store Manager only).
  public query ({ caller }) func listAlerts() : async [Phase23.Alert] {
    Phase23Lib.listAlerts(accessGrants, demoState, alerts, caller);
  };

  /// Acknowledge an alert (Admin/Store Manager only).
  public shared ({ caller }) func acknowledgeAlert(id : Common.AlertId) : async () {
    Phase23Lib.acknowledgeAlert(accessGrants, demoState, alerts, changeLog, counters, caller, id);
  };
};
