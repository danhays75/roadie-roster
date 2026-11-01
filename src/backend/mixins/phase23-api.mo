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
  orientationCheckoffs : Map.Map<Common.RoadieId, Phase23.OrientationCheckoff>,
  attendance : Map.Map<Nat, Phase23.AttendanceRecord>,
  trainingGroups : Map.Map<Common.TrainingGroupId, Phase23.TrainingGroup>,
  trainerNotes : Map.Map<Nat, Phase23.TrainerNote>,
  leaderTalks : Map.Map<Common.LeaderTalkId, Phase23.LeaderTalk>,
  finalSignOffs : Map.Map<Common.RoadieId, Phase23.FinalSignOff>,
  alerts : Map.Map<Common.AlertId, Phase23.Alert>,
  changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
  counters : Phase23Lib.Counters,
) {
  /// Dashboard summary tiles and per-position progress.
  public query ({ caller }) func getDashboard() : async {
    hired : Nat;
    buildToTotal : Nat;
    stillNeeded : Nat;
    showedAtOrientation : ?Nat;
    certified : ?Nat;
    foh : [Store.Position];
    boh : [Store.Position];
  } {
    Phase23Lib.getDashboard(accessGrants, roadies, positions, caller);
  };

  /// Read the orientation check-off for a roadie (Admin/Store Manager only).
  public query ({ caller }) func getOrientationCheckoff(roadieId : Common.RoadieId) : async ?Phase23.OrientationCheckoff {
    Phase23Lib.getOrientationCheckoff(accessGrants, orientationCheckoffs, caller, roadieId);
  };

  /// Update the orientation check-off for a roadie (Admin/Store Manager only).
  public shared ({ caller }) func updateOrientationCheckoff(checkoff : Phase23.OrientationCheckoff) : async () {
    Phase23Lib.updateOrientationCheckoff(accessGrants, orientationCheckoffs, changeLog, counters, caller, checkoff);
  };

  /// Record attendance for a roadie (Admin/Store Manager only).
  public shared ({ caller }) func recordAttendance(record : Phase23.AttendanceRecord) : async () {
    Phase23Lib.recordAttendance(accessGrants, attendance, changeLog, counters, caller, record);
  };

  /// List attendance records for an event (Admin/Store Manager only).
  public query ({ caller }) func listAttendanceForEvent(eventId : Common.EventId) : async [Phase23.AttendanceRecord] {
    Phase23Lib.listAttendanceForEvent(accessGrants, attendance, caller, eventId);
  };

  /// Read a training group with its unassigned and off-shift lists.
  public query ({ caller }) func getTrainingGroup(id : Common.TrainingGroupId) : async ?Phase23.TrainingGroupView {
    Phase23Lib.getTrainingGroup(accessGrants, trainingGroups, roadies, caller, id);
  };

  /// Create a training group (Admin/Store Manager only).
  public shared ({ caller }) func createTrainingGroup(group : Phase23.TrainingGroup) : async Common.TrainingGroupId {
    Phase23Lib.createTrainingGroup(accessGrants, trainingGroups, changeLog, counters, caller, group);
  };

  /// Update a training group's membership (Admin/Store Manager only).
  public shared ({ caller }) func updateTrainingGroup(group : Phase23.TrainingGroup) : async () {
    Phase23Lib.updateTrainingGroup(accessGrants, trainingGroups, changeLog, counters, caller, group);
  };

  /// Add a trainer note (Trainer/Admin/Store Manager only).
  public shared ({ caller }) func addTrainerNote(note : Phase23.TrainerNote) : async Nat {
    Phase23Lib.addTrainerNote(accessGrants, trainerNotes, changeLog, counters, caller, note);
  };

  /// Edit a trainer note within its 24-hour lock window (author only).
  public shared ({ caller }) func updateTrainerNote(note : Phase23.TrainerNote) : async () {
    Phase23Lib.updateTrainerNote(accessGrants, trainerNotes, changeLog, counters, caller, note);
  };

  /// List trainer notes for a roadie. Restricted the same way roadies are:
  /// Integration sees nothing, and a trainer sees notes only for roadies in
  /// their assigned stations.
  public query ({ caller }) func listTrainerNotes(roadieId : Common.RoadieId) : async [Phase23.TrainerNote] {
    Phase23Lib.listTrainerNotes(accessGrants, trainerNotes, roadies, caller, roadieId);
  };

  /// Create a leader talk (Admin/Store Manager only).
  public shared ({ caller }) func createLeaderTalk(talk : Phase23.LeaderTalk) : async Common.LeaderTalkId {
    Phase23Lib.createLeaderTalk(accessGrants, leaderTalks, changeLog, counters, caller, talk);
  };

  /// Record per-roadie attendance for a leader talk (Admin/Store Manager only).
  public shared ({ caller }) func setLeaderTalkAttendance(id : Common.LeaderTalkId, attendees : [Common.RoadieId]) : async () {
    Phase23Lib.setLeaderTalkAttendance(accessGrants, leaderTalks, changeLog, counters, caller, id, attendees);
  };

  /// Record a final sign-off for a roadie (Admin/Store Manager only).
  public shared ({ caller }) func recordFinalSignOff(signOff : Phase23.FinalSignOff) : async () {
    Phase23Lib.recordFinalSignOff(accessGrants, finalSignOffs, changeLog, counters, caller, signOff);
  };

  /// List alerts (Admin/Store Manager only).
  public query ({ caller }) func listAlerts() : async [Phase23.Alert] {
    Phase23Lib.listAlerts(accessGrants, alerts, caller);
  };

  /// Acknowledge an alert (Admin/Store Manager only).
  public shared ({ caller }) func acknowledgeAlert(id : Common.AlertId) : async () {
    Phase23Lib.acknowledgeAlert(accessGrants, alerts, changeLog, counters, caller, id);
  };
};
