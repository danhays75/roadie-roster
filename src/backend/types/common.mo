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

  /// A signature captured on a device, stored as an uploaded image reference.
  public type SignatureRef = Text;

  /// A photo captured on a device, stored as an uploaded image reference.
  public type PhotoRef = Text;

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
};
