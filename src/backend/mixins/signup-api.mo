import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Common "../types/common";
import Signup "../types/signup";
import Roadie "../types/roadie";
import Store "../types/store";
import Access "../types/access";
import SignupLib "../lib/signup";

mixin (
  accessGrants : Map.Map<Principal, Access.AccessGrant>,
  signups : Map.Map<Common.SignupId, Signup.SignupSubmission>,
  roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
  positions : Map.Map<Common.PositionId, Store.Position>,
  changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
  counters : SignupLib.Counters,
) {
  /// Submit a new sign-up from the kiosk.
  public shared func submitSignup(
    profile : Roadie.RoadieProfile,
    photo : ?Common.PhotoRef,
    signature : ?Common.SignatureRef,
    contactSet : Roadie.ContactSet,
  ) : async Common.SignupId {
    SignupLib.submitSignup(signups, counters, profile, photo, signature, contactSet);
  };

  /// List pending sign-up submissions (Admin/Store Manager only).
  public query ({ caller }) func listPendingSignups() : async [Signup.SignupSubmission] {
    SignupLib.listPendingSignups(accessGrants, signups, caller);
  };

  /// Read one submission (Admin/Store Manager only).
  public query ({ caller }) func getSignup(id : Common.SignupId) : async ?Signup.SignupSubmission {
    SignupLib.getSignup(accessGrants, signups, caller, id);
  };

  /// Find duplicate cards matching a submission (Admin/Store Manager only).
  public query ({ caller }) func findDuplicates(id : Common.SignupId) : async [Signup.DuplicateMatch] {
    SignupLib.findDuplicates(accessGrants, signups, roadies, caller, id);
  };

  /// Approve a submission (Admin/Store Manager only).
  public shared ({ caller }) func approveSignup(
    id : Common.SignupId,
    decision : Signup.ApprovalDecision,
    signature : Common.SignatureRef,
  ) : async Common.RoadieId {
    SignupLib.approveSignup(accessGrants, signups, roadies, positions, changeLog, counters, caller, id, decision, signature);
  };

  /// Reject a submission (Admin/Store Manager only).
  public shared ({ caller }) func rejectSignup(id : Common.SignupId) : async () {
    SignupLib.rejectSignup(accessGrants, signups, changeLog, counters, caller, id);
  };
};
