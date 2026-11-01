import Common "common";

module {
  /// Orientation check-off for one roadie.
  public type OrientationCheckoff = {
    roadieId : Common.RoadieId;
    uniformItems : [Text];
    paperworkItems : [Text];
    shirtsCount : Nat;
    hatsCount : Nat;
    updatedAt : Common.Timestamp;
  };

  /// Attendance state for one roadie at one event or shift.
  public type AttendanceState = {
    #present;
    #late;
    #absent;
  };

  /// One attendance record per roadie per event or shift.
  public type AttendanceRecord = {
    roadieId : Common.RoadieId;
    eventId : ?Common.EventId;
    shift : ?Common.Shift;
    state : AttendanceState;
    recordedAt : Common.Timestamp;
    recordedBy : Principal;
  };

  /// A training group for one day and shift.
  public type TrainingGroup = {
    id : Common.TrainingGroupId;
    day : Common.DateOnly;
    shift : Common.Shift;
    positionId : Common.PositionId;
    trainerPrincipal : ?Principal;
    memberRoadieIds : [Common.RoadieId];
  };

  /// The per-shift view of a training group's membership.
  public type TrainingGroupView = {
    group : TrainingGroup;
    unassigned : [Common.RoadieId];
    offThisShift : [Common.RoadieId];
  };

  /// A trainer note about one roadie for one shift.
  public type TrainerNote = {
    id : Nat;
    author : Principal;
    roadieId : Common.RoadieId;
    shift : Common.Shift;
    day : Common.DateOnly;
    didWell : Text;
    workOn : Text;
    createdAt : Common.Timestamp;
  };

  /// A leader talk with per-roadie attendance.
  public type LeaderTalk = {
    id : Common.LeaderTalkId;
    name : Text;
    day : Common.DateOnly;
    attendees : [Common.RoadieId];
  };

  /// The final sign-off decision for a roadie.
  public type SignOffOutcome = {
    #certified;
    #needsMoreTime : Text;
  };

  /// A final sign-off record.
  public type FinalSignOff = {
    roadieId : Common.RoadieId;
    outcome : SignOffOutcome;
    futureTrainer : Bool;
    signedBy : Principal;
    signedAt : Common.Timestamp;
  };

  /// An alert.
  public type Alert = {
    id : Common.AlertId;
    message : Text;
    createdAt : Common.Timestamp;
    acknowledged : Bool;
  };
};
