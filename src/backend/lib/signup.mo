import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Time "mo:core/Time";
import Text "mo:core/Text";
import Common "../types/common";
import Signup "../types/signup";
import Roadie "../types/roadie";
import Store "../types/store";
import Access "../types/access";
import Auth "auth";
import ChangeLog "changelog";
import Age "age";

module {
  public type Counters = {
    var nextSignupId : Nat;
    var nextRoadieId : Nat;
    var nextChangeLogId : Nat;
  };

  /// Maximum accepted length of a free-text sign-up field.
  let maxTextLength : Nat = 200;
  /// Maximum accepted length of a phone/email field.
  let maxContactLength : Nat = 320;

  /// The store's default time zone when none is configured.
  let _defaultTimeZone : Common.TimeZone = "America/Chicago";

  /// Submit a new sign-up from the kiosk. Callable by Kiosk, Store Manager or
  /// Admin; every text field is length-capped. A sign-up submitted while demo
  /// mode is on is saved as a demo sign-up.
  public func submitSignup(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    signups : Map.Map<Common.SignupId, Signup.SignupSubmission>,
    counters : Counters,
    caller : Principal,
    profile : Roadie.RoadieProfile,
    photo : ?Common.PhotoRef,
    signature : ?Common.SignatureRef,
    contactSet : Roadie.ContactSet,
  ) : Common.SignupId {
    let role = Auth.requireRegistered(accessGrants, demoState, caller);
    if (role != #kiosk and role != #storeManager and role != #admin) {
      Runtime.trap("Access denied: Kiosk, Store Manager or Admin role required");
    };
    let id = counters.nextSignupId;
    counters.nextSignupId := id + 1;
    signups.add(id, {
      id;
      submittedAt = effectiveNow(demoState);
      profile = capProfile(profile);
      photo;
      signature;
      contactSet = capContactSet(contactSet);
      status = #pending;
      isDemo = Auth.demoActive(demoState);
    });
    id;
  };

  /// List pending sign-up submissions (Admin/Store Manager only). Full photo
  /// bytes are never returned; fetch a photo with `getSignupPhoto`. Demo
  /// sign-ups are visible only while demo mode is on.
  public func listPendingSignups(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    signups : Map.Map<Common.SignupId, Signup.SignupSubmission>,
    caller : Principal,
  ) : [Signup.SignupSubmission] {
    Auth.requireManager(accessGrants, demoState, caller);
    signups.values()
      .filter(func(s) = s.isDemo == Auth.demoActive(demoState) and s.status == #pending)
      .map(func(s) = { s with photo = null })
      .toArray();
  };

  /// Read one submission (Admin/Store Manager only).
  public func getSignup(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    signups : Map.Map<Common.SignupId, Signup.SignupSubmission>,
    caller : Principal,
    id : Common.SignupId,
  ) : ?Signup.SignupSubmission {
    Auth.requireManager(accessGrants, demoState, caller);
    switch (signups.get(id)) {
      case (?s) {
        if (s.isDemo != Auth.demoActive(demoState)) {
          return null;
        };
        ?{ s with photo = null };
      };
      case null { null };
    };
  };

  /// Read a pending submission's photo bytes by id (Admin/Store Manager only).
  /// Returns null when the submission has no photo.
  public func getSignupPhoto(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    signups : Map.Map<Common.SignupId, Signup.SignupSubmission>,
    caller : Principal,
    id : Common.SignupId,
  ) : ?Common.PhotoRef {
    Auth.requireManager(accessGrants, demoState, caller);
    switch (signups.get(id)) {
      case (?s) {
        if (s.isDemo != Auth.demoActive(demoState)) {
          return null;
        };
        s.photo;
      };
      case null { null };
    };
  };

  /// Find duplicate cards matching a submission's phone or email (Admin/Store
  /// Manager only). Only roadies in the active demo/real partition are
  /// considered.
  public func findDuplicates(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    signups : Map.Map<Common.SignupId, Signup.SignupSubmission>,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    positions : Map.Map<Common.PositionId, Store.Position>,
    caller : Principal,
    id : Common.SignupId,
  ) : [Signup.DuplicateMatch] {
    Auth.requireManager(accessGrants, demoState, caller);
    let submission = signups.get(id) ?? Runtime.trap("Signup not found");
    if (submission.isDemo != Auth.demoActive(demoState)) {
      Runtime.trap("Signup not found");
    };
    let phone = submission.contactSet.phone;
    let email = submission.contactSet.email;
    roadies.values().filter(func(r) {
      if (r.isDemo != Auth.demoActive(demoState)) {
        return false;
      };
      switch (r.contactSet) {
        case (?cs) {
          (phone.size() > 0 and cs.phone == phone) or (email.size() > 0 and cs.email == email);
        };
        case null { false };
      };
    }).map(func(r) {
      let phoneMatch = switch (r.contactSet) {
        case (?cs) { phone.size() > 0 and cs.phone == phone };
        case null { false };
      };
      let emailMatch = switch (r.contactSet) {
        case (?cs) { email.size() > 0 and cs.email == email };
        case null { false };
      };
      // Phone takes precedence: a phone match reports "phone" even when the
      // email also matches. "email" is reported only when the email is the
      // sole match.
      let matchedOn = if (phoneMatch) { "phone" } else { "email" };
      let name = switch (r.profile.preferredName) {
        case (?p) { if (p.size() > 0) { p } else { r.profile.name } };
        case null { r.profile.name };
      };
      let mainPositionName = switch (positions.get(r.mainPositionId)) {
        case (?pos) { pos.name };
        case null { "" };
      };
      { roadieId = r.id; name; mainPositionName; matchedOn; archived = r.status == #archived };
    }).toArray();
  };

  /// Approve a submission, creating the roadie card and raising on-hand
  /// (Admin/Store Manager only). Blocks when the roadie's real age in store
  /// time is below the minimum age of the main or second position. The
  /// manager's drawn approval signature is stored separately in the contact
  /// set; the roadie's own availability signature is preserved.
  public func approveSignup(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    signups : Map.Map<Common.SignupId, Signup.SignupSubmission>,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    positions : Map.Map<Common.PositionId, Store.Position>,
    storeInfo : { var value : Store.StoreInfo },
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    id : Common.SignupId,
    decision : Signup.ApprovalDecision,
    signature : Common.SignatureRef,
  ) : Common.RoadieId {
    Auth.requireManager(accessGrants, demoState, caller);
    let submission = signups.get(id) ?? Runtime.trap("Signup not found");
    if (submission.isDemo != Auth.demoActive(demoState)) {
      Runtime.trap("Signup not found");
    };
    switch (submission.status) {
      case (#pending) {};
      case (_) { Runtime.trap("Signup has already been decided") };
    };
    let main = positions.get(decision.mainPositionId) ?? Runtime.trap("Position not found");
    let second = switch (decision.secondPositionId) {
      case (?sid) { ?(positions.get(sid) ?? Runtime.trap("Second position not found")) };
      case null { null };
    };
    let timeZone = storeInfo.value.timeZone;
    let now = effectiveNow(demoState);
    let dob = submission.contactSet.dateOfBirth;
    if (not Age.meetsMinimumAge(dob, main.minimumAge, now, timeZone)) {
      Runtime.trap("Roadie is below the minimum age for this position");
    };
    switch (second) {
      case (?p) {
        if (not Age.meetsMinimumAge(dob, p.minimumAge, now, timeZone)) {
          Runtime.trap("Roadie is below the minimum age for the second position");
        };
      };
      case null {};
    };
    let roadieId = counters.nextRoadieId;
    counters.nextRoadieId := roadieId + 1;
    // The manager's approval signature is stored separately; the roadie's own
    // availability signature is preserved.
    let contactSet : Roadie.ContactSet = {
      submission.contactSet with
      managerSignature = ?signature;
      managerSignedAt = ?now;
      managerSignedBy = ?caller;
    };
    roadies.add(roadieId, {
      id = roadieId;
      profile = submission.profile;
      photo = submission.photo;
      mainPositionId = decision.mainPositionId;
      secondPositionId = decision.secondPositionId;
      crossTrainedPositionId = null;
      crewId = decision.crewId;
      orientationEventId = decision.orientationEventId;
      startDate = decision.startDate;
      status = #hired;
      corporateEmployeeId = null;
      contactSet = ?contactSet;
      isMinor = Age.isMinor(dob, now, timeZone);
      birthdayMonthDay = Age.birthdayMonthDay(dob);
      archivedReason = null;
      archivedAt = null;
      hiredAt = now;
      hireDate = ?submission.submittedAt;
      signedBy = ?caller;
      isDemo = submission.isDemo;
    });
    signups.add(id, { submission with status = #approved(roadieId) });
    logWrite(changeLog, counters, demoState, caller, "approveSignup", ?roadieId, true, "Approved signup");
    roadieId;
  };

  /// Reject a pending submission (Admin/Store Manager only).
  public func rejectSignup(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    signups : Map.Map<Common.SignupId, Signup.SignupSubmission>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    id : Common.SignupId,
  ) : () {
    Auth.requireManager(accessGrants, demoState, caller);
    let submission = signups.get(id) ?? Runtime.trap("Signup not found");
    if (submission.isDemo != Auth.demoActive(demoState)) {
      Runtime.trap("Signup not found");
    };
    signups.add(id, { submission with status = #rejected });
    logWrite(changeLog, counters, demoState, caller, "rejectSignup", null, false, "Rejected signup");
  };

  /// Internal: the effective clock. While demo mode is on with a pretend date
  /// set, the pretend timestamp is returned; otherwise the real clock.
  func effectiveNow(demoState : Common.DemoState) : Common.Timestamp {
    if (not Auth.demoActive(demoState)) {
      return Time.now();
    };
    switch (demoState.pretendDate) {
      case (?pd) {
        let hourOffset : Int = switch (pd.shift) {
          case (#am) { 9 };
          case (#pm) { 15 };
        };
        pd.day + hourOffset * 3_600_000_000_000;
      };
      case null { Time.now() };
    };
  };

  /// Internal: write a change-log entry into the active partition.
  func logWrite(
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    demoState : Common.DemoState,
    by : Principal,
    action : Text,
    subjectRoadieId : ?Common.RoadieId,
    touchesContactSet : Bool,
    detail : Text,
  ) : () {
    if (Auth.demoActive(demoState)) {
      ignore ChangeLog.recordDemo(changeLog, counters, by, action, subjectRoadieId, touchesContactSet, detail);
    } else {
      ignore ChangeLog.record(changeLog, counters, by, action, subjectRoadieId, touchesContactSet, detail);
    };
  };

  /// Internal: cap every free-text field of a profile.
  func capProfile(profile : Roadie.RoadieProfile) : Roadie.RoadieProfile {
    {
      profile with
      name = cap(profile.name, maxTextLength);
      preferredName = capOpt(profile.preferredName, maxTextLength);
      hometown = capOpt(profile.hometown, maxTextLength);
      hobbies = capOpt(profile.hobbies, maxTextLength);
      favoriteMovie = capOpt(profile.favoriteMovie, maxTextLength);
      favoriteSnack = capOpt(profile.favoriteSnack, maxTextLength);
      favoriteTeam = capOpt(profile.favoriteTeam, maxTextLength);
      favoriteDrink = capOpt(profile.favoriteDrink, maxTextLength);
      favoriteColor = capOpt(profile.favoriteColor, maxTextLength);
      funFact = capOpt(profile.funFact, maxTextLength);
      goalHere = capOpt(profile.goalHere, maxTextLength);
      positionAppliedFor = capOpt(profile.positionAppliedFor, maxTextLength);
      shirtSize = capOpt(profile.shirtSize, maxTextLength);
      hatSize = capOpt(profile.hatSize, maxTextLength);
    };
  };

  /// Internal: cap every free-text field of a contact set.
  func capContactSet(contactSet : Roadie.ContactSet) : Roadie.ContactSet {
    {
      contactSet with
      phone = cap(contactSet.phone, maxContactLength);
      email = cap(contactSet.email, maxContactLength);
      emergencyContactName = cap(contactSet.emergencyContactName, maxTextLength);
      emergencyContactPhone = cap(contactSet.emergencyContactPhone, maxContactLength);
    };
  };

  /// Internal: truncate text to at most `max` characters.
  func cap(text : Text, max : Nat) : Text {
    if (text.size() <= max) { text } else { Text.fromArray(text.toArray().sliceToArray(0, max)) };
  };

  /// Internal: truncate an optional text field.
  func capOpt(text : ?Text, max : Nat) : ?Text {
    switch (text) {
      case (?t) { ?cap(t, max) };
      case null { null };
    };
  };
};
