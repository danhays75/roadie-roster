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
    paperworkDueDate : DateOnly;
  };

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
    shirtType : Text;
    shirtQty : Nat;
    hatType : Text;
    hatQty : Nat;
  };

  // New Position shape: restores the legacy defaultShirts/defaultHats pair
  // alongside the shirtType/shirtQty/hatType/hatQty pair.
  type NewPosition = {
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

  // Old training-group shape being replaced by the per-shift board model.
  type OldTrainingGroup = {
    id : Nat;
    day : DateOnly;
    shift : Shift;
    positionId : Nat;
    trainerPrincipal : ?Principal;
    memberRoadieIds : [Nat];
    isDemo : Bool;
  };

  // New per-shift board model.
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

  /// The previous version's counters shape, before `nextGroupChangeNoticeId`
  /// was added. `OldActor` must match the last applied stable signature.
  type OldCounters = {
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

  // OldActor is the NewActor of the preceding migration (00000015_000000.mo).
  public type OldActor = {
    accessControlState : AccessControl.AccessControlState;
    storeInfo : { var value : StoreInfo };
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
    trainingGroups : Map.Map<Nat, OldTrainingGroup>;
    trainerNotes : Map.Map<Nat, TrainerNote>;
    leaderTalks : Map.Map<Nat, LeaderTalk>;
    finalSignOffs : Map.Map<Nat, FinalSignOff>;
    alerts : Map.Map<Nat, Alert>;
    counters : OldCounters;
    kioskPin : { var value : ?Text };
    demoState : DemoState;
    uniformSettings : { var value : UniformSettings };
  };

  public type NewActor = {
    accessControlState : AccessControl.AccessControlState;
    storeInfo : { var value : StoreInfo };
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

  /// The map key for one shift board: the event id and shift, so a board is
  /// unique per shift.
  func boardKey(eventId : Nat, shift : Shift) : Text {
    eventId.toText() # ":" # (switch shift { case (#am) "am"; case (#pm) "pm" });
  };

  /// Fold the retired per-day TrainingGroup records into the new per-shift
  /// ShiftBoard model. Each old group becomes one trainer column on the board
  /// for its day's event and shift; groups that share an event and shift are
  /// merged into one board. The old `day` is matched to a `#trainingDay` or
  /// `#friendsAndFamily` schedule event by start date; a group whose day matches
  /// no such event is dropped (its data cannot be placed on a shift board).
  func migrateBoards(
    oldGroups : Map.Map<Nat, OldTrainingGroup>,
    schedule : Map.Map<Nat, ScheduleEvent>,
    defaultCapacity : Nat,
  ) : Map.Map<Text, ShiftBoard> {
    let boards = Map.empty<Text, ShiftBoard>();
    for ((_, g) in oldGroups.entries()) {
      let eventId = findEventForDay(schedule, g.day, g.shift);
      switch (eventId) {
        case null {};
        case (?eid) {
          let key = boardKey(eid, g.shift);
          let existing = switch (boards.get(key)) {
            case (?b) { b };
            case null {
              {
                eventId = eid;
                shift = g.shift;
                groups = [];
                offRoadieIds = [];
                editedAt = 0;
                isDemo = g.isDemo;
              };
            };
          };
          let trainer = switch (g.trainerPrincipal) {
            case (?p) { p };
            case null { Principal.fromText("aaaaa-aa") };
          };
          let newGroup : ShiftBoardGroup = {
            trainerPrincipal = trainer;
            capacity = defaultCapacity;
            roadieIds = g.memberRoadieIds;
          };
          boards.add(key, { existing with groups = existing.groups.concat([newGroup]) });
        };
      };
    };
    boards;
  };

  /// Find the `#trainingDay` or `#friendsAndFamily` event whose start date
  /// matches `day`. Friends & Family events only have a `#pm` shift.
  func findEventForDay(
    schedule : Map.Map<Nat, ScheduleEvent>,
    day : DateOnly,
    shift : Shift,
  ) : ?Nat {
    let dayStart = day;
    let dayEnd = day + 86_400_000_000_000;
    var found : ?Nat = null;
    for ((_, e) in schedule.entries()) {
      let isTraining = e.kind == #trainingDay;
      let isFF = e.kind == #friendsAndFamily;
      if (isTraining or isFF) {
        let inDay = e.start >= dayStart and e.start < dayEnd;
        let shiftOk = if (isFF) { shift == #pm } else { true };
        if (inDay and shiftOk and found == null) {
          found := ?e.id;
        };
      };
    };
    found;
  };

  /// Restore the legacy defaultShirts/defaultHats pair on a position. The
  /// values were dropped by the preceding migration, so they are restored to
  /// the historical defaults (3 shirts, 2 hats).
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
      shirtsRequired = old.shirtsRequired;
      hatsRequired = old.hatsRequired;
      crewManager = old.crewManager;
      defaultShirts = 3;
      defaultHats = 2;
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

  public func migration(old : OldActor) : NewActor {
    let defaultCapacity = old.storeInfo.value.trainingGroupSize;
    let shiftBoards = migrateBoards(old.trainingGroups, old.schedule, defaultCapacity);
    let positions = old.positions.map<Nat, OldPosition, NewPosition>(func(_, p) = convertPosition(p));
    let storeTemplates = old.storeTemplates.map<Text, OldStoreTemplate, NewStoreTemplate>(func(_, t) = convertTemplate(t));

    {
      accessControlState = old.accessControlState;
      storeInfo = old.storeInfo;
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
      groupChangeNotices = Map.empty();
      trainerNotes = old.trainerNotes;
      leaderTalks = old.leaderTalks;
      finalSignOffs = old.finalSignOffs;
      alerts = old.alerts;
      counters = {
        var nextRoadieId = old.counters.nextRoadieId;
        var nextPositionId = old.counters.nextPositionId;
        var nextEventId = old.counters.nextEventId;
        var nextCrewId = old.counters.nextCrewId;
        var nextSignupId = old.counters.nextSignupId;
        var nextChangeLogId = old.counters.nextChangeLogId;
        var nextTrainingGroupId = old.counters.nextTrainingGroupId;
        var nextLeaderTalkId = old.counters.nextLeaderTalkId;
        var nextAlertId = old.counters.nextAlertId;
        var nextAttendanceId = old.counters.nextAttendanceId;
        var nextTrainerNoteId = old.counters.nextTrainerNoteId;
        var nextBuildToAdjustmentId = old.counters.nextBuildToAdjustmentId;
        var nextGroupChangeNoticeId = 0;
      };
      kioskPin = old.kioskPin;
      demoState = old.demoState;
      uniformSettings = old.uniformSettings;
    };
  };
};
