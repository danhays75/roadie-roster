import AccessControl "mo:caffeineai-authorization/access-control";
import Map "mo:core/Map";
import Nat "mo:core/Nat";
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

  type UniformItemType = { #checkbox; #count };

  // Old StoreInfo still carries the retired paperworkDueDate; the new shape
  // drops it. The paperwork due date now lives only on the schedule's
  // `#deadline` event.
  type OldStoreInfo = {
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
    paperworkDueDate : DateOnly;
  };

  type NewStoreInfo = {
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

  // Old Position still carries the retired shirtsRequired/hatsRequired pair and
  // crewManager; the new shape drops all three.
  type OldPosition = {
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
    defaultShirts : Nat;
    defaultHats : Nat;
    shirtType : Text;
    shirtQty : Nat;
    hatType : Text;
    hatQty : Nat;
  };

  type NewPosition = {
    id : Nat;
    name : Text;
    house : House;
    code : Text;
    openingBuildTo : Nat;
    afterOpeningBuildTo : Nat;
    needsAlcoholCert : Bool;
    minimumAge : Nat;
    defaultShirts : Nat;
    defaultHats : Nat;
    shirtType : Text;
    shirtQty : Nat;
    hatType : Text;
    hatQty : Nat;
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
    itemType : UniformItemType;
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

  type OldStoreTemplate = {
    name : Text;
    schedule : [ScheduleEvent];
    positions : [OldPosition];
    checklists : Checklists;
    leaderTalkName : Text;
  };

  type NewStoreTemplate = {
    name : Text;
    schedule : [ScheduleEvent];
    positions : [NewPosition];
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
    #ncnsOrientation;
    #paperworkIncomplete;
    #other : Text;
  };

  type RosterState = { #pending; #active };

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
    rosterState : RosterState;
    isDemo : Bool;
  };

  type Crew = { id : Nat; name : Text; leaderPrincipal : ?Principal; isDemo : Bool };

  type ChangeLogEntry = {
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

  type SignupSubmission = {
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
    uniformCounts : [(Nat, Nat)];
    paperworkItems : [Text];
    shirtsCount : Nat;
    hatsCount : Nat;
    updatedAt : Timestamp;
    isDemo : Bool;
  };

  type AttendanceState = { #present; #late; #absent };

  type AttendanceRecord = {
    roadieId : Nat;
    eventId : ?Nat;
    shift : ?Shift;
    state : AttendanceState;
    recordedAt : Timestamp;
    recordedBy : Principal;
    isDemo : Bool;
  };

  type ShiftBoardGroup = {
    trainerPrincipal : Principal;
    capacity : Nat;
    roadieIds : [Nat];
  };

  type ShiftBoard = {
    eventId : Nat;
    shift : Shift;
    groups : [ShiftBoardGroup];
    offRoadieIds : [Nat];
    editedAt : Timestamp;
    isDemo : Bool;
  };

  type GroupChangeNotice = {
    id : Nat;
    trainerPrincipal : Principal;
    eventId : Nat;
    shift : Shift;
    shiftLabel : Text;
    addedNames : [Text];
    removedNames : [Text];
    editorName : Text;
    createdAt : Timestamp;
    dismissed : Bool;
    isDemo : Bool;
  };

  type TrainerNote = {
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
    isDemo : Bool;
  };

  type SignOffOutcome = { #certified; #needsMoreTime : Text };

  type FinalSignOff = {
    roadieId : Nat;
    outcome : SignOffOutcome;
    futureTrainer : Bool;
    signedBy : Principal;
    signedAt : Timestamp;
    isDemo : Bool;
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
    var nextGroupChangeNoticeId : Nat;
  };

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

  type DemoRoleEntry = {
    role : DemoRole;
    stations : [Nat];
  };

  type DemoState = {
    var enabled : Bool;
    var turnedOnAt : ?Timestamp;
    var autoOffAt : ?Timestamp;
    var pretendDate : ?PretendDate;
    var demoRoles : Map.Map<Principal, DemoRoleEntry>;
  };

  type SizeCurveEntry = { size : Text; percent : Nat };

  type SizeCurve = {
    shirts : [SizeCurveEntry];
    hats : [SizeCurveEntry];
  };

  type UniformSettings = {
    sizeCurve : SizeCurve;
    bufferPercent : Nat;
  };

  // OldActor is the NewActor of the preceding migration (00000016_000000.mo).
  public type OldActor = {
    accessControlState : AccessControl.AccessControlState;
    storeInfo : { var value : OldStoreInfo };
    positions : Map.Map<Nat, OldPosition>;
    buildToAdjustments : Map.Map<Nat, BuildToAdjustment>;
    schedule : Map.Map<Nat, ScheduleEvent>;
    checklists : { var value : Checklists };
    retention : { var value : RetentionSettings };
    storeTemplates : Map.Map<Text, OldStoreTemplate>;
    roadies : Map.Map<Nat, Roadie>;
    crews : Map.Map<Nat, Crew>;
    changeLog : Map.Map<Nat, ChangeLogEntry>;
    signups : Map.Map<Nat, SignupSubmission>;
    accessGrants : Map.Map<Principal, AccessGrant>;
    pendingUsers : Map.Map<Principal, PendingUser>;
    orientationCheckoffs : Map.Map<Nat, OrientationCheckoff>;
    attendance : Map.Map<Nat, AttendanceRecord>;
    shiftBoards : Map.Map<Text, ShiftBoard>;
    groupChangeNotices : Map.Map<Nat, GroupChangeNotice>;
    trainerNotes : Map.Map<Nat, TrainerNote>;
    leaderTalks : Map.Map<Nat, LeaderTalk>;
    finalSignOffs : Map.Map<Nat, FinalSignOff>;
    alerts : Map.Map<Nat, Alert>;
    counters : Counters;
    kioskPin : { var value : ?Text };
    demoState : DemoState;
    uniformSettings : { var value : UniformSettings };
  };

  public type NewActor = {
    accessControlState : AccessControl.AccessControlState;
    storeInfo : { var value : NewStoreInfo };
    positions : Map.Map<Nat, NewPosition>;
    buildToAdjustments : Map.Map<Nat, BuildToAdjustment>;
    schedule : Map.Map<Nat, ScheduleEvent>;
    checklists : { var value : Checklists };
    retention : { var value : RetentionSettings };
    storeTemplates : Map.Map<Text, NewStoreTemplate>;
    roadies : Map.Map<Nat, Roadie>;
    crews : Map.Map<Nat, Crew>;
    changeLog : Map.Map<Nat, ChangeLogEntry>;
    signups : Map.Map<Nat, SignupSubmission>;
    accessGrants : Map.Map<Principal, AccessGrant>;
    pendingUsers : Map.Map<Principal, PendingUser>;
    orientationCheckoffs : Map.Map<Nat, OrientationCheckoff>;
    attendance : Map.Map<Nat, AttendanceRecord>;
    shiftBoards : Map.Map<Text, ShiftBoard>;
    groupChangeNotices : Map.Map<Nat, GroupChangeNotice>;
    trainerNotes : Map.Map<Nat, TrainerNote>;
    leaderTalks : Map.Map<Nat, LeaderTalk>;
    finalSignOffs : Map.Map<Nat, FinalSignOff>;
    alerts : Map.Map<Nat, Alert>;
    counters : Counters;
    kioskPin : { var value : ?Text };
    demoState : DemoState;
    uniformSettings : { var value : UniformSettings };
  };

  /// The partitioned map key for one shift board: the partition, the event id
  /// and the shift, so a demo board and a real board for the same event and
  /// shift never collide.
  func boardKey(eventId : Nat, shift : Shift, isDemo : Bool) : Text {
    (if (isDemo) { "demo:" } else { "real:" })
      # eventId.toText()
      # ":"
      # (switch shift { case (#am) "am"; case (#pm) "pm" });
  };

  /// Re-key every stored shift board with the partition prefix, derived from
  /// each board's own `isDemo` flag. A board whose old key already carries a
  /// partition prefix is left as-is.
  func repartitionBoards(old : Map.Map<Text, ShiftBoard>) : Map.Map<Text, ShiftBoard> {
    let boards = Map.empty<Text, ShiftBoard>();
    for ((_, b) in old.entries()) {
      boards.add(boardKey(b.eventId, b.shift, b.isDemo), b);
    };
    boards;
  };

  /// Drop the retired shirtsRequired/hatsRequired pair and crewManager from a
  /// position.
  func convertPosition(old : OldPosition) : NewPosition {
    {
      id = old.id;
      name = old.name;
      house = old.house;
      code = old.code;
      openingBuildTo = old.openingBuildTo;
      afterOpeningBuildTo = old.afterOpeningBuildTo;
      needsAlcoholCert = old.needsAlcoholCert;
      minimumAge = old.minimumAge;
      defaultShirts = old.defaultShirts;
      defaultHats = old.defaultHats;
      shirtType = old.shirtType;
      shirtQty = old.shirtQty;
      hatType = old.hatType;
      hatQty = old.hatQty;
    };
  };

  /// Convert a saved store template's positions to the new shape.
  func convertTemplate(old : OldStoreTemplate) : NewStoreTemplate {
    {
      name = old.name;
      schedule = old.schedule;
      positions = old.positions.map(convertPosition);
      checklists = old.checklists;
      leaderTalkName = old.leaderTalkName;
    };
  };

  /// Drop the retired paperworkDueDate from the store info. The paperwork due
  /// date now lives only on the schedule's `#deadline` event, which is
  /// preserved untouched.
  func convertStoreInfo(old : OldStoreInfo) : NewStoreInfo {
    {
      appName = old.appName;
      storeNumber = old.storeNumber;
      locationName = old.locationName;
      address = old.address;
      storePhone = old.storePhone;
      openingDate = old.openingDate;
      timeZone = old.timeZone;
      amShiftStart = old.amShiftStart;
      amShiftEnd = old.amShiftEnd;
      pmShiftStart = old.pmShiftStart;
      pmShiftEnd = old.pmShiftEnd;
      leaderTalkName = old.leaderTalkName;
      trainingGroupSize = old.trainingGroupSize;
      leaderTalkSize = old.leaderTalkSize;
      logo = old.logo;
      secondaryLogo = old.secondaryLogo;
    };
  };

  public func migration(old : OldActor) : NewActor {
    let positions = old.positions.map<Nat, OldPosition, NewPosition>(func(_, p) = convertPosition(p));
    let storeTemplates = old.storeTemplates.map<Text, OldStoreTemplate, NewStoreTemplate>(func(_, t) = convertTemplate(t));
    let shiftBoards = repartitionBoards(old.shiftBoards);

    {
      accessControlState = old.accessControlState;
      storeInfo = { var value = convertStoreInfo(old.storeInfo.value) };
      positions;
      buildToAdjustments = old.buildToAdjustments;
      schedule = old.schedule;
      checklists = old.checklists;
      retention = old.retention;
      storeTemplates;
      roadies = old.roadies;
      crews = old.crews;
      changeLog = old.changeLog;
      signups = old.signups;
      accessGrants = old.accessGrants;
      pendingUsers = old.pendingUsers;
      orientationCheckoffs = old.orientationCheckoffs;
      attendance = old.attendance;
      shiftBoards;
      groupChangeNotices = old.groupChangeNotices;
      trainerNotes = old.trainerNotes;
      leaderTalks = old.leaderTalks;
      finalSignOffs = old.finalSignOffs;
      alerts = old.alerts;
      counters = old.counters;
      kioskPin = old.kioskPin;
      demoState = old.demoState;
      uniformSettings = old.uniformSettings;
    };
  };
};
