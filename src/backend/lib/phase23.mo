import Map "mo:core/Map";
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

  // --- Training groups ---

  /// Read a training group with its unassigned and off-shift lists (Admin/Store
  /// Manager/Trainer). Demo groups are visible only while demo mode is on.
  public func getTrainingGroup(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    trainingGroups : Map.Map<Common.TrainingGroupId, Phase23.TrainingGroup>,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    caller : Principal,
    id : Common.TrainingGroupId,
  ) : ?Phase23.TrainingGroupView {
    ignore Auth.requireReadable(accessGrants, demoState, caller);
    let demo = Auth.demoActive(demoState);
    switch (trainingGroups.get(id)) {
      case (?group) {
        if (group.isDemo != demo) { return null };
        let active = roadies.values().filter(func r = r.isDemo == demo and r.status != #archived).toArray();
        let unassigned = active.filter(func r =
          r.mainPositionId == group.positionId
          and not group.memberRoadieIds.any(func m = m == r.id)
        ).map(func r = r.id);
        let offThisShift = active.filter(func r =
          r.mainPositionId != group.positionId
          and not group.memberRoadieIds.any(func m = m == r.id)
        ).map(func r = r.id);
        ?{ group; unassigned; offThisShift };
      };
      case null { null };
    };
  };

  /// Create a training group (Admin/Store Manager only). A group created while
  /// demo mode is on is a demo group.
  public func createTrainingGroup(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    trainingGroups : Map.Map<Common.TrainingGroupId, Phase23.TrainingGroup>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    group : Phase23.TrainingGroup,
  ) : Common.TrainingGroupId {
    Auth.requireManager(accessGrants, demoState, caller);
    let id = counters.nextTrainingGroupId;
    counters.nextTrainingGroupId := id + 1;
    trainingGroups.add(id, { group with id; isDemo = Auth.demoActive(demoState) });
    logWrite(changeLog, counters, demoState, caller, "createTrainingGroup", null, false, "Created training group");
    id;
  };

  /// Update a training group's membership (Admin/Store Manager only). A write
  /// to the other partition is rejected.
  public func updateTrainingGroup(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    trainingGroups : Map.Map<Common.TrainingGroupId, Phase23.TrainingGroup>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    group : Phase23.TrainingGroup,
  ) : () {
    Auth.requireManager(accessGrants, demoState, caller);
    let existing = trainingGroups.get(group.id) ?? Runtime.trap("Training group not found");
    if (existing.isDemo != Auth.demoActive(demoState)) {
      Runtime.trap("Training group not found");
    };
    trainingGroups.add(group.id, group);
    logWrite(changeLog, counters, demoState, caller, "updateTrainingGroup", null, false, "Updated training group");
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
          switch (position) { case (?p) { p.defaultShirts }; case null { 0 } };
        } else if (lower.contains(#text "hat")) {
          switch (position) { case (?p) { p.defaultHats }; case null { 0 } };
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
