import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Iter "mo:core/Iter";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Common "../types/common";
import Signup "../types/signup";
import Roadie "../types/roadie";
import Store "../types/store";
import Access "../types/access";
import Auth "auth";
import Age "age";
import ChangeLog "changelog";

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

  /// Submit a new sign-up from the kiosk. Callable by Kiosk, Store Manager or
  /// Admin; every text field is length-capped.
  public func submitSignup(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    signups : Map.Map<Common.SignupId, Signup.SignupSubmission>,
    counters : Counters,
    caller : Principal,
    profile : Roadie.RoadieProfile,
    photo : ?Common.PhotoRef,
    signature : ?Common.SignatureRef,
    contactSet : Roadie.ContactSet,
  ) : Common.SignupId {
    let role = Auth.requireRegistered(accessGrants, caller);
    if (role != #kiosk and role != #storeManager and role != #admin) {
      Runtime.trap("Access denied: Kiosk, Store Manager or Admin role required");
    };
    let cappedProfile = capProfile(profile);
    let cappedContactSet = capContactSet(contactSet);
    let id = counters.nextSignupId;
    counters.nextSignupId := id + 1;
    signups.add(id, {
      id;
      submittedAt = Time.now();
      profile = cappedProfile;
      photo;
      signature;
      contactSet = cappedContactSet;
      status = #pending;
    });
    id;
  };

  /// List pending sign-up submissions (Admin/Store Manager only).
  public func listPendingSignups(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    signups : Map.Map<Common.SignupId, Signup.SignupSubmission>,
    caller : Principal,
  ) : [Signup.SignupSubmission] {
    Auth.requireManager(accessGrants, caller);
    signups.values().filter(func s = s.status == #pending).toArray();
  };

  /// Read one submission (Admin/Store Manager only).
  public func getSignup(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    signups : Map.Map<Common.SignupId, Signup.SignupSubmission>,
    caller : Principal,
    id : Common.SignupId,
  ) : ?Signup.SignupSubmission {
    Auth.requireManager(accessGrants, caller);
    signups.get(id);
  };

  /// Find duplicate cards matching a submission's phone or email (Admin/Store Manager only).
  public func findDuplicates(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    signups : Map.Map<Common.SignupId, Signup.SignupSubmission>,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    caller : Principal,
    id : Common.SignupId,
  ) : [Signup.DuplicateMatch] {
    Auth.requireManager(accessGrants, caller);
    let submission = signups.get(id) ?? Runtime.trap("Submission not found");
    let phone = submission.contactSet.phone;
    let email = submission.contactSet.email;
    roadies.values().filter(func r =
      switch (r.contactSet) {
        case (?cs) { cs.phone == phone or cs.email == email };
        case null { false };
      }
    ).map(func r = {
      roadieId = r.id;
      matchedOn = switch (r.contactSet) {
        case (?cs) {
          if (cs.phone == phone) { "phone" } else { "email" };
        };
        case null { "unknown" };
      };
      archived = r.status == #archived;
    }).toArray();
  };

  /// Approve a submission, creating the roadie card and raising on-hand
  /// (Admin/Store Manager only). Blocks when the roadie's real age in store
  /// time is below the minimum age of the main or second position. The
  /// manager's drawn approval signature is stored separately in the contact
  /// set; the roadie's own availability signature is preserved.
  public func approveSignup(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
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
    Auth.requireManager(accessGrants, caller);
    let submission = signups.get(id) ?? Runtime.trap("Submission not found");
    if (submission.status != #pending) {
      Runtime.trap("Submission is not pending");
    };
    let timeZone = storeInfo.value.timeZone;
    let now = Time.now();
    let dob = submission.contactSet.dateOfBirth;
    let target = positions.get(decision.mainPositionId) ?? Runtime.trap("Position not found");
    if (not Age.meetsMinimumAge(dob, target.minimumAge, now, timeZone)) {
      Runtime.trap("Cannot assign a roadie below the position's minimum age");
    };
    switch (decision.secondPositionId) {
      case (?secondId) {
        let second = positions.get(secondId) ?? Runtime.trap("Second position not found");
        if (not Age.meetsMinimumAge(dob, second.minimumAge, now, timeZone)) {
          Runtime.trap("Cannot assign a roadie below the second position's minimum age");
        };
      };
      case null {};
    };
    let roadieId = counters.nextRoadieId;
    counters.nextRoadieId := roadieId + 1;
    let approvedContactSet : Roadie.ContactSet = {
      submission.contactSet with
      managerSignature = ?signature;
      managerSignedAt = ?now;
      managerSignedBy = ?caller;
    };
    let roadie : Roadie.Roadie = {
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
      contactSet = ?approvedContactSet;
      isMinor = Age.isMinor(dob, now, timeZone);
      birthdayMonthDay = Age.birthdayMonthDay(dob);
      archivedReason = null;
      archivedAt = null;
      hiredAt = now;
      signedBy = ?caller;
    };
    roadies.add(roadieId, roadie);
    signups.add(id, { submission with status = #approved(roadieId) });
    ignore ChangeLog.record(changeLog, counters, caller, "approveSignup", ?roadieId, false, "Approved sign-up and created roadie card");
    roadieId;
  };

  /// Reject a pending submission (Admin/Store Manager only).
  public func rejectSignup(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    signups : Map.Map<Common.SignupId, Signup.SignupSubmission>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    id : Common.SignupId,
  ) : () {
    Auth.requireManager(accessGrants, caller);
    let submission = signups.get(id) ?? Runtime.trap("Submission not found");
    if (submission.status != #pending) {
      Runtime.trap("Submission is not pending");
    };
    signups.add(id, { submission with status = #rejected });
    ignore ChangeLog.record(changeLog, counters, caller, "rejectSignup", null, false, "Rejected sign-up");
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
    if (text.size() <= max) { text } else { Text.fromIter(text.toIter().take(max)) };
  };

  /// Internal: truncate an optional text field.
  func capOpt(text : ?Text, max : Nat) : ?Text {
    switch (text) {
      case (?t) { ?cap(t, max) };
      case null { null };
    };
  };
};
