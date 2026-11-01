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
  type PhotoRef = Text;
  type SignatureRef = Text;
  type PersonName = Text;
  type ShirtSize = Text;
  type HatSize = Text;

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

  type Roadie = {
    id : Nat;
    profile : RoadieProfile;
    photo : ?PhotoRef;
    signature : ?SignatureRef;
    mainPositionId : Nat;
    secondPositionId : ?Nat;
    crossTrainedPositionId : ?Nat;
    crewId : ?Nat;
    orientationEventId : ?Nat;
    startDate : ?DateOnly;
    status : RoadieStatus;
    corporateEmployeeId : ?Text;
    contactSet : ?ContactSet;
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

  type SignupSubmission = {
    id : Nat;
    submittedAt : Timestamp;
    profile : RoadieProfile;
    photo : ?PhotoRef;
    signature : ?SignatureRef;
    contactSet : ContactSet;
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

  // OldActor is the NewActor of the preceding migration (00000000_000000.mo).
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
  };

  // The state shape is unchanged; this migration only re-applies the seed when
  // the store has no positions (idempotent re-seed on upgrade).
  public type NewActor = OldActor;

  // --- Seed data (same values as 00000000_000000.mo) ---

  let openingDateNs : Int = 1_802_066_400_000_000_000;

  func seedPositions() : [Position] {
    [
      { id = 0; name = "Servers"; house = #foh; code = "SRV"; openingBuildTo = 65; afterOpeningBuildTo = 65; needsAlcoholCert = true; minimumAge = 18; shirtsRequired = 2; hatsRequired = 1; crewManager = null },
      { id = 1; name = "Hosts"; house = #foh; code = "HST"; openingBuildTo = 18; afterOpeningBuildTo = 18; needsAlcoholCert = false; minimumAge = 16; shirtsRequired = 2; hatsRequired = 1; crewManager = null },
      { id = 2; name = "Bartenders"; house = #foh; code = "BAR"; openingBuildTo = 12; afterOpeningBuildTo = 12; needsAlcoholCert = true; minimumAge = 21; shirtsRequired = 2; hatsRequired = 1; crewManager = null },
      { id = 3; name = "Server assistants"; house = #foh; code = "SA"; openingBuildTo = 12; afterOpeningBuildTo = 12; needsAlcoholCert = false; minimumAge = 16; shirtsRequired = 2; hatsRequired = 1; crewManager = null },
      { id = 4; name = "To-go"; house = #foh; code = "TG"; openingBuildTo = 10; afterOpeningBuildTo = 10; needsAlcoholCert = false; minimumAge = 16; shirtsRequired = 2; hatsRequired = 1; crewManager = null },
      { id = 5; name = "Fry / Salad"; house = #boh; code = "FS"; openingBuildTo = 16; afterOpeningBuildTo = 16; needsAlcoholCert = false; minimumAge = 16; shirtsRequired = 2; hatsRequired = 1; crewManager = null },
      { id = 6; name = "Dish"; house = #boh; code = "DSH"; openingBuildTo = 14; afterOpeningBuildTo = 14; needsAlcoholCert = false; minimumAge = 16; shirtsRequired = 2; hatsRequired = 1; crewManager = null },
      { id = 7; name = "Pizza"; house = #boh; code = "PIZ"; openingBuildTo = 12; afterOpeningBuildTo = 12; needsAlcoholCert = false; minimumAge = 16; shirtsRequired = 2; hatsRequired = 1; crewManager = null },
      { id = 8; name = "Broil / Saute"; house = #boh; code = "BRS"; openingBuildTo = 10; afterOpeningBuildTo = 10; needsAlcoholCert = false; minimumAge = 18; shirtsRequired = 2; hatsRequired = 1; crewManager = null },
      { id = 9; name = "Hot prep"; house = #boh; code = "HP"; openingBuildTo = 7; afterOpeningBuildTo = 7; needsAlcoholCert = false; minimumAge = 18; shirtsRequired = 2; hatsRequired = 1; crewManager = null },
      { id = 10; name = "Cold prep"; house = #boh; code = "CP"; openingBuildTo = 7; afterOpeningBuildTo = 7; needsAlcoholCert = false; minimumAge = 16; shirtsRequired = 2; hatsRequired = 1; crewManager = null },
      { id = 11; name = "Point / Build"; house = #boh; code = "PB"; openingBuildTo = 7; afterOpeningBuildTo = 7; needsAlcoholCert = false; minimumAge = 16; shirtsRequired = 2; hatsRequired = 1; crewManager = null },
      { id = 12; name = "Sear"; house = #boh; code = "SEA"; openingBuildTo = 7; afterOpeningBuildTo = 7; needsAlcoholCert = false; minimumAge = 18; shirtsRequired = 2; hatsRequired = 1; crewManager = null },
      { id = 13; name = "Expo"; house = #boh; code = "EXP"; openingBuildTo = 6; afterOpeningBuildTo = 6; needsAlcoholCert = false; minimumAge = 18; shirtsRequired = 2; hatsRequired = 1; crewManager = null },
      { id = 14; name = "Bake"; house = #boh; code = "BAK"; openingBuildTo = 5; afterOpeningBuildTo = 5; needsAlcoholCert = false; minimumAge = 16; shirtsRequired = 2; hatsRequired = 1; crewManager = null },
      { id = 15; name = "Silverware roller"; house = #boh; code = "SWR"; openingBuildTo = 4; afterOpeningBuildTo = 4; needsAlcoholCert = false; minimumAge = 16; shirtsRequired = 2; hatsRequired = 1; crewManager = null },
      { id = 16; name = "Meat cutter"; house = #boh; code = "MTC"; openingBuildTo = 3; afterOpeningBuildTo = 3; needsAlcoholCert = false; minimumAge = 18; shirtsRequired = 2; hatsRequired = 1; crewManager = null },
      { id = 17; name = "DMO prep"; house = #boh; code = "DMO"; openingBuildTo = 3; afterOpeningBuildTo = 3; needsAlcoholCert = false; minimumAge = 16; shirtsRequired = 2; hatsRequired = 1; crewManager = null },
    ];
  };

  func seedSchedule() : [ScheduleEvent] {
    [
      { id = 0; kind = #deadline; name = "Paperwork due"; start = 1_801_202_400_000_000_000; end = null },
      { id = 1; kind = #orientation; name = "Orientation BOH"; start = 1_801_321_200_000_000_000; end = null },
      { id = 2; kind = #orientation; name = "Orientation FOH"; start = 1_801_335_600_000_000_000; end = null },
      { id = 3; kind = #trainingDay; name = "Training Day 1"; start = 1_801_461_600_000_000_000; end = null },
      { id = 4; kind = #trainingDay; name = "Training Day 2"; start = 1_801_548_000_000_000_000; end = null },
      { id = 5; kind = #orientation; name = "Makeup orientation"; start = 1_801_576_800_000_000_000; end = null },
      { id = 6; kind = #trainingDay; name = "Training Day 3"; start = 1_801_634_400_000_000_000; end = null },
      { id = 7; kind = #trainingDay; name = "Training Day 4"; start = 1_801_720_800_000_000_000; end = null },
      { id = 8; kind = #friendsAndFamily; name = "Friends & Family"; start = 1_801_807_200_000_000_000; end = null },
      { id = 9; kind = #friendsAndFamily; name = "Friends & Family"; start = 1_801_980_000_000_000_000; end = null },
      { id = 10; kind = #openingDay; name = "Opening day"; start = 1_802_066_400_000_000_000; end = null },
      { id = 11; kind = #signOff; name = "Final trainer sign-off"; start = 1_802_584_800_000_000_000; end = null },
    ];
  };

  func seedOrientationUniform() : [ChecklistItem] {
    [
      { id = 0; text = "Non-slip shoes"; requiresAlcoholCert = false; minorOnly = false },
      { id = 1; text = "Dark blue jeans"; requiresAlcoholCert = false; minorOnly = false },
      { id = 2; text = "Hair"; requiresAlcoholCert = false; minorOnly = false },
      { id = 3; text = "Piercings"; requiresAlcoholCert = false; minorOnly = false },
      { id = 4; text = "Smile"; requiresAlcoholCert = false; minorOnly = false },
      { id = 5; text = "Name tag"; requiresAlcoholCert = false; minorOnly = false },
    ];
  };

  func seedPaperwork() : [ChecklistItem] {
    [
      { id = 0; text = "Onboarding"; requiresAlcoholCert = false; minorOnly = false },
      { id = 1; text = "Policies & procedures"; requiresAlcoholCert = false; minorOnly = false },
      { id = 2; text = "Food handler card"; requiresAlcoholCert = false; minorOnly = false },
      { id = 3; text = "Alcohol cert"; requiresAlcoholCert = true; minorOnly = false },
      { id = 4; text = "Minor work permit"; requiresAlcoholCert = false; minorOnly = true },
    ];
  };

  func seedStoreInfo() : StoreInfo {
    {
      appName = "Roadie Roster";
      storeNumber = "975";
      locationName = "Lake Charles";
      address = "1400 W Prien Lake Rd, Lake Charles, LA 70601";
      storePhone = "";
      openingDate = openingDateNs;
      timeZone = "America/Chicago";
      amShiftStart = 600;
      amShiftEnd = 900;
      pmShiftStart = 960;
      pmShiftEnd = 1320;
      leaderTalkName = "10 Minutes with Dan";
      trainingGroupSize = 5;
      leaderTalkSize = 10;
      logo = null;
    };
  };

  func seedRetention() : RetentionSettings {
    {
      archivedContactSetDays = 90;
      notesDays = 365;
      archivedPhotoDays = 365;
      changeLogDays = 730;
    };
  };

  public func migration(old : OldActor) : NewActor {
    // Idempotent re-seed: only when the store has no positions yet. A store
    // that already has positions keeps its data untouched.
    if (old.positions.size() > 0) {
      return old;
    };
    let positionsMap = Map.empty<Nat, Position>();
    for (p in seedPositions().values()) {
      positionsMap.add(p.id, p);
    };
    let scheduleMap = Map.empty<Nat, ScheduleEvent>();
    for (e in seedSchedule().values()) {
      scheduleMap.add(e.id, e);
    };
    {
      accessControlState = old.accessControlState;
      storeInfo = { var value = seedStoreInfo() };
      positions = positionsMap;
      buildToAdjustments = old.buildToAdjustments;
      schedule = scheduleMap;
      checklists = {
        var value = {
          orientationUniform = seedOrientationUniform();
          paperwork = seedPaperwork();
        };
      };
      retention = { var value = seedRetention() };
      storeTemplates = old.storeTemplates;
      roadies = old.roadies;
      crews = old.crews;
      changeLog = old.changeLog;
      signups = old.signups;
      accessGrants = old.accessGrants;
      pendingUsers = old.pendingUsers;
      orientationCheckoffs = old.orientationCheckoffs;
      attendance = old.attendance;
      trainingGroups = old.trainingGroups;
      trainerNotes = old.trainerNotes;
      leaderTalks = old.leaderTalks;
      finalSignOffs = old.finalSignOffs;
      alerts = old.alerts;
      counters = {
        var nextRoadieId = old.counters.nextRoadieId;
        var nextPositionId = 18;
        var nextEventId = 12;
        var nextCrewId = old.counters.nextCrewId;
        var nextSignupId = old.counters.nextSignupId;
        var nextChangeLogId = old.counters.nextChangeLogId;
        var nextTrainingGroupId = old.counters.nextTrainingGroupId;
        var nextLeaderTalkId = old.counters.nextLeaderTalkId;
        var nextAlertId = old.counters.nextAlertId;
        var nextAttendanceId = old.counters.nextAttendanceId;
        var nextTrainerNoteId = old.counters.nextTrainerNoteId;
        var nextBuildToAdjustmentId = old.counters.nextBuildToAdjustmentId;
      };
    };
  };
};
