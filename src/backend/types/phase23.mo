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

  /// One trainer's column on a shift board: the trainer, the group's capacity
  /// and the roadies assigned to it. `capacity` defaults from the Admin
  /// `trainingGroupSize` setting and the Training Manager may change it per
  /// trainer per shift.
  public type ShiftBoardGroup = {
    trainerPrincipal : Principal;
    capacity : Nat;
    roadieIds : [Common.RoadieId];
  };

  /// The board for one shift: a `#trainingDay` or `#friendsAndFamily` schedule
  /// event plus `#am` or `#pm`. Friends & Family events have a single `#pm`
  /// shift only. `groups` holds one entry per trainer; `offRoadieIds` holds the
  /// roadies marked Off this shift. A roadie may appear in at most one group or
  /// in Off, never both. `isDemo` marks a demo board.
  public type ShiftBoard = {
    eventId : Common.EventId;
    shift : Common.Shift;
    groups : [ShiftBoardGroup];
    offRoadieIds : [Common.RoadieId];
    editedAt : Common.Timestamp;
    isDemo : Bool;
  };

  /// One roadie chip on a shift board: photo, name, position code and whether
  /// they are scheduled on a shift they marked unavailable on the kiosk.
  public type ShiftBoardRoadie = {
    roadieId : Common.RoadieId;
    name : Text;
    photo : ?Common.PhotoRef;
    positionId : Common.PositionId;
    positionCode : Text;
    markedUnavailable : Bool;
  };

  /// One trainer column on a shift board, with its roadie chips.
  public type ShiftBoardGroupView = {
    trainerPrincipal : Principal;
    capacity : Nat;
    roadies : [ShiftBoardRoadie];
  };

  /// The full read view of one shift board: the trainer columns, the
  /// Unassigned tray (active roadies not in a group or Off for this shift) and
  /// the Off this shift tray.
  public type ShiftBoardView = {
    eventId : Common.EventId;
    shift : Common.Shift;
    groups : [ShiftBoardGroupView];
    unassigned : [ShiftBoardRoadie];
    offThisShift : [ShiftBoardRoadie];
    editedAt : Common.Timestamp;
    isDemo : Bool;
  };

  /// A per-trainer notice that their group changed on a current or future
  /// shift: the shift label, the added and removed roadie names and the editor's
  /// name. Shown as a dismissible card until dismissed. `isDemo` marks a demo
  /// notice.
  public type GroupChangeNotice = {
    id : Nat;
    trainerPrincipal : Principal;
    eventId : Common.EventId;
    shift : Common.Shift;
    shiftLabel : Text;
    addedNames : [Text];
    removedNames : [Text];
    editorName : Text;
    createdAt : Common.Timestamp;
    dismissed : Bool;
    isDemo : Bool;
  };

  /// A trainer's own group for the current or next shift, for the Today screen.
  public type MyGroupView = {
    eventId : Common.EventId;
    shift : Common.Shift;
    shiftLabel : Text;
    capacity : Nat;
    roadies : [ShiftBoardRoadie];
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

  /// One orientation session available for assignment: an `#orientation`
  /// schedule event, ordered by start.
  public type OrientationSessionOption = {
    eventId : Common.EventId;
    name : Text;
    start : Common.DateTime;
    end : ?Common.DateTime;
  };

  /// One unassigned pending roadie on the orientation screen: a roadie whose
  /// roster state is pending and whose `orientationEventId` is null or points
  /// to an event that is missing or is not an orientation session.
  public type UnassignedRoadieRow = {
    roadieId : Common.RoadieId;
    name : Text;
    photo : ?Common.PhotoRef;
    positionId : Common.PositionId;
    positionName : Text;
    crewId : ?Common.CrewId;
    crewName : ?Text;
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
