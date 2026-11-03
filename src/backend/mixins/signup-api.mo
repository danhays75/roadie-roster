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
  storeInfo : { var value : Store.StoreInfo },
  changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
  counters : SignupLib.Counters,
  demoState : Common.DemoState,
) {
  /// Submit a new sign-up from the kiosk (Kiosk, Store Manager or Admin only).
  public shared ({ caller }) func submitSignup(
    profile : Roadie.RoadieProfile,
    photo : ?Common.PhotoRef,
    signature : ?Common.SignatureRef,
    contactSet : Roadie.ContactSet,
  ) : async Common.SignupId {
    SignupLib.submitSignup(accessGrants, demoState, signups, counters, caller, profile, photo, signature, contactSet);
  };

  /// List pending sign-up submissions (Admin/Store Manager only).
  public query ({ caller }) func listPendingSignups() : async [Signup.SignupSubmission] {
    SignupLib.listPendingSignups(accessGrants, demoState, signups, caller);
  };

  /// Read one submission (Admin/Store Manager only).
  public query ({ caller }) func getSignup(id : Common.SignupId) : async ?Signup.SignupSubmission {
    SignupLib.getSignup(accessGrants, demoState, signups, caller, id);
  };

  /// Read a pending submission's photo bytes by id (Admin/Store Manager only).
  /// Returns null when the submission has no photo.
  public query ({ caller }) func getSignupPhoto(id : Common.SignupId) : async ?Common.PhotoRef {
    SignupLib.getSignupPhoto(accessGrants, demoState, signups, caller, id);
  };

  /// Find duplicate cards matching a submission (Admin/Store Manager only).
  /// Each match names the matched roadie and their main position.
  public query ({ caller }) func findDuplicates(id : Common.SignupId) : async [Signup.DuplicateMatch] {
    SignupLib.findDuplicates(accessGrants, demoState, signups, roadies, positions, caller, id);
  };

  /// Approve a submission (Admin/Store Manager only).
  public shared ({ caller }) func approveSignup(
    id : Common.SignupId,
    decision : Signup.ApprovalDecision,
    signature : Common.SignatureRef,
  ) : async Common.RoadieId {
    SignupLib.approveSignup(accessGrants, demoState, signups, roadies, positions, storeInfo, changeLog, counters, caller, id, decision, signature);
  };

  /// Reject a pending submission (Admin/Store Manager only).
  public shared ({ caller }) func rejectSignup(id : Common.SignupId) : async () {
    SignupLib.rejectSignup(accessGrants, demoState, signups, changeLog, counters, caller, id);
  };
};
