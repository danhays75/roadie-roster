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

  /// The demo role a signed-in caller is currently impersonating, or null when
  /// demo mode is off, the caller is anonymous, or the caller has not chosen a
  /// role. A signed-in caller with no stored entry defaults to demo Admin.
  public func demoRoleFor(
    demoState : Common.DemoState,
    caller : Principal,
  ) : ?Common.DemoRole {
    if (caller.isAnonymous()) {
      return null;
    };
    if (not demoActive(demoState)) {
      return null;
    };
    switch (demoState.demoRoles.get(caller)) {
      case (?entry) { ?entry.role };
      case null { ?#admin };
    };
  };

  /// The demo trainer stations for a signed-in caller, or an empty array when
  /// demo mode is off, the caller is anonymous, or the caller has no stored
  /// entry.
  public func demoTrainerStationsFor(
    demoState : Common.DemoState,
    caller : Principal,
  ) : [Common.PositionId] {
    if (caller.isAnonymous() or not demoActive(demoState)) {
      return [];
    };
    switch (demoState.demoRoles.get(caller)) {
      case (?entry) { entry.stations };
      case null { [] };
    };
  };

  /// The principal a caller should be treated as when matching board groups and
  /// group-change notices. While demo mode is on and the caller's demo role is
  /// NSO Trainer with a chosen demo leader, returns that demo leader principal;
  /// otherwise returns the caller unchanged. Never consulted outside demo mode.
  public func actingPrincipal(
    demoState : Common.DemoState,
    caller : Principal,
  ) : Principal {
    switch (demoRoleFor(demoState, caller)) {
      case (?#trainer) {
        switch (demoState.demoTrainerAs.get(caller)) {
          case (?leader) { leader };
          case null { caller };
        };
      };
      case _ { caller };
    };
  };

  /// The effective role of a caller, or null when unregistered/expired. While
  /// demo mode is on, a **signed-in** caller (even one not yet approved) acts
  /// as their own chosen demo role; an anonymous caller always gets null, even
  /// while demo mode is on.
  public func effectiveRole(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    caller : Principal,
  ) : ?Common.Role {
    if (caller.isAnonymous()) {
      return null;
    };
    switch (demoRoleFor(demoState, caller)) {
      case (?role) { ?demoRoleToRole(role) };
      case null { realRole(accessGrants, caller) };
    };
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
  /// is on, the caller's own impersonated demo role is consulted.
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
  /// caller's own impersonated demo role is consulted.
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
  /// While demo mode is on, the caller's own impersonated demo role is
  /// consulted, so a demo Trainer really cannot see contact info.
  public func canSeeContactSet(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    caller : Principal,
  ) : Bool {
    isManager(accessGrants, demoState, caller);
  };

  /// True when the caller is a Kiosk login (reads are rejected). While demo
  /// mode is on, the caller's own impersonated demo role is consulted.
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

  /// Require a registered caller; trap otherwise. While demo mode is on, a
  /// signed-in caller acts as their own chosen demo role; an anonymous caller
  /// is always unregistered.
  public func requireRegistered(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    caller : Principal,
  ) : Common.Role {
    effectiveRole(accessGrants, demoState, caller)
      ?? Runtime.trap("Access denied: caller is not registered or access has ended");
  };

  /// Require Admin; trap otherwise. While demo mode is on, the caller's own
  /// impersonated demo role is consulted.
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

  /// Require the caller's *real* Admin or Store Manager role, ignoring any
  /// impersonated demo role.
  public func requireRealManager(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    caller : Principal,
  ) : () {
    switch (realRole(accessGrants, caller)) {
      case (?role) {
        if (role != #admin and role != #storeManager) {
          Runtime.trap("Access denied: Admin or Store Manager role required");
        };
      };
      case null {
        Runtime.trap("Access denied: Admin or Store Manager role required");
      };
    };
  };

  /// Require a real Admin grant and refuse while demo mode is on. Applied to
  /// every write that changes real, shared settings so a demo impersonation can
  /// never mutate real data.
  public func requireRealSettingsAdmin(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    caller : Principal,
  ) : () {
    requireRealAdmin(accessGrants, caller);
    if (demoActive(demoState)) {
      Runtime.trap("Turn off demo mode to change real settings");
    };
  };

  /// Require a real Admin or Store Manager grant and refuse while demo mode is
  /// on. Applied to every write that changes real, shared settings so a demo
  /// impersonation can never mutate real data.
  public func requireRealSettingsManager(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    caller : Principal,
  ) : () {
    requireRealManager(accessGrants, caller);
    if (demoActive(demoState)) {
      Runtime.trap("Turn off demo mode to change real settings");
    };
  };

  /// Require Admin or Store Manager; trap otherwise. While demo mode is on, the
  /// caller's own impersonated demo role is consulted.
  public func requireManager(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    caller : Principal,
  ) : () {
    if (not isManager(accessGrants, demoState, caller)) {
      Runtime.trap("Access denied: Admin or Store Manager role required");
    };
  };

  /// Require an orientation-staff caller (Admin, Store Manager, Training
  /// Manager or Visiting Manager); trap otherwise. While demo mode is on, the
  /// caller's own impersonated demo role is consulted.
  public func requireOrientationStaff(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    caller : Principal,
  ) : () {
    switch (effectiveRole(accessGrants, demoState, caller)) {
      case (?role) {
        if (role != #admin and role != #storeManager and role != #trainingManager and role != #visitingManager) {
          Runtime.trap("Access denied: Admin, Store Manager, Training Manager or Visiting Manager role required");
        };
      };
      case null {
        Runtime.trap("Access denied: Admin, Store Manager, Training Manager or Visiting Manager role required");
      };
    };
  };

  /// Require a group-editor caller (Admin, Store Manager or Training Manager);
  /// trap otherwise. While demo mode is on, the caller's own impersonated demo
  /// role is consulted. Real boards are additionally blocked by the demo
  /// real-settings guard at the call site; demo boards stay editable in demo.
  public func requireGroupEditor(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    caller : Principal,
  ) : () {
    switch (effectiveRole(accessGrants, demoState, caller)) {
      case (?role) {
        if (role != #admin and role != #storeManager and role != #trainingManager) {
          Runtime.trap("Access denied: Admin, Store Manager or Training Manager role required");
        };
      };
      case null {
        Runtime.trap("Access denied: Admin, Store Manager or Training Manager role required");
      };
    };
  };

  /// Require a read-capable caller (any role except Kiosk); trap otherwise.
  /// While demo mode is on, the caller's own impersonated demo role is
  /// consulted.
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
