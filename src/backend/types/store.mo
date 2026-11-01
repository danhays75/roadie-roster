import Common "common";

module {
  /// Store-level configuration edited on the Admin page.
  public type StoreInfo = {
    appName : Text;
    storeNumber : Text;
    locationName : Text;
    address : Text;
    storePhone : Common.Phone;
    openingDate : Common.DateOnly;
    timeZone : Common.TimeZone;
    amShiftStart : Common.TimeOfDay;
    amShiftEnd : Common.TimeOfDay;
    pmShiftStart : Common.TimeOfDay;
    pmShiftEnd : Common.TimeOfDay;
    leaderTalkName : Text;
    trainingGroupSize : Nat;
    leaderTalkSize : Nat;
    logo : ?Common.PhotoRef;
  };

  /// A position (station) with its build-to targets and requirements.
  public type Position = {
    id : Common.PositionId;
    name : Text;
    house : Common.House;
    code : Text;
    openingBuildTo : Nat;
    afterOpeningBuildTo : Nat;
    needsAlcoholCert : Bool;
    minimumAge : Nat;
    shirtsRequired : Nat;
    hatsRequired : Nat;
    crewManager : ?Text;
  };

  /// A single build-to adjustment recorded as a +1/−1 delta.
  public type BuildToAdjustment = {
    positionId : Common.PositionId;
    openingDelta : Int;
    afterOpeningDelta : Int;
    at : Common.Timestamp;
    by : Principal;
  };

  /// The kind of an opening-schedule event.
  public type EventKind = {
    #deadline;
    #orientation;
    #trainingDay;
    #friendsAndFamily;
    #openingDay;
    #signOff;
    #other;
  };

  /// An opening-schedule event with a fixed identifier.
  public type ScheduleEvent = {
    id : Common.EventId;
    kind : EventKind;
    name : Text;
    start : Common.DateTime;
    end : ?Common.DateTime;
  };

  /// A checklist item (orientation uniform or paperwork).
  public type ChecklistItem = {
    id : Nat;
    text : Text;
    requiresAlcoholCert : Bool;
    minorOnly : Bool;
  };

  /// The two editable checklists.
  public type Checklists = {
    orientationUniform : [ChecklistItem];
    paperwork : [ChecklistItem];
  };

  /// Retention settings in days.
  public type RetentionSettings = {
    archivedContactSetDays : Nat;
    notesDays : Nat;
    archivedPhotoDays : Nat;
    changeLogDays : Nat;
  };

  /// A saved store template (no people data).
  public type StoreTemplate = {
    name : Text;
    schedule : [ScheduleEvent];
    positions : [Position];
    checklists : Checklists;
    leaderTalkName : Text;
  };
};
