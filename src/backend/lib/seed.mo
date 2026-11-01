import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Common "../types/common";
import Store "../types/store";
import Access "../types/access";
import Auth "auth";

/// Idempotent runtime re-seed. The init-once migration chain seeds a fresh
/// install; this path re-applies the same seed when the store has no positions
/// yet (for example after positions were deleted, or on a canister whose
/// migration chain did not seed). It never overwrites an existing store.
module {
  public type Counters = {
    var nextPositionId : Nat;
    var nextEventId : Nat;
  };

  /// True when the store has no positions configured.
  public func needsSeed(
    positions : Map.Map<Common.PositionId, Store.Position>,
  ) : Bool {
    positions.size() == 0;
  };

  /// Re-seed the store when it has no positions. Returns true when a seed was
  /// applied, false when the store already had positions. Any read-capable
  /// caller may trigger it; it is idempotent and never overwrites data.
  public func ensureSeeded(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    storeInfo : { var value : Store.StoreInfo },
    positions : Map.Map<Common.PositionId, Store.Position>,
    schedule : Map.Map<Common.EventId, Store.ScheduleEvent>,
    checklists : { var value : Store.Checklists },
    retention : { var value : Store.RetentionSettings },
    counters : Counters,
    caller : Principal,
  ) : Bool {
    // Any read-capable role may trigger the re-seed; Kiosk and unregistered
    // callers are rejected by the shared guard.
    ignore Auth.requireReadable(accessGrants, caller);
    if (not needsSeed(positions)) {
      return false;
    };
    for (p in seedPositions().values()) {
      positions.add(p.id, p);
    };
    for (e in seedSchedule().values()) {
      schedule.add(e.id, e);
    };
    storeInfo.value := seedStoreInfo();
    checklists.value := {
      orientationUniform = seedOrientationUniform();
      paperwork = seedPaperwork();
    };
    retention.value := seedRetention();
    // Advance the counters past the seeded identifiers so new records do not
    // collide with the seed.
    if (counters.nextPositionId < 18) {
      counters.nextPositionId := 18;
    };
    if (counters.nextEventId < 12) {
      counters.nextEventId := 12;
    };
    true;
  };

  // --- Seed data (same values as migrations/00000000_000000.mo) ---

  // Opening date: Mon Feb 8, 2027, 00:00 America/Chicago (CST, UTC-6).
  let openingDateNs : Int = 1_802_066_400_000_000_000;

  func seedPositions() : [Store.Position] {
    [
      { id = 0; name = "Servers"; house = #foh; code = "SRV"; openingBuildTo = 65; afterOpeningBuildTo = 65; needsAlcoholCert = true; minimumAge = 18; shirtsRequired = 2; hatsRequired = 1; crewManager = null },
      { id = 1; name = "Hosts"; house = #foh; code = "HST"; openingBuildTo = 18; afterOpeningBuildTo = 18; needsAlcoholCert = false; minimumAge = 16; shirtsRequired = 2; hatsRequired = 1; crewManager = null },
      { id = 2; name = "Bartenders"; house = #foh; code = "BAR"; openingBuildTo = 12; afterOpeningBuildTo = 12; needsAlcoholCert = true; minimumAge = 21; shirtsRequired = 2; hatsRequired = 1; crewManager = null },
      { id = 3; name = "Server assistants"; house = #foh; code = "SA"; openingBuildTo = 12; afterOpeningBuildTo = 12; needsAlcoholCert = false; minimumAge = 16; shirtsRequired = 2; hatsRequired = 1; crewManager = null },
      { id = 4; name = "To-go"; house = #foh; code = "TG"; openingBuildTo = 10; afterOpeningBuildTo = 10; needsAlcoholCert = false; minimumAge = 16; shirtsRequired = 2; hatsRequired = 1; crewManager = null },
      { id = 5; name = "Fry / Salad"; house = #boh; code = "FS"; openingBuildTo = 16; afterOpeningBuildTo = 16; needsAlcoholCert = false; minimumAge = 16; shirtsRequired = 2; hatsRequired = 1; crewManager = null },
      { id = 6; name = "Dish"; house = #boh; code = "DSH"; openingBuildTo = 14; afterOpeningBuildTo = 14; needsAlcoholCert = false; minimumAge = 16; shirtsRequired = 2; hatsRequired = 1; crewManager = null },
      { id = 7; name = "Pizza"; house = #boh; code = "PIZ"; openingBuildTo = 12; afterOpeningBuildTo = 12; needsAlcoholCert = false; minimumAge = 16; shirtsRequired = 2; hatsRequired = 1; crewManager = null },
      { id = 8; name = "Broil / Saute"; house = #boh; code = "BRS"; openingBuildTo = 10; afterOpeningBuildTo = 10; needsAlcoholCert = false; minimumAge = 18; shirtsRequired = 2; hatsRequired = 1; crewManager = null },
      { id = 9; name = "Hot prep"; house = #boh; code = "HP"; openingBuildTo = 7; afterOpeningBuildTo = 7; needsAlcoholCert = false; minimumAge = 18; shirtsRequired = 2; hatsRequired = 1; crewManager = null },
      { id = 10; name = "Cold prep"; house = #boh; code = "CP"; openingBuildTo = 7; afterOpeningBuildTo = 7; needsAlcoholCert = false; minimumAge = 16; shirtsRequired = 2; hatsRequired = 1; crewManager = null },
      { id = 11; name = "Point / Build"; house = #boh; code = "PB"; openingBuildTo = 7; afterOpeningBuildTo = 7; needsAlcoholCert = false; minimumAge = 16; shirtsRequired = 2; hatsRequired = 1; crewManager = null },
      { id = 12; name = "Sear"; house = #boh; code = "SEA"; openingBuildTo = 7; afterOpeningBuildTo = 7; needsAlcoholCert = false; minimumAge = 18; shirtsRequired = 2; hatsRequired = 1; crewManager = null },
      { id = 13; name = "Expo"; house = #boh; code = "EXP"; openingBuildTo = 6; afterOpeningBuildTo = 6; needsAlcoholCert = false; minimumAge = 18; shirtsRequired = 2; hatsRequired = 1; crewManager = null },
      { id = 14; name = "Bake"; house = #boh; code = "BAK"; openingBuildTo = 5; afterOpeningBuildTo = 5; needsAlcoholCert = false; minimumAge = 16; shirtsRequired = 2; hatsRequired = 1; crewManager = null },
      { id = 15; name = "Silverware roller"; house = #boh; code = "SWR"; openingBuildTo = 4; afterOpeningBuildTo = 4; needsAlcoholCert = false; minimumAge = 16; shirtsRequired = 2; hatsRequired = 1; crewManager = null },
      { id = 16; name = "Meat cutter"; house = #boh; code = "MTC"; openingBuildTo = 3; afterOpeningBuildTo = 3; needsAlcoholCert = false; minimumAge = 18; shirtsRequired = 2; hatsRequired = 1; crewManager = null },
      { id = 17; name = "DMO prep"; house = #boh; code = "DMO"; openingBuildTo = 3; afterOpeningBuildTo = 3; needsAlcoholCert = false; minimumAge = 16; shirtsRequired = 2; hatsRequired = 1; crewManager = null },
    ];
  };

  func seedSchedule() : [Store.ScheduleEvent] {
    [
      { id = 0; kind = #deadline; name = "Paperwork due"; start = 1_801_202_400_000_000_000; end = null },
      { id = 1; kind = #orientation; name = "Orientation BOH"; start = 1_801_321_200_000_000_000; end = null },
      { id = 2; kind = #orientation; name = "Orientation FOH"; start = 1_801_335_600_000_000_000; end = null },
      { id = 3; kind = #trainingDay; name = "Training Day 1"; start = 1_801_461_600_000_000_000; end = null },
      { id = 4; kind = #trainingDay; name = "Training Day 2"; start = 1_801_548_000_000_000_000; end = null },
      { id = 5; kind = #orientation; name = "Makeup orientation"; start = 1_801_576_800_000_000_000; end = null },
      { id = 6; kind = #trainingDay; name = "Training Day 3"; start = 1_801_634_400_000_000_000; end = null },
      { id = 7; kind = #trainingDay; name = "Training Day 4"; start = 1_801_720_800_000_000_000; end = null },
      { id = 8; kind = #friendsAndFamily; name = "Friends & Family"; start = 1_801_807_200_000_000_000; end = null },
      { id = 9; kind = #friendsAndFamily; name = "Friends & Family"; start = 1_801_980_000_000_000_000; end = null },
      { id = 10; kind = #openingDay; name = "Opening day"; start = 1_802_066_400_000_000_000; end = null },
      { id = 11; kind = #signOff; name = "Final trainer sign-off"; start = 1_802_584_800_000_000_000; end = null },
    ];
  };

  func seedOrientationUniform() : [Store.ChecklistItem] {
    [
      { id = 0; text = "Non-slip shoes"; requiresAlcoholCert = false; minorOnly = false },
      { id = 1; text = "Dark blue jeans"; requiresAlcoholCert = false; minorOnly = false },
      { id = 2; text = "Hair"; requiresAlcoholCert = false; minorOnly = false },
      { id = 3; text = "Piercings"; requiresAlcoholCert = false; minorOnly = false },
      { id = 4; text = "Smile"; requiresAlcoholCert = false; minorOnly = false },
      { id = 5; text = "Name tag"; requiresAlcoholCert = false; minorOnly = false },
    ];
  };

  func seedPaperwork() : [Store.ChecklistItem] {
    [
      { id = 0; text = "Onboarding"; requiresAlcoholCert = false; minorOnly = false },
      { id = 1; text = "Policies & procedures"; requiresAlcoholCert = false; minorOnly = false },
      { id = 2; text = "Food handler card"; requiresAlcoholCert = false; minorOnly = false },
      { id = 3; text = "Alcohol cert"; requiresAlcoholCert = true; minorOnly = false },
      { id = 4; text = "Minor work permit"; requiresAlcoholCert = false; minorOnly = true },
    ];
  };

  func seedStoreInfo() : Store.StoreInfo {
    {
      appName = "Roadie Roster";
      storeNumber = "975";
      locationName = "Lake Charles";
      address = "1400 W Prien Lake Rd, Lake Charles, LA 70601";
      storePhone = "";
      openingDate = openingDateNs;
      timeZone = "America/Chicago";
      amShiftStart = 600;
      amShiftEnd = 900;
      pmShiftStart = 960;
      pmShiftEnd = 1320;
      leaderTalkName = "10 Minutes with Dan";
      trainingGroupSize = 5;
      leaderTalkSize = 10;
      logo = null;
    };
  };

  func seedRetention() : Store.RetentionSettings {
    {
      archivedContactSetDays = 90;
      notesDays = 365;
      archivedPhotoDays = 365;
      changeLogDays = 730;
    };
  };
};
