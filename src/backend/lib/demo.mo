import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Principal "mo:core/Principal";
import Order "mo:core/Order";
import Time "mo:core/Time";
import Common "../types/common";
import Demo "../types/demo";
import Store "../types/store";
import Roadie "../types/roadie";
import Signup "../types/signup";
import Phase23 "../types/phase23";
import Access "../types/access";
import Auth "auth";
import ChangeLog "changelog";

/// Demo-mode domain logic. Demo mode is off by default; only an Admin may turn
/// it on, and turning it on requires the literal confirmation "DEMO". It turns
/// itself off automatically eight hours after it was turned on. Demo records
/// are stored alongside real records and separated by an `isDemo` flag, so
/// while demo mode is on every query and export returns only demo records, and
/// while it is off demo records are invisible everywhere.
module {
  /// The counters the demo seeder advances so seeded demo records do not
  /// collide with real ones.
  public type Counters = {
    var nextRoadieId : Nat;
    var nextCrewId : Nat;
    var nextSignupId : Nat;
    var nextChangeLogId : Nat;
    var nextAttendanceId : Nat;
    var nextTrainerNoteId : Nat;
  };

  /// Eight hours in nanoseconds — the demo-mode auto-off window.
  let eightHoursNs : Int = 28_800_000_000_000;

  /// The literal an Admin must type to turn demo mode on.
  let confirmWord : Text = "DEMO";

  /// The system actor recorded as the `who` of an automatic demo-mode off. The
  /// automatic off is not performed by any caller, so it must not be attributed
  /// to whichever caller happens to trigger the next update.
  func systemActor() : Principal {
    Principal.fromText("aaaaa-aa");
  };

  /// The sentinel work email stored on a demo leader's staff profile so demo
  /// leaders can be told apart from real ones without an `isDemo` flag on
  /// `AccessGrant`. A sentinel email leaves the real-looking home store number
  /// free to display.
  let demoLeaderMarker : Text = "DEMO";

  /// True when demo mode is currently on, accounting for the eight-hour
  /// auto-off. A query cannot persist the auto-off, so reads compute it.
  func isOn(demoState : Common.DemoState, now : Int) : Bool {
    if (not demoState.enabled) {
      return false;
    };
    switch (demoState.autoOffAt) {
      case (?offAt) { now < offAt };
      case null { true };
    };
  };

  /// Persist the auto-off when the eight-hour window has elapsed. Called from
  /// every update path so the stored flag catches up with the computed view.
  /// The automatic off is written to the change log with the system actor as
  /// `who`, and the pretend date and demo role are cleared, exactly like a
  /// manual off.
  func refreshAutoOff(
    demoState : Common.DemoState,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    now : Int,
  ) {
    if (demoState.enabled) {
      switch (demoState.autoOffAt) {
        case (?offAt) {
          if (now >= offAt) {
            turnOff(demoState);
            ignore ChangeLog.record(changeLog, counters, systemActor(), "demoModeAutoOff", null, false, "Demo mode turned off automatically");
          };
        };
        case null {};
      };
    };
  };

  /// The remaining nanoseconds until the automatic off, or null when demo mode
  /// is off or has no auto-off time. Used to schedule the auto-off timer.
  public func autoOffDelayNs(demoState : Common.DemoState, now : Int) : ?Nat {
    if (not demoState.enabled) {
      return null;
    };
    switch (demoState.autoOffAt) {
      case (?offAt) {
        if (now >= offAt) { ?0 } else { ?(offAt - now).toNat() };
      };
      case null { null };
    };
  };

  /// The timer callback body: turn demo mode off and log the automatic off with
  /// the system actor when the eight-hour window has elapsed. Safe to call when
  /// demo mode is already off or was turned off manually in the meantime.
  public func autoOffIfDue(
    demoState : Common.DemoState,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    now : Int,
  ) {
    refreshAutoOff(demoState, changeLog, counters, now);
  };

  /// Clear the demo-mode flags, the pretend date and the demo role. Shared by
  /// the manual off and the automatic off so both leave the same clean state.
  func turnOff(demoState : Common.DemoState) {
    demoState.enabled := false;
    demoState.turnedOnAt := null;
    demoState.autoOffAt := null;
    demoState.pretendDate := null;
    demoState.demoRole := #admin;
    demoState.demoTrainerStations := [];
  };

  /// Build the shared view of the demo state.
  func toView(demoState : Common.DemoState, now : Int) : Demo.DemoStateView {
    {
      enabled = isOn(demoState, now);
      turnedOnAt = demoState.turnedOnAt;
      autoOffAt = demoState.autoOffAt;
      pretendDate = demoState.pretendDate;
      demoRole = demoState.demoRole;
      demoTrainerStations = demoState.demoTrainerStations;
    };
  };

  /// Read the current demo state as a shared view. Any caller, including
  /// unregistered users, so the banner can render on the sign-in and waiting
  /// screens.
  public func getDemoState(demoState : Common.DemoState) : Demo.DemoStateView {
    toView(demoState, Time.now());
  };

  /// Turn demo mode on or off. Turning it on requires the literal confirmation
  /// "DEMO" and an Admin caller; turning it on sets the eight-hour auto-off
  /// time. Every on/off is written to the change log.
  public func setDemoMode(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    enabled : Bool,
    confirmation : Text,
  ) : Demo.DemoActionResult {
    Auth.requireRealAdmin(accessGrants, caller);
    let now = Time.now();
    refreshAutoOff(demoState, changeLog, counters, now);
    if (enabled) {
      if (confirmation != confirmWord) {
        return #err("Type DEMO to confirm");
      };
      demoState.enabled := true;
      demoState.turnedOnAt := ?now;
      demoState.autoOffAt := ?(now + eightHoursNs);
      ignore ChangeLog.record(changeLog, counters, caller, "demoModeOn", null, false, "Demo mode turned on");
    } else {
      turnOff(demoState);
      ignore ChangeLog.record(changeLog, counters, caller, "demoModeOff", null, false, "Demo mode turned off");
    };
    #ok(toView(demoState, now));
  };

  /// Set the impersonated demo role and, for a demo NSO Trainer, the stations
  /// that role may see. Any signed-in caller may choose a demo role while demo
  /// mode is on; the backend enforces the same permission rules for the
  /// impersonated role as for a real user with that role.
  public func setDemoRole(
    demoState : Common.DemoState,
    caller : Principal,
    role : Demo.DemoRole,
    stations : [Common.PositionId],
  ) : Demo.DemoActionResult {
    if (caller.isAnonymous()) {
      return #err("Sign in to choose a demo role");
    };
    let now = Time.now();
    if (not isOn(demoState, now)) {
      return #err("Demo mode is off");
    };
    demoState.demoRole := role;
    demoState.demoTrainerStations := stations;
    #ok(toView(demoState, now));
  };

  /// Set or clear the pretend "now" used while demo mode is on. Null restores
  /// the real clock.
  public func setPretendDate(
    demoState : Common.DemoState,
    caller : Principal,
    pretendDate : ?Demo.PretendDate,
  ) : Demo.DemoActionResult {
    if (caller.isAnonymous()) {
      return #err("Sign in to set a pretend date");
    };
    let now = Time.now();
    if (not isOn(demoState, now)) {
      return #err("Demo mode is off");
    };
    demoState.pretendDate := pretendDate;
    #ok(toView(demoState, now));
  };

  /// Count the demo records currently loaded, so the admin UI can show what
  /// "Clear demo data" would remove.
  public func getDemoDataSummary(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    signups : Map.Map<Common.SignupId, Signup.SignupSubmission>,
    crews : Map.Map<Common.CrewId, Roadie.Crew>,
    attendance : Map.Map<Nat, Phase23.AttendanceRecord>,
    trainerNotes : Map.Map<Nat, Phase23.TrainerNote>,
  ) : Demo.DemoDataSummary {
    {
      roadies = roadies.values().filter(func(r) = r.isDemo).size();
      signups = signups.values().filter(func(s) = s.isDemo).size();
      crews = crews.values().filter(func(c) = c.isDemo).size();
      leaders = accessGrants.values().filter(func(g) = isDemoLeader(g)).size();
      attendance = attendance.values().filter(func(a) = a.isDemo).size();
      notes = trainerNotes.values().filter(func(n) = n.isDemo).size();
    };
  };

  /// Internal: true when an access grant is a seeded demo leader. Demo leaders
  /// are marked by a sentinel work email so their real-looking home store
  /// number can still be shown.
  func isDemoLeader(grant : Access.AccessGrant) : Bool {
    switch (grant.staffProfile) {
      case (?p) { p.workEmail == ?demoLeaderMarker };
      case null { false };
    };
  };

  /// Seed the demo data set (Admin, demo mode only): about 40 roadies spread
  /// across positions with illustrated avatars and full About Me answers, a mix
  /// of statuses, 2 minors and 2 archived; 3 crews; 4 leaders; and 3 pending
  /// kiosk sign-ups including one phone duplicate. Returns the new counts.
  /// Idempotent: loading again does not duplicate the seed.
  public func loadDemoData(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    signups : Map.Map<Common.SignupId, Signup.SignupSubmission>,
    crews : Map.Map<Common.CrewId, Roadie.Crew>,
    attendance : Map.Map<Nat, Phase23.AttendanceRecord>,
    trainerNotes : Map.Map<Nat, Phase23.TrainerNote>,
    positions : Map.Map<Common.PositionId, Store.Position>,
    storeInfo : { var value : Store.StoreInfo },
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
  ) : Demo.DemoDataSummary {
    Auth.requireRealAdmin(accessGrants, caller);
    let now = Time.now();
    refreshAutoOff(demoState, changeLog, counters, now);
    if (not isOn(demoState, now)) {
      return getDemoDataSummary(accessGrants, roadies, signups, crews, attendance, trainerNotes);
    };
    // Idempotent: if any demo roadie already exists, the seed is already loaded.
    if (roadies.values().any(func(r) = r.isDemo)) {
      return getDemoDataSummary(accessGrants, roadies, signups, crews, attendance, trainerNotes);
    };

    let openingDate = storeInfo.value.openingDate;

    // --- Crews (3) ---
    let crewNames = ["Opening Crew", "Training Crew", "Friends & Family Crew"];
    var crewIds : [Common.CrewId] = [];
    for (name in crewNames.values()) {
      let id = counters.nextCrewId;
      counters.nextCrewId := id + 1;
      crews.add(id, { id; name; leaderPrincipal = null; isDemo = true });
      crewIds := crewIds.concat([id]);
    };

    // --- Leaders (4): Legend, Platinum, 2 Gold trainers ---
    // Stored as demo access grants so they appear on the Leaders page; marked
    // by a DEMO home-store number so they are counted and cleared as demo data.
    seedLeader(accessGrants, "Legend Leader", #leadership, "Legend", [], null, null);
    seedLeader(accessGrants, "Platinum Leader", #storeManager, "Platinum", [], null, null);
    seedLeader(accessGrants, "Gold Trainer One", #trainer, "Gold", [0, 1], ?"Store 512", ?"Store 512");
    seedLeader(accessGrants, "Gold Trainer Two", #trainer, "Gold", [2, 3], ?"Store 733", ?"Store 733");

    // --- Roadies (40) ---
    let positionIds = positions.keys().toArray();
    let statuses : [Roadie.RoadieStatus] = [
      #hired, #paperworkDone, #oriented, #inTraining, #certified, #active, #active, #active,
    ];
    var i = 0;
    while (i < 40) {
      let id = counters.nextRoadieId;
      counters.nextRoadieId := id + 1;
      let positionId = if (positionIds.size() == 0) { 0 } else { positionIds[i % positionIds.size()] };
      let status = statuses[i % statuses.size()];
      let isMinor = i == 7 or i == 19;
      let isArchived = i == 11 or i == 29;
      let crewId = if (i % 3 == 0) { ?crewIds[0] } else if (i % 3 == 1) { ?crewIds[1] } else { ?crewIds[2] };
      let name = "Demo Roadie " # (i + 1).toText();
      roadies.add(id, {
        id;
        profile = demoProfile(name, i);
        photo = null;
        mainPositionId = positionId;
        secondPositionId = null;
        crossTrainedPositionId = null;
        crewId;
        orientationEventId = null;
        startDate = ?openingDate;
        status = if (isArchived) { #archived } else { status };
        corporateEmployeeId = null;
        contactSet = ?demoContactSet(i, isMinor);
        isMinor;
        birthdayMonthDay = if (isMinor) { ?"04-12" } else { ?"09-23" };
        archivedReason = if (isArchived) { ?#other("Demo archive") } else { null };
        archivedAt = if (isArchived) { ?now } else { null };
        hiredAt = now;
        hireDate = ?openingDate;
        signedBy = null;
        isDemo = true;
      });
      i += 1;
    };

    // --- Pending kiosk sign-ups (3), one a phone duplicate of another ---
    let duplicatePhone = "555-0100";
    seedSignup(signups, counters, 0, "Demo Signup One", duplicatePhone, "demo1@example.com", now);
    seedSignup(signups, counters, 1, "Demo Signup Two", duplicatePhone, "demo2@example.com", now);
    seedSignup(signups, counters, 2, "Demo Signup Three", "555-0199", "demo3@example.com", now);

    ignore ChangeLog.record(changeLog, counters, caller, "loadDemoData", null, false, "Loaded demo data");
    getDemoDataSummary(accessGrants, roadies, signups, crews, attendance, trainerNotes);
  };

  /// Remove every demo record (Admin, demo mode only). Real records are never
  /// touched. Returns the counts that were removed.
  public func clearDemoData(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    signups : Map.Map<Common.SignupId, Signup.SignupSubmission>,
    crews : Map.Map<Common.CrewId, Roadie.Crew>,
    attendance : Map.Map<Nat, Phase23.AttendanceRecord>,
    trainerNotes : Map.Map<Nat, Phase23.TrainerNote>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
  ) : Demo.DemoDataSummary {
    Auth.requireRealAdmin(accessGrants, caller);
    let now = Time.now();
    refreshAutoOff(demoState, changeLog, counters, now);
    if (not isOn(demoState, now)) {
      return getDemoDataSummary(accessGrants, roadies, signups, crews, attendance, trainerNotes);
    };
    let removed = getDemoDataSummary(accessGrants, roadies, signups, crews, attendance, trainerNotes);
    removeWhere(roadies, Nat.compare, func(r) = r.isDemo);
    removeWhere(signups, Nat.compare, func(s) = s.isDemo);
    removeWhere(crews, Nat.compare, func(c) = c.isDemo);
    removeWhere(attendance, Nat.compare, func(a) = a.isDemo);
    removeWhere(trainerNotes, Nat.compare, func(n) = n.isDemo);
    removeWhere(accessGrants, Principal.compare, func(g) = isDemoLeader(g));
    ignore ChangeLog.record(changeLog, counters, caller, "clearDemoData", null, false, "Cleared demo data");
    removed;
  };

  /// Internal: remove every entry whose value satisfies `pred`.
  func removeWhere<K, V>(map : Map.Map<K, V>, compare : (K, K) -> Order.Order, pred : V -> Bool) {
    let doomed = map.entries().filter(func((_, v)) = pred(v)).map(func((k, _)) = k).toArray();
    for (k in doomed.values()) {
      map.remove(k);
    };
  };

  /// Internal: seed one demo leader as a demo access grant.
  func seedLeader(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    name : Text,
    role : Common.Role,
    title : Text,
    stations : [Common.PositionId],
    homeStoreNumber : ?Text,
    homeStoreCity : ?Text,
  ) {
    let owner = Principal.fromText("aaaaa-aa");
    // A distinct synthetic principal per leader keeps them separate records.
    let p = Principal.fromBlob(name.encodeUtf8());
    accessGrants.add(p, {
      principal = p;
      role;
      approvedAt = Time.now();
      approvedBy = owner;
      accessEndsAt = null;
      trainerPositionIds = stations;
      linkedRoadieId = null;
      staffProfile = ?{
        fullName = name;
        requestedRole = role;
        title;
        homeStoreNumber = homeStoreNumber ?? "Demo Store";
        homeStoreCity = homeStoreCity ?? "Demo City";
        preferredName = ?name;
        workPhone = null;
        workEmail = ?demoLeaderMarker;
        photo = null;
        trainerPositionIds = stations;
        arrivalDate = null;
        departureDate = null;
        hometown = ?"Demo Town";
        hobbies = ?"Demo hobbies";
        favoriteTeam = ?"Demo Team";
        favoriteSnack = ?"Demo Snack";
        favoriteDrink = ?"Demo Drink";
        favoriteColor = ?"Demo Color";
        funFact = ?"Demo fun fact";
        goalHere = ?"Demo goal";
        shirtSize = ?"L";
        hatSize = ?"M";
      };
    });
  };

  /// Internal: a full About Me profile for demo roadie `i`.
  func demoProfile(name : Text, i : Nat) : Roadie.RoadieProfile {
    {
      name;
      preferredName = ?("Demo" # (i + 1).toText());
      hometown = ?"Demo Town";
      hobbies = ?"Demo hobbies";
      favoriteMovie = ?"Demo Movie";
      favoriteSnack = ?"Demo Snack";
      favoriteTeam = ?"Demo Team";
      favoriteDrink = ?"Demo Drink";
      favoriteColor = ?"Demo Color";
      funFact = ?"Demo fun fact";
      goalHere = ?"Demo goal";
      positionAppliedFor = ?"Demo Position";
      shirtSize = ?"M";
      hatSize = ?"M";
      shiftsWantedPerWeek = ?4;
      weekdayLunch = ?true;
    };
  };

  /// Internal: a contact set for demo roadie `i`. Demo contact data is fake.
  func demoContactSet(i : Nat, isMinor : Bool) : Roadie.ContactSet {
    {
      phone = "555-01" # pad2(i);
      email = "demo" # i.toText() # "@example.com";
      emergencyContactName = "Demo Emergency";
      emergencyContactPhone = "555-0199";
      dateOfBirth = if (isMinor) { 1_000_000_000_000_000_000 } else { 700_000_000_000_000_000 };
      availability = [];
      availabilitySignature = null;
      availabilitySignedAt = null;
      availabilityResignPending = false;
      managerSignature = null;
      managerSignedAt = null;
      managerSignedBy = null;
    };
  };

  /// Internal: zero-pad a small Nat to two digits.
  func pad2(n : Nat) : Text {
    if (n < 10) { "0" # n.toText() } else { n.toText() };
  };

  /// Internal: seed one pending demo kiosk sign-up.
  func seedSignup(
    signups : Map.Map<Common.SignupId, Signup.SignupSubmission>,
    counters : Counters,
    i : Nat,
    name : Text,
    phone : Text,
    email : Text,
    now : Int,
  ) {
    let id = counters.nextSignupId;
    counters.nextSignupId := id + 1;
    signups.add(id, {
      id;
      submittedAt = now;
      profile = demoProfile(name, i);
      photo = null;
      signature = null;
      contactSet = {
        phone;
        email;
        emergencyContactName = "Demo Emergency";
        emergencyContactPhone = "555-0199";
        dateOfBirth = 700_000_000_000_000_000;
        availability = [];
        availabilitySignature = null;
        availabilitySignedAt = null;
        availabilityResignPending = false;
        managerSignature = null;
        managerSignedAt = null;
        managerSignedBy = null;
      };
      status = #pending;
      isDemo = true;
    });
  };
};
