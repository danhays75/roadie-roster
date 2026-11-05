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
  shiftBoards : Map.Map<Text, Phase23.ShiftBoard>,
  groupChangeNotices : Map.Map<Nat, Phase23.GroupChangeNotice>,
  trainerNotes : Map.Map<Nat, Phase23.TrainerNote>,
  leaderTalks : Map.Map<Common.LeaderTalkId, Phase23.LeaderTalk>,
  finalSignOffs : Map.Map<Common.RoadieId, Phase23.FinalSignOff>,
  alerts : Map.Map<Common.AlertId, Phase23.Alert>,
  checkIns : Map.Map<Text, Phase23.CheckInRecord>,
  absentAlerts : Map.Map<Common.AlertId, Phase23.AbsentAlert>,
  storeInfo : { var value : Store.StoreInfo },
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

  /// Mark a roadie Present at an orientation session (Admin, Store Manager,
  /// Training Manager or Visiting Manager). Idempotent so concurrent managers
  /// converge. Rejects an archived roadie. When the roadie's paperwork is
  /// incomplete it traps "Paperwork incomplete" unless `overrideReason` is a
  /// non-empty string and the caller is Admin or Store Manager.
  public shared ({ caller }) func markPresent(roadieId : Common.RoadieId, eventId : Common.EventId, overrideReason : ?Text) : async () {
    Phase23Lib.markPresent(accessGrants, demoState, roadies, positions, checklists, orientationCheckoffs, attendance, changeLog, counters, caller, roadieId, eventId, overrideReason);
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
    Phase23Lib.archiveNoShows(accessGrants, demoState, roadies, schedule, shiftBoards, groupChangeNotices, changeLog, counters, caller, eventId);
  };

  /// List the orientation sessions available for assignment, ordered by start
  /// (Admin, Store Manager, Training Manager or Visiting Manager).
  public query ({ caller }) func listOrientationSessions() : async [Phase23.OrientationSessionOption] {
    Phase23Lib.listOrientationSessions(accessGrants, demoState, schedule, caller);
  };

  /// List the pending roadies with no usable orientation session (Admin, Store
  /// Manager, Training Manager or Visiting Manager).
  public query ({ caller }) func listUnassignedPendingRoadies() : async [Phase23.UnassignedRoadieRow] {
    Phase23Lib.listUnassignedPendingRoadies(accessGrants, demoState, roadies, positions, crews, schedule, caller);
  };

  /// Move every non-archived roadie from one orientation session to another
  /// (Admin/Store Manager only, logged). Returns the number moved.
  public shared ({ caller }) func moveAllRoadiesToSession(fromEventId : Common.EventId, toEventId : Common.EventId) : async Nat {
    Phase23Lib.moveAllRoadiesToSession(accessGrants, demoState, roadies, schedule, changeLog, counters, caller, fromEventId, toEventId);
  };

  /// The uniform check-off for a roadie (Admin, Store Manager, Training Manager
  /// or Visiting Manager). Locked until the roadie's paperwork is 100% complete.
  public query ({ caller }) func getUniformCheckoff(roadieId : Common.RoadieId) : async ?Phase23.UniformCheckoffView {
    Phase23Lib.getUniformCheckoff(accessGrants, demoState, roadies, positions, checklists, orientationCheckoffs, caller, roadieId);
  };

  /// Save the uniform check-off for a roadie (Admin, Store Manager, Training
  /// Manager or Visiting Manager). Updates only the uniform fields and keeps
  /// the roadie's paperwork items.
  public shared ({ caller }) func saveUniformCheckoff(roadieId : Common.RoadieId, uniformItems : [Text], uniformCounts : [(Nat, Nat)]) : async () {
    Phase23Lib.saveUniformCheckoff(accessGrants, demoState, roadies, positions, checklists, orientationCheckoffs, changeLog, counters, caller, roadieId, uniformItems, uniformCounts);
  };

  /// Set the paperwork items for a roadie (Admin or Store Manager only, logged).
  /// Updates only `paperworkItems` and keeps the uniform fields.
  public shared ({ caller }) func setPaperworkItems(roadieId : Common.RoadieId, paperworkItems : [Text]) : async () {
    Phase23Lib.setPaperworkItems(accessGrants, demoState, roadies, orientationCheckoffs, changeLog, counters, caller, roadieId, paperworkItems);
  };

  /// Read one shift board with its trainer columns, Unassigned tray and Off
  /// this shift tray (every read role except kiosk and integration).
  public query ({ caller }) func getShiftBoard(eventId : Common.EventId, shift : Common.Shift) : async ?Phase23.ShiftBoardView {
    Phase23Lib.getShiftBoard(accessGrants, demoState, shiftBoards, roadies, positions, schedule, caller, eventId, shift);
  };

  /// List every shift board for the current partition (every read role except
  /// kiosk and integration).
  public query ({ caller }) func listShiftBoards() : async [Phase23.ShiftBoardView] {
    Phase23Lib.listShiftBoards(accessGrants, demoState, shiftBoards, roadies, positions, schedule, caller);
  };

  /// Replace one shift board's groups, capacities and Off list (Admin, Store
  /// Manager or Training Manager).
  public shared ({ caller }) func saveShiftBoard(board : Phase23.ShiftBoard) : async () {
    Phase23Lib.saveShiftBoard(accessGrants, demoState, shiftBoards, groupChangeNotices, roadies, schedule, changeLog, counters, caller, board);
  };

  /// Copy another shift's groups, capacities and Off list onto this shift,
  /// replacing the current board (Admin, Store Manager or Training Manager).
  public shared ({ caller }) func copyShiftBoard(eventId : Common.EventId, shift : Common.Shift, fromEventId : Common.EventId, fromShift : Common.Shift) : async () {
    Phase23Lib.copyShiftBoard(accessGrants, demoState, shiftBoards, groupChangeNotices, roadies, schedule, changeLog, counters, caller, eventId, shift, fromEventId, fromShift);
  };

  /// Fill empty capacity from the Unassigned tray (Admin, Store Manager or
  /// Training Manager).
  public shared ({ caller }) func autoFillShiftBoard(eventId : Common.EventId, shift : Common.Shift) : async () {
    Phase23Lib.autoFillShiftBoard(accessGrants, demoState, shiftBoards, groupChangeNotices, roadies, positions, schedule, changeLog, counters, caller, eventId, shift);
  };

  /// Clear one shift board's groups and Off list (Admin, Store Manager or
  /// Training Manager).
  public shared ({ caller }) func clearShiftBoard(eventId : Common.EventId, shift : Common.Shift) : async () {
    Phase23Lib.clearShiftBoard(accessGrants, demoState, shiftBoards, groupChangeNotices, roadies, schedule, changeLog, counters, caller, eventId, shift);
  };

  /// List the caller's undismissed group-change notices, newest first.
  public query ({ caller }) func listGroupChangeNotices() : async [Phase23.GroupChangeNotice] {
    Phase23Lib.listGroupChangeNotices(accessGrants, demoState, groupChangeNotices, caller);
  };

  /// Dismiss one of the caller's own group-change notices.
  public shared ({ caller }) func dismissGroupChangeNotice(id : Nat) : async () {
    Phase23Lib.dismissGroupChangeNotice(accessGrants, demoState, groupChangeNotices, changeLog, counters, caller, id);
  };

  /// The caller's own group for the current or next shift, for the Today
  /// screen. Null when the caller trains no group on that shift.
  public query ({ caller }) func getMyGroup() : async ?Phase23.MyGroupView {
    Phase23Lib.getMyGroup(accessGrants, demoState, shiftBoards, roadies, positions, schedule, caller);
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

  // --- Trainer check-in ---

  /// Create or change one roadie's check-in record for a shift (upsert). Admin,
  /// Store Manager and Training Manager may check in anyone; a trainer may
  /// check in only roadies in their own group on that shift's board. A trainer
  /// may write only from 30 minutes before the shift start until 2 hours after
  /// the shift end; after that only Admin, Store Manager or Training Manager
  /// may change records. Marking a roadie absent raises an absent alert.
  public shared ({ caller }) func recordCheckIn(
    eventId : Common.EventId,
    shift : Common.Shift,
    roadieId : Common.RoadieId,
    state : Phase23.CheckInState,
    lateAt : ?Common.Timestamp,
    excused : ?Text,
  ) : async () {
    Phase23Lib.recordCheckIn(accessGrants, demoState, shiftBoards, roadies, schedule, storeInfo.value, checkIns, absentAlerts, changeLog, counters, caller, eventId, shift, roadieId, state, lateAt, excused);
  };

  /// The trainer check-in screen for the caller's own group on one shift.
  public query ({ caller }) func getCheckInBoard(eventId : Common.EventId, shift : Common.Shift) : async ?Phase23.CheckInBoardView {
    Phase23Lib.getCheckInBoard(accessGrants, demoState, shiftBoards, roadies, schedule, storeInfo.value, checkIns, caller, eventId, shift);
  };

  /// List the unarchived absent alerts (Admin, Store Manager or Training
  /// Manager). `phone` is present only for Admin and Store Manager.
  public query ({ caller }) func listAbsentAlerts() : async [Phase23.AbsentAlertView] {
    Phase23Lib.listAbsentAlerts(accessGrants, demoState, absentAlerts, roadies, schedule, caller);
  };

  /// Excuse an absent roadie with a short reason (Admin, Store Manager or
  /// Training Manager).
  public shared ({ caller }) func excuseAbsentAlert(id : Common.AlertId, reason : Text) : async () {
    Phase23Lib.excuseAbsentAlert(accessGrants, demoState, absentAlerts, checkIns, changeLog, counters, caller, id, reason);
  };

  /// Archive an absent alert (Admin, Store Manager or Training Manager).
  public shared ({ caller }) func archiveAbsentAlert(id : Common.AlertId) : async () {
    Phase23Lib.archiveAbsentAlert(accessGrants, demoState, absentAlerts, changeLog, counters, caller, id);
  };

  /// Move an absent roadie to the same day's other shift, into that shift's
  /// Unassigned tray (Admin, Store Manager or Training Manager).
  public shared ({ caller }) func moveAbsentRoadieToOtherShift(id : Common.AlertId) : async () {
    Phase23Lib.moveAbsentRoadieToOtherShift(accessGrants, demoState, absentAlerts, shiftBoards, roadies, changeLog, counters, caller, id);
  };

  /// The Today page payload, shaped by the caller's role.
  public query ({ caller }) func getToday() : async Phase23.TodayView {
    Phase23Lib.getToday(accessGrants, demoState, shiftBoards, roadies, positions, schedule, storeInfo.value, checkIns, absentAlerts, caller);
  };
};
