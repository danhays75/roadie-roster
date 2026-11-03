import AccessControl "mo:caffeineai-authorization/access-control";
import Map "mo:core/Map";
import Principal "mo:core/Principal";

module {
  // --- Inlined stable types (migrations must be self-contained) ---

  type Timestamp = Int;
  type DateOnly = Int;
  type TimeOfDay = Nat;
  type TimeZone = Text;
  type Phone = Text;
  type Email = Text;
  type PersonName = Text;
  type ShirtSize = Text;
  type HatSize = Text;
  type PhotoRef = Blob;
  type SignatureRef = Blob;

  type Role = {
    #admin;
    #storeManager;
    #trainingManager;
    #leadership;
    #visitingManager;
    #trainer;
    #kiosk;
    #integration;
  };

  type House = { #foh; #boh };
  type Shift = { #am; #pm };
  type Weekday = { #wed; #thu; #fri; #sat; #sun; #mon; #tue };

  type StoreInfo = {
    appName : Text;
    storeNumber : Text;
    locationName : Text;
    address : Text;
    storePhone : Phone;
    openingDate : DateOnly;
    timeZone : TimeZone;
    amShiftStart : TimeOfDay;
    amShiftEnd : TimeOfDay;
    pmShiftStart : TimeOfDay;
    pmShiftEnd : TimeOfDay;
    leaderTalkName : Text;
    trainingGroupSize : Nat;
    leaderTalkSize : Nat;
    logo : ?PhotoRef;
    secondaryLogo : ?PhotoRef;
  };

  type Position = {
    id : Nat;
    name : Text;
    house : House;
    code : Text;
    openingBuildTo : Nat;
    afterOpeningBuildTo : Nat;
    needsAlcoholCert : Bool;
    minimumAge : Nat;
    shirtsRequired : Nat;
    hatsRequired : Nat;
    crewManager : ?Text;
  };

  type BuildToAdjustment = {
    positionId : Nat;
    openingDelta : Int;
    afterOpeningDelta : Int;
    at : Timestamp;
    by : Principal;
  };

  type EventKind = {
    #deadline;
    #orientation;
    #trainingDay;
    #friendsAndFamily;
    #openingDay;
    #signOff;
    #other;
  };

  type ScheduleEvent = {
    id : Nat;
    kind : EventKind;
    name : Text;
    start : Timestamp;
    end : ?Timestamp;
  };

  type ChecklistItem = {
    id : Nat;
    text : Text;
    requiresAlcoholCert : Bool;
    minorOnly : Bool;
  };

  type Checklists = {
    orientationUniform : [ChecklistItem];
    paperwork : [ChecklistItem];
  };

  type RetentionSettings = {
    archivedContactSetDays : Nat;
    notesDays : Nat;
    archivedPhotoDays : Nat;
    changeLogDays : Nat;
  };

  type StoreTemplate = {
    name : Text;
    schedule : [ScheduleEvent];
    positions : [Position];
    checklists : Checklists;
    leaderTalkName : Text;
  };

  type RoadieStatus = {
    #hired;
    #paperworkDone;
    #oriented;
    #inTraining;
    #certified;
    #needsMoreTime;
    #active;
    #archived;
  };

  type ArchiveReason = {
    #noShow;
    #quitDuringTraining;
    #tookAnotherJob;
    #letGo;
    #other : Text;
  };

  type AvailabilitySlot = { day : Weekday; shift : Shift };

  type ContactSet = {
    phone : Phone;
    email : Email;
    emergencyContactName : Text;
    emergencyContactPhone : Phone;
    dateOfBirth : DateOnly;
    availability : [AvailabilitySlot];
    availabilitySignature : ?SignatureRef;
    availabilitySignedAt : ?Timestamp;
    availabilityResignPending : Bool;
    managerSignature : ?SignatureRef;
    managerSignedAt : ?Timestamp;
    managerSignedBy : ?Principal;
  };

  type RoadieProfile = {
    name : PersonName;
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
    shirtSize : ?ShirtSize;
    hatSize : ?HatSize;
    shiftsWantedPerWeek : ?Nat;
    weekdayLunch : ?Bool;
  };

  // Old roadie (as deployed by 00000009_000000.mo): no demo flag.
  type Roadie = {
    id : Nat;
    profile : RoadieProfile;
    photo : ?PhotoRef;
    mainPositionId : Nat;
    secondPositionId : ?Nat;
    crossTrainedPositionId : ?Nat;
    crewId : ?Nat;
    orientationEventId : ?Nat;
    startDate : ?DateOnly;
    status : RoadieStatus;
    corporateEmployeeId : ?Text;
    contactSet : ?ContactSet;
    isMinor : Bool;
    birthdayMonthDay : ?Text;
    archivedReason : ?ArchiveReason;
    archivedAt : ?Timestamp;
    hiredAt : Timestamp;
    hireDate : ?Timestamp;
    signedBy : ?Principal;
  };

  // New roadie carrying the demo flag.
  type NewRoadie = {
    id : Nat;
    profile : RoadieProfile;
    photo : ?PhotoRef;
    mainPositionId : Nat;
    secondPositionId : ?Nat;
    crossTrainedPositionId : ?Nat;
    crewId : ?Nat;
    orientationEventId : ?Nat;
    startDate : ?DateOnly;
    status : RoadieStatus;
    corporateEmployeeId : ?Text;
    contactSet : ?ContactSet;
    isMinor : Bool;
    birthdayMonthDay : ?Text;
    archivedReason : ?ArchiveReason;
    archivedAt : ?Timestamp;
    hiredAt : Timestamp;
    hireDate : ?Timestamp;
    signedBy : ?Principal;
    isDemo : Bool;
  };

  // Old crew (as deployed by 00000009_000000.mo): no demo flag.
  type Crew = { id : Nat; name : Text; leaderPrincipal : ?Principal };

  // New crew carrying the demo flag.
  type NewCrew = { id : Nat; name : Text; leaderPrincipal : ?Principal; isDemo : Bool };

  // Old change-log entry: no demo flag.
  type ChangeLogEntry = {
    id : Nat;
    at : Timestamp;
    by : Principal;
    action : Text;
    subjectRoadieId : ?Nat;
    touchesContactSet : Bool;
    detail : Text;
  };

  // New change-log entry carrying the demo flag.
  type NewChangeLogEntry = {
    id : Nat;
    at : Timestamp;
    by : Principal;
    action : Text;
    subjectRoadieId : ?Nat;
    touchesContactSet : Bool;
    detail : Text;
    isDemo : Bool;
  };

  type SignupStatus = { #pending; #approved : Nat; #rejected };

  // Old sign-up: no demo flag.
  type SignupSubmission = {
    id : Nat;
    submittedAt : Timestamp;
    profile : RoadieProfile;
    photo : ?PhotoRef;
    signature : ?SignatureRef;
    contactSet : ContactSet;
    status : SignupStatus;
  };

  // New sign-up carrying the demo flag.
  type NewSignupSubmission = {
    id : Nat;
    submittedAt : Timestamp;
    profile : RoadieProfile;
    photo : ?PhotoRef;
    signature : ?SignatureRef;
    contactSet : ContactSet;
    status : SignupStatus;
    isDemo : Bool;
  };

  type StaffProfile = {
    fullName : PersonName;
    requestedRole : Role;
    title : Text;
    homeStoreNumber : Text;
    homeStoreCity : Text;
    preferredName : ?Text;
    workPhone : ?Phone;
    workEmail : ?Email;
    photo : ?PhotoRef;
    trainerPositionIds : [Nat];
    arrivalDate : ?DateOnly;
    departureDate : ?DateOnly;
    hometown : ?Text;
    hobbies : ?Text;
    favoriteTeam : ?Text;
    favoriteSnack : ?Text;
    favoriteDrink : ?Text;
    favoriteColor : ?Text;
    funFact : ?Text;
    goalHere : ?Text;
    shirtSize : ?ShirtSize;
    hatSize : ?HatSize;
  };

  type AccessGrant = {
    principal : Principal;
    role : Role;
    approvedAt : Timestamp;
    approvedBy : Principal;
    accessEndsAt : ?Timestamp;
    trainerPositionIds : [Nat];
    linkedRoadieId : ?Nat;
    staffProfile : ?StaffProfile;
  };

  type PendingUser = {
    principal : Principal;
    requestedAt : Timestamp;
    staffProfile : ?StaffProfile;
  };

  type OrientationCheckoff = {
    roadieId : Nat;
    uniformItems : [Text];
    paperworkItems : [Text];
    shirtsCount : Nat;
    hatsCount : Nat;
    updatedAt : Timestamp;
  };

  type AttendanceState = { #present; #late; #absent };

  // Old attendance record: no demo flag.
  type AttendanceRecord = {
    roadieId : Nat;
    eventId : ?Nat;
    shift : ?Shift;
    state : AttendanceState;
    recordedAt : Timestamp;
    recordedBy : Principal;
  };

  // New attendance record carrying the demo flag.
  type NewAttendanceRecord = {
    roadieId : Nat;
    eventId : ?Nat;
    shift : ?Shift;
    state : AttendanceState;
    recordedAt : Timestamp;
    recordedBy : Principal;
    isDemo : Bool;
  };

  type TrainingGroup = {
    id : Nat;
    day : DateOnly;
    shift : Shift;
    positionId : Nat;
    trainerPrincipal : ?Principal;
    memberRoadieIds : [Nat];
  };

  // Old trainer note: no demo flag.
  type TrainerNote = {
    id : Nat;
    author : Principal;
    roadieId : Nat;
    shift : Shift;
    day : DateOnly;
    didWell : Text;
    workOn : Text;
    createdAt : Timestamp;
  };

  // New trainer note carrying the demo flag.
  type NewTrainerNote = {
    id : Nat;
    author : Principal;
    roadieId : Nat;
    shift : Shift;
    day : DateOnly;
    didWell : Text;
    workOn : Text;
    createdAt : Timestamp;
    isDemo : Bool;
  };

  type LeaderTalk = {
    id : Nat;
    name : Text;
    day : DateOnly;
    attendees : [Nat];
  };

  type SignOffOutcome = { #certified; #needsMoreTime : Text };

  type FinalSignOff = {
    roadieId : Nat;
    outcome : SignOffOutcome;
    futureTrainer : Bool;
    signedBy : Principal;
    signedAt : Timestamp;
  };

  type Alert = {
    id : Nat;
    message : Text;
    createdAt : Timestamp;
    acknowledged : Bool;
  };

  type Counters = {
    var nextRoadieId : Nat;
    var nextPositionId : Nat;
    var nextEventId : Nat;
    var nextCrewId : Nat;
    var nextSignupId : Nat;
    var nextChangeLogId : Nat;
    var nextTrainingGroupId : Nat;
    var nextLeaderTalkId : Nat;
    var nextAlertId : Nat;
    var nextAttendanceId : Nat;
    var nextTrainerNoteId : Nat;
    var nextBuildToAdjustmentId : Nat;
  };

  // --- Demo-mode types (new in this migration) ---

  type DemoRole = {
    #admin;
    #storeManager;
    #trainingManager;
    #trainer;
    #visitingManager;
    #leadership;
    #kiosk;
  };

  type DemoShift = { #am; #pm };

  type PretendDate = { day : DateOnly; shift : DemoShift };

  type DemoState = {
    var enabled : Bool;
    var turnedOnAt : ?Timestamp;
    var autoOffAt : ?Timestamp;
    var pretendDate : ?PretendDate;
    var demoRole : DemoRole;
    var demoTrainerStations : [Nat];
  };

  // OldActor is the NewActor of the preceding migration (00000009_000000.mo).
  public type OldActor = {
    accessControlState : AccessControl.AccessControlState;
    storeInfo : { var value : StoreInfo };
    positions : Map.Map<Nat, Position>;
    buildToAdjustments : Map.Map<Nat, BuildToAdjustment>;
    schedule : Map.Map<Nat, ScheduleEvent>;
    checklists : { var value : Checklists };
    retention : { var value : RetentionSettings };
    storeTemplates : Map.Map<Text, StoreTemplate>;
    roadies : Map.Map<Nat, Roadie>;
    crews : Map.Map<Nat, Crew>;
    changeLog : Map.Map<Nat, ChangeLogEntry>;
    signups : Map.Map<Nat, SignupSubmission>;
    accessGrants : Map.Map<Principal, AccessGrant>;
    pendingUsers : Map.Map<Principal, PendingUser>;
    orientationCheckoffs : Map.Map<Nat, OrientationCheckoff>;
    attendance : Map.Map<Nat, AttendanceRecord>;
    trainingGroups : Map.Map<Nat, TrainingGroup>;
    trainerNotes : Map.Map<Nat, TrainerNote>;
    leaderTalks : Map.Map<Nat, LeaderTalk>;
    finalSignOffs : Map.Map<Nat, FinalSignOff>;
    alerts : Map.Map<Nat, Alert>;
    counters : Counters;
    kioskPin : { var value : ?Text };
  };

  public type NewActor = {
    accessControlState : AccessControl.AccessControlState;
    storeInfo : { var value : StoreInfo };
    positions : Map.Map<Nat, Position>;
    buildToAdjustments : Map.Map<Nat, BuildToAdjustment>;
    schedule : Map.Map<Nat, ScheduleEvent>;
    checklists : { var value : Checklists };
    retention : { var value : RetentionSettings };
    storeTemplates : Map.Map<Text, StoreTemplate>;
    roadies : Map.Map<Nat, NewRoadie>;
    crews : Map.Map<Nat, NewCrew>;
    changeLog : Map.Map<Nat, NewChangeLogEntry>;
    signups : Map.Map<Nat, NewSignupSubmission>;
    accessGrants : Map.Map<Principal, AccessGrant>;
    pendingUsers : Map.Map<Principal, PendingUser>;
    orientationCheckoffs : Map.Map<Nat, OrientationCheckoff>;
    attendance : Map.Map<Nat, NewAttendanceRecord>;
    trainingGroups : Map.Map<Nat, TrainingGroup>;
    trainerNotes : Map.Map<Nat, NewTrainerNote>;
    leaderTalks : Map.Map<Nat, LeaderTalk>;
    finalSignOffs : Map.Map<Nat, FinalSignOff>;
    alerts : Map.Map<Nat, Alert>;
    counters : Counters;
    kioskPin : { var value : ?Text };
    demoState : DemoState;
  };

  /// Mark an existing roadie as a real (non-demo) record.
  func convertRoadie(old : Roadie) : NewRoadie {
    {
      id = old.id;
      profile = old.profile;
      photo = old.photo;
      mainPositionId = old.mainPositionId;
      secondPositionId = old.secondPositionId;
      crossTrainedPositionId = old.crossTrainedPositionId;
      crewId = old.crewId;
      orientationEventId = old.orientationEventId;
      startDate = old.startDate;
      status = old.status;
      corporateEmployeeId = old.corporateEmployeeId;
      contactSet = old.contactSet;
      isMinor = old.isMinor;
      birthdayMonthDay = old.birthdayMonthDay;
      archivedReason = old.archivedReason;
      archivedAt = old.archivedAt;
      hiredAt = old.hiredAt;
      hireDate = old.hireDate;
      signedBy = old.signedBy;
      isDemo = false;
    };
  };

  /// Mark an existing crew as a real (non-demo) record.
  func convertCrew(old : Crew) : NewCrew {
    { id = old.id; name = old.name; leaderPrincipal = old.leaderPrincipal; isDemo = false };
  };

  /// Mark an existing change-log entry as a real (non-demo) record.
  func convertChangeLogEntry(old : ChangeLogEntry) : NewChangeLogEntry {
    {
      id = old.id;
      at = old.at;
      by = old.by;
      action = old.action;
      subjectRoadieId = old.subjectRoadieId;
      touchesContactSet = old.touchesContactSet;
      detail = old.detail;
      isDemo = false;
    };
  };

  /// Mark an existing sign-up as a real (non-demo) record.
  func convertSignup(old : SignupSubmission) : NewSignupSubmission {
    {
      id = old.id;
      submittedAt = old.submittedAt;
      profile = old.profile;
      photo = old.photo;
      signature = old.signature;
      contactSet = old.contactSet;
      status = old.status;
      isDemo = false;
    };
  };

  /// Mark an existing attendance record as a real (non-demo) record.
  func convertAttendance(old : AttendanceRecord) : NewAttendanceRecord {
    {
      roadieId = old.roadieId;
      eventId = old.eventId;
      shift = old.shift;
      state = old.state;
      recordedAt = old.recordedAt;
      recordedBy = old.recordedBy;
      isDemo = false;
    };
  };

  /// Mark an existing trainer note as a real (non-demo) record.
  func convertTrainerNote(old : TrainerNote) : NewTrainerNote {
    {
      id = old.id;
      author = old.author;
      roadieId = old.roadieId;
      shift = old.shift;
      day = old.day;
      didWell = old.didWell;
      workOn = old.workOn;
      createdAt = old.createdAt;
      isDemo = false;
    };
  };

  public func migration(old : OldActor) : NewActor {
    {
      accessControlState = old.accessControlState;
      storeInfo = old.storeInfo;
      positions = old.positions;
      buildToAdjustments = old.buildToAdjustments;
      schedule = old.schedule;
      checklists = old.checklists;
      retention = old.retention;
      storeTemplates = old.storeTemplates;
      roadies = old.roadies.map(func(_id, r) { convertRoadie(r) });
      crews = old.crews.map(func(_id, c) { convertCrew(c) });
      changeLog = old.changeLog.map(func(_id, e) { convertChangeLogEntry(e) });
      signups = old.signups.map(func(_id, s) { convertSignup(s) });
      accessGrants = old.accessGrants;
      pendingUsers = old.pendingUsers;
      orientationCheckoffs = old.orientationCheckoffs;
      attendance = old.attendance.map(func(_id, a) { convertAttendance(a) });
      trainingGroups = old.trainingGroups;
      trainerNotes = old.trainerNotes.map(func(_id, n) { convertTrainerNote(n) });
      leaderTalks = old.leaderTalks;
      finalSignOffs = old.finalSignOffs;
      alerts = old.alerts;
      counters = old.counters;
      kioskPin = old.kioskPin;
      demoState = {
        var enabled = false;
        var turnedOnAt = null;
        var autoOffAt = null;
        var pretendDate = null;
        var demoRole = #admin;
        var demoTrainerStations = [];
      };
    };
  };
};
