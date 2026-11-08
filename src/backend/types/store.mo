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
    /// Legacy default shirt and hat counts for this position, kept on the
    /// public API for the orientation and roster screens. Part of the store
    /// template.
    defaultShirts : Nat;
    defaultHats : Nat;
    /// Uniform defaults for this position: the shirt type (free text) and how
    /// many shirts, and the hat type (free text) and how many hats. Quantities
    /// accept 0. Part of the store template.
    shirtType : Text;
    shirtQty : Nat;
    hatType : Text;
    hatQty : Nat;
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

  /// A checklist item (orientation uniform or paperwork). `itemType` is
  /// `#checkbox` for a simple tick or `#count` for a counted item (for example
  /// shirts or hats given); paperwork items are always `#checkbox`.
  ///
  /// `enabled` is meaningful only for paperwork items: a disabled paperwork
  /// item is hidden everywhere as if it did not exist (the roadie card
  /// checklist, the stage tags, paperwork counts and totals, the Paperwork Done
  /// stage, the orientation gate and the Practice run) and never blocks
  /// in-order completion. Orientation uniform items are always enabled.
  public type ChecklistItem = {
    id : Nat;
    text : Text;
    requiresAlcoholCert : Bool;
    minorOnly : Bool;
    itemType : Common.UniformItemType;
    enabled : Bool;
  };

  /// The two editable checklists. Array order is the display and enforcement
  /// order. `paperwork` is ordered: Digital Paperwork, I-9 / W-4, Alcohol
  /// Certificate, Food Handler Card, Policies & Procedures, then any minor-only
  /// items. An item may only be checked when every applicable, enabled item
  /// above it is checked, and unchecking an item also unchecks every item below
  /// it. Disabled items are skipped entirely.
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
    defaultShirts : Nat;
    defaultHats : Nat;
    shirtType : Text;
    shirtQty : Nat;
    hatType : Text;
    hatQty : Nat;
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

  // --- Uniforms ---

  /// One size's share of the size curve, as a whole percentage. `size` is the
  /// size label (a shirt size or a hat size).
  public type SizeCurveEntry = {
    size : Text;
    percent : Nat;
  };

  /// The size curve used to project sizes for positions not yet filled: a
  /// percentage per shirt size and per hat size. Each set is intended to total
  /// 100%; a set that does not total 100% is saved with a warning, never
  /// blocked.
  public type SizeCurve = {
    shirts : [SizeCurveEntry];
    hats : [SizeCurveEntry];
  };

  /// The uniform settings edited on Admin > Uniforms: the size curve and the
  /// order buffer percentage (default 10).
  public type UniformSettings = {
    sizeCurve : SizeCurve;
    bufferPercent : Nat;
  };

  /// Which house the uniform order is filtered to.
  public type UniformHouseFilter = {
    #all;
    #foh;
    #boh;
  };

  /// One item-and-size row of the uniform order: the Hired count, the
  /// Projected count for unfilled build-to slots, and the Order total (with the
  /// buffer applied, rounded up).
  public type UniformOrderRow = {
    item : Text;
    size : Text;
    hired : Nat;
    projected : Nat;
    orderTotal : Nat;
  };

  /// A roadie missing a size, listed by name and id so the order page can link
  /// to their card.
  public type UniformSizeUnknownRow = {
    roadieId : Common.RoadieId;
    name : Text;
    missingShirt : Bool;
    missingHat : Bool;
  };

  /// The per-item totals row of the uniform order: the Hired, Projected and
  /// Order total summed across every size of one item.
  public type UniformOrderTotalsRow = {
    item : Text;
    hired : Nat;
    projected : Nat;
    orderTotal : Nat;
  };

  /// The uniform order for one house filter: the per-item-and-size rows, the
  /// per-item totals rows, plus the roadies missing a size.
  public type UniformOrderView = {
    filter : UniformHouseFilter;
    bufferPercent : Nat;
    rows : [UniformOrderRow];
    totals : [UniformOrderTotalsRow];
    sizeUnknown : [UniformSizeUnknownRow];
  };
};
