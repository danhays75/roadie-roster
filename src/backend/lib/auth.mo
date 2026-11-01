import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Time "mo:core/Time";
import Common "../types/common";
import Access "../types/access";

/// Shared authorization helpers. Every domain lib receives the access-grant map
/// and the caller principal, and asks this module what the caller may do.
module {
  /// The effective role of a caller, or null when unregistered/expired.
  public func effectiveRole(
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

  /// True when the caller is a registered, non-expired Admin.
  public func isAdmin(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    caller : Principal,
  ) : Bool {
    switch (effectiveRole(accessGrants, caller)) {
      case (?role) { role == #admin };
      case null { false };
    };
  };

  /// True when the caller is Admin or Store Manager.
  public func isManager(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    caller : Principal,
  ) : Bool {
    switch (effectiveRole(accessGrants, caller)) {
      case (?role) { role == #admin or role == #storeManager };
      case null { false };
    };
  };

  /// True when the caller may read the contact set (Admin or Store Manager).
  public func canSeeContactSet(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    caller : Principal,
  ) : Bool {
    isManager(accessGrants, caller);
  };

  /// True when the caller is a Kiosk login (reads are rejected).
  public func isKiosk(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    caller : Principal,
  ) : Bool {
    switch (effectiveRole(accessGrants, caller)) {
      case (?role) { role == #kiosk };
      case null { false };
    };
  };

  /// Require a registered caller; trap otherwise.
  public func requireRegistered(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    caller : Principal,
  ) : Common.Role {
    effectiveRole(accessGrants, caller)
      ?? Runtime.trap("Access denied: caller is not registered or access has ended");
  };

  /// Require Admin; trap otherwise.
  public func requireAdmin(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    caller : Principal,
  ) : () {
    if (not isAdmin(accessGrants, caller)) {
      Runtime.trap("Access denied: Admin role required");
    };
  };

  /// Require Admin or Store Manager; trap otherwise.
  public func requireManager(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    caller : Principal,
  ) : () {
    if (not isManager(accessGrants, caller)) {
      Runtime.trap("Access denied: Admin or Store Manager role required");
    };
  };

  /// Require a read-capable caller (any role except Kiosk); trap otherwise.
  public func requireReadable(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    caller : Principal,
  ) : Common.Role {
    let role = requireRegistered(accessGrants, caller);
    if (role == #kiosk) {
      Runtime.trap("Access denied: Kiosk logins may only submit a sign-up");
    };
    role;
  };
};
