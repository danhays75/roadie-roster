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
    secondaryLogo : ?Common.PhotoRef;
  };

  /// The two store logos returned by the public logo query. Both are optional;
  /// an absent logo is `null`.
  public type StoreLogos = {
    logo : ?Common.PhotoRef;
    secondaryLogo : ?Common.PhotoRef;
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

  /// A position inside an exported/imported store template file. Carries only
  /// the fields the template needs; no people data.
  public type TemplatePosition = {
    name : Text;
    house : Common.House;
    code : Text;
    openingBuildTo : Nat;
    afterOpeningBuildTo : Nat;
    minimumAge : Nat;
    needsAlcoholCert : Bool;
  };

  /// A schedule event inside a template file, expressed as whole days relative
  /// to the store's opening date (negative = before opening). `endOffsetDays`
  /// is null when the event has no end.
  public type TemplateScheduleEvent = {
    kind : EventKind;
    name : Text;
    startOffsetDays : Int;
    endOffsetDays : ?Int;
  };

  /// The downloadable/loadable store template file. Carries a version number,
  /// the schedule as days relative to opening, positions, checklists and the
  /// leader talk name and sizes. It deliberately carries no people data, logos,
  /// store number, city or opening date.
  public type StoreTemplateFile = {
    version : Nat;
    schedule : [TemplateScheduleEvent];
    positions : [TemplatePosition];
    checklists : Checklists;
    leaderTalkName : Text;
    leaderTalkSize : Nat;
    trainingGroupSize : Nat;
  };

  /// A preview of what a template load would replace, shown before confirming.
  public type TemplatePreview = {
    positionCount : Nat;
    scheduleCount : Nat;
    orientationUniformCount : Nat;
    paperworkCount : Nat;
    leaderTalkName : Text;
  };

  /// The outcome of loading a template. `#ok` carries the preview that was
  /// applied; `#err` explains why the load was refused.
  public type TemplateLoadResult = {
    #ok : TemplatePreview;
    #err : Text;
  };

  /// The Admin > Store settings payload: the store configuration plus the
  /// current demo-mode state, so the settings screen can render the Demo mode
  /// switch and its confirmation in one read.
  public type StoreSettings = {
    info : StoreInfo;
    demo : Common.DemoStateView;
  };
};
