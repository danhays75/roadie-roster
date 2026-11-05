import Storage "mo:caffeineai-object-storage/Storage";
import Map "mo:core/Map";
import Principal "mo:core/Principal";

module {
  /// Nanoseconds since the Unix epoch, signed (matches `Time.now()`).
  public type Timestamp = Int;

  /// Identifier for a roadie card.
  public type RoadieId = Nat;

  /// Identifier for a position (station).
  public type PositionId = Nat;

  /// Identifier for a schedule event.
  public type EventId = Nat;

  /// Identifier for a crew.
  public type CrewId = Nat;

  /// Identifier for a sign-up submission.
  public type SignupId = Nat;

  /// Identifier for a change-log entry.
  public type ChangeLogId = Nat;

  /// Identifier for a training group.
  public type TrainingGroupId = Nat;

  /// Identifier for a leader talk.
  public type LeaderTalkId = Nat;

  /// Identifier for an alert.
  public type AlertId = Nat;

  /// The seven application roles.
  public type Role = {
    #admin;
    #storeManager;
    #trainingManager;
    #leadership;
    #visitingManager;
    #trainer;
    #kiosk;
    #integration;
  };

  /// Front-of-house or back-of-house.
  public type House = {
    #foh;
    #boh;
  };

  /// AM or PM shift.
  public type Shift = {
    #am;
    #pm;
  };

  /// Weekday used by the availability grid (Wed–Tue).
  public type Weekday = {
    #wed;
    #thu;
    #fri;
    #sat;
    #sun;
    #mon;
    #tue;
  };

  /// A calendar date and time, stored as a UTC nanosecond timestamp.
  public type DateTime = Timestamp;

  /// A calendar date with no time component, stored as UTC midnight nanoseconds.
  public type DateOnly = Timestamp;

  /// A clock time of day in minutes since midnight, store-local.
  public type TimeOfDay = Nat;

  /// A store-local time zone identifier (IANA name, e.g. "America/Chicago").
  public type TimeZone = Text;

  /// A free-text reason supplied by a manager.
  public type Reason = Text;

  /// A person's full name.
  public type PersonName = Text;

  /// A phone number as entered.
  public type Phone = Text;

  /// An email address as entered.
  public type Email = Text;

  /// A shirt size label.
  public type ShirtSize = Text;

  /// A hat size label.
  public type HatSize = Text;

  /// A signature captured on a device, stored as a real platform file-storage
  /// reference (the uploaded blob's hash). Fetchable only by Admin and Store
  /// Manager.
  public type SignatureRef = Storage.ExternalBlob;

  /// A photo captured on a device, stored as a real platform file-storage
  /// reference (the uploaded blob's hash). Fetchable only by signed-in users
  /// with a read-capable role.
  public type PhotoRef = Storage.ExternalBlob;

  /// A generic error returned to callers.
  public type ApiError = {
    #unauthorized : Text;
    #notFound : Text;
    #invalid : Text;
    #conflict : Text;
  };

  /// A generic result wrapper.
  public type ApiResult<T> = {
    #ok : T;
    #err : ApiError;
  };

  /// The type of an orientation uniform checklist item: a simple checkbox, or
  /// a counted item (for example shirts or hats given).
  public type UniformItemType = {
    #checkbox;
    #count;
  };

  // --- Demo mode ---

  /// The role a signed-in caller impersonates while demo mode is on. Mirrors
  /// the real application roles so the backend can enforce the same permission
  /// rules for the impersonated role as for a real user with that role.
  public type DemoRole = {
    #admin;
    #storeManager;
    #trainingManager;
    #trainer;
    #visitingManager;
    #leadership;
    #kiosk;
  };

  /// The pretend clock's half of day.
  public type DemoShift = {
    #am;
    #pm;
  };

  /// The pretend "now" used while demo mode is on. `day` is a UTC-midnight
  /// date-only timestamp; `shift` selects AM or PM.
  public type PretendDate = {
    day : DateOnly;
    shift : DemoShift;
  };

  /// One caller's chosen demo role and, for a demo NSO Trainer, the stations
  /// that role may see. Stored per caller so one person's "View as" choice
  /// never changes anyone else's view.
  public type DemoRoleEntry = {
    role : DemoRole;
    stations : [PositionId];
  };

  /// The persisted demo-mode state. `enabled` is off by default; `turnedOnAt`
  /// and `autoOffAt` are set when demo mode is turned on and `autoOffAt` is
  /// eight hours later. `pretendDate` overrides "now" for schedule windows,
  /// countdowns, the Today screen, check-in availability and age math.
  /// `demoRoles` holds each signed-in caller's own chosen demo role and
  /// stations; a caller with no entry defaults to demo Admin. `demoTrainerAs`
  /// holds, per caller, the demo leader principal a demo NSO Trainer is
  /// viewing as; it is only consulted while demo mode is on. Both maps are
  /// cleared when demo mode turns off.
  public type DemoState = {
    var enabled : Bool;
    var turnedOnAt : ?Timestamp;
    var autoOffAt : ?Timestamp;
    var pretendDate : ?PretendDate;
    var demoRoles : Map.Map<Principal, DemoRoleEntry>;
    var demoTrainerAs : Map.Map<Principal, Principal>;
  };

  /// A read-only view of the demo state returned to the frontend. `demoRole`
  /// and `demoTrainerStations` describe the *requesting* caller's own demo
  /// role, or null/empty when demo mode is off or the caller has not chosen
  /// one. `demoTrainerAs` is the demo leader principal the requesting caller
  /// is viewing as, or null when none is chosen.
  public type DemoStateView = {
    enabled : Bool;
    turnedOnAt : ?Timestamp;
    autoOffAt : ?Timestamp;
    pretendDate : ?PretendDate;
    demoRole : ?DemoRole;
    demoTrainerStations : [PositionId];
    demoTrainerAs : ?Principal;
  };

  /// The counts of demo records currently loaded, so the admin UI can show
  /// what "Clear demo data" would remove.
  public type DemoDataSummary = {
    roadies : Nat;
    signups : Nat;
    crews : Nat;
    leaders : Nat;
    attendance : Nat;
    notes : Nat;
  };

  /// The result of a demo-mode action. `#ok` carries the new state view;
  /// `#err` explains why the action was refused.
  public type DemoActionResult = {
    #ok : DemoStateView;
    #err : Text;
  };
};
