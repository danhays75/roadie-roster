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

  /// The contact set — visible only to Admin and Store Manager. Every signature
  /// lives here so non-managers never receive one: the roadie's drawn
  /// availability signature and the manager's separate approval signature.
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
    managerSignature : ?Common.SignatureRef;
    managerSignedAt : ?Common.Timestamp;
    managerSignedBy : ?Principal;
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
    favoriteTeam : ?Text;
    favoriteDrink : ?Text;
    favoriteColor : ?Text;
    funFact : ?Text;
    goalHere : ?Text;
    positionAppliedFor : ?Text;
    shirtSize : ?Common.ShirtSize;
    hatSize : ?Common.HatSize;
    shiftsWantedPerWeek : ?Nat;
    weekdayLunch : ?Bool;
  };

  /// A roadie card. `isMinor` and `birthdayMonthDay` are non-sensitive derived
  /// values so the card back can show the birthday and a Minor badge without
  /// exposing the date of birth (which stays in the contact set).
  public type Roadie = {
    id : Common.RoadieId;
    profile : RoadieProfile;
    photo : ?Common.PhotoRef;
    mainPositionId : Common.PositionId;
    secondPositionId : ?Common.PositionId;
    crossTrainedPositionId : ?Common.PositionId;
    crewId : ?Common.CrewId;
    orientationEventId : ?Common.EventId;
    startDate : ?Common.DateOnly;
    status : RoadieStatus;
    corporateEmployeeId : ?Text;
    contactSet : ?ContactSet;
    isMinor : Bool;
    birthdayMonthDay : ?Text;
    archivedReason : ?ArchiveReason;
    archivedAt : ?Common.Timestamp;
    hiredAt : Common.Timestamp;
    hireDate : ?Common.Timestamp;
    signedBy : ?Principal;
    /// True when this card is a demo record. Demo records are invisible while
    /// demo mode is off and never count toward on-hand, build-to, exports,
    /// gift bags or the store template.
    isDemo : Bool;
  };

  /// A crew. `leaderPrincipal` is the approved leader who leads the crew, or
  /// null when the crew has no leader yet. `isDemo` marks a demo crew.
  public type Crew = {
    id : Common.CrewId;
    name : Text;
    leaderPrincipal : ?Principal;
    isDemo : Bool;
  };

  /// Per-position roster counts: on-hand roadies and open spots.
  public type RosterSummary = {
    positionId : Common.PositionId;
    positionName : Text;
    onHand : Nat;
    buildTo : Nat;
    openSpots : Nat;
  };

  /// A single change-log entry. `isDemo` marks entries written while demo mode
  /// was on, so the change log can separate demo activity from real activity.
  public type ChangeLogEntry = {
    id : Common.ChangeLogId;
    at : Common.Timestamp;
    by : Principal;
    action : Text;
    subjectRoadieId : ?Common.RoadieId;
    touchesContactSet : Bool;
    detail : Text;
    isDemo : Bool;
  };
};
