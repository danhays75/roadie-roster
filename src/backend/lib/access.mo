import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Time "mo:core/Time";
import AccessControl "mo:caffeineai-authorization/access-control";
import Common "../types/common";
import Access "../types/access";
import Auth "auth";

module {
  /// Nanoseconds in one day.
  let nsPerDay : Int = 86_400_000_000_000;
  /// Nanoseconds in one hour.
  let nsPerHour : Int = 3_600_000_000_000;
  /// Nanoseconds in one second.
  let nsPerSecond : Int = 1_000_000_000;

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

  /// Approve a pending user with a role and options (Admin only). Only a
  /// principal that is actually pending may be approved; an unknown or
  /// already-approved principal is rejected.
  public func approveUser(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    pendingUsers : Map.Map<Principal, Access.PendingUser>,
    caller : Principal,
    request : Access.ApprovalRequest,
  ) : () {
    Auth.requireAdmin(accessGrants, caller);
    if (not pendingUsers.containsKey(request.principal)) {
      Runtime.trap("Cannot approve: principal is not pending");
    };
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

  /// Change an existing user's role (Admin only). Refuses any change that would
  /// leave zero active admins, including demoting the last admin.
  public func updateUserRole(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    caller : Principal,
    principal : Principal,
    role : Common.Role,
  ) : () {
    Auth.requireAdmin(accessGrants, caller);
    let existing = accessGrants.get(principal)
      ?? Runtime.trap("Access denied: user is not registered");
    // Refuse to demote the last active admin.
    if (existing.role == #admin and role != #admin and isActiveAdmin(existing)) {
      if (countAdmins(accessGrants) <= 1) {
        Runtime.trap("Cannot change role: at least 2 admins must exist");
      };
    };
    accessGrants.add(principal, { existing with role });
  };

  /// Update a user's trainer stations (Admin only). Works for an already
  /// approved user so an admin can change a trainer's stations after approval.
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

  /// Update a user's access end date (Admin only). Works for an already
  /// approved user so an admin can change an end date after approval. Refuses
  /// any change that would leave zero active admins, including end-dating the
  /// last admin.
  public func updateAccessEnd(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    caller : Principal,
    principal : Principal,
    accessEndsAt : ?Common.Timestamp,
  ) : () {
    Auth.requireAdmin(accessGrants, caller);
    let existing = accessGrants.get(principal)
      ?? Runtime.trap("Access denied: user is not registered");
    // Refuse to end-date the last active admin. Only a change that removes a
    // currently-active admin can leave zero active admins.
    if (existing.role == #admin and isActiveAdmin(existing)) {
      switch (accessEndsAt) {
        case (?endsAt) {
          if (endsAt <= Time.now() and countAdmins(accessGrants) <= 1) {
            Runtime.trap("Cannot end access: at least 2 admins must exist");
          };
        };
        case null {};
      };
    };
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

  /// Build an access end timestamp of 11:59:59 PM America/Chicago on the
  /// calendar day of `day` (a UTC-midnight date-only timestamp). The store's
  /// time zone is fixed at America/Chicago, so the offset is resolved for that
  /// zone on that date (CST = UTC-6, CDT = UTC-5).
  public func endOfDayChicago(day : Common.DateOnly) : Common.Timestamp {
    let dayIndex = floorDiv(day, nsPerDay);
    let (year, month, dayOfMonth) = civilFromDays(dayIndex);
    let offsetHours = chicagoOffsetHours(year, month, dayOfMonth);
    // 23:59:59 local = 24:00:00 local minus one second.
    let localMidnightUtc = dayIndex * nsPerDay;
    let endLocal = localMidnightUtc + nsPerDay - nsPerSecond;
    // Convert local wall-clock to UTC by subtracting the offset.
    endLocal - (offsetHours * nsPerHour);
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

  /// Internal: true when the grant is an admin whose access has not ended.
  func isActiveAdmin(grant : Access.AccessGrant) : Bool {
    if (grant.role != #admin) {
      return false;
    };
    switch (grant.accessEndsAt) {
      case (?endsAt) { Time.now() < endsAt };
      case null { true };
    };
  };

  /// Internal: floor division that works for negative numerators.
  func floorDiv(a : Int, b : Int) : Int {
    let q = a / b;
    if (a % b != 0 and (a < 0) != (b < 0)) { q - 1 } else { q };
  };

  /// Internal: days since 1970-01-01 to a civil (year, month, day).
  /// Howard Hinnant's civil_from_days algorithm.
  func civilFromDays(z0 : Int) : (Int, Int, Int) {
    let z = z0 + 719_468;
    let era = floorDiv(z, 146_097);
    let doe = z - era * 146_097; // [0, 146096]
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365; // [0, 399]
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100); // [0, 365]
    let mp = (5 * doy + 2) / 153; // [0, 11]
    let d = doy - (153 * mp + 2) / 5 + 1; // [1, 31]
    let m = if (mp < 10) { mp + 3 } else { mp - 9 }; // [1, 12]
    let year = if (m <= 2) { y + 1 } else { y };
    (year, m, d);
  };

  /// Internal: day of week for a civil date (0 = Sunday .. 6 = Saturday).
  func dayOfWeek(year : Int, month : Int, day : Int) : Int {
    let t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
    let y = if (month < 3) { year - 1 } else { year };
    let idx = (month - 1).toNat();
    let w = (y + y / 4 - y / 100 + y / 400 + t[idx] + day) % 7;
    w;
  };

  /// Internal: the UTC offset in hours for America/Chicago on a civil date.
  /// DST (CDT, UTC-5) runs from the second Sunday of March at 02:00 local to
  /// the first Sunday of November at 02:00 local; otherwise CST (UTC-6).
  func chicagoOffsetHours(year : Int, month : Int, day : Int) : Int {
    if (month < 3 or month > 11) {
      return -6;
    };
    if (month > 3 and month < 11) {
      return -5;
    };
    if (month == 3) {
      // Second Sunday of March.
      let firstDow = dayOfWeek(year, 3, 1);
      let secondSunday = 1 + ((7 - firstDow) % 7) + 7;
      if (day > secondSunday) { return -5 };
      if (day < secondSunday) { return -6 };
      // On the transition day, DST starts at 02:00 local; 11:59:59 PM is after.
      return -5;
    };
    // month == 11: first Sunday of November.
    let firstDow = dayOfWeek(year, 11, 1);
    let firstSunday = 1 + ((7 - firstDow) % 7);
    if (day < firstSunday) { return -5 };
    if (day > firstSunday) { return -6 };
    // On the transition day, DST ends at 02:00 local; 11:59:59 PM is after.
    return -6;
  };
};
