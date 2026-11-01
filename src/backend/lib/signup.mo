import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Time "mo:core/Time";
import Common "../types/common";
import Signup "../types/signup";
import Roadie "../types/roadie";
import Store "../types/store";
import Access "../types/access";
import Auth "auth";
import ChangeLog "changelog";

module {
  public type Counters = {
    var nextSignupId : Nat;
    var nextRoadieId : Nat;
    var nextChangeLogId : Nat;
  };

  /// Submit a new sign-up from the kiosk; the only call Kiosk may make.
  public func submitSignup(
    signups : Map.Map<Common.SignupId, Signup.SignupSubmission>,
    counters : Counters,
    profile : Roadie.RoadieProfile,
    photo : ?Common.PhotoRef,
    signature : ?Common.SignatureRef,
    contactSet : Roadie.ContactSet,
  ) : Common.SignupId {
    let id = counters.nextSignupId;
    counters.nextSignupId := id + 1;
    signups.add(id, {
      id;
      submittedAt = Time.now();
      profile;
      photo;
      signature;
      contactSet;
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

  /// Approve a submission, creating the roadie card and raising on-hand (Admin/Store Manager only).
  public func approveSignup(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    signups : Map.Map<Common.SignupId, Signup.SignupSubmission>,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    positions : Map.Map<Common.PositionId, Store.Position>,
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
    let target = positions.get(decision.mainPositionId) ?? Runtime.trap("Position not found");
    // Block assigning a minor to a position whose minimum age is higher.
    let eighteenYearsNs : Int = 18 * 365 * 24 * 60 * 60 * 1_000_000_000;
    if (Time.now() < submission.contactSet.dateOfBirth + eighteenYearsNs and target.minimumAge > 18) {
      Runtime.trap("Cannot assign a minor to a position with a higher minimum age");
    };
    let roadieId = counters.nextRoadieId;
    counters.nextRoadieId := roadieId + 1;
    let roadie : Roadie.Roadie = {
      id = roadieId;
      profile = submission.profile;
      photo = submission.photo;
      signature = ?signature;
      mainPositionId = decision.mainPositionId;
      secondPositionId = decision.secondPositionId;
      crossTrainedPositionId = null;
      crewId = decision.crewId;
      orientationEventId = decision.orientationEventId;
      startDate = decision.startDate;
      status = #hired;
      corporateEmployeeId = null;
      contactSet = ?submission.contactSet;
      archivedReason = null;
      archivedAt = null;
      hiredAt = Time.now();
      signedBy = ?caller;
    };
    roadies.add(roadieId, roadie);
    signups.add(id, { submission with status = #approved(roadieId) });
    ignore ChangeLog.record(changeLog, counters, caller, "approveSignup", ?roadieId, false, "Approved sign-up and created roadie card");
    roadieId;
  };

  /// Reject a submission (Admin/Store Manager only).
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
    signups.add(id, { submission with status = #rejected });
    ignore ChangeLog.record(changeLog, counters, caller, "rejectSignup", null, false, "Rejected sign-up");
  };
};
