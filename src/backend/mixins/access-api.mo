import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Time "mo:core/Time";
import AccessControl "mo:caffeineai-authorization/access-control";
import Common "../types/common";
import Access "../types/access";
import AccessLib "../lib/access";

mixin (
  accessGrants : Map.Map<Principal, Access.AccessGrant>,
  pendingUsers : Map.Map<Principal, Access.PendingUser>,
  accessControlState : AccessControl.AccessControlState,
) {
  /// Register the caller for approval. Any signed-in caller may call this once;
  /// it is idempotent and returns true when the caller is already registered or
  /// already pending. The first caller approved by an Admin becomes an Admin.
  public shared ({ caller }) func requestAccess() : async Bool {
    if (accessGrants.containsKey(caller)) {
      return true;
    };
    if (pendingUsers.containsKey(caller)) {
      return true;
    };
    pendingUsers.add(caller, { principal = caller; requestedAt = Time.now(); staffProfile = null });
    false;
  };

  /// Store the signed-in caller's staff profile on their pending request. The
  /// caller must already have a pending request (created by `requestAccess`).
  public shared ({ caller }) func submitStaffProfile(profile : Access.StaffProfile) : async () {
    AccessLib.submitStaffProfile(pendingUsers, caller, profile);
  };

  /// Update the signed-in caller's own staff profile on their access grant.
  public shared ({ caller }) func updateMyStaffProfile(profile : Access.StaffProfile) : async () {
    AccessLib.updateMyStaffProfile(accessGrants, caller, profile);
  };

  /// Bootstrap the first app Admin from the platform's shared authorization
  /// grant. The first principal to sign in is made an admin by the platform
  /// mixin; this bridges that grant into the app's access model so the first
  /// caller can approve users. Returns true when the caller holds an app Admin
  /// grant after the call.
  public shared ({ caller }) func bootstrapAdmin() : async Bool {
    AccessLib.bootstrapAdmin(accessGrants, accessControlState, caller);
  };

  /// Read the caller's own access grant. Returns null until an Admin has
  /// approved the caller, so the frontend keeps showing the waiting screen.
  public query ({ caller }) func getMyAccess() : async ?Access.AccessGrant {
    AccessLib.getMyAccess(accessGrants, caller);
  };

  /// List pending access requests (Admin only).
  public query ({ caller }) func listPendingUsers() : async [Access.PendingUser] {
    AccessLib.listPendingUsers(accessGrants, pendingUsers, caller);
  };

  /// List all access grants (Admin only).
  public query ({ caller }) func listAccessGrants() : async [Access.AccessGrant] {
    AccessLib.listAccessGrants(accessGrants, caller);
  };

  /// List the leaders shown on the Leaders page: the manager, trainer and
  /// leadership roles. Readable by every role except Kiosk and Integration.
  /// Never carries phone or email.
  public query ({ caller }) func listLeaders() : async [Access.LeaderSummary] {
    AccessLib.listLeaders(accessGrants, caller);
  };

  /// Approve a pending user (Admin only).
  public shared ({ caller }) func approveUser(request : Access.ApprovalRequest) : async () {
    AccessLib.approveUser(accessGrants, pendingUsers, caller, request);
  };

  /// Change an existing user's role (Admin only).
  public shared ({ caller }) func updateUserRole(principal : Principal, role : Common.Role) : async () {
    AccessLib.updateUserRole(accessGrants, caller, principal, role);
  };

  /// Update a user's trainer stations (Admin only).
  public shared ({ caller }) func updateTrainerStations(principal : Principal, positionIds : [Common.PositionId]) : async () {
    AccessLib.updateTrainerStations(accessGrants, caller, principal, positionIds);
  };

  /// Update a user's access end date (Admin only).
  public shared ({ caller }) func updateAccessEnd(principal : Principal, accessEndsAt : ?Common.Timestamp) : async () {
    AccessLib.updateAccessEnd(accessGrants, caller, principal, accessEndsAt);
  };

  /// Remove a user's access (Admin only).
  public shared ({ caller }) func removeUser(principal : Principal) : async () {
    AccessLib.removeUser(accessGrants, caller, principal);
  };

  /// Count the current admins.
  public query ({ caller }) func adminCount() : async Nat {
    AccessLib.adminCount(accessGrants, caller);
  };

  /// Build the access end timestamp for a chosen calendar day: 11:59:59 PM
  /// America/Chicago on that day. `day` is a UTC-midnight date-only timestamp.
  /// Any signed-in caller may call this so the approval and access panels can
  /// set an end date without reimplementing the store-time-zone rule.
  public query func accessEndForDay(day : Common.DateOnly) : async Common.Timestamp {
    AccessLib.endOfDayChicago(day);
  };
};
