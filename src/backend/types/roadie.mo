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

  /// The derived hiring stage of a roadie, in order Hired → Paperwork Done →
  /// Oriented → In Training → Certified. Computed on every read from the
  /// roadie's status, roster state, paperwork and training check-ins; never
  /// stored and never set by hand. An archived roadie has no stage and is shown
  /// as Former.
  public type RoadieStage = {
    #hired;
    #paperworkDone;
    #oriented;
    #inTraining;
    #certified;
  };

  /// The latest completed paperwork step while a roadie's stage is Hired, so
  /// the stage tag can show progress instead of a bare "Hired". The steps are
  /// ordered by the paperwork checklist order (Digital Paperwork, I-9 / W-4,
  /// Alcohol Certificate, Food Handler Card, Policies & Procedures, then
  /// minor-only items):
  /// `#none` (nothing checked) → `#digitalPaperwork` → `#i9W4` →
  /// `#alcoholCertificate` → `#foodHandlerCard`. When every applicable item is
  /// checked the stage is Paperwork Done, so this value is null for every
  /// non-Hired stage and for an archived roadie. Items that do not apply to the
  /// roadie (for example the Alcohol Certificate for a non-alcohol position) or
  /// that are disabled are skipped.
  public type PaperworkStep = {
    #none;
    #digitalPaperwork;
    #i9W4;
    #alcoholCertificate;
    #foodHandlerCard;
  };

  /// Why a roadie was archived.
  public type ArchiveReason = {
    #noShow;
    #quitDuringTraining;
    #tookAnotherJob;
    #letGo;
    #ncnsOrientation;
    #paperworkIncomplete;
    #other : Text;
  };

  /// Whether a roadie is still pending (hired, not yet shown up at an
  /// orientation session) or active (marked Present at an orientation
  /// session). Archived roadies are excluded from both counts.
  public type RosterState = {
    #pending;
    #active;
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

  /// A roadie card. `isMinor`, `birthdayMonthDay` and `stage` are non-sensitive
  /// derived values so the card back can show the birthday, a Minor badge and
  /// the hiring stage without exposing the date of birth (which stays in the
  /// contact set). `stage` is recomputed on every read and never set by hand;
  /// it is null for an archived roadie, which is shown as Former.
  public type Roadie = {
    id : Common.RoadieId;
    profile : RoadieProfile;
    photo : ?Common.PhotoRef;
    /// Demo-only photo URL. Set only by Load demo data; null for every real
    /// record. Used as the image when `photo` is absent.
    demoPhotoUrl : ?Text;
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
    /// Pending until the roadie is marked Present at an orientation session,
    /// then active. Archived roadies keep their last state but are excluded
    /// from every pending/active count.
    rosterState : RosterState;
    /// True when this card is a demo record. Demo records are invisible while
    /// demo mode is off and never count toward on-hand, build-to, exports,
    /// gift bags or the store template.
    isDemo : Bool;
    /// The derived hiring stage. Null for an archived roadie (shown as Former).
    stage : ?RoadieStage;
    /// The latest completed paperwork step, derived on every read. Non-null
    /// only while `stage` is `#hired`; null for every other stage and for an
    /// archived roadie. Drives the in-between stage tag ("Digital Paperwork ✓",
    /// "I-9 / W-4 ✓", "Alcohol Cert ✓").
    paperworkStep : ?PaperworkStep;
  };

  /// A crew. `leaderPrincipal` is the approved manager who owns the crew, or
  /// null when the crew has no owner yet. `isDemo` marks a demo crew.
  public type Crew = {
    id : Common.CrewId;
    name : Text;
    leaderPrincipal : ?Principal;
    isDemo : Bool;
  };

  /// A crew with its member counts, for the kiosk approval Crew dropdown. The
  /// count is pending + active roadies assigned to the crew; archived roadies
  /// are excluded. `isDemo` marks a demo crew.
  public type CrewSummary = {
    id : Common.CrewId;
    name : Text;
    leaderPrincipal : ?Principal;
    roadieCount : Nat;
    isDemo : Bool;
  };

  /// Per-position roster counts: on-hand roadies and open spots. `onHand`
  /// counts pending + active roadies (archived excluded); `pending` and
  /// `active` break that total down.
  public type RosterSummary = {
    positionId : Common.PositionId;
    positionName : Text;
    onHand : Nat;
    pending : Nat;
    active : Nat;
    buildTo : Nat;
    openSpots : Nat;
  };

  /// Pending and active counts for one position or for the whole store.
  public type RosterCounts = {
    pending : Nat;
    active : Nat;
  };

  /// The Hired → Active funnel shown on the dashboard: everyone hired, how
  /// many have shown up (active) and how many are still pending.
  public type RosterFunnel = {
    hired : Nat;
    active : Nat;
    pending : Nat;
  };

  /// A single change-log entry. `isDemo` marks entries written while demo mode
  /// was on, so the change log can separate demo activity from real activity.
  /// `paperworkDetail` carries the item-by-item paperwork change for a
  /// `setPaperworkItems` entry — which items were checked or unchecked, by name
  /// — and is null for every other action.
  public type ChangeLogEntry = {
    id : Common.ChangeLogId;
    at : Common.Timestamp;
    by : Principal;
    action : Text;
    subjectRoadieId : ?Common.RoadieId;
    touchesContactSet : Bool;
    detail : Text;
    paperworkDetail : ?Text;
    isDemo : Bool;
  };
};
