import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Time "mo:core/Time";
import Char "mo:core/Char";
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

  /// Read the caller's own access grant, if any.
  public func getMyAccess(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    caller : Principal,
  ) : ?Access.AccessGrant {
    accessGrants.get(caller);
  };

  /// Bootstrap the first app Admin.
  public func bootstrapAdmin(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    accessControlState : AccessControl.AccessControlState,
    caller : Principal,
  ) : Bool {
    // Only the platform's first user (the shared authorization owner) may
    // bootstrap, and only while no app admin exists yet.
    if (countAdmins(accessGrants) > 0) {
      return false;
    };
    if (not AccessControl.isAdmin(accessControlState, caller)) {
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
      staffProfile = null;
    });
    true;
  };

  /// Read the caller's own pending access request, if any. Returns null when
  /// the caller has no entry in `pendingUsers`; otherwise the requestedAt of
  /// that pending entry and hasProfile = true when a staff profile is present.
  public func getMyPendingRequest(
    pendingUsers : Map.Map<Principal, Access.PendingUser>,
    caller : Principal,
  ) : ?Access.PendingRequestSummary {
    switch (pendingUsers.get(caller)) {
      case (?pending) {
        ?{
          requestedAt = pending.requestedAt;
          hasProfile = switch (pending.staffProfile) {
            case (?_) { true };
            case null { false };
          };
        };
      };
      case null { null };
    };
  };

  /// Store the signed-in caller's staff profile on their pending request. The
  /// caller must already have a pending request (created by `requestAccess`).
  /// Calling it again replaces the stored profile. A caller who already holds an
  /// access grant is not pending, so this traps; they use `updateMyStaffProfile`.
  public func submitStaffProfile(
    pendingUsers : Map.Map<Principal, Access.PendingUser>,
    caller : Principal,
    profile : Access.StaffProfile,
  ) : () {
    let pending = pendingUsers.get(caller)
      ?? Runtime.trap("No pending request for this principal");
    pendingUsers.add(caller, { pending with staffProfile = ?profile });
  };

  /// Update the signed-in caller's own staff profile on their access grant.
  /// Existing users who were approved before profiles existed can fill theirs in
  /// here without losing their access. Traps when the caller has no grant.
  public func updateMyStaffProfile(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    caller : Principal,
    profile : Access.StaffProfile,
  ) : () {
    let grant = accessGrants.get(caller)
      ?? Runtime.trap("Access grant not found");
    accessGrants.add(caller, { grant with staffProfile = ?profile });
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

  /// List the leaders shown on the Leaders page: the manager, trainer and
  /// leadership roles (Admin, Store Manager, Training Manager, Visiting
  /// Manager, Trainer, Leadership). Readable by every role except Kiosk and
  /// Integration. Never carries phone or email: the returned staff profile has
  /// its work phone and work email cleared.
  public func listLeaders(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    caller : Principal,
  ) : [Access.LeaderSummary] {
    let role = Auth.requireReadable(accessGrants, caller);
    if (role == #integration) {
      Runtime.trap("Access denied: Integration role may only read the Shareable export");
    };
    accessGrants.values().filter(func(g) = isLeaderRole(g.role)).map(func(g) {
      {
        principal = g.principal;
        role = g.role;
        title = leaderTitle(g);
        staffProfile = switch (g.staffProfile) {
          case (?p) { ?redactProfile(p) };
          case null { null };
        };
        trainerPositionIds = g.trainerPositionIds;
        arrivalDate = switch (g.staffProfile) {
          case (?p) { p.arrivalDate };
          case null { null };
        };
        departureDate = switch (g.staffProfile) {
          case (?p) { p.departureDate };
          case null { null };
        };
      };
    }).toArray();
  };

  /// Internal: true when a role is shown on the Leaders page.
  func isLeaderRole(role : Common.Role) : Bool {
    switch (role) {
      case (#admin) { true };
      case (#storeManager) { true };
      case (#trainingManager) { true };
      case (#visitingManager) { true };
      case (#trainer) { true };
      case (#leadership) { true };
      case (_) { false };
    };
  };

  /// Internal: the leader's display title, falling back to a role label.
  func leaderTitle(grant : Access.AccessGrant) : Text {
    switch (grant.staffProfile) {
      case (?p) {
        let trimmed = p.title.trim(#predicate(func(c : Char) : Bool { c.isWhitespace() }));
        if (trimmed.size() > 0) { trimmed } else { roleLabel(grant.role) };
      };
      case null { roleLabel(grant.role) };
    };
  };

  /// Internal: a human label for a leader role.
  func roleLabel(role : Common.Role) : Text {
    switch (role) {
      case (#admin) { "Admin" };
      case (#storeManager) { "Store Manager" };
      case (#trainingManager) { "Training Manager" };
      case (#visitingManager) { "Visiting Manager" };
      case (#trainer) { "NSO Trainer" };
      case (#leadership) { "Leadership" };
      case (_) { "" };
    };
  };

  /// Internal: strip contact information from a staff profile before it leaves
  /// the backend. Phone and email are never shown on a leader card.
  func redactProfile(profile : Access.StaffProfile) : Access.StaffProfile {
    { profile with workPhone = null; workEmail = null };
  };

  /// Approve a pending user with a role and options (Admin only). An Admin
  /// grant is always stored with no end date, so an admin can never be
  /// end-dated into lockout.
  public func approveUser(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    pendingUsers : Map.Map<Principal, Access.PendingUser>,
    caller : Principal,
    request : Access.ApprovalRequest,
  ) : () {
    Auth.requireAdmin(accessGrants, caller);
    if (not pendingUsers.containsKey(request.principal)) {
      Runtime.trap("No pending request for this principal");
    };
    pendingUsers.remove(request.principal);
    // An Admin grant never carries an end date.
    let accessEndsAt = switch (request.role) {
      case (#admin) { null };
      case (_) { request.accessEndsAt };
    };
    accessGrants.add(request.principal, {
      principal = request.principal;
      role = request.role;
      approvedAt = Time.now();
      approvedBy = caller;
      accessEndsAt;
      trainerPositionIds = request.trainerPositionIds;
      linkedRoadieId = request.linkedRoadieId;
      staffProfile = request.staffProfile;
    });
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
    let grant = accessGrants.get(principal) ?? Runtime.trap("Access grant not found");
    if (grant.role == #admin and role != #admin and isActiveAdmin(grant) and countAdmins(accessGrants) <= 1) {
      Runtime.trap("Cannot demote the last active admin");
    };
    // An Admin grant never carries an end date.
    let accessEndsAt = switch (role) {
      case (#admin) { null };
      case (_) { grant.accessEndsAt };
    };
    accessGrants.add(principal, { grant with role; accessEndsAt });
  };

  /// Update a user's trainer stations (Admin only).
  public func updateTrainerStations(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    caller : Principal,
    principal : Principal,
    positionIds : [Common.PositionId],
  ) : () {
    Auth.requireAdmin(accessGrants, caller);
    let grant = accessGrants.get(principal) ?? Runtime.trap("Access grant not found");
    accessGrants.add(principal, { grant with trainerPositionIds = positionIds });
  };

  /// Update a user's access end date (Admin only). Refuses ANY end date (past
  /// or future) on the last active admin, so the last admin can never be
  /// end-dated into lockout. An Admin grant is always stored with no end date.
  public func updateAccessEnd(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    caller : Principal,
    principal : Principal,
    accessEndsAt : ?Common.Timestamp,
  ) : () {
    Auth.requireAdmin(accessGrants, caller);
    let grant = accessGrants.get(principal) ?? Runtime.trap("Access grant not found");
    if (grant.role == #admin) {
      // An admin can never be end-dated at all.
      if (accessEndsAt != null) {
        Runtime.trap("An admin grant cannot have an end date");
      };
      accessGrants.add(principal, { grant with accessEndsAt = null });
      return;
    };
    accessGrants.add(principal, { grant with accessEndsAt });
  };

  /// Remove a user's access (Admin only); the last admin cannot be removed.
  public func removeUser(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    caller : Principal,
    principal : Principal,
  ) : () {
    Auth.requireAdmin(accessGrants, caller);
    let grant = accessGrants.get(principal) ?? Runtime.trap("Access grant not found");
    if (grant.role == #admin and isActiveAdmin(grant) and countAdmins(accessGrants) <= 1) {
      Runtime.trap("Cannot remove the last active admin");
    };
    accessGrants.remove(principal);
  };

  /// Count the current admins.
  public func adminCount(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    caller : Principal,
  ) : Nat {
    ignore Auth.requireReadable(accessGrants, caller);
    countAdmins(accessGrants);
  };

  /// Build an access end timestamp of 11:59:59 PM America/Chicago on the
  /// calendar day of `day` (a UTC-midnight date-only timestamp).
  public func endOfDayChicago(day : Common.DateOnly) : Common.Timestamp {
    let (y, m, d) = civilFromDays(floorDiv(day, nsPerDay));
    let offsetHours = chicagoOffsetHours(y, m, d);
    // 23:59:59 local on that civil day, expressed as a UTC timestamp.
    let localMidnightUtc = day;
    localMidnightUtc + 23 * nsPerHour + 59 * 60 * nsPerSecond + 59 * nsPerSecond - offsetHours * nsPerHour;
  };

  /// Internal: count non-expired admins.
  func countAdmins(accessGrants : Map.Map<Principal, Access.AccessGrant>) : Nat {
    accessGrants.values().filter(func(g) = isActiveAdmin(g)).size();
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
  func civilFromDays(z0 : Int) : (Int, Int, Int) {
    let z = z0 + 719_468;
    let era = floorDiv(z, 146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if (mp < 10) { mp + 3 } else { mp - 9 };
    let year = if (m <= 2) { y + 1 } else { y };
    (year, m, d);
  };

  /// Internal: day of week for a civil date (0 = Sunday .. 6 = Saturday).
  func dayOfWeek(year : Int, month : Int, day : Int) : Int {
    let z = daysFromCivil(year, month, day);
    let w = (z + 4) % 7;
    if (w < 0) { w + 7 } else { w };
  };

  /// Internal: days since the Unix epoch from a civil date.
  func daysFromCivil(year : Int, month : Int, day : Int) : Int {
    let y = if (month <= 2) { year - 1 } else { year };
    let era = floorDiv(y, 400);
    let yoe = y - era * 400;
    let mp = if (month > 2) { month - 3 } else { month + 9 };
    let doy = (153 * mp + 2) / 5 + day - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468;
  };

  /// Internal: the UTC offset in hours for America/Chicago on a civil date.
  func chicagoOffsetHours(year : Int, month : Int, day : Int) : Int {
    // US DST: second Sunday in March to first Sunday in November.
    let dstStart = daysFromCivil(year, 3, nthSundayOfMonth(year, 3, 2));
    let dstEnd = daysFromCivil(year, 11, nthSundayOfMonth(year, 11, 1));
    let today = daysFromCivil(year, month, day);
    if (today >= dstStart and today < dstEnd) { -5 } else { -6 };
  };

  /// Internal: day-of-month of the `n`th Sunday in `month` of `year`.
  func nthSundayOfMonth(year : Int, month : Int, n : Int) : Int {
    let firstWeekday = dayOfWeek(year, month, 1);
    let toFirstSunday = (7 - firstWeekday) % 7;
    1 + toFirstSunday + (n - 1) * 7;
  };
};
