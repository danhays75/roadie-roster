import Common "common";

module {
  /// The lifecycle status of a roadie card.
  public type RoadieStatus = {
    #hired;
    #paperworkDone;
    #oriented;
    #inTraining;
    #certified;
    #needsMoreTime;
    #active;
    #archived;
  };

  /// Why a roadie was archived.
  public type ArchiveReason = {
    #noShow;
    #quitDuringTraining;
    #tookAnotherJob;
    #letGo;
    #other : Text;
  };

  /// The contact set — visible only to Admin and Store Manager.
  public type ContactSet = {
    phone : Common.Phone;
    email : Common.Email;
    emergencyContactName : Text;
    emergencyContactPhone : Common.Phone;
    dateOfBirth : Common.DateOnly;
    availability : [AvailabilitySlot];
    availabilitySignature : ?Common.SignatureRef;
    availabilitySignedAt : ?Common.Timestamp;
    availabilityResignPending : Bool;
  };

  /// One availability cell: a weekday and shift the roadie can work.
  public type AvailabilitySlot = {
    day : Common.Weekday;
    shift : Common.Shift;
  };

  /// The non-contact profile fields shown on the card back.
  public type RoadieProfile = {
    name : Common.PersonName;
    preferredName : ?Text;
    hometown : ?Text;
    hobbies : ?Text;
    favoriteMovie : ?Text;
    favoriteSnack : ?Text;
    funFact : ?Text;
    goalHere : ?Text;
    positionAppliedFor : ?Text;
    shirtSize : ?Common.ShirtSize;
    hatSize : ?Common.HatSize;
    shiftsWantedPerWeek : ?Nat;
    weekdayLunch : ?Bool;
  };

  /// A roadie card.
  public type Roadie = {
    id : Common.RoadieId;
    profile : RoadieProfile;
    photo : ?Common.PhotoRef;
    signature : ?Common.SignatureRef;
    mainPositionId : Common.PositionId;
    secondPositionId : ?Common.PositionId;
    crossTrainedPositionId : ?Common.PositionId;
    crewId : ?Common.CrewId;
    orientationEventId : ?Common.EventId;
    startDate : ?Common.DateOnly;
    status : RoadieStatus;
    corporateEmployeeId : ?Text;
    contactSet : ?ContactSet;
    archivedReason : ?ArchiveReason;
    archivedAt : ?Common.Timestamp;
    hiredAt : Common.Timestamp;
    signedBy : ?Principal;
  };

  /// A crew.
  public type Crew = {
    id : Common.CrewId;
    name : Text;
  };

  /// Per-position roster counts: on-hand roadies and open spots.
  public type RosterSummary = {
    positionId : Common.PositionId;
    positionName : Text;
    onHand : Nat;
    buildTo : Nat;
    openSpots : Nat;
  };

  /// A single change-log entry.
  public type ChangeLogEntry = {
    id : Common.ChangeLogId;
    at : Common.Timestamp;
    by : Principal;
    action : Text;
    subjectRoadieId : ?Common.RoadieId;
    touchesContactSet : Bool;
    detail : Text;
  };
};
