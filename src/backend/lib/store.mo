import List "mo:core/List";
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Text "mo:core/Text";
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
    var nextPositionId : Nat;
    var nextEventId : Nat;
    var nextBuildToAdjustmentId : Nat;
    var nextChangeLogId : Nat;
  };

  /// Read the current store configuration (any role except Kiosk).
  public func getStoreInfo(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    storeInfo : { var value : Store.StoreInfo },
    caller : Principal,
  ) : Store.StoreInfo {
    ignore Auth.requireReadable(accessGrants, demoState, caller);
    storeInfo.value;
  };

  /// Read both store logos (main and secondary). Callable by any caller,
  /// including Kiosk-role and unregistered users, so it deliberately applies no
  /// role gate.
  public func getStoreLogo(
    storeInfo : { var value : Store.StoreInfo },
  ) : Store.StoreLogos {
    {
      logo = storeInfo.value.logo;
      secondaryLogo = storeInfo.value.secondaryLogo;
    };
  };

  /// Update the store configuration (Admin only).
  public func updateStoreInfo(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    storeInfo : { var value : Store.StoreInfo },
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    info : Store.StoreInfo,
  ) : () {
    Auth.requireRealSettingsAdmin(accessGrants, demoState, caller);
    storeInfo.value := info;
    ignore ChangeLog.record(changeLog, counters, caller, "updateStoreInfo", null, false, "Updated store info");
  };

  /// List all positions (any role except Kiosk).
  public func listPositions(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    positions : Map.Map<Common.PositionId, Store.Position>,
    caller : Principal,
  ) : [Store.Position] {
    ignore Auth.requireReadable(accessGrants, demoState, caller);
    positions.values().toArray();
  };

  /// Create a position (Admin only).
  public func createPosition(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    positions : Map.Map<Common.PositionId, Store.Position>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    position : Store.Position,
  ) : Common.PositionId {
    Auth.requireRealSettingsAdmin(accessGrants, demoState, caller);
    let id = counters.nextPositionId;
    counters.nextPositionId := id + 1;
    positions.add(id, { position with id });
    ignore ChangeLog.record(changeLog, counters, caller, "createPosition", null, false, "Created position " # position.name);
    id;
  };

  /// Update a position (Admin only).
  public func updatePosition(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    positions : Map.Map<Common.PositionId, Store.Position>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    position : Store.Position,
  ) : () {
    Auth.requireRealSettingsAdmin(accessGrants, demoState, caller);
    if (not positions.containsKey(position.id)) {
      Runtime.trap("Position not found");
    };
    positions.add(position.id, position);
    ignore ChangeLog.record(changeLog, counters, caller, "updatePosition", null, false, "Updated position " # position.name);
  };

  /// Delete a position; fails when active roadies reference it (Admin only).
  public func deletePosition(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    positions : Map.Map<Common.PositionId, Store.Position>,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    id : Common.PositionId,
  ) : () {
    Auth.requireRealSettingsAdmin(accessGrants, demoState, caller);
    let position = positions.get(id) ?? Runtime.trap("Position not found");
    let referenced = roadies.values().any(func(r) =
      r.isDemo == Auth.demoActive(demoState) and (r.mainPositionId == id or r.secondPositionId == ?id or r.crossTrainedPositionId == ?id)
    );
    if (referenced) {
      Runtime.trap("Position is referenced by one or more roadies");
    };
    positions.remove(id);
    ignore ChangeLog.record(changeLog, counters, caller, "deletePosition", null, false, "Deleted position " # position.name);
  };

  /// Apply a +1/−1 build-to adjustment (Store Manager/Admin only).
  public func adjustBuildTo(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    positions : Map.Map<Common.PositionId, Store.Position>,
    buildToAdjustments : Map.Map<Nat, Store.BuildToAdjustment>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    positionId : Common.PositionId,
    openingDelta : Int,
    afterOpeningDelta : Int,
  ) : () {
    Auth.requireRealSettingsManager(accessGrants, demoState, caller);
    let position = positions.get(positionId) ?? Runtime.trap("Position not found");
    let newOpening = position.openingBuildTo.toInt() + openingDelta;
    let newAfter = position.afterOpeningBuildTo.toInt() + afterOpeningDelta;
    if (newOpening < 0 or newAfter < 0) {
      Runtime.trap("Build-to target cannot go below zero");
    };
    positions.add(positionId, {
      position with
      openingBuildTo = newOpening.toNat();
      afterOpeningBuildTo = newAfter.toNat();
    });
    let id = counters.nextBuildToAdjustmentId;
    counters.nextBuildToAdjustmentId := id + 1;
    buildToAdjustments.add(id, {
      positionId;
      openingDelta;
      afterOpeningDelta;
      at = Time.now();
      by = caller;
    });
    ignore ChangeLog.record(changeLog, counters, caller, "adjustBuildTo", null, false, "Adjusted build-to for " # position.name);
  };

  /// The next upcoming orientation session: the earliest orientation event
  /// whose start is at or after `now`. Returns null when none is scheduled.
  public func nextOrientationEvent(
    schedule : Map.Map<Common.EventId, Store.ScheduleEvent>,
    now : Common.Timestamp,
  ) : ?Store.ScheduleEvent {
    var best : ?Store.ScheduleEvent = null;
    for (event in schedule.values()) {
      if (event.kind == #orientation and event.start >= now) {
        switch (best) {
          case (?b) { if (event.start < b.start) { best := ?event } };
          case null { best := ?event };
        };
      };
    };
    best;
  };

  /// List the opening schedule (any role except Kiosk).
  public func listSchedule(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    schedule : Map.Map<Common.EventId, Store.ScheduleEvent>,
    caller : Principal,
  ) : [Store.ScheduleEvent] {
    ignore Auth.requireReadable(accessGrants, demoState, caller);
    schedule.values().toArray();
  };

  /// Create a schedule event (Admin only).
  public func createScheduleEvent(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    schedule : Map.Map<Common.EventId, Store.ScheduleEvent>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    event : Store.ScheduleEvent,
  ) : Common.EventId {
    Auth.requireRealSettingsAdmin(accessGrants, demoState, caller);
    let id = counters.nextEventId;
    counters.nextEventId := id + 1;
    schedule.add(id, { event with id });
    ignore ChangeLog.record(changeLog, counters, caller, "createScheduleEvent", null, false, "Created schedule event " # event.name);
    id;
  };

  /// Update a schedule event (Admin only).
  public func updateScheduleEvent(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    schedule : Map.Map<Common.EventId, Store.ScheduleEvent>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    event : Store.ScheduleEvent,
  ) : () {
    Auth.requireRealSettingsAdmin(accessGrants, demoState, caller);
    if (not schedule.containsKey(event.id)) {
      Runtime.trap("Schedule event not found");
    };
    schedule.add(event.id, event);
    ignore ChangeLog.record(changeLog, counters, caller, "updateScheduleEvent", null, false, "Updated schedule event " # event.name);
  };

  /// Delete a schedule event; fails when records reference it (Admin only).
  public func deleteScheduleEvent(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    schedule : Map.Map<Common.EventId, Store.ScheduleEvent>,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    attendance : Map.Map<Nat, Phase23.AttendanceRecord>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    id : Common.EventId,
  ) : () {
    Auth.requireRealSettingsAdmin(accessGrants, demoState, caller);
    let event = schedule.get(id) ?? Runtime.trap("Schedule event not found");
    let referencedByRoadie = roadies.values().any(func(r) = r.isDemo == Auth.demoActive(demoState) and r.orientationEventId == ?id);
    let referencedByAttendance = attendance.values().any(func(a) = a.isDemo == Auth.demoActive(demoState) and a.eventId == ?id);
    if (referencedByRoadie or referencedByAttendance) {
      Runtime.trap("Schedule event is referenced by one or more records");
    };
    schedule.remove(id);
    ignore ChangeLog.record(changeLog, counters, caller, "deleteScheduleEvent", null, false, "Deleted schedule event " # event.name);
  };

  /// Read the editable checklists (any role except Kiosk).
  public func getChecklists(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    checklists : { var value : Store.Checklists },
    caller : Principal,
  ) : Store.Checklists {
    ignore Auth.requireReadable(accessGrants, demoState, caller);
    checklists.value;
  };

  /// Update the editable checklists (Admin only).
  public func updateChecklists(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    checklists : { var value : Store.Checklists },
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    value : Store.Checklists,
  ) : () {
    Auth.requireRealSettingsAdmin(accessGrants, demoState, caller);
    checklists.value := value;
    ignore ChangeLog.record(changeLog, counters, caller, "updateChecklists", null, false, "Updated checklists");
  };

  /// Read retention settings (any role except Kiosk).
  public func getRetentionSettings(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    retention : { var value : Store.RetentionSettings },
    caller : Principal,
  ) : Store.RetentionSettings {
    ignore Auth.requireReadable(accessGrants, demoState, caller);
    retention.value;
  };

  /// Update retention settings (Admin only).
  public func updateRetentionSettings(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    retention : { var value : Store.RetentionSettings },
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    settings : Store.RetentionSettings,
  ) : () {
    Auth.requireRealSettingsAdmin(accessGrants, demoState, caller);
    retention.value := settings;
    ignore ChangeLog.record(changeLog, counters, caller, "updateRetentionSettings", null, false, "Updated retention settings");
  };

  /// Nanoseconds in one day.
  let nsPerDay : Int = 86_400_000_000_000;

  /// Build the downloadable store template file from the current positions,
  /// schedule, checklists and leader-talk settings (Admin only). Schedule events
  /// are expressed as whole days relative to the store's opening date. The file
  /// deliberately carries no people data, logos, store number, city or opening
  /// date.
  public func downloadStoreTemplate(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    storeInfo : { var value : Store.StoreInfo },
    positions : Map.Map<Common.PositionId, Store.Position>,
    schedule : Map.Map<Common.EventId, Store.ScheduleEvent>,
    checklists : { var value : Store.Checklists },
    caller : Principal,
  ) : Store.StoreTemplateFile {
    Auth.requireRealSettingsAdmin(accessGrants, demoState, caller);
    let opening = storeInfo.value.openingDate;
    {
      version = 1;
      schedule = schedule.values().map(func(e) {
        {
          kind = e.kind;
          name = e.name;
          startOffsetDays = (e.start - opening) / nsPerDay;
          endOffsetDays = switch (e.end) {
            case (?end) { ?((end - opening) / nsPerDay) };
            case null { null };
          };
        };
      }).toArray();
      positions = positions.values().map(func(p) {
        {
          name = p.name;
          house = p.house;
          code = p.code;
          openingBuildTo = p.openingBuildTo;
          afterOpeningBuildTo = p.afterOpeningBuildTo;
          minimumAge = p.minimumAge;
          needsAlcoholCert = p.needsAlcoholCert;
          shirtType = p.shirtType;
          shirtQty = p.shirtQty;
          hatType = p.hatType;
          hatQty = p.hatQty;
        };
      }).toArray();
      checklists = checklists.value;
      leaderTalkName = storeInfo.value.leaderTalkName;
      leaderTalkSize = storeInfo.value.leaderTalkSize;
      trainingGroupSize = storeInfo.value.trainingGroupSize;
    };
  };

  /// Load a store template file (Admin only). Refuses when any roadie exists.
  /// Otherwise replaces positions, schedule and checklists, recomputing schedule
  /// dates from this store's opening date, and updates the leader-talk name and
  /// sizes. Returns the applied preview, or an error explaining the refusal.
  public func loadStoreTemplate(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    storeInfo : { var value : Store.StoreInfo },
    positions : Map.Map<Common.PositionId, Store.Position>,
    schedule : Map.Map<Common.EventId, Store.ScheduleEvent>,
    checklists : { var value : Store.Checklists },
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    file : Store.StoreTemplateFile,
  ) : Store.TemplateLoadResult {
    Auth.requireRealSettingsAdmin(accessGrants, demoState, caller);
    // Demo records never block a template load; only real roadies do.
    if (roadies.values().any(func r = not r.isDemo)) {
      return #err("Cannot load a template once roadies exist");
    };
    let opening = storeInfo.value.openingDate;
    // Replace positions, assigning fresh sequential ids.
    positions.clear();
    var nextPositionId = 0;
    for (p in file.positions.values()) {
      positions.add(nextPositionId, {
        id = nextPositionId;
        name = p.name;
        house = p.house;
        code = p.code;
        openingBuildTo = p.openingBuildTo;
        afterOpeningBuildTo = p.afterOpeningBuildTo;
        needsAlcoholCert = p.needsAlcoholCert;
        minimumAge = p.minimumAge;
        shirtsRequired = 2;
        hatsRequired = 1;
        crewManager = null;
        shirtType = p.shirtType;
        shirtQty = p.shirtQty;
        hatType = p.hatType;
        hatQty = p.hatQty;
      });
      nextPositionId += 1;
    };
    // Replace schedule, recomputing each date from this store's opening date.
    schedule.clear();
    var nextEventId = 0;
    for (e in file.schedule.values()) {
      schedule.add(nextEventId, {
        id = nextEventId;
        kind = e.kind;
        name = e.name;
        start = opening + e.startOffsetDays * nsPerDay;
        end = switch (e.endOffsetDays) {
          case (?offset) { ?(opening + offset * nsPerDay) };
          case null { null };
        };
      });
      nextEventId += 1;
    };
    checklists.value := file.checklists;
    storeInfo.value := {
      storeInfo.value with
      leaderTalkName = file.leaderTalkName;
      leaderTalkSize = file.leaderTalkSize;
      trainingGroupSize = file.trainingGroupSize;
    };
    counters.nextPositionId := nextPositionId;
    counters.nextEventId := nextEventId;
    ignore ChangeLog.record(changeLog, counters, caller, "loadStoreTemplate", null, false, "Loaded store template");
    #ok({
      positionCount = file.positions.size();
      scheduleCount = file.schedule.size();
      orientationUniformCount = file.checklists.orientationUniform.size();
      paperworkCount = file.checklists.paperwork.size();
      leaderTalkName = file.leaderTalkName;
    });
  };

  /// Save the current store configuration as a template (Admin only).
  public func saveStoreTemplate(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    storeInfo : { var value : Store.StoreInfo },
    positions : Map.Map<Common.PositionId, Store.Position>,
    schedule : Map.Map<Common.EventId, Store.ScheduleEvent>,
    checklists : { var value : Store.Checklists },
    storeTemplates : Map.Map<Text, Store.StoreTemplate>,
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    name : Text,
  ) : () {
    Auth.requireRealSettingsAdmin(accessGrants, demoState, caller);
    storeTemplates.add(name, {
      name;
      schedule = schedule.values().toArray();
      positions = positions.values().toArray();
      checklists = checklists.value;
      leaderTalkName = storeInfo.value.leaderTalkName;
    });
    ignore ChangeLog.record(changeLog, counters, caller, "saveStoreTemplate", null, false, "Saved store template " # name);
  };

  // --- Uniforms ---

  /// Require a uniform viewer (Admin, Store Manager or Training Manager); trap
  /// otherwise. While demo mode is on, the caller's own impersonated demo role
  /// is consulted.
  func requireUniformViewer(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    caller : Principal,
  ) : () {
    switch (Auth.effectiveRole(accessGrants, demoState, caller)) {
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

  /// Read the uniform settings (size curve and order buffer). Admin, Store
  /// Manager and Training Manager may read it.
  public func getUniformSettings(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    uniformSettings : { var value : Store.UniformSettings },
    caller : Principal,
  ) : Store.UniformSettings {
    requireUniformViewer(accessGrants, demoState, caller);
    uniformSettings.value;
  };

  /// Update the uniform settings (Admin or Store Manager only, logged). Refused
  /// while demo mode is on.
  public func updateUniformSettings(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    uniformSettings : { var value : Store.UniformSettings },
    changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
    counters : Counters,
    caller : Principal,
    settings : Store.UniformSettings,
  ) : () {
    Auth.requireRealSettingsManager(accessGrants, demoState, caller);
    uniformSettings.value := settings;
    ignore ChangeLog.record(changeLog, counters, caller, "updateUniformSettings", null, false, "Updated uniform settings");
  };

  /// Build the uniform order for one house filter (Admin, Store Manager or
  /// Training Manager). Per item and size: Hired counts Pending + Active
  /// roadies (archived excluded) using their real sizes and their position's
  /// uniform defaults; Projected splits the unfilled build-to slots of each
  /// position by the size curve and multiplies by that position's defaults;
  /// Order total adds the buffer percentage and rounds up. Roadies missing a
  /// shirt or hat size are listed in the Size unknown bucket. Demo records
  /// count only while demo mode is on.
  public func getUniformOrder(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    positions : Map.Map<Common.PositionId, Store.Position>,
    uniformSettings : { var value : Store.UniformSettings },
    caller : Principal,
    filter : Store.UniformHouseFilter,
  ) : Store.UniformOrderView {
    requireUniformViewer(accessGrants, demoState, caller);
    let demo = Auth.demoActive(demoState);
    let buffer = uniformSettings.value.bufferPercent;
    let curve = uniformSettings.value.sizeCurve;
    let inScope = positions.values()
      .filter(func(p) = houseMatches(filter, p.house))
      .toArray();
    let hired = roadies.values()
      .filter(func(r) =
        r.isDemo == demo
        and r.status != #archived
        and inScope.any(func(p) = p.id == r.mainPositionId)
      )
      .toArray();

    let shirtItems = distinctItems(inScope, true);
    let hatItems = distinctItems(inScope, false);
    let shirtSizes = distinctSizes(curve.shirts, hired.map(func r = r.profile.shirtSize));
    let hatSizes = distinctSizes(curve.hats, hired.map(func r = r.profile.hatSize));

    let rows = List.empty<Store.UniformOrderRow>();
    for (item in shirtItems.values()) {
      for (size in shirtSizes.values()) {
        let h = hiredCount(hired, inScope, item, size, true);
        let p = projectedCount(inScope, hired, item, size, curve.shirts, true);
        rows.add({ item; size; hired = h; projected = p; orderTotal = withBuffer(h, p, buffer) });
      };
    };
    for (item in hatItems.values()) {
      for (size in hatSizes.values()) {
        let h = hiredCount(hired, inScope, item, size, false);
        let p = projectedCount(inScope, hired, item, size, curve.hats, false);
        rows.add({ item; size; hired = h; projected = p; orderTotal = withBuffer(h, p, buffer) });
      };
    };

    let sizeUnknown = hired
      .filter(func r = r.profile.shirtSize == null or r.profile.hatSize == null)
      .map(func r = {
        roadieId = r.id;
        name = displayName(r);
        missingShirt = r.profile.shirtSize == null;
        missingHat = r.profile.hatSize == null;
      });

    let rowArray = rows.toArray();
    let totals = List.empty<Store.UniformOrderTotalsRow>();
    for (item in shirtItems.values()) {
      var h = 0; var p = 0; var o = 0;
      for (row in rowArray.values()) {
        if (row.item == item) { h += row.hired; p += row.projected; o += row.orderTotal };
      };
      totals.add({ item; hired = h; projected = p; orderTotal = o });
    };
    for (item in hatItems.values()) {
      var h = 0; var p = 0; var o = 0;
      for (row in rowArray.values()) {
        if (row.item == item) { h += row.hired; p += row.projected; o += row.orderTotal };
      };
      totals.add({ item; hired = h; projected = p; orderTotal = o });
    };

    {
      filter;
      bufferPercent = buffer;
      rows = rowArray;
      totals = totals.toArray();
      sizeUnknown;
    };
  };

  /// Internal: whether a position's house is in the filter.
  func houseMatches(filter : Store.UniformHouseFilter, house : Common.House) : Bool {
    switch (filter) {
      case (#all) { true };
      case (#foh) { house == #foh };
      case (#boh) { house == #boh };
    };
  };

  /// Internal: the display label for a uniform item, falling back to a generic
  /// label when the position's type text is blank.
  func itemLabel(raw : Text, shirts : Bool) : Text {
    if (raw.size() > 0) { raw } else if (shirts) { "Shirt" } else { "Hat" };
  };

  /// Internal: the distinct uniform item labels among positions that give at
  /// least one of the item.
  func distinctItems(positions : [Store.Position], shirts : Bool) : [Text] {
    let out = List.empty<Text>();
    for (p in positions.values()) {
      let qty = if (shirts) { p.shirtQty } else { p.hatQty };
      if (qty > 0) {
        let itemName = itemLabel(if (shirts) { p.shirtType } else { p.hatType }, shirts);
        if (not out.contains(itemName)) { out.add(itemName) };
      };
    };
    out.toArray();
  };

  /// Internal: the size labels to report: the curve's sizes plus any real sizes
  /// the hired roadies carry that the curve omits.
  func distinctSizes(curveEntries : [Store.SizeCurveEntry], realSizes : [?Text]) : [Text] {
    let out = List.empty<Text>();
    for (e in curveEntries.values()) {
      if (not out.contains(e.size)) { out.add(e.size) };
    };
    for (s in realSizes.values()) {
      switch (s) {
        case (?size) { if (not out.contains(size)) { out.add(size) } };
        case null {};
      };
    };
    out.toArray();
  };

  /// Internal: the Hired count for one item and size: each hired roadie whose
  /// position gives that item and whose real size matches contributes the
  /// position's quantity for that item.
  func hiredCount(
    hired : [Roadie.Roadie],
    inScope : [Store.Position],
    item : Text,
    size : Text,
    shirts : Bool,
  ) : Nat {
    var total = 0;
    for (r in hired.values()) {
      let realSize = if (shirts) { r.profile.shirtSize } else { r.profile.hatSize };
      switch (realSize) {
        case (?s) {
          if (s == size) {
            switch (inScope.find(func(p) = p.id == r.mainPositionId)) {
              case (?p) {
                let qty = if (shirts) { p.shirtQty } else { p.hatQty };
                let itemName = itemLabel(if (shirts) { p.shirtType } else { p.hatType }, shirts);
                if (qty > 0 and itemName == item) { total += qty };
              };
              case null {};
            };
          };
        };
        case null {};
      };
    };
    total;
  };

  /// Internal: the Projected count for one item and size. For each in-scope
  /// position, the units to project are its unfilled build-to slots plus any
  /// hired roadie at that position who is missing the item's size (their items
  /// are projected by the curve exactly as an unfilled slot is). Those units
  /// are multiplied by the position's quantity for the item and summed across
  /// every in-scope position FIRST; the size curve's percentage is then applied
  /// once and the result rounded once, half up.
  func projectedCount(
    inScope : [Store.Position],
    hired : [Roadie.Roadie],
    item : Text,
    size : Text,
    curveEntries : [Store.SizeCurveEntry],
    shirts : Bool,
  ) : Nat {
    let percent = switch (curveEntries.find(func(e) = e.size == size)) {
      case (?e) { e.percent };
      case null { 0 };
    };
    if (percent == 0) { return 0 };
    var units = 0;
    for (p in inScope.values()) {
      let qty = if (shirts) { p.shirtQty } else { p.hatQty };
      let itemName = itemLabel(if (shirts) { p.shirtType } else { p.hatType }, shirts);
      if (qty > 0 and itemName == item) {
        let hiredHere = hired.filter(func r = r.mainPositionId == p.id).size();
        let unfilled = saturatingSub(p.openingBuildTo, hiredHere);
        let missingSize = hired.filter(func r =
          r.mainPositionId == p.id
          and (if (shirts) { r.profile.shirtSize == null } else { r.profile.hatSize == null })
        ).size();
        units += (unfilled + missingSize) * qty;
      };
    };
    (units * percent + 50) / 100;
  };

  /// Internal: the Order total for one row: (Hired + Projected) with the buffer
  /// percentage added, rounded up.
  func withBuffer(hired : Nat, projected : Nat, buffer : Nat) : Nat {
    let base = hired + projected;
    (base * (100 + buffer) + 99) / 100;
  };

  /// Internal: the display name for a roadie (preferred name when set).
  func displayName(roadie : Roadie.Roadie) : Text {
    switch (roadie.profile.preferredName) {
      case (?p) { if (p.size() > 0) { p } else { roadie.profile.name } };
      case null { roadie.profile.name };
    };
  };

  /// Internal: `a - b`, clamped at zero, without a trapping Nat subtraction.
  func saturatingSub(a : Nat, b : Nat) : Nat {
    if (a <= b) { 0 } else { a - b };
  };
};
