import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Time "mo:core/Time";
import Common "../types/common";
import Access "../types/access";

/// Shared authorization helpers. Every domain lib receives the access-grant map
/// and the caller principal, and asks this module what the caller may do.
module {
  /// True when demo mode is currently on, accounting for the eight-hour
  /// auto-off. Pure read; the demo lib owns the actual auto-off write.
  public func demoActive(demoState : Common.DemoState) : Bool {
    if (not demoState.enabled) {
      return false;
    };
    switch (demoState.autoOffAt) {
      case (?autoOffAt) { Time.now() < autoOffAt };
      case null { true };
    };
  };

  /// The sentinel work email stored on a demo leader's staff profile so demo
  /// leaders can be told apart from real ones. Matches the marker the demo
  /// seeder writes.
  let demoLeaderMarker : Text = "DEMO";

  /// True when an access grant is a seeded demo leader. Demo leaders are marked
  /// by a sentinel work email so their real-looking home store number can still
  /// be shown.
  public func isDemoLeader(grant : Access.AccessGrant) : Bool {
    switch (grant.staffProfile) {
      case (?p) { p.workEmail == ?demoLeaderMarker };
      case null { false };
    };
  };

  /// Map a demo role to the real application role it impersonates.
  public func demoRoleToRole(role : Common.DemoRole) : Common.Role {
    switch (role) {
      case (#admin) { #admin };
      case (#storeManager) { #storeManager };
      case (#trainingManager) { #trainingManager };
      case (#trainer) { #trainer };
      case (#visitingManager) { #visitingManager };
      case (#leadership) { #leadership };
      case (#kiosk) { #kiosk };
    };
  };

  /// The effective role of a caller, or null when unregistered/expired. While
  /// demo mode is on, any signed-in caller (even one not yet approved) acts as
  /// the chosen demo role.
  public func effectiveRole(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    caller : Principal,
  ) : ?Common.Role {
    if (demoActive(demoState)) {
      return ?demoRoleToRole(demoState.demoRole);
    };
    realRole(accessGrants, caller);
  };

  /// The caller's real role from their access grant, or null when
  /// unregistered/expired. Ignores demo mode.
  public func realRole(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    caller : Principal,
  ) : ?Common.Role {
    switch (accessGrants.get(caller)) {
      case (?grant) {
        switch (grant.accessEndsAt) {
          case (?endsAt) {
            if (Time.now() >= endsAt) { null } else { ?grant.role };
          };
          case null { ?grant.role };
        };
      };
      case null { null };
    };
  };

  /// True when the caller is a registered, non-expired Admin. While demo mode
  /// is on, the impersonated demo role is consulted.
  public func isAdmin(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    caller : Principal,
  ) : Bool {
    switch (effectiveRole(accessGrants, demoState, caller)) {
      case (?role) { role == #admin };
      case null { false };
    };
  };

  /// True when the caller is Admin or Store Manager. While demo mode is on, the
  /// impersonated demo role is consulted.
  public func isManager(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    caller : Principal,
  ) : Bool {
    switch (effectiveRole(accessGrants, demoState, caller)) {
      case (?role) { role == #admin or role == #storeManager };
      case null { false };
    };
  };

  /// True when the caller may read the contact set (Admin or Store Manager).
  /// While demo mode is on, the impersonated demo role is consulted, so a demo
  /// Trainer really cannot see contact info.
  public func canSeeContactSet(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    caller : Principal,
  ) : Bool {
    isManager(accessGrants, demoState, caller);
  };

  /// True when the caller is a Kiosk login (reads are rejected). While demo
  /// mode is on, the impersonated demo role is consulted.
  public func isKiosk(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    caller : Principal,
  ) : Bool {
    switch (effectiveRole(accessGrants, demoState, caller)) {
      case (?role) { role == #kiosk };
      case null { false };
    };
  };

  /// Require a registered caller; trap otherwise. While demo mode is on, any
  /// signed-in caller acts as the chosen demo role.
  public func requireRegistered(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    caller : Principal,
  ) : Common.Role {
    effectiveRole(accessGrants, demoState, caller)
      ?? Runtime.trap("Access denied: caller is not registered or access has ended");
  };

  /// Require Admin; trap otherwise. While demo mode is on, the impersonated
  /// demo role is consulted.
  public func requireAdmin(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    caller : Principal,
  ) : () {
    if (not isAdmin(accessGrants, demoState, caller)) {
      Runtime.trap("Access denied: Admin role required");
    };
  };

  /// Require the caller's *real* Admin role, ignoring any impersonated demo
  /// role. Used by the demo-mode controls themselves so a real Admin can always
  /// turn demo mode off and manage demo data, even while impersonating a
  /// non-admin demo role.
  public func requireRealAdmin(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    caller : Principal,
  ) : () {
    switch (realRole(accessGrants, caller)) {
      case (?role) {
        if (role != #admin) {
          Runtime.trap("Access denied: Admin role required");
        };
      };
      case null {
        Runtime.trap("Access denied: Admin role required");
      };
    };
  };

  /// Require Admin or Store Manager; trap otherwise. While demo mode is on, the
  /// impersonated demo role is consulted.
  public func requireManager(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    caller : Principal,
  ) : () {
    if (not isManager(accessGrants, demoState, caller)) {
      Runtime.trap("Access denied: Admin or Store Manager role required");
    };
  };

  /// Require a read-capable caller (any role except Kiosk); trap otherwise.
  /// While demo mode is on, the impersonated demo role is consulted.
  public func requireReadable(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    caller : Principal,
  ) : Common.Role {
    let role = requireRegistered(accessGrants, demoState, caller);
    if (role == #kiosk) {
      Runtime.trap("Access denied: Kiosk logins may only submit a sign-up");
    };
    role;
  };
};
