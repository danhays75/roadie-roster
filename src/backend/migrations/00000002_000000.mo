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

  // Old placeholder refs were plain text (a filename); new refs are real
  // platform file-storage references (blob hashes).
  type OldPhotoRef = Text;
  type OldSignatureRef = Text;
  type NewPhotoRef = Blob;
  type NewSignatureRef = Blob;

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
    logo : ?OldPhotoRef;
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
    logo : ?NewPhotoRef;
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

  // --- Old shapes (as deployed) ---

  type OldContactSet = {
    phone : Phone;
    email : Email;
    emergencyContactName : Text;
    emergencyContactPhone : Phone;
    dateOfBirth : DateOnly;
    availability : [AvailabilitySlot];
    availabilitySignature : ?OldSignatureRef;
    availabilitySignedAt : ?Timestamp;
    availabilityResignPending : Bool;
  };

  type RoadieProfile = {
    name : PersonName;
    preferredName : ?Text;
    hometown : ?Text;
    hobbies : ?Text;
    favoriteMovie : ?Text;
    favoriteSnack : ?Text;
    funFact : ?Text;
    goalHere : ?Text;
    positionAppliedFor : ?Text;
    shirtSize : ?ShirtSize;
    hatSize : ?HatSize;
    shiftsWantedPerWeek : ?Nat;
    weekdayLunch : ?Bool;
  };

  type OldRoadie = {
    id : Nat;
    profile : RoadieProfile;
    photo : ?OldPhotoRef;
    signature : ?OldSignatureRef;
    mainPositionId : Nat;
    secondPositionId : ?Nat;
    crossTrainedPositionId : ?Nat;
    crewId : ?Nat;
    orientationEventId : ?Nat;
    startDate : ?DateOnly;
    status : RoadieStatus;
    corporateEmployeeId : ?Text;
    contactSet : ?OldContactSet;
    archivedReason : ?ArchiveReason;
    archivedAt : ?Timestamp;
    hiredAt : Timestamp;
    signedBy : ?Principal;
  };

  type Crew = { id : Nat; name : Text };

  type ChangeLogEntry = {
    id : Nat;
    at : Timestamp;
    by : Principal;
    action : Text;
    subjectRoadieId : ?Nat;
    touchesContactSet : Bool;
    detail : Text;
  };

  type SignupStatus = { #pending; #approved : Nat; #rejected };

  type OldSignupSubmission = {
    id : Nat;
    submittedAt : Timestamp;
    profile : RoadieProfile;
    photo : ?OldPhotoRef;
    signature : ?OldSignatureRef;
    contactSet : OldContactSet;
    status : SignupStatus;
  };

  type AccessGrant = {
    principal : Principal;
    role : Role;
    approvedAt : Timestamp;
    approvedBy : Principal;
    accessEndsAt : ?Timestamp;
    trainerPositionIds : [Nat];
    linkedRoadieId : ?Nat;
  };

  type PendingUser = {
    principal : Principal;
    requestedAt : Timestamp;
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

  type AttendanceRecord = {
    roadieId : Nat;
    eventId : ?Nat;
    shift : ?Shift;
    state : AttendanceState;
    recordedAt : Timestamp;
    recordedBy : Principal;
  };

  type TrainingGroup = {
    id : Nat;
    day : DateOnly;
    shift : Shift;
    positionId : Nat;
    trainerPrincipal : ?Principal;
    memberRoadieIds : [Nat];
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

  // --- New shapes ---

  type NewContactSet = {
    phone : Phone;
    email : Email;
    emergencyContactName : Text;
    emergencyContactPhone : Phone;
    dateOfBirth : DateOnly;
    availability : [AvailabilitySlot];
    availabilitySignature : ?NewSignatureRef;
    availabilitySignedAt : ?Timestamp;
    availabilityResignPending : Bool;
    managerSignature : ?NewSignatureRef;
    managerSignedAt : ?Timestamp;
    managerSignedBy : ?Principal;
  };

  type NewRoadie = {
    id : Nat;
    profile : RoadieProfile;
    photo : ?NewPhotoRef;
    mainPositionId : Nat;
    secondPositionId : ?Nat;
    crossTrainedPositionId : ?Nat;
    crewId : ?Nat;
    orientationEventId : ?Nat;
    startDate : ?DateOnly;
    status : RoadieStatus;
    corporateEmployeeId : ?Text;
    contactSet : ?NewContactSet;
    isMinor : Bool;
    birthdayMonthDay : ?Text;
    archivedReason : ?ArchiveReason;
    archivedAt : ?Timestamp;
    hiredAt : Timestamp;
    signedBy : ?Principal;
  };

  type NewSignupSubmission = {
    id : Nat;
    submittedAt : Timestamp;
    profile : RoadieProfile;
    photo : ?NewPhotoRef;
    signature : ?NewSignatureRef;
    contactSet : NewContactSet;
    status : SignupStatus;
  };

  // OldActor is the NewActor of the preceding migration (00000001_000000.mo).
  public type OldActor = {
    accessControlState : AccessControl.AccessControlState;
    storeInfo : { var value : StoreInfo };
    positions : Map.Map<Nat, Position>;
    buildToAdjustments : Map.Map<Nat, BuildToAdjustment>;
    schedule : Map.Map<Nat, ScheduleEvent>;
    checklists : { var value : Checklists };
    retention : { var value : RetentionSettings };
    storeTemplates : Map.Map<Text, StoreTemplate>;
    roadies : Map.Map<Nat, OldRoadie>;
    crews : Map.Map<Nat, Crew>;
    changeLog : Map.Map<Nat, ChangeLogEntry>;
    signups : Map.Map<Nat, OldSignupSubmission>;
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
  };

  public type NewActor = {
    accessControlState : AccessControl.AccessControlState;
    storeInfo : { var value : NewStoreInfo };
    positions : Map.Map<Nat, Position>;
    buildToAdjustments : Map.Map<Nat, BuildToAdjustment>;
    schedule : Map.Map<Nat, ScheduleEvent>;
    checklists : { var value : Checklists };
    retention : { var value : RetentionSettings };
    storeTemplates : Map.Map<Text, StoreTemplate>;
    roadies : Map.Map<Nat, NewRoadie>;
    crews : Map.Map<Nat, Crew>;
    changeLog : Map.Map<Nat, ChangeLogEntry>;
    signups : Map.Map<Nat, NewSignupSubmission>;
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
  };

  /// Convert an old text placeholder ref to a real storage ref. The old values
  /// were filenames, never real uploads, so they cannot become blob hashes and
  /// are dropped to null.
  func convertRef(_old : ?Text) : ?Blob {
    null;
  };

  func convertContactSet(old : OldContactSet) : NewContactSet {
    {
      phone = old.phone;
      email = old.email;
      emergencyContactName = old.emergencyContactName;
      emergencyContactPhone = old.emergencyContactPhone;
      dateOfBirth = old.dateOfBirth;
      availability = old.availability;
      availabilitySignature = convertRef(old.availabilitySignature);
      availabilitySignedAt = old.availabilitySignedAt;
      availabilityResignPending = old.availabilityResignPending;
      managerSignature = null;
      managerSignedAt = null;
      managerSignedBy = null;
    };
  };

  func convertRoadie(old : OldRoadie) : NewRoadie {
    {
      id = old.id;
      profile = old.profile;
      photo = convertRef(old.photo);
      mainPositionId = old.mainPositionId;
      secondPositionId = old.secondPositionId;
      crossTrainedPositionId = old.crossTrainedPositionId;
      crewId = old.crewId;
      orientationEventId = old.orientationEventId;
      startDate = old.startDate;
      status = old.status;
      corporateEmployeeId = old.corporateEmployeeId;
      contactSet = switch (old.contactSet) {
        case (?cs) { ?convertContactSet(cs) };
        case null { null };
      };
      // Derived values are recomputed by the backend on read; the migration
      // cannot compute store-time age, so it seeds the safe default.
      isMinor = false;
      birthdayMonthDay = null;
      archivedReason = old.archivedReason;
      archivedAt = old.archivedAt;
      hiredAt = old.hiredAt;
      signedBy = old.signedBy;
    };
  };

  func convertSignup(old : OldSignupSubmission) : NewSignupSubmission {
    {
      id = old.id;
      submittedAt = old.submittedAt;
      profile = old.profile;
      photo = convertRef(old.photo);
      signature = convertRef(old.signature);
      contactSet = convertContactSet(old.contactSet);
      status = old.status;
    };
  };

  func convertStoreInfo(old : StoreInfo) : NewStoreInfo {
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
      logo = convertRef(old.logo);
    };
  };

  public func migration(old : OldActor) : NewActor {
    {
      accessControlState = old.accessControlState;
      storeInfo = { var value = convertStoreInfo(old.storeInfo.value) };
      positions = old.positions;
      buildToAdjustments = old.buildToAdjustments;
      schedule = old.schedule;
      checklists = old.checklists;
      retention = old.retention;
      storeTemplates = old.storeTemplates;
      roadies = old.roadies.map(func(_id, r) = convertRoadie(r));
      crews = old.crews;
      changeLog = old.changeLog;
      signups = old.signups.map(func(_id, s) = convertSignup(s));
      accessGrants = old.accessGrants;
      pendingUsers = old.pendingUsers;
      orientationCheckoffs = old.orientationCheckoffs;
      attendance = old.attendance;
      trainingGroups = old.trainingGroups;
      trainerNotes = old.trainerNotes;
      leaderTalks = old.leaderTalks;
      finalSignOffs = old.finalSignOffs;
      alerts = old.alerts;
      counters = old.counters;
    };
  };
};
