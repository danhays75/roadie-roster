import AccessControl "mo:caffeineai-authorization/access-control";
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Principal "mo:core/Principal";
import Set "mo:core/Set";

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

  // --- Old shapes (as deployed by 00000011_000000.mo) ---

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

  type NewArchiveReason = {
    #noShow;
    #quitDuringTraining;
    #tookAnotherJob;
    #letGo;
    #ncnsOrientation;
    #paperworkIncomplete;
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

  // --- New shapes (this migration) ---

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
    paperworkDueDate : DateOnly;
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
    shirtsRequired : Nat;
    hatsRequired : Nat;
    crewManager : ?Text;
    defaultShirts : Nat;
    defaultHats : Nat;
  };

  type NewChecklistItem = {
    id : Nat;
    text : Text;
    requiresAlcoholCert : Bool;
    minorOnly : Bool;
    itemType : UniformItemType;
  };

  type NewChecklists = {
    orientationUniform : [NewChecklistItem];
    paperwork : [NewChecklistItem];
  };

  type NewStoreTemplate = {
    name : Text;
    schedule : [ScheduleEvent];
    positions : [NewPosition];
    checklists : NewChecklists;
    leaderTalkName : Text;
  };

  type RosterState = { #pending; #active };

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
    archivedReason : ?NewArchiveReason;
    archivedAt : ?Timestamp;
    hiredAt : Timestamp;
    hireDate : ?Timestamp;
    signedBy : ?Principal;
    rosterState : RosterState;
    isDemo : Bool;
  };

  type NewOrientationCheckoff = {
    roadieId : Nat;
    uniformItems : [Text];
    uniformCounts : [(Nat, Nat)];
    paperworkItems : [Text];
    shirtsCount : Nat;
    hatsCount : Nat;
    updatedAt : Timestamp;
    isDemo : Bool;
  };

  type NewTrainingGroup = {
    id : Nat;
    day : DateOnly;
    shift : Shift;
    positionId : Nat;
    trainerPrincipal : ?Principal;
    memberRoadieIds : [Nat];
    isDemo : Bool;
  };

  type NewLeaderTalk = {
    id : Nat;
    name : Text;
    day : DateOnly;
    attendees : [Nat];
    isDemo : Bool;
  };

  type NewFinalSignOff = {
    roadieId : Nat;
    outcome : SignOffOutcome;
    futureTrainer : Bool;
    signedBy : Principal;
    signedAt : Timestamp;
    isDemo : Bool;
  };

  // OldActor is the NewActor of the preceding migration (00000011_000000.mo).
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
    demoState : DemoState;
  };

  public type NewActor = {
    accessControlState : AccessControl.AccessControlState;
    storeInfo : { var value : NewStoreInfo };
    positions : Map.Map<Nat, NewPosition>;
    buildToAdjustments : Map.Map<Nat, BuildToAdjustment>;
    schedule : Map.Map<Nat, ScheduleEvent>;
    checklists : { var value : NewChecklists };
    retention : { var value : RetentionSettings };
    storeTemplates : Map.Map<Text, NewStoreTemplate>;
    roadies : Map.Map<Nat, NewRoadie>;
    crews : Map.Map<Nat, Crew>;
    changeLog : Map.Map<Nat, ChangeLogEntry>;
    signups : Map.Map<Nat, SignupSubmission>;
    accessGrants : Map.Map<Principal, AccessGrant>;
    pendingUsers : Map.Map<Principal, PendingUser>;
    orientationCheckoffs : Map.Map<Nat, NewOrientationCheckoff>;
    attendance : Map.Map<Nat, AttendanceRecord>;
    trainingGroups : Map.Map<Nat, NewTrainingGroup>;
    trainerNotes : Map.Map<Nat, TrainerNote>;
    leaderTalks : Map.Map<Nat, NewLeaderTalk>;
    finalSignOffs : Map.Map<Nat, NewFinalSignOff>;
    alerts : Map.Map<Nat, Alert>;
    counters : Counters;
    kioskPin : { var value : ?Text };
    demoState : DemoState;
  };

  /// Jan 29, 2027, 00:00:00 America/Chicago (CST, UTC-6) as nanoseconds since
  /// the Unix epoch.
  let paperworkDue : DateOnly = 1_801_202_400_000_000_000;

  /// Add the uniform item type to a checklist item. Existing items are
  /// checkboxes; an admin can switch an orientation uniform item to a count.
  func convertChecklistItem(old : ChecklistItem) : NewChecklistItem {
    {
      id = old.id;
      text = old.text;
      requiresAlcoholCert = old.requiresAlcoholCert;
      minorOnly = old.minorOnly;
      itemType = #checkbox;
    };
  };

  func convertChecklists(old : Checklists) : NewChecklists {
    {
      orientationUniform = old.orientationUniform.map(convertChecklistItem);
      paperwork = old.paperwork.map(convertChecklistItem);
    };
  };

  /// Add the default shirt and hat counts to a position.
  func convertPosition(old : Position) : NewPosition {
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
    };
  };

  /// Add the roster state to a roadie. A non-archived roadie who already has a
  /// Present record at an orientation session is active; everyone else is
  /// pending.
  func convertRoadie(orientationPresent : Set.Set<Nat>, old : Roadie) : NewRoadie {
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
      archivedReason = switch (old.archivedReason) {
        case null { null };
        case (?r) {
          ?(switch (r) {
            case (#noShow) { #noShow };
            case (#quitDuringTraining) { #quitDuringTraining };
            case (#tookAnotherJob) { #tookAnotherJob };
            case (#letGo) { #letGo };
            case (#other(t)) { #other(t) };
          });
        };
      };
      archivedAt = old.archivedAt;
      hiredAt = old.hiredAt;
      hireDate = old.hireDate;
      signedBy = old.signedBy;
      rosterState = if (old.status == #archived) {
        #pending;
      } else if (orientationPresent.contains(old.id)) {
        #active;
      } else {
        #pending;
      };
      isDemo = old.isDemo;
    };
  };

  func convertOrientationCheckoff(old : OrientationCheckoff) : NewOrientationCheckoff {
    {
      roadieId = old.roadieId;
      uniformItems = old.uniformItems;
      uniformCounts = [];
      paperworkItems = old.paperworkItems;
      shirtsCount = old.shirtsCount;
      hatsCount = old.hatsCount;
      updatedAt = old.updatedAt;
      isDemo = false;
    };
  };

  func convertTrainingGroup(old : TrainingGroup) : NewTrainingGroup {
    {
      id = old.id;
      day = old.day;
      shift = old.shift;
      positionId = old.positionId;
      trainerPrincipal = old.trainerPrincipal;
      memberRoadieIds = old.memberRoadieIds;
      isDemo = false;
    };
  };

  func convertLeaderTalk(old : LeaderTalk) : NewLeaderTalk {
    { id = old.id; name = old.name; day = old.day; attendees = old.attendees; isDemo = false };
  };

  func convertFinalSignOff(old : FinalSignOff) : NewFinalSignOff {
    {
      roadieId = old.roadieId;
      outcome = old.outcome;
      futureTrainer = old.futureTrainer;
      signedBy = old.signedBy;
      signedAt = old.signedAt;
      isDemo = false;
    };
  };

  /// Sat Jan 30, 2027, 9:00 AM America/Chicago (CST, UTC-6) as nanoseconds.
  let defaultOrientationStart : Timestamp = 1_801_321_200_000_000_000;

  /// Collapse the seeded "Orientation BOH" and "Orientation FOH" into a single
  /// default orientation session, keeping the first orientation event's id
  /// stable. Any additional orientation event is dropped; the admin can add a
  /// second session or a makeup session afterwards.
  func convertSchedule(old : Map.Map<Nat, ScheduleEvent>) : Map.Map<Nat, ScheduleEvent> {
    let result = Map.empty<Nat, ScheduleEvent>();
    var defaultPlaced = false;
    for ((id, event) in old.entries()) {
      if (event.kind == #orientation) {
        if (not defaultPlaced) {
          result.add(id, {
            id;
            kind = #orientation;
            name = "Orientation · Sat Jan 30, 2027, 9:00 AM";
            start = defaultOrientationStart;
            end = null;
          });
          defaultPlaced := true;
        };
        // Additional orientation events are dropped; the admin can add a
        // second session or a makeup session.
      } else {
        result.add(id, event);
      };
    };
    result;
  };

  func convertStoreTemplate(old : StoreTemplate) : NewStoreTemplate {
    {
      name = old.name;
      schedule = old.schedule;
      positions = old.positions.map(convertPosition);
      checklists = convertChecklists(old.checklists);
      leaderTalkName = old.leaderTalkName;
    };
  };

  public func migration(old : OldActor) : NewActor {
    // Roadies already marked Present at an orientation session become active.
    let orientationPresent = Set.empty<Nat>();
    for (record in old.attendance.values()) {
      if (record.state == #present) {
        switch (record.eventId) {
          case (?eventId) {
            switch (old.schedule.get(eventId)) {
              case (?event) {
                if (event.kind == #orientation) {
                  orientationPresent.add(record.roadieId);
                };
              };
              case null {};
            };
          };
          case null {};
        };
      };
    };

    {
      accessControlState = old.accessControlState;
      storeInfo = { var value = { old.storeInfo.value with paperworkDueDate = paperworkDue } };
      positions = old.positions.map(func(_id, p) { convertPosition(p) });
      buildToAdjustments = old.buildToAdjustments;
      schedule = convertSchedule(old.schedule);
      checklists = { var value = convertChecklists(old.checklists.value) };
      retention = old.retention;
      storeTemplates = old.storeTemplates.map(func(_name, t) { convertStoreTemplate(t) });
      roadies = old.roadies.map(func(_id, r) { convertRoadie(orientationPresent, r) });
      crews = old.crews;
      changeLog = old.changeLog;
      signups = old.signups;
      accessGrants = old.accessGrants;
      pendingUsers = old.pendingUsers;
      orientationCheckoffs = old.orientationCheckoffs.map(func(_id, c) { convertOrientationCheckoff(c) });
      attendance = old.attendance;
      trainingGroups = old.trainingGroups.map(func(_id, g) { convertTrainingGroup(g) });
      trainerNotes = old.trainerNotes;
      leaderTalks = old.leaderTalks.map(func(_id, t) { convertLeaderTalk(t) });
      finalSignOffs = old.finalSignOffs.map(func(_id, s) { convertFinalSignOff(s) });
      alerts = old.alerts;
      counters = old.counters;
      kioskPin = old.kioskPin;
      demoState = old.demoState;
    };
  };
};
