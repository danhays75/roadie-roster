import Common "common";
import Store "store";
import Roadie "roadie";

module {
  /// Orientation check-off for one roadie. `uniformItems` holds the ids of
  /// checked checkbox items; `uniformCounts` holds (itemId, count) pairs for
  /// count items. `isDemo` marks a demo check-off.
  public type OrientationCheckoff = {
    roadieId : Common.RoadieId;
    uniformItems : [Text];
    uniformCounts : [(Nat, Nat)];
    paperworkItems : [Text];
    shirtsCount : Nat;
    hatsCount : Nat;
    updatedAt : Common.Timestamp;
    isDemo : Bool;
  };

  /// Attendance state for one roadie at one event or shift.
  public type AttendanceState = {
    #present;
    #late;
    #absent;
  };

  /// One attendance record per roadie per event or shift. `isDemo` marks a
  /// demo check-in.
  public type AttendanceRecord = {
    roadieId : Common.RoadieId;
    eventId : ?Common.EventId;
    shift : ?Common.Shift;
    state : AttendanceState;
    recordedAt : Common.Timestamp;
    recordedBy : Principal;
    isDemo : Bool;
  };

  /// A training group for one day and shift. `isDemo` marks a demo group.
  public type TrainingGroup = {
    id : Common.TrainingGroupId;
    day : Common.DateOnly;
    shift : Common.Shift;
    positionId : Common.PositionId;
    trainerPrincipal : ?Principal;
    memberRoadieIds : [Common.RoadieId];
    isDemo : Bool;
  };

  /// The per-shift view of a training group's membership.
  public type TrainingGroupView = {
    group : TrainingGroup;
    unassigned : [Common.RoadieId];
    offThisShift : [Common.RoadieId];
  };

  /// A trainer note about one roadie for one shift. `isDemo` marks a demo note.
  public type TrainerNote = {
    id : Nat;
    author : Principal;
    roadieId : Common.RoadieId;
    shift : Common.Shift;
    day : Common.DateOnly;
    didWell : Text;
    workOn : Text;
    createdAt : Common.Timestamp;
    isDemo : Bool;
  };

  /// A leader talk with per-roadie attendance. `isDemo` marks a demo talk.
  public type LeaderTalk = {
    id : Common.LeaderTalkId;
    name : Text;
    day : Common.DateOnly;
    attendees : [Common.RoadieId];
    isDemo : Bool;
  };

  /// The final sign-off decision for a roadie.
  public type SignOffOutcome = {
    #certified;
    #needsMoreTime : Text;
  };

  /// A final sign-off record. `isDemo` marks a demo sign-off.
  public type FinalSignOff = {
    roadieId : Common.RoadieId;
    outcome : SignOffOutcome;
    futureTrainer : Bool;
    signedBy : Principal;
    signedAt : Common.Timestamp;
    isDemo : Bool;
  };

  /// An alert.
  public type Alert = {
    id : Common.AlertId;
    message : Text;
    createdAt : Common.Timestamp;
    acknowledged : Bool;
  };

  // --- Orientation check-in screen ---

  /// Whether a roadie's paperwork is 100% complete for the items that apply
  /// to them (respecting "Only alcohol positions" and "Only under 18").
  public type PaperworkStatus = {
    #complete;
    #incomplete;
  };

  /// One roadie row on the orientation check-in screen: photo, name, position,
  /// crew, paperwork status, roster state and whether they are already marked
  /// Present. `noShow` is true once the session's date has passed and the
  /// roadie is still pending and assigned to that session.
  public type OrientationRoadieRow = {
    roadieId : Common.RoadieId;
    name : Text;
    photo : ?Common.PhotoRef;
    positionId : Common.PositionId;
    positionName : Text;
    crewId : ?Common.CrewId;
    crewName : ?Text;
    paperworkStatus : PaperworkStatus;
    rosterState : Roadie.RosterState;
    present : Bool;
    noShow : Bool;
  };

  /// The orientation check-in screen for one session: the session's assigned
  /// roadies plus the Present x / y counts.
  public type OrientationSessionView = {
    eventId : Common.EventId;
    name : Text;
    start : Common.DateTime;
    end : ?Common.DateTime;
    presentCount : Nat;
    assignedCount : Nat;
    roadies : [OrientationRoadieRow];
  };

  // --- Uniform check-off ---

  /// One uniform check-off item for a roadie. `checked` applies to checkbox
  /// items; `count` applies to count items.
  public type UniformCheckoffItem = {
    itemId : Nat;
    text : Text;
    itemType : Common.UniformItemType;
    checked : Bool;
    count : Nat;
  };

  /// The uniform check-off for one roadie. `locked` is true (read-only, with
  /// "Paperwork incomplete") until the roadie's paperwork is 100% complete.
  /// `complete` is true when every item is satisfied; `missing` names the
  /// items still outstanding.
  public type UniformCheckoffView = {
    roadieId : Common.RoadieId;
    locked : Bool;
    complete : Bool;
    missing : [Text];
    items : [UniformCheckoffItem];
  };

  // --- Dashboard ---

  /// The dashboard summary: the Hired → Active funnel plus the per-house
  /// position lists. `hired` counts pending + active (archived excluded).
  public type DashboardView = {
    hired : Nat;
    active : Nat;
    pending : Nat;
    buildToTotal : Nat;
    stillNeeded : Nat;
    showedAtOrientation : ?Nat;
    certified : ?Nat;
    foh : [Store.Position];
    boh : [Store.Position];
  };
};
