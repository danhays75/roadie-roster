import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Time "mo:core/Time";
import AccessControl "mo:caffeineai-authorization/access-control";
import Common "../types/common";
import Access "../types/access";
import Auth "auth";

module {
  /// Read the caller's own access grant, if any. This reports only a grant that
  /// has actually been persisted in the app's access model, so an unregistered
  /// caller always receives null and the frontend shows the "Waiting for
  /// approval" screen. The platform's first-admin grant is bridged into the app
  /// model by `bootstrapAdmin`, which persists a real grant before this read
  /// reports one; a synthesized grant here would let the frontend render the
  /// authenticated shell for a caller whose every domain read still traps.
  public func getMyAccess(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    caller : Principal,
  ) : ?Access.AccessGrant {
    accessGrants.get(caller);
  };

  /// Bootstrap the first app Admin. The first principal to sign in is made an
  /// admin by the platform's shared authorization mixin; this endpoint bridges
  /// that platform grant into the app's own access model so the first caller
  /// can approve users. Idempotent: it only acts while no app Admin grant
  /// exists, and it never grants Admin to a caller the platform does not
  /// already consider an admin.
  public func bootstrapAdmin(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    accessControlState : AccessControl.AccessControlState,
    caller : Principal,
  ) : Bool {
    if (accessGrants.containsKey(caller)) {
      return true;
    };
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      return false;
    };
    if (countAdmins(accessGrants) > 0) {
      return false;
    };
    accessGrants.add(caller, {
      principal = caller;
      role = #admin;
      approvedAt = Time.now();
      approvedBy = caller;
      accessEndsAt = null;
      trainerPositionIds = [];
      linkedRoadieId = null;
    });
    true;
  };

  /// List pending access requests (Admin only).
  public func listPendingUsers(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    pendingUsers : Map.Map<Principal, Access.PendingUser>,
    caller : Principal,
  ) : [Access.PendingUser] {
    Auth.requireAdmin(accessGrants, caller);
    pendingUsers.values().toArray();
  };

  /// List all access grants (Admin only).
  public func listAccessGrants(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    caller : Principal,
  ) : [Access.AccessGrant] {
    Auth.requireAdmin(accessGrants, caller);
    accessGrants.values().toArray();
  };

  /// Approve a pending user with a role and options (Admin only).
  public func approveUser(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    pendingUsers : Map.Map<Principal, Access.PendingUser>,
    caller : Principal,
    request : Access.ApprovalRequest,
  ) : () {
    Auth.requireAdmin(accessGrants, caller);
    let now = Time.now();
    let grant : Access.AccessGrant = {
      principal = request.principal;
      role = request.role;
      approvedAt = now;
      approvedBy = caller;
      accessEndsAt = request.accessEndsAt;
      trainerPositionIds = request.trainerPositionIds;
      linkedRoadieId = request.linkedRoadieId;
    };
    accessGrants.add(request.principal, grant);
    pendingUsers.remove(request.principal);
  };

  /// Change an existing user's role (Admin only).
  public func updateUserRole(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    caller : Principal,
    principal : Principal,
    role : Common.Role,
  ) : () {
    Auth.requireAdmin(accessGrants, caller);
    let existing = accessGrants.get(principal)
      ?? Runtime.trap("Access denied: user is not registered");
    // Refuse to demote the last admin.
    if (existing.role == #admin and role != #admin) {
      if (countAdmins(accessGrants) <= 1) {
        Runtime.trap("Cannot change role: at least 2 admins must exist");
      };
    };
    accessGrants.add(principal, { existing with role });
  };

  /// Update a user's trainer stations (Admin only).
  public func updateTrainerStations(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    caller : Principal,
    principal : Principal,
    positionIds : [Common.PositionId],
  ) : () {
    Auth.requireAdmin(accessGrants, caller);
    let existing = accessGrants.get(principal)
      ?? Runtime.trap("Access denied: user is not registered");
    accessGrants.add(principal, { existing with trainerPositionIds = positionIds });
  };

  /// Update a user's access end date (Admin only).
  public func updateAccessEnd(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    caller : Principal,
    principal : Principal,
    accessEndsAt : ?Common.Timestamp,
  ) : () {
    Auth.requireAdmin(accessGrants, caller);
    let existing = accessGrants.get(principal)
      ?? Runtime.trap("Access denied: user is not registered");
    accessGrants.add(principal, { existing with accessEndsAt });
  };

  /// Remove a user's access (Admin only); the last admin cannot be removed.
  public func removeUser(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    caller : Principal,
    principal : Principal,
  ) : () {
    Auth.requireAdmin(accessGrants, caller);
    let existing = accessGrants.get(principal)
      ?? Runtime.trap("Access denied: user is not registered");
    if (existing.role == #admin and countAdmins(accessGrants) <= 1) {
      Runtime.trap("Cannot remove the last admin");
    };
    accessGrants.remove(principal);
  };

  /// Count the current admins (any role except Kiosk).
  public func adminCount(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    caller : Principal,
  ) : Nat {
    ignore Auth.requireReadable(accessGrants, caller);
    countAdmins(accessGrants);
  };

  /// Internal: count non-expired admins.
  func countAdmins(accessGrants : Map.Map<Principal, Access.AccessGrant>) : Nat {
    var count = 0;
    for (grant in accessGrants.values()) {
      if (grant.role == #admin) {
        switch (grant.accessEndsAt) {
          case (?endsAt) { if (Time.now() < endsAt) { count += 1 } };
          case null { count += 1 };
        };
      };
    };
    count;
  };
};
