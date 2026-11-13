import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Common "../types/common";
import Roadie "../types/roadie";
import Store "../types/store";
import Access "../types/access";
import Phase23 "../types/phase23";
import RoadieLib "../lib/roadie";

mixin (
  accessGrants : Map.Map<Principal, Access.AccessGrant>,
  roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
  crews : Map.Map<Common.CrewId, Roadie.Crew>,
  positions : Map.Map<Common.PositionId, Store.Position>,
  schedule : Map.Map<Common.EventId, Store.ScheduleEvent>,
  checklists : { var value : Store.Checklists },
  orientationCheckoffs : Map.Map<Common.RoadieId, Phase23.OrientationCheckoff>,
  checkIns : Map.Map<Text, Phase23.CheckInRecord>,
  changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
  counters : RoadieLib.Counters,
  demoState : Common.DemoState,
  shiftBoards : Map.Map<Text, Phase23.ShiftBoard>,
  groupChangeNotices : Map.Map<Nat, Phase23.GroupChangeNotice>,
  storeInfo : { var value : Store.StoreInfo },
) {
  /// List roadie cards visible to the caller.
  public query ({ caller }) func listRoadies() : async [Roadie.Roadie] {
    RoadieLib.listRoadies(accessGrants, demoState, roadies, storeInfo.value, checklists, positions, orientationCheckoffs, checkIns, schedule, caller);
  };

  /// Read one roadie card.
  public query ({ caller }) func getRoadie(id : Common.RoadieId) : async ?Roadie.Roadie {
    RoadieLib.getRoadie(accessGrants, demoState, roadies, storeInfo.value, checklists, positions, orientationCheckoffs, checkIns, schedule, caller, id);
  };

  /// Read a roadie's photo bytes by id, for a caller allowed to see the roadie.
  /// Returns null when the roadie has no photo or is not visible to the caller.
  public query ({ caller }) func getPhoto(id : Common.RoadieId) : async ?Common.PhotoRef {
    RoadieLib.getPhoto(accessGrants, demoState, roadies, caller, id);
  };

  /// List the roster for one position.
  public query ({ caller }) func listRosterForPosition(positionId : Common.PositionId) : async [Roadie.Roadie] {
    RoadieLib.listRosterForPosition(accessGrants, demoState, roadies, storeInfo.value, checklists, positions, orientationCheckoffs, checkIns, schedule, caller, positionId);
  };

  /// Edit a roadie's non-contact details (Admin/Store Manager only).
  public shared ({ caller }) func updateRoadieDetails(id : Common.RoadieId, profile : Roadie.RoadieProfile) : async () {
    RoadieLib.updateRoadieDetails(accessGrants, demoState, roadies, changeLog, counters, caller, id, profile);
  };

  /// Change a roadie's position or crew (Admin/Store Manager only).
  public shared ({ caller }) func changePosition(
    id : Common.RoadieId,
    mainPositionId : Common.PositionId,
    secondPositionId : ?Common.PositionId,
    crewId : ?Common.CrewId,
  ) : async () {
    RoadieLib.changePosition(accessGrants, demoState, roadies, positions, storeInfo.value, changeLog, counters, caller, id, mainPositionId, secondPositionId, crewId);
  };

  /// Archive a roadie (Admin/Store Manager only).
  public shared ({ caller }) func archiveRoadie(id : Common.RoadieId, reason : Roadie.ArchiveReason) : async () {
    RoadieLib.archiveRoadie(accessGrants, demoState, roadies, shiftBoards, groupChangeNotices, schedule, storeInfo.value, changeLog, counters, caller, id, reason);
  };

  /// Rehire an archived roadie (Admin/Store Manager only). Returns the roadie
  /// to pending and assigns the next upcoming orientation session.
  public shared ({ caller }) func rehireRoadie(id : Common.RoadieId, reason : ?Text) : async () {
    RoadieLib.rehireRoadie(accessGrants, demoState, roadies, schedule, storeInfo.value, changeLog, counters, caller, id, reason);
  };

  /// Read a roadie's contact set. Admin and Store Manager receive the contact
  /// set; every other read-capable role receives an empty array.
  public query ({ caller }) func getContactSet(id : Common.RoadieId) : async [Roadie.ContactSet] {
    RoadieLib.getContactSet(accessGrants, demoState, roadies, caller, id);
  };

  /// Per-position roster counts: on-hand roadies and open spots.
  public query ({ caller }) func getRosterSummary() : async [Roadie.RosterSummary] {
    RoadieLib.getRosterSummary(accessGrants, demoState, roadies, positions, caller);
  };

  /// Update a roadie's contact set (Admin/Store Manager only).
  public shared ({ caller }) func updateContactSet(id : Common.RoadieId, contactSet : Roadie.ContactSet) : async () {
    RoadieLib.updateContactSet(accessGrants, demoState, roadies, changeLog, counters, caller, id, contactSet);
  };

  /// Re-sign a roadie's availability (Admin/Store Manager only).
  public shared ({ caller }) func resignAvailability(id : Common.RoadieId, signature : Common.SignatureRef) : async () {
    RoadieLib.resignAvailability(accessGrants, demoState, roadies, storeInfo.value, changeLog, counters, caller, id, signature);
  };

  /// List crews.
  public query ({ caller }) func listCrews() : async [Roadie.Crew] {
    RoadieLib.listCrews(accessGrants, demoState, crews, caller);
  };

  /// List crews with their member counts (pending + active, archived excluded),
  /// for the kiosk approval Crew dropdown.
  public query ({ caller }) func listCrewSummaries() : async [Roadie.CrewSummary] {
    RoadieLib.listCrewSummaries(accessGrants, demoState, crews, roadies, caller);
  };

  /// Create a crew owned by `leaderPrincipal` (Admin/Store Manager only). The
  /// owner is required and must be an approved Admin, Store Manager or Training
  /// Manager leader; a manager may own only one crew.
  public shared ({ caller }) func createCrew(name : Text, leaderPrincipal : Principal) : async Common.CrewId {
    RoadieLib.createCrew(accessGrants, demoState, crews, changeLog, counters, caller, name, leaderPrincipal);
  };

  /// Rename a crew and/or change its owner (Admin/Store Manager only).
  public shared ({ caller }) func updateCrew(id : Common.CrewId, name : Text, leaderPrincipal : ?Principal) : async () {
    RoadieLib.updateCrew(accessGrants, demoState, crews, changeLog, counters, caller, id, name, leaderPrincipal);
  };

  /// Delete a crew (Admin/Store Manager only). Refuses while any roadie is
  /// assigned to the crew.
  public shared ({ caller }) func deleteCrew(id : Common.CrewId) : async () {
    RoadieLib.deleteCrew(accessGrants, demoState, crews, roadies, changeLog, counters, caller, id);
  };

  /// List change-log entries visible to the caller.
  public query ({ caller }) func listChangeLog() : async [Roadie.ChangeLogEntry] {
    RoadieLib.listChangeLog(accessGrants, demoState, roadies, changeLog, caller);
  };

  /// Compute whether a roadie is a minor as of now.
  public query ({ caller }) func isMinor(id : Common.RoadieId) : async Bool {
    RoadieLib.isMinor(accessGrants, demoState, roadies, storeInfo.value, caller, id);
  };
};
