import Int "mo:core/Int";
import List "mo:core/List";
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Time "mo:core/Time";
import Common "../types/common";
import Store "../types/store";
import Roadie "../types/roadie";
import Phase23 "../types/phase23";
import Access "../types/access";
import Auth "auth";
import ChangeLog "changelog";

module {
  public type Counters = {
    var nextTrainingGroupId : Nat;
    var nextGroupChangeNoticeId : Nat;
    var nextLeaderTalkId : Nat;
    var nextAlertId : Nat;
    var nextAttendanceId : Nat;
    var nextTrainerNoteId : Nat;
    var nextChangeLogId : Nat;
  };

  /// Dashboard summary tiles and per-position progress. `hired` counts pending
  /// + active (archived excluded); `active` and `pending` break that down for
  /// the Hired → Active funnel. Demo records count only while demo mode is on.
  public func getDashboard(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    positions : Map.Map<Common.PositionId, Store.Position>,
    caller : Principal,
  ) : Phase23.DashboardView {
    ignore Auth.requireReadable(accessGrants, demoState, caller);
    let active = roadies.values().filter(func r = r.isDemo == Auth.demoActive(demoState) and r.status != #archived).toArray();
    let hired = active.size();
    let activeCount = active.filter(func r = r.rosterState == #active).size();
    let pendingCount = active.filter(func r = r.rosterState == #pending).size();
    let certified = active.filter(func r = r.status == #certified).size();
    let allPositions = positions.values().toArray();
    let buildToTotal = allPositions.foldLeft(0, func(acc, p) = acc + p.openingBuildTo);
    let stillNeeded = saturatingSub(buildToTotal, hired);
    let foh = allPositions.filter(func p = p.house == #foh);
    let boh = allPositions.filter(func p = p.house == #boh);
    {
      hired;
      active = activeCount;
      pending = pendingCount;
      buildToTotal;
      stillNeeded;
      showedAtOrientation = ?activeCount;
      certified = ?certified;
      foh;
      boh;
    };
  };

  /// Read the orientation check-off for a roadie (Admin/Store Manager only).
  /// Demo check-offs are visible only while demo mode is on.
  public func getOrientationCheckoff(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    checkoffs : Map.Map<Common.RoadieId, Phase23.OrientationCheckoff>,
    caller : Principal,
    roadieId : Common.RoadieId,
  ) : ?Phase23.OrientationCheckoff {
    Auth.requireManager(accessGrants, demoState, caller);
    switch (checkoffs.get(roadieId)) {
      case (?c) {
        if (c.isDemo != Auth.demoActive(demoState)) { return null };
        ?c;
      };
      case null { null };
    };
  };

  /// Record attendance for a roadie at an event or shift (Admin/Store Manager
  /// only). A check-in recorded while demo mode is on is a demo check-in.
  public func recordAttendance(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    attendance : Map.Map<Nat, Phase23.AttendanceRecord>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    record : Phase23.AttendanceRecord,
  ) : () {
    Auth.requireManager(accessGrants, demoState, caller);
    let id = counters.nextAttendanceId;
    counters.nextAttendanceId := id + 1;
    attendance.add(id, { record with recordedAt = effectiveNow(demoState); recordedBy = caller; isDemo = Auth.demoActive(demoState) });
    logWrite(changeLog, counters, demoState, caller, "recordAttendance", ?record.roadieId, false, "Recorded attendance");
  };

  /// List attendance records for an event (Admin/Store Manager only). Demo
  /// check-ins are visible only while demo mode is on.
  public func listAttendanceForEvent(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    attendance : Map.Map<Nat, Phase23.AttendanceRecord>,
    caller : Principal,
    eventId : Common.EventId,
  ) : [Phase23.AttendanceRecord] {
    Auth.requireManager(accessGrants, demoState, caller);
    attendance.values()
      .filter(func a = a.isDemo == Auth.demoActive(demoState) and a.eventId == ?eventId)
      .toArray();
  };

  // --- Orientation check-in screen ---

  /// The orientation check-in screen for one session: the session's assigned
  /// roadies with photo, name, position, crew and paperwork status, plus the
  /// Present x / y counts. Admin, Store Manager, Training Manager and Visiting
  /// Manager may read it.
  public func getOrientationSessionView(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    positions : Map.Map<Common.PositionId, Store.Position>,
    crews : Map.Map<Common.CrewId, Roadie.Crew>,
    schedule : Map.Map<Common.EventId, Store.ScheduleEvent>,
    checklists : { var value : Store.Checklists },
    checkoffs : Map.Map<Common.RoadieId, Phase23.OrientationCheckoff>,
    attendance : Map.Map<Nat, Phase23.AttendanceRecord>,
    caller : Principal,
    eventId : Common.EventId,
  ) : ?Phase23.OrientationSessionView {
    Auth.requireOrientationStaff(accessGrants, demoState, caller);
    let event = schedule.get(eventId) ?? Runtime.trap("Orientation session not found");
    if (event.kind != #orientation) {
      Runtime.trap("Schedule event is not an orientation session");
    };
    let demo = Auth.demoActive(demoState);
    let now = effectiveNow(demoState);
    let assigned = roadies.values()
      .filter(func r = r.isDemo == demo and r.status != #archived and r.orientationEventId == ?eventId)
      .toArray();
    let rows = assigned.map(func(r) {
      let positionName = switch (positions.get(r.mainPositionId)) {
        case (?p) { p.name };
        case null { "" };
      };
      let crewName = switch (r.crewId) {
        case (?cid) {
          switch (crews.get(cid)) {
            case (?c) { ?c.name };
            case null { null };
          };
        };
        case null { null };
      };
      let present = isPresentAt(attendance, demo, r.id, eventId);
      let noShow = r.rosterState == #pending and event.start < now;
      {
        roadieId = r.id;
        name = displayName(r);
        photo = r.photo;
        positionId = r.mainPositionId;
        positionName;
        crewId = r.crewId;
        crewName;
        paperworkStatus = paperworkStatusWith(checklists.value, positions, r, visibleCheckoff(checkoffs, demo, r.id));
        rosterState = r.rosterState;
        present;
        noShow;
      };
    });
    let presentCount = rows.filter(func(row) = row.present).size();
    ?{
      eventId;
      name = event.name;
      start = event.start;
      end = event.end;
      presentCount;
      assignedCount = rows.size();
      roadies = rows;
    };
  };

  /// Mark a roadie Present at an orientation session (Admin, Store Manager,
  /// Training Manager or Visiting Manager). Idempotent: several managers may
  /// call it concurrently and the result converges. Sets the roadie's roster
  /// state to active and records attendance. Rejects an archived roadie. When
  /// the roadie's paperwork is incomplete it traps "Paperwork incomplete"
  /// unless `overrideReason` is a non-empty string and the caller is Admin or
  /// Store Manager; the reason is written into the change log.
  public func markPresent(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    positions : Map.Map<Common.PositionId, Store.Position>,
    checklists : { var value : Store.Checklists },
    checkoffs : Map.Map<Common.RoadieId, Phase23.OrientationCheckoff>,
    attendance : Map.Map<Nat, Phase23.AttendanceRecord>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    roadieId : Common.RoadieId,
    eventId : Common.EventId,
    overrideReason : ?Text,
  ) : () {
    Auth.requireOrientationStaff(accessGrants, demoState, caller);
    let roadie = requireVisibleRoadie(roadies, demoState, roadieId);
    if (roadie.status == #archived) {
      Runtime.trap("Roadie is archived; rehire first");
    };
    let demo = Auth.demoActive(demoState);
    let stored = visibleCheckoff(checkoffs, demo, roadieId);
    let paperworkComplete = paperworkStatusWith(checklists.value, positions, roadie, stored) == #complete;
    var detail = "Marked present at orientation";
    if (not paperworkComplete) {
      let reason = switch (overrideReason) {
        case (?r) { r };
        case null { "" };
      };
      if (reason.size() == 0 or not Auth.isManager(accessGrants, demoState, caller)) {
        Runtime.trap("Paperwork incomplete");
      };
      detail := "Marked present with paperwork override: " # reason;
    };
    // Idempotent: only add an attendance record when none exists yet.
    if (not isPresentAt(attendance, demo, roadieId, eventId)) {
      let id = counters.nextAttendanceId;
      counters.nextAttendanceId := id + 1;
      attendance.add(id, {
        roadieId;
        eventId = ?eventId;
        shift = null;
        state = #present;
        recordedAt = effectiveNow(demoState);
        recordedBy = caller;
        isDemo = demo;
      });
    };
    roadies.add(roadieId, { roadie with rosterState = #active });
    logWrite(changeLog, counters, demoState, caller, "markPresent", ?roadieId, false, detail);
  };

  /// Undo a roadie's Present mark at an orientation session (Admin/Store
  /// Manager only, logged). Returns the roadie to pending and clears the
  /// attendance record for that session.
  public func undoPresent(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    attendance : Map.Map<Nat, Phase23.AttendanceRecord>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    roadieId : Common.RoadieId,
    eventId : Common.EventId,
  ) : () {
    Auth.requireManager(accessGrants, demoState, caller);
    let roadie = requireVisibleRoadie(roadies, demoState, roadieId);
    let demo = Auth.demoActive(demoState);
    removeAttendance(attendance, demo, roadieId, eventId);
    roadies.add(roadieId, { roadie with rosterState = #pending });
    logWrite(changeLog, counters, demoState, caller, "undoPresent", ?roadieId, false, "Undid present at orientation");
  };

  /// Move a roadie to another orientation session (Admin/Store Manager only).
  public func moveRoadieToSession(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    schedule : Map.Map<Common.EventId, Store.ScheduleEvent>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    roadieId : Common.RoadieId,
    eventId : Common.EventId,
  ) : () {
    Auth.requireManager(accessGrants, demoState, caller);
    let roadie = requireVisibleRoadie(roadies, demoState, roadieId);
    let event = schedule.get(eventId) ?? Runtime.trap("Orientation session not found");
    if (event.kind != #orientation) {
      Runtime.trap("Schedule event is not an orientation session");
    };
    roadies.add(roadieId, { roadie with orientationEventId = ?eventId });
    logWrite(changeLog, counters, demoState, caller, "moveRoadieToSession", ?roadieId, false, "Moved roadie to orientation session");
  };

  /// List the orientation sessions available for assignment: every
  /// `#orientation` schedule event, ordered by start. Admin, Store Manager,
  /// Training Manager and Visiting Manager may read it.
  public func listOrientationSessions(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    schedule : Map.Map<Common.EventId, Store.ScheduleEvent>,
    caller : Principal,
  ) : [Phase23.OrientationSessionOption] {
    Auth.requireOrientationStaff(accessGrants, demoState, caller);
    let sessions = schedule.values()
      .filter(func(e) = e.kind == #orientation)
      .map(func(e) = { eventId = e.id; name = e.name; start = e.start; end = e.end })
      .toArray();
    sessions.sort(func(a, b) = Int.compare(a.start, b.start));
  };

  /// List the pending roadies with no usable orientation session: their
  /// `orientationEventId` is null, or points to an event that is missing from
  /// the schedule or is not an `#orientation` event. Each row carries the
  /// roadie's photo, position and crew. Admin, Store Manager, Training Manager
  /// and Visiting Manager may read it.
  public func listUnassignedPendingRoadies(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    positions : Map.Map<Common.PositionId, Store.Position>,
    crews : Map.Map<Common.CrewId, Roadie.Crew>,
    schedule : Map.Map<Common.EventId, Store.ScheduleEvent>,
    caller : Principal,
  ) : [Phase23.UnassignedRoadieRow] {
    Auth.requireOrientationStaff(accessGrants, demoState, caller);
    let demo = Auth.demoActive(demoState);
    roadies.values()
      .filter(func r = r.isDemo == demo and r.status != #archived and r.rosterState == #pending and not hasOrientationSession(schedule, r.orientationEventId))
      .map(func(r) {
        let positionName = switch (positions.get(r.mainPositionId)) {
          case (?p) { p.name };
          case null { "" };
        };
        let crewName = switch (r.crewId) {
          case (?cid) {
            switch (crews.get(cid)) {
              case (?c) { ?c.name };
              case null { null };
            };
          };
          case null { null };
        };
        {
          roadieId = r.id;
          name = displayName(r);
          photo = r.photo;
          positionId = r.mainPositionId;
          positionName;
          crewId = r.crewId;
          crewName;
        };
      })
      .toArray();
  };

  /// Move every non-archived roadie currently assigned to `fromEventId` to
  /// `toEventId` (Admin/Store Manager only, logged). Returns the number moved.
  /// The target must be an existing `#orientation` event. Used to merge two
  /// sessions before deleting the emptied one.
  public func moveAllRoadiesToSession(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    schedule : Map.Map<Common.EventId, Store.ScheduleEvent>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    fromEventId : Common.EventId,
    toEventId : Common.EventId,
  ) : Nat {
    Auth.requireManager(accessGrants, demoState, caller);
    let target = schedule.get(toEventId) ?? Runtime.trap("Orientation session not found");
    if (target.kind != #orientation) {
      Runtime.trap("Schedule event is not an orientation session");
    };
    let demo = Auth.demoActive(demoState);
    let moving = roadies.values()
      .filter(func r = r.isDemo == demo and r.status != #archived and r.orientationEventId == ?fromEventId)
      .toArray();
    for (r in moving.values()) {
      roadies.add(r.id, { r with orientationEventId = ?toEventId });
    };
    let count = moving.size();
    let fromName = switch (schedule.get(fromEventId)) {
      case (?e) { e.name };
      case null { "session " # fromEventId.toText() };
    };
    logWrite(changeLog, counters, demoState, caller, "moveAllRoadiesToSession", null, false, "Moved " # count.toText() # " roadies from " # fromName # " to " # target.name);
    count;
  };

  /// Internal: whether a roadie's assignment names a live orientation session.
  func hasOrientationSession(
    schedule : Map.Map<Common.EventId, Store.ScheduleEvent>,
    orientationEventId : ?Common.EventId,
  ) : Bool {
    switch (orientationEventId) {
      case null { false };
      case (?eventId) {
        switch (schedule.get(eventId)) {
          case (?event) { event.kind == #orientation };
          case null { false };
        };
      };
    };
  };

  /// Archive every no-show at a session (Admin/Store Manager only): roadies
  /// still pending and assigned to that session once its date has passed. They
  /// are archived as NCNS Orientation. Returns the archived roadie ids.
  public func archiveNoShows(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    schedule : Map.Map<Common.EventId, Store.ScheduleEvent>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    eventId : Common.EventId,
  ) : [Common.RoadieId] {
    Auth.requireManager(accessGrants, demoState, caller);
    let event = schedule.get(eventId) ?? Runtime.trap("Orientation session not found");
    if (event.kind != #orientation) {
      Runtime.trap("Schedule event is not an orientation session");
    };
    let demo = Auth.demoActive(demoState);
    let now = effectiveNow(demoState);
    if (event.start >= now) {
      Runtime.trap("Session has not passed yet");
    };
    let noShows = roadies.values()
      .filter(func r = r.isDemo == demo and r.status != #archived and r.rosterState == #pending and r.orientationEventId == ?eventId)
      .toArray();
    for (r in noShows.values()) {
      roadies.add(r.id, { r with status = #archived; archivedReason = ?#ncnsOrientation; archivedAt = ?now });
    };
    logWrite(changeLog, counters, demoState, caller, "archiveNoShows", null, false, "Archived no-shows as NCNS Orientation");
    noShows.map(func r = r.id);
  };

  // --- Uniform check-off ---

  /// The uniform check-off for a roadie (Admin/Store Manager only). Locked
  /// (read-only) until the roadie's paperwork is 100% complete. Shirt and hat
  /// count items pre-fill from the position defaults.
  public func getUniformCheckoff(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    positions : Map.Map<Common.PositionId, Store.Position>,
    checklists : { var value : Store.Checklists },
    checkoffs : Map.Map<Common.RoadieId, Phase23.OrientationCheckoff>,
    caller : Principal,
    roadieId : Common.RoadieId,
  ) : ?Phase23.UniformCheckoffView {
    Auth.requireOrientationStaff(accessGrants, demoState, caller);
    let roadie = requireVisibleRoadie(roadies, demoState, roadieId);
    let demo = Auth.demoActive(demoState);
    let stored = switch (checkoffs.get(roadieId)) {
      case (?c) { if (c.isDemo == demo) { ?c } else { null } };
      case null { null };
    };
    let position = positions.get(roadie.mainPositionId);
    let items = checklists.value.orientationUniform.map(func(item) {
      let checked = switch (stored) {
        case (?c) { c.uniformItems.any(func(t) = t == item.id.toText()) };
        case null { false };
      };
      let count = switch (stored) {
        case (?c) {
          switch (c.uniformCounts.find(func((iid, _)) = iid == item.id)) {
            case (?(_, n)) { n };
            case null { defaultCount(item, position) };
          };
        };
        case null { defaultCount(item, position) };
      };
      {
        itemId = item.id;
        text = item.text;
        itemType = item.itemType;
        checked;
        count;
      };
    });
    let missing = items.filter(func(i) = not itemSatisfied(i)).map(func(i) = i.text);
    let complete = missing.size() == 0;
    let locked = paperworkStatusWith(checklists.value, positions, roadie, stored) == #incomplete;
    ?{ roadieId; locked; complete; missing; items };
  };

  /// Save the uniform check-off for a roadie (Admin, Store Manager, Training
  /// Manager or Visiting Manager). Updates only the uniform fields and keeps
  /// the roadie's paperwork items, so a uniform save never clobbers paperwork.
  /// The check-off is locked until the roadie's paperwork is 100% complete.
  /// Creates the check-off record when it is missing, with the active `isDemo`.
  public func saveUniformCheckoff(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    positions : Map.Map<Common.PositionId, Store.Position>,
    checklists : { var value : Store.Checklists },
    checkoffs : Map.Map<Common.RoadieId, Phase23.OrientationCheckoff>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    roadieId : Common.RoadieId,
    uniformItems : [Text],
    uniformCounts : [(Nat, Nat)],
  ) : () {
    Auth.requireOrientationStaff(accessGrants, demoState, caller);
    let roadie = requireVisibleRoadie(roadies, demoState, roadieId);
    let demo = Auth.demoActive(demoState);
    let existing = visibleCheckoff(checkoffs, demo, roadieId);
    if (paperworkStatusWith(checklists.value, positions, roadie, existing) == #incomplete) {
      Runtime.trap("Paperwork incomplete");
    };
    let base = switch (existing) {
      case (?c) { c };
      case null {
        {
          roadieId;
          uniformItems = [];
          uniformCounts = [];
          paperworkItems = [];
          shirtsCount = 0;
          hatsCount = 0;
          updatedAt = 0;
          isDemo = demo;
        };
      };
    };
    // Update only the uniform fields; keep the roadie's paperwork items.
    checkoffs.add(roadieId, {
      base with
      uniformItems;
      uniformCounts;
      updatedAt = effectiveNow(demoState);
    });
    logWrite(changeLog, counters, demoState, caller, "saveUniformCheckoff", ?roadieId, false, "Saved uniform check-off");
  };

  /// Set the paperwork items for a roadie (Admin or Store Manager only, logged).
  /// Updates only `paperworkItems` and keeps the uniform fields, so a paperwork
  /// save never clobbers the uniform check-off. Creates the check-off record
  /// when it is missing, with the active `isDemo`.
  public func setPaperworkItems(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    checkoffs : Map.Map<Common.RoadieId, Phase23.OrientationCheckoff>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    roadieId : Common.RoadieId,
    paperworkItems : [Text],
  ) : () {
    Auth.requireManager(accessGrants, demoState, caller);
    let roadie = requireVisibleRoadie(roadies, demoState, roadieId);
    let demo = Auth.demoActive(demoState);
    let existing = visibleCheckoff(checkoffs, demo, roadieId);
    let base = switch (existing) {
      case (?c) { c };
      case null {
        {
          roadieId;
          uniformItems = [];
          uniformCounts = [];
          paperworkItems = [];
          shirtsCount = 0;
          hatsCount = 0;
          updatedAt = 0;
          isDemo = demo;
        };
      };
    };
    // Update only the paperwork items; keep the roadie's uniform fields.
    checkoffs.add(roadieId, {
      base with
      paperworkItems;
      updatedAt = effectiveNow(demoState);
    });
    logWrite(changeLog, counters, demoState, caller, "setPaperworkItems", ?roadieId, false, "Set paperwork items");
  };

  // --- Shift boards ---

  /// The map key for one shift board: the partition, the event id and the
  /// shift, so a demo board and a real board for the same event and shift never
  /// collide. Matches the migration and the OQL entity key.
  func boardKey(eventId : Common.EventId, shift : Common.Shift, isDemo : Bool) : Text {
    (if (isDemo) { "demo:" } else { "real:" })
      # eventId.toText()
      # ":"
      # (switch shift { case (#am) "am"; case (#pm) "pm" });
  };

  /// Internal: the shift label for a board, e.g. "Day 2 AM" or "F&F PM".
  func shiftLabel(event : ?Store.ScheduleEvent, shift : Common.Shift) : Text {
    let suffix = switch (shift) { case (#am) "AM"; case (#pm) "PM" };
    switch (event) {
      case (?e) { e.name # " " # suffix };
      case null { suffix };
    };
  };

  /// Internal: the weekday of a timestamp in store time. The store's opening
  /// schedule is authored in UTC-midnight dates, so the weekday is derived from
  /// the UTC date.
  func weekdayOf(ts : Common.Timestamp) : Common.Weekday {
    // 1970-01-01 was a Thursday. Days since epoch modulo 7 gives the weekday.
    let days = ts / 86_400_000_000_000;
    let rem = days % 7;
    let r = if (rem < 0) { rem + 7 } else { rem };
    if (r == 0) { #thu }
    else if (r == 1) { #fri }
    else if (r == 2) { #sat }
    else if (r == 3) { #sun }
    else if (r == 4) { #mon }
    else if (r == 5) { #tue }
    else { #wed };
  };

  /// Internal: whether a roadie marked themselves unavailable for the given
  /// weekday and shift on the kiosk. A roadie with no contact set or no
  /// availability is treated as available.
  func markedUnavailable(roadie : Roadie.Roadie, day : Common.Weekday, shift : Common.Shift) : Bool {
    switch (roadie.contactSet) {
      case (?cs) {
        let slots = cs.availability;
        // Unavailable when the roadie has at least one availability slot and
        // none of them covers this weekday and shift.
        if (slots.size() == 0) { return false };
        not slots.any(func(s) = s.day == day and s.shift == shift);
      };
      case null { false };
    };
  };

  /// Internal: build one roadie chip for a shift board.
  func roadieChip(
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    positions : Map.Map<Common.PositionId, Store.Position>,
    day : Common.Weekday,
    shift : Common.Shift,
    roadieId : Common.RoadieId,
  ) : ?Phase23.ShiftBoardRoadie {
    switch (roadies.get(roadieId)) {
      case (?r) {
        let positionCode = switch (positions.get(r.mainPositionId)) {
          case (?p) { p.code };
          case null { "" };
        };
        ?{
          roadieId = r.id;
          name = displayName(r);
          photo = r.photo;
          positionId = r.mainPositionId;
          positionCode;
          markedUnavailable = markedUnavailable(r, day, shift);
        };
      };
      case null { null };
    };
  };

  /// Internal: build the full read view of a board.
  func buildBoardView(
    board : Phase23.ShiftBoard,
    event : ?Store.ScheduleEvent,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    positions : Map.Map<Common.PositionId, Store.Position>,
  ) : Phase23.ShiftBoardView {
    let day = switch (event) {
      case (?e) { weekdayOf(e.start) };
      case null { #wed };
    };
    let shift = board.shift;
    let groups = board.groups.map(func(g) {
      let chips = g.roadieIds.filterMap(func(rid) = roadieChip(roadies, positions, day, shift, rid));
      {
        trainerPrincipal = g.trainerPrincipal;
        capacity = g.capacity;
        roadies = chips;
      };
    });
    // Every roadie id already placed in a group or in Off.
    let placed = List.empty<Common.RoadieId>();
    for (g in board.groups.values()) {
      for (rid in g.roadieIds.values()) { placed.add(rid) };
    };
    for (rid in board.offRoadieIds.values()) { placed.add(rid) };
    let offThisShift = board.offRoadieIds.filterMap(func(rid) = roadieChip(roadies, positions, day, shift, rid));
    // Unassigned: active roadies in the partition not placed in a group or Off.
    let unassigned = roadies.values()
      .filter(func r =
        r.isDemo == board.isDemo
        and r.status != #archived
        and r.rosterState == #active
        and not placed.contains(r.id)
      )
      .map(func(r) {
        let positionCode = switch (positions.get(r.mainPositionId)) {
          case (?p) { p.code };
          case null { "" };
        };
        {
          roadieId = r.id;
          name = displayName(r);
          photo = r.photo;
          positionId = r.mainPositionId;
          positionCode;
          markedUnavailable = markedUnavailable(r, day, shift);
        };
      })
      .toArray();
    {
      eventId = board.eventId;
      shift = board.shift;
      groups;
      unassigned;
      offThisShift;
      editedAt = board.editedAt;
      isDemo = board.isDemo;
    };
  };

  /// Read one shift board with its trainer columns, Unassigned tray and Off
  /// this shift tray. Read-only for every read role except kiosk and
  /// integration. Demo boards are visible only while demo mode is on.
  public func getShiftBoard(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    shiftBoards : Map.Map<Text, Phase23.ShiftBoard>,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    positions : Map.Map<Common.PositionId, Store.Position>,
    schedule : Map.Map<Common.EventId, Store.ScheduleEvent>,
    caller : Principal,
    eventId : Common.EventId,
    shift : Common.Shift,
  ) : ?Phase23.ShiftBoardView {
    ignore Auth.requireReadable(accessGrants, demoState, caller);
    let demo = Auth.demoActive(demoState);
    switch (shiftBoards.get(boardKey(eventId, shift, demo))) {
      case (?board) {
        if (board.isDemo != demo) { return null };
        ?buildBoardView(board, schedule.get(eventId), roadies, positions);
      };
      case null { null };
    };
  };

  /// List every shift board for the current partition, ordered by event and
  /// shift. Read-only for every read role except kiosk and integration.
  public func listShiftBoards(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    shiftBoards : Map.Map<Text, Phase23.ShiftBoard>,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    positions : Map.Map<Common.PositionId, Store.Position>,
    schedule : Map.Map<Common.EventId, Store.ScheduleEvent>,
    caller : Principal,
  ) : [Phase23.ShiftBoardView] {
    ignore Auth.requireReadable(accessGrants, demoState, caller);
    let demo = Auth.demoActive(demoState);
    let boards = shiftBoards.values()
      .filter(func b = b.isDemo == demo)
      .toArray();
    let views = boards.map(func(b) = buildBoardView(b, schedule.get(b.eventId), roadies, positions));
    views.sort(func(a, b) {
      let c = Int.compare(a.eventId, b.eventId);
      if (c != #equal) { c } else {
        let sa = switch (a.shift) { case (#am) 0; case (#pm) 1 };
        let sb = switch (b.shift) { case (#am) 0; case (#pm) 1 };
        Int.compare(sa, sb);
      };
    });
  };

  /// Internal: reject a board whose roadies appear in more than one group or in
  /// both a group and Off.
  func validateBoard(board : Phase23.ShiftBoard) : () {
    let seen = List.empty<Common.RoadieId>();
    for (g in board.groups.values()) {
      for (rid in g.roadieIds.values()) {
        if (seen.contains(rid)) {
          Runtime.trap("A roadie may appear in at most one group or in Off");
        };
        seen.add(rid);
      };
    };
    for (rid in board.offRoadieIds.values()) {
      if (seen.contains(rid)) {
        Runtime.trap("A roadie may appear in at most one group or in Off");
      };
      seen.add(rid);
    };
  };

  /// Internal: the roles a trainer principal may hold to lead a group on a
  /// board.
  func isTrainerRole(role : Common.Role) : Bool {
    role == #admin
      or role == #storeManager
      or role == #trainingManager
      or role == #trainer
      or role == #visitingManager;
  };

  /// Internal: reject a board whose roadies or trainers are not valid for the
  /// active partition. Every roadie id must exist, be in the active partition
  /// and not be archived. Every trainer principal must hold an access grant
  /// with a trainer-capable role; in demo mode a demo leader is accepted.
  func validateBoardMembers(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    board : Phase23.ShiftBoard,
  ) : () {
    let demo = Auth.demoActive(demoState);
    for (g in board.groups.values()) {
      if (not trainerAllowed(accessGrants, demoState, g.trainerPrincipal)) {
        Runtime.trap("Trainer is not eligible to lead a group");
      };
      for (rid in g.roadieIds.values()) {
        requireBoardRoadie(roadies, demo, rid);
      };
    };
    for (rid in board.offRoadieIds.values()) {
      requireBoardRoadie(roadies, demo, rid);
    };
  };

  /// Internal: require a roadie id to name an existing, non-archived roadie in
  /// the active partition.
  func requireBoardRoadie(
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    demo : Bool,
    rid : Common.RoadieId,
  ) : () {
    let roadie = roadies.get(rid) ?? Runtime.trap("Roadie not found on this board");
    if (roadie.isDemo != demo) {
      Runtime.trap("Roadie belongs to the other partition");
    };
    if (roadie.status == #archived) {
      Runtime.trap("Roadie is archived");
    };
  };

  /// Internal: whether a principal may lead a group on a board. In demo mode a
  /// demo leader is accepted; otherwise the principal must hold an access grant
  /// with a trainer-capable role.
  func trainerAllowed(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    trainer : Principal,
  ) : Bool {
    if (Auth.demoActive(demoState)) {
      switch (accessGrants.get(trainer)) {
        case (?grant) { Auth.isDemoLeader(grant) };
        case null { false };
      };
    } else {
      switch (accessGrants.get(trainer)) {
        case (?grant) { isTrainerRole(grant.role) };
        case null { false };
      };
    };
  };

  /// Internal: the display name for a principal, from their access grant's
  /// staff profile, falling back to a short principal form.
  func principalName(accessGrants : Map.Map<Principal, Access.AccessGrant>, p : Principal) : Text {
    switch (accessGrants.get(p)) {
      case (?grant) {
        switch (grant.staffProfile) {
          case (?sp) {
            switch (sp.preferredName) {
              case (?pn) { if (pn.size() > 0) { pn } else { sp.fullName } };
              case null { sp.fullName };
            };
          };
          case null { p.toText() };
        };
      };
      case null { p.toText() };
    };
  };

  /// Internal: record a group-change notice for each trainer whose group
  /// membership changed between the previous board and the new one, for a
  /// current or future shift. `event` supplies the shift label; `now` is the
  /// effective clock.
  func recordGroupChanges(
    groupChangeNotices : Map.Map<Nat, Phase23.GroupChangeNotice>,
    counters : Counters,
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    demoState : Common.DemoState,
    previous : ?Phase23.ShiftBoard,
    next : Phase23.ShiftBoard,
    event : ?Store.ScheduleEvent,
    editor : Principal,
  ) : () {
    // Only current or future shifts produce notices.
    switch (event) {
      case (?e) {
        if (e.start < effectiveNow(demoState)) { return };
      };
      case null { return };
    };
    let shiftText = shiftLabel(event, next.shift);
    let editorName = principalName(accessGrants, editor);
    let demo = Auth.demoActive(demoState);
    // The set of trainers on the previous board, so a trainer removed entirely
    // still gets a notice.
    let trainers = List.empty<Principal>();
    switch (previous) {
      case (?p) {
        for (g in p.groups.values()) {
          if (not trainers.contains(g.trainerPrincipal)) { trainers.add(g.trainerPrincipal) };
        };
      };
      case null {};
    };
    for (g in next.groups.values()) {
      if (not trainers.contains(g.trainerPrincipal)) { trainers.add(g.trainerPrincipal) };
    };
    for (trainer in trainers.values()) {
      let before = groupRoadieIds(previous, trainer);
      let after = groupRoadieIds(?next, trainer);
      let added = after.filter(func(rid) = not before.contains(rid));
      let removed = before.filter(func(rid) = not after.contains(rid));
      if (added.size() > 0 or removed.size() > 0) {
        let id = counters.nextGroupChangeNoticeId;
        counters.nextGroupChangeNoticeId := id + 1;
        groupChangeNotices.add(id, {
          id;
          trainerPrincipal = trainer;
          eventId = next.eventId;
          shift = next.shift;
          shiftLabel = shiftText;
          addedNames = added.map(func(rid) = roadieName(roadies, rid));
          removedNames = removed.map(func(rid) = roadieName(roadies, rid));
          editorName;
          createdAt = effectiveNow(demoState);
          dismissed = false;
          isDemo = demo;
        });
      };
    };
  };

  /// Internal: the roadie ids in one trainer's group on a board, or an empty
  /// array when the trainer has no group.
  func groupRoadieIds(board : ?Phase23.ShiftBoard, trainer : Principal) : [Common.RoadieId] {
    switch (board) {
      case (?b) {
        switch (b.groups.find(func(g) = g.trainerPrincipal == trainer)) {
          case (?g) { g.roadieIds };
          case null { [] };
        };
      };
      case null { [] };
    };
  };

  /// Internal: a roadie's display name, or a fallback when the roadie is gone.
  func roadieName(roadies : Map.Map<Common.RoadieId, Roadie.Roadie>, id : Common.RoadieId) : Text {
    switch (roadies.get(id)) {
      case (?r) { displayName(r) };
      case null { "Roadie " # id.toText() };
    };
  };

  /// Replace one shift board's groups, capacities and Off list (Admin, Store
  /// Manager or Training Manager). Rejects a roadie placed in more than one
  /// group or in both a group and Off. Real boards are blocked by the demo
  /// real-settings guard while demo mode is on; demo boards stay editable.
  public func saveShiftBoard(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    shiftBoards : Map.Map<Text, Phase23.ShiftBoard>,
    groupChangeNotices : Map.Map<Nat, Phase23.GroupChangeNotice>,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    schedule : Map.Map<Common.EventId, Store.ScheduleEvent>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    board : Phase23.ShiftBoard,
  ) : () {
    Auth.requireGroupEditor(accessGrants, demoState, caller);
    let demo = Auth.demoActive(demoState);
    validateBoard(board);
    validateBoardMembers(accessGrants, demoState, roadies, board);
    let key = boardKey(board.eventId, board.shift, demo);
    let previous = shiftBoards.get(key);
    // A write targets the current partition only: a real board cannot be
    // changed while demo mode is on, and a demo board cannot be changed while
    // it is off.
    switch (previous) {
      case (?p) {
        if (p.isDemo != demo) {
          Runtime.trap("Shift board belongs to the other partition");
        };
      };
      case null {};
    };
    let stored : Phase23.ShiftBoard = {
      board with
      editedAt = effectiveNow(demoState);
      isDemo = demo;
    };
    shiftBoards.add(key, stored);
    recordGroupChanges(groupChangeNotices, counters, accessGrants, roadies, demoState, previous, stored, schedule.get(board.eventId), caller);
    logWrite(changeLog, counters, demoState, caller, "saveShiftBoard", null, false, "Saved shift board " # key);
  };

  /// Copy another shift's groups, capacities and Off list onto this shift,
  /// replacing the current board (Admin, Store Manager or Training Manager).
  public func copyShiftBoard(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    shiftBoards : Map.Map<Text, Phase23.ShiftBoard>,
    groupChangeNotices : Map.Map<Nat, Phase23.GroupChangeNotice>,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    schedule : Map.Map<Common.EventId, Store.ScheduleEvent>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    eventId : Common.EventId,
    shift : Common.Shift,
    fromEventId : Common.EventId,
    fromShift : Common.Shift,
  ) : () {
    Auth.requireGroupEditor(accessGrants, demoState, caller);
    let demo = Auth.demoActive(demoState);
    let source = shiftBoards.get(boardKey(fromEventId, fromShift, demo)) ?? Runtime.trap("Source shift board not found");
    if (source.isDemo != demo) {
      Runtime.trap("Source shift board not found");
    };
    let key = boardKey(eventId, shift, demo);
    let previous = shiftBoards.get(key);
    switch (previous) {
      case (?p) {
        if (p.isDemo != demo) {
          Runtime.trap("Shift board belongs to the other partition");
        };
      };
      case null {};
    };
    let stored : Phase23.ShiftBoard = {
      eventId;
      shift;
      groups = source.groups;
      offRoadieIds = source.offRoadieIds;
      editedAt = effectiveNow(demoState);
      isDemo = demo;
    };
    validateBoard(stored);
    shiftBoards.add(key, stored);
    recordGroupChanges(groupChangeNotices, counters, accessGrants, roadies, demoState, previous, stored, schedule.get(eventId), caller);
    logWrite(changeLog, counters, demoState, caller, "copyShiftBoard", null, false, "Copied shift board " # boardKey(fromEventId, fromShift, demo) # " to " # key);
  };

  /// Fill empty capacity from the Unassigned tray: same station as the trainer
  /// first, only roadies available that shift, then balanced evenly. Never
  /// moves an already-placed roadie (Admin, Store Manager or Training Manager).
  public func autoFillShiftBoard(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    shiftBoards : Map.Map<Text, Phase23.ShiftBoard>,
    groupChangeNotices : Map.Map<Nat, Phase23.GroupChangeNotice>,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    positions : Map.Map<Common.PositionId, Store.Position>,
    schedule : Map.Map<Common.EventId, Store.ScheduleEvent>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    eventId : Common.EventId,
    shift : Common.Shift,
  ) : () {
    Auth.requireGroupEditor(accessGrants, demoState, caller);
    let demo = Auth.demoActive(demoState);
    let key = boardKey(eventId, shift, demo);
    let board = shiftBoards.get(key) ?? Runtime.trap("Shift board not found");
    if (board.isDemo != demo) {
      Runtime.trap("Shift board not found");
    };
    // The roadies already placed on this board are never moved.
    let placed = List.empty<Common.RoadieId>();
    for (g in board.groups.values()) {
      for (rid in g.roadieIds.values()) { placed.add(rid) };
    };
    for (rid in board.offRoadieIds.values()) { placed.add(rid) };
    // Candidate pool: active roadies in the partition, not placed, available
    // that shift. Availability is by weekday; the weekday comes from the
    // event's start date.
    let day = switch (schedule.get(eventId)) {
      case (?e) { weekdayOf(e.start) };
      case null { #wed };
    };
    let candidates = roadies.values()
      .filter(func r =
        r.isDemo == demo
        and r.status != #archived
        and r.rosterState == #active
        and not placed.contains(r.id)
        and not markedUnavailable(r, day, shift)
      )
      .toArray();
    // Deal candidates round-robin across the groups that still have open
    // capacity, so no group is filled to capacity before the next gets a
    // roadie. The same-station pass runs first: in each round every group with
    // open capacity takes one candidate whose main position is one of the
    // trainer's stations; then the any pass fills the remaining seats the same
    // way. A candidate is consumed once, tracked in `used`.
    let used = List.empty<Common.RoadieId>();
    let working = List.fromArray<Phase23.ShiftBoardGroup>(board.groups.map(func(g) { { g with roadieIds = g.roadieIds } }));
    // The stations each group's trainer covers, computed once per group.
    let stations = working.map<Phase23.ShiftBoardGroup, [Common.PositionId]>(func(g) = trainerStationsFor(accessGrants, demoState, g.trainerPrincipal));
    // Same-station pass.
    var progressed = true;
    while (progressed) {
      progressed := false;
      var gi = 0;
      while (gi < working.size()) {
        let g = working.at(gi);
        if (g.roadieIds.size() < g.capacity) {
          let trainerStations = stations.at(gi);
          switch (candidates.find(func c = not used.contains(c.id) and trainerStations.contains(c.mainPositionId))) {
            case (?c) {
              used.add(c.id);
              working.put(gi, { g with roadieIds = g.roadieIds.concat([c.id]) });
              progressed := true;
            };
            case null {};
          };
        };
        gi += 1;
      };
    };
    // Any-candidate pass.
    var progressedAny = true;
    while (progressedAny) {
      progressedAny := false;
      var gi = 0;
      while (gi < working.size()) {
        let g = working.at(gi);
        if (g.roadieIds.size() < g.capacity) {
          switch (candidates.find(func c = not used.contains(c.id))) {
            case (?c) {
              used.add(c.id);
              working.put(gi, { g with roadieIds = g.roadieIds.concat([c.id]) });
              progressedAny := true;
            };
            case null {};
          };
        };
        gi += 1;
      };
    };
    let newGroups = working.toArray();
    let stored : Phase23.ShiftBoard = {
      board with
      groups = newGroups;
      editedAt = effectiveNow(demoState);
    };
    validateBoard(stored);
    shiftBoards.add(key, stored);
    recordGroupChanges(groupChangeNotices, counters, accessGrants, roadies, demoState, ?board, stored, schedule.get(eventId), caller);
    logWrite(changeLog, counters, demoState, caller, "autoFillShiftBoard", null, false, "Auto-filled shift board " # key);
  };

  /// Internal: the stations a trainer covers, from their access grant (or their
  /// demo stations while demo mode is on).
  func trainerStationsFor(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    trainer : Principal,
  ) : [Common.PositionId] {
    if (Auth.demoActive(demoState)) {
      Auth.demoTrainerStationsFor(demoState, trainer);
    } else {
      switch (accessGrants.get(trainer)) {
        case (?grant) { grant.trainerPositionIds };
        case null { [] };
      };
    };
  };

  /// Clear one shift board's groups and Off list (Admin, Store Manager or
  /// Training Manager).
  public func clearShiftBoard(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    shiftBoards : Map.Map<Text, Phase23.ShiftBoard>,
    groupChangeNotices : Map.Map<Nat, Phase23.GroupChangeNotice>,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    schedule : Map.Map<Common.EventId, Store.ScheduleEvent>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    eventId : Common.EventId,
    shift : Common.Shift,
  ) : () {
    Auth.requireGroupEditor(accessGrants, demoState, caller);
    let demo = Auth.demoActive(demoState);
    let key = boardKey(eventId, shift, demo);
    let previous = shiftBoards.get(key);
    switch (previous) {
      case (?p) {
        if (p.isDemo != demo) {
          Runtime.trap("Shift board belongs to the other partition");
        };
      };
      case null {};
    };
    let stored : Phase23.ShiftBoard = {
      eventId;
      shift;
      groups = [];
      offRoadieIds = [];
      editedAt = effectiveNow(demoState);
      isDemo = demo;
    };
    shiftBoards.add(key, stored);
    recordGroupChanges(groupChangeNotices, counters, accessGrants, roadies, demoState, previous, stored, schedule.get(eventId), caller);
    logWrite(changeLog, counters, demoState, caller, "clearShiftBoard", null, false, "Cleared shift board " # key);
  };

  /// List the caller's undismissed group-change notices, newest first.
  public func listGroupChangeNotices(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    groupChangeNotices : Map.Map<Nat, Phase23.GroupChangeNotice>,
    caller : Principal,
  ) : [Phase23.GroupChangeNotice] {
    ignore Auth.requireReadable(accessGrants, demoState, caller);
    let demo = Auth.demoActive(demoState);
    let notices = groupChangeNotices.values()
      .filter(func n = n.isDemo == demo and n.trainerPrincipal == caller and not n.dismissed)
      .toArray();
    notices.sort(func(a, b) = Int.compare(b.createdAt, a.createdAt));
  };

  /// Dismiss one of the caller's own group-change notices.
  public func dismissGroupChangeNotice(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    groupChangeNotices : Map.Map<Nat, Phase23.GroupChangeNotice>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    id : Nat,
  ) : () {
    ignore Auth.requireReadable(accessGrants, demoState, caller);
    let notice = groupChangeNotices.get(id) ?? Runtime.trap("Group change notice not found");
    if (notice.isDemo != Auth.demoActive(demoState) or notice.trainerPrincipal != caller) {
      Runtime.trap("Group change notice not found");
    };
    groupChangeNotices.add(id, { notice with dismissed = true });
    logWrite(changeLog, counters, demoState, caller, "dismissGroupChangeNotice", null, false, "Dismissed group change notice");
  };

  /// The caller's own group for the current or next shift, for the Today
  /// screen. Returns null when the caller trains no group on that shift.
  public func getMyGroup(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    shiftBoards : Map.Map<Text, Phase23.ShiftBoard>,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    positions : Map.Map<Common.PositionId, Store.Position>,
    schedule : Map.Map<Common.EventId, Store.ScheduleEvent>,
    caller : Principal,
  ) : ?Phase23.MyGroupView {
    ignore Auth.requireReadable(accessGrants, demoState, caller);
    let demo = Auth.demoActive(demoState);
    let now = effectiveNow(demoState);
    // Find the caller's group on the current or next shift by time. Event ids
    // are creation order, not time order, so compare each candidate event's
    // start against the effective clock: the earliest shift at or after now,
    // falling back to the latest past shift when every shift has passed.
    var best : ?(Common.EventId, Common.Shift, Phase23.ShiftBoardGroup, Common.Timestamp) = null;
    for (board in shiftBoards.values()) {
      if (board.isDemo == demo) {
        switch (board.groups.find(func(g) = g.trainerPrincipal == caller)) {
          case (?g) {
            switch (schedule.get(board.eventId)) {
              case (?event) {
                let better = switch (best) {
                  case (?b) {
                    let (_, _, _, bestStart) = b;
                    let bestUpcoming = bestStart >= now;
                    let candUpcoming = event.start >= now;
                    if (candUpcoming and not bestUpcoming) {
                      true;
                    } else if (bestUpcoming and not candUpcoming) {
                      false;
                    } else if (candUpcoming) {
                      // Both upcoming: the earlier start wins; AM before PM on a tie.
                      let c = Int.compare(event.start, bestStart);
                      if (c == #less) { true } else if (c == #greater) { false } else {
                        let sa = switch (board.shift) { case (#am) 0; case (#pm) 1 };
                        let sb = switch (b.1) { case (#am) 0; case (#pm) 1 };
                        sa < sb;
                      };
                    } else {
                      // Both past: the later start wins; PM after AM on a tie.
                      let c = Int.compare(event.start, bestStart);
                      if (c == #greater) { true } else if (c == #less) { false } else {
                        let sa = switch (board.shift) { case (#am) 0; case (#pm) 1 };
                        let sb = switch (b.1) { case (#am) 0; case (#pm) 1 };
                        sa > sb;
                      };
                    };
                  };
                  case null { true };
                };
                if (better) { best := ?(board.eventId, board.shift, g, event.start) };
              };
              case null {};
            };
          };
          case null {};
        };
      };
    };
    switch (best) {
      case (?b) {
        let (eventId, shift, group, _) = b;
        let event = schedule.get(eventId);
        let day = switch (event) {
          case (?e) { weekdayOf(e.start) };
          case null { #wed };
        };
        let chips = group.roadieIds.filterMap(func(rid) = roadieChip(roadies, positions, day, shift, rid));
        ?{
          eventId;
          shift;
          shiftLabel = shiftLabel(event, shift);
          capacity = group.capacity;
          roadies = chips;
        };
      };
      case null { null };
    };
  };

  /// Add a trainer note (Trainer/Admin/Store Manager only). A note added while
  /// demo mode is on is a demo note.
  public func addTrainerNote(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    trainerNotes : Map.Map<Nat, Phase23.TrainerNote>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    note : Phase23.TrainerNote,
  ) : Nat {
    let role = Auth.requireReadable(accessGrants, demoState, caller);
    if (role != #trainer and role != #admin and role != #storeManager) {
      Runtime.trap("Access denied: Trainer, Admin or Store Manager role required");
    };
    let id = counters.nextTrainerNoteId;
    counters.nextTrainerNoteId := id + 1;
    trainerNotes.add(id, { note with id; author = caller; createdAt = effectiveNow(demoState); isDemo = Auth.demoActive(demoState) });
    logWrite(changeLog, counters, demoState, caller, "addTrainerNote", ?note.roadieId, false, "Added trainer note");
    id;
  };

  /// Edit a trainer note within its 24-hour lock window (author only).
  public func updateTrainerNote(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    trainerNotes : Map.Map<Nat, Phase23.TrainerNote>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    note : Phase23.TrainerNote,
  ) : () {
    ignore Auth.requireReadable(accessGrants, demoState, caller);
    let existing = trainerNotes.get(note.id) ?? Runtime.trap("Trainer note not found");
    if (existing.isDemo != Auth.demoActive(demoState)) {
      Runtime.trap("Trainer note not found");
    };
    if (existing.author != caller) {
      Runtime.trap("Access denied: only the author may edit a trainer note");
    };
    let twentyFourHoursNs : Int = 24 * 60 * 60 * 1_000_000_000;
    if (effectiveNow(demoState) > existing.createdAt + twentyFourHoursNs) {
      Runtime.trap("Trainer note is locked after 24 hours");
    };
    trainerNotes.add(note.id, { existing with didWell = note.didWell; workOn = note.workOn });
    logWrite(changeLog, counters, demoState, caller, "updateTrainerNote", ?note.roadieId, false, "Edited trainer note");
  };

  /// List trainer notes for a roadie. Restricted the same way roadies are:
  /// Integration sees nothing, and a trainer sees notes only for roadies in
  /// their assigned stations. Admin, Store Manager, Training Manager,
  /// Leadership and visiting managers can see all notes. Demo notes are visible
  /// only while demo mode is on.
  public func listTrainerNotes(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    trainerNotes : Map.Map<Nat, Phase23.TrainerNote>,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    caller : Principal,
    roadieId : Common.RoadieId,
  ) : [Phase23.TrainerNote] {
    let role = Auth.requireReadable(accessGrants, demoState, caller);
    // Integration sees only the Shareable export, so it sees no notes.
    if (role == #integration) {
      return [];
    };
    // A trainer sees notes only for roadies in their assigned stations.
    if (role == #trainer) {
      switch (roadies.get(roadieId)) {
        case (?roadie) {
          if (roadie.isDemo != Auth.demoActive(demoState) or not roadieVisibleToRole(roadie, role, accessGrants, demoState, caller)) {
            return [];
          };
        };
        case null { return [] };
      };
    };
    trainerNotes.values()
      .filter(func(n) = n.isDemo == Auth.demoActive(demoState) and n.roadieId == roadieId)
      .toArray();
  };

  /// Internal: whether a roadie is visible to a role. A trainer sees only
  /// roadies in their approved stations; a trainer with no approved stations
  /// sees no roadies. Integration sees only the Shareable export. While demo
  /// mode is on, a demo NSO Trainer sees only the chosen demo stations.
  func roadieVisibleToRole(
    roadie : Roadie.Roadie,
    role : Common.Role,
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    caller : Principal,
  ) : Bool {
    switch (role) {
      case (#integration) { false };
      case (#trainer) {
        let stations = if (Auth.demoActive(demoState)) {
          Auth.demoTrainerStationsFor(demoState, caller);
        } else {
          switch (accessGrants.get(caller)) {
            case (?grant) { grant.trainerPositionIds };
            case null { [] };
          };
        };
        stations.any(func(pid) =
          pid == roadie.mainPositionId or roadie.secondPositionId == ?pid
        );
      };
      case (_) { true };
    };
  };

  /// Create a leader talk (Admin/Store Manager only). A talk created while demo
  /// mode is on is a demo talk.
  public func createLeaderTalk(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    leaderTalks : Map.Map<Common.LeaderTalkId, Phase23.LeaderTalk>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    talk : Phase23.LeaderTalk,
  ) : Common.LeaderTalkId {
    Auth.requireManager(accessGrants, demoState, caller);
    let id = counters.nextLeaderTalkId;
    counters.nextLeaderTalkId := id + 1;
    leaderTalks.add(id, { talk with id; isDemo = Auth.demoActive(demoState) });
    logWrite(changeLog, counters, demoState, caller, "createLeaderTalk", null, false, "Created leader talk");
    id;
  };

  /// Record per-roadie attendance for a leader talk (Admin/Store Manager only).
  /// A write to the other partition is rejected.
  public func setLeaderTalkAttendance(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    leaderTalks : Map.Map<Common.LeaderTalkId, Phase23.LeaderTalk>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    id : Common.LeaderTalkId,
    attendees : [Common.RoadieId],
  ) : () {
    Auth.requireManager(accessGrants, demoState, caller);
    let talk = leaderTalks.get(id) ?? Runtime.trap("Leader talk not found");
    if (talk.isDemo != Auth.demoActive(demoState)) {
      Runtime.trap("Leader talk not found");
    };
    leaderTalks.add(id, { talk with attendees });
    logWrite(changeLog, counters, demoState, caller, "setLeaderTalkAttendance", null, false, "Recorded leader talk attendance");
  };

  /// Record a final sign-off for a roadie (Admin/Store Manager only). A
  /// sign-off recorded while demo mode is on is a demo sign-off; a write to the
  /// other partition is rejected.
  public func recordFinalSignOff(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    finalSignOffs : Map.Map<Common.RoadieId, Phase23.FinalSignOff>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    signOff : Phase23.FinalSignOff,
  ) : () {
    Auth.requireManager(accessGrants, demoState, caller);
    let demo = Auth.demoActive(demoState);
    switch (finalSignOffs.get(signOff.roadieId)) {
      case (?existing) {
        if (existing.isDemo != demo) {
          Runtime.trap("Final sign-off not found");
        };
      };
      case null {};
    };
    finalSignOffs.add(signOff.roadieId, { signOff with signedBy = caller; signedAt = effectiveNow(demoState); isDemo = demo });
    logWrite(changeLog, counters, demoState, caller, "recordFinalSignOff", ?signOff.roadieId, false, "Recorded final sign-off");
  };

  /// List alerts (Admin/Store Manager only).
  public func listAlerts(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    alerts : Map.Map<Common.AlertId, Phase23.Alert>,
    caller : Principal,
  ) : [Phase23.Alert] {
    Auth.requireManager(accessGrants, demoState, caller);
    alerts.values().toArray();
  };

  /// Acknowledge an alert (Admin/Store Manager only).
  public func acknowledgeAlert(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    alerts : Map.Map<Common.AlertId, Phase23.Alert>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    id : Common.AlertId,
  ) : () {
    Auth.requireManager(accessGrants, demoState, caller);
    let alert = alerts.get(id) ?? Runtime.trap("Alert not found");
    alerts.add(id, { alert with acknowledged = true });
    logWrite(changeLog, counters, demoState, caller, "acknowledgeAlert", null, false, "Acknowledged alert");
  };

  // --- Paperwork helpers (shared with the dashboard and roster) ---

  /// Whether a roadie's paperwork is complete, given their stored check-off:
  /// every paperwork checklist item that applies to them (respecting "Only
  /// alcohol positions" and "Only under 18") is checked. A roadie with no
  /// applicable items is complete.
  public func paperworkStatusWith(
    checklists : Store.Checklists,
    positions : Map.Map<Common.PositionId, Store.Position>,
    roadie : Roadie.Roadie,
    checkoff : ?Phase23.OrientationCheckoff,
  ) : Phase23.PaperworkStatus {
    let applicable = applicablePaperwork(checklists, positions, roadie);
    let checked = switch (checkoff) {
      case (?c) { c.paperworkItems };
      case null { [] };
    };
    let complete = applicable.all(func(item) = checked.any(func(t) = t == item.id.toText()));
    if (complete) { #complete } else { #incomplete };
  };

  /// Internal: the paperwork items that apply to a roadie.
  func applicablePaperwork(
    checklists : Store.Checklists,
    positions : Map.Map<Common.PositionId, Store.Position>,
    roadie : Roadie.Roadie,
  ) : [Store.ChecklistItem] {
    let needsAlcohol = switch (positions.get(roadie.mainPositionId)) {
      case (?p) { p.needsAlcoholCert };
      case null { false };
    };
    checklists.paperwork.filter(func(item) =
      (not item.requiresAlcoholCert or needsAlcohol) and (not item.minorOnly or roadie.isMinor)
    );
  };

  /// Internal: the default count for a count item, from the position defaults
  /// for shirt and hat items.
  func defaultCount(item : Store.ChecklistItem, position : ?Store.Position) : Nat {
    switch (item.itemType) {
      case (#checkbox) { 0 };
      case (#count) {
        let lower = item.text.toLower();
        if (lower.contains(#text "shirt")) {
          switch (position) { case (?p) { p.shirtQty }; case null { 0 } };
        } else if (lower.contains(#text "hat")) {
          switch (position) { case (?p) { p.hatQty }; case null { 0 } };
        } else {
          0;
        };
      };
    };
  };

  /// Internal: whether a uniform item is satisfied.
  func itemSatisfied(item : Phase23.UniformCheckoffItem) : Bool {
    switch (item.itemType) {
      case (#checkbox) { item.checked };
      case (#count) { item.count > 0 };
    };
  };

  /// Internal: the display name for a roadie (preferred name when set).
  func displayName(roadie : Roadie.Roadie) : Text {
    switch (roadie.profile.preferredName) {
      case (?p) { if (p.size() > 0) { p } else { roadie.profile.name } };
      case null { roadie.profile.name };
    };
  };

  /// Internal: the stored check-off for a roadie when it belongs to the active
  /// partition, otherwise null.
  func visibleCheckoff(
    checkoffs : Map.Map<Common.RoadieId, Phase23.OrientationCheckoff>,
    demo : Bool,
    roadieId : Common.RoadieId,
  ) : ?Phase23.OrientationCheckoff {
    switch (checkoffs.get(roadieId)) {
      case (?c) { if (c.isDemo == demo) { ?c } else { null } };
      case null { null };
    };
  };

  /// Internal: whether a roadie is marked Present at an event.
  func isPresentAt(
    attendance : Map.Map<Nat, Phase23.AttendanceRecord>,
    demo : Bool,
    roadieId : Common.RoadieId,
    eventId : Common.EventId,
  ) : Bool {
    attendance.values().any(func(a) =
      a.isDemo == demo and a.roadieId == roadieId and a.eventId == ?eventId and a.state == #present
    );
  };

  /// Internal: find the attendance record for a roadie at an event, with its
  /// map key so callers can update it in place.
  func findAttendance(
    attendance : Map.Map<Nat, Phase23.AttendanceRecord>,
    demo : Bool,
    roadieId : Common.RoadieId,
    eventId : Common.EventId,
  ) : ?(Nat, Phase23.AttendanceRecord) {
    attendance.entries().find(func((_, a)) =
      a.isDemo == demo and a.roadieId == roadieId and a.eventId == ?eventId
    );
  };

  /// Internal: remove every attendance record for a roadie at an event.
  func removeAttendance(
    attendance : Map.Map<Nat, Phase23.AttendanceRecord>,
    demo : Bool,
    roadieId : Common.RoadieId,
    eventId : Common.EventId,
  ) : () {
    let doomed = attendance.entries()
      .filter(func((_, a)) = a.isDemo == demo and a.roadieId == roadieId and a.eventId == ?eventId)
      .map(func((k, _)) = k)
      .toArray();
    for (k in doomed.values()) {
      attendance.remove(k);
    };
  };

  /// Internal: fetch a roadie that belongs to the active demo/real partition,
  /// or trap.
  func requireVisibleRoadie(
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    demoState : Common.DemoState,
    id : Common.RoadieId,
  ) : Roadie.Roadie {
    let roadie = roadies.get(id) ?? Runtime.trap("Roadie not found");
    if (roadie.isDemo != Auth.demoActive(demoState)) {
      Runtime.trap("Roadie not found");
    };
    roadie;
  };

  /// Internal: the effective clock. While demo mode is on with a pretend date
  /// set, the pretend timestamp is returned; otherwise the real clock.
  func effectiveNow(demoState : Common.DemoState) : Common.Timestamp {
    if (not Auth.demoActive(demoState)) {
      return Time.now();
    };
    switch (demoState.pretendDate) {
      case (?pd) {
        let hourOffset : Int = switch (pd.shift) {
          case (#am) { 9 };
          case (#pm) { 15 };
        };
        pd.day + hourOffset * 3_600_000_000_000;
      };
      case null { Time.now() };
    };
  };

  /// Internal: write a change-log entry into the active partition.
  func logWrite(
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    demoState : Common.DemoState,
    by : Principal,
    action : Text,
    subjectRoadieId : ?Common.RoadieId,
    touchesContactSet : Bool,
    detail : Text,
  ) : () {
    if (Auth.demoActive(demoState)) {
      ignore ChangeLog.recordDemo(changeLog, counters, by, action, subjectRoadieId, touchesContactSet, detail);
    } else {
      ignore ChangeLog.record(changeLog, counters, by, action, subjectRoadieId, touchesContactSet, detail);
    };
  };

  /// Internal: `a - b`, clamped at zero, without a trapping Nat subtraction.
  func saturatingSub(a : Nat, b : Nat) : Nat {
    if (a <= b) { 0 } else { a - b };
  };
};
