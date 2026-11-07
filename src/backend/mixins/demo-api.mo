import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Time "mo:core/Time";
import Timer "mo:core/Timer";
import Common "../types/common";
import Store "../types/store";
import Roadie "../types/roadie";
import Signup "../types/signup";
import Phase23 "../types/phase23";
import Access "../types/access";
import DemoLib "../lib/demo";

mixin (
  accessGrants : Map.Map<Principal, Access.AccessGrant>,
  demoState : Common.DemoState,
  roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
  signups : Map.Map<Common.SignupId, Signup.SignupSubmission>,
  crews : Map.Map<Common.CrewId, Roadie.Crew>,
  attendance : Map.Map<Nat, Phase23.AttendanceRecord>,
  trainerNotes : Map.Map<Nat, Phase23.TrainerNote>,
  orientationCheckoffs : Map.Map<Common.RoadieId, Phase23.OrientationCheckoff>,
  shiftBoards : Map.Map<Text, Phase23.ShiftBoard>,
  groupChangeNotices : Map.Map<Nat, Phase23.GroupChangeNotice>,
  leaderTalks : Map.Map<Common.LeaderTalkId, Phase23.LeaderTalk>,
  finalSignOffs : Map.Map<Common.RoadieId, Phase23.FinalSignOff>,
  positions : Map.Map<Common.PositionId, Store.Position>,
  storeInfo : { var value : Store.StoreInfo },
  changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>,
  counters : DemoLib.Counters,
) {
  /// Schedule the automatic demo-mode off so it is recorded even when no later
  /// update follows the eight-hour mark. The timer callback runs as a system
  /// message and logs the off with the system actor as `who`.
  func scheduleAutoOff() : async () {
    switch (DemoLib.autoOffDelayNs(demoState, Time.now())) {
      case (?delayNs) {
        ignore Timer.setTimer<system>(
          #nanoseconds(delayNs),
          func() : async () {
            DemoLib.autoOffIfDue(demoState, changeLog, counters, Time.now());
          },
        );
      };
      case null {};
    };
  };

  /// Read the current demo state for the calling principal. Any caller,
  /// including unregistered users, so the banner can render on the sign-in and
  /// waiting screens. `demoRole` and `demoTrainerStations` describe the
  /// caller's own demo role.
  public query ({ caller }) func getDemoState() : async Common.DemoStateView {
    DemoLib.getDemoState(accessGrants, demoState, caller);
  };

  /// Turn demo mode on or off (Admin only). Turning it on requires the literal
  /// confirmation "DEMO"; turning it on sets the eight-hour auto-off time.
  /// Every on/off is written to the change log.
  public shared ({ caller }) func setDemoMode(enabled : Bool, confirmation : Text) : async Common.DemoActionResult {
    let result = DemoLib.setDemoMode(accessGrants, demoState, changeLog, counters, caller, enabled, confirmation);
    switch (result) {
      case (#ok(_)) { if (enabled) { await scheduleAutoOff() } };
      case (#err(_)) {};
    };
    result;
  };

  /// Set the impersonated demo role and, for a demo NSO Trainer, the stations
  /// that role may see. Any signed-in caller may choose a demo role while demo
  /// mode is on.
  public shared ({ caller }) func setDemoRole(role : Common.DemoRole, stations : [Common.PositionId]) : async Common.DemoActionResult {
    DemoLib.setDemoRole(accessGrants, demoState, caller, role, stations);
  };

  /// Choose which demo leader a demo NSO Trainer views as, so "View as NSO
  /// Trainer" can see that leader's group. Stored per caller while demo mode is
  /// on; ignored outside demo mode.
  public shared ({ caller }) func setDemoTrainerAs(trainerPrincipal : Principal) : async Common.DemoActionResult {
    DemoLib.setDemoTrainerAs(accessGrants, demoState, caller, trainerPrincipal);
  };

  /// Choose which demo manager a demo Store Manager or Training Manager views
  /// as, so "My crew" and the Roster "My crew" chip match the chosen manager's
  /// crew. Stored per caller while demo mode is on; ignored outside demo mode.
  public shared ({ caller }) func setDemoManagerAs(managerPrincipal : Principal) : async Common.DemoActionResult {
    DemoLib.setDemoManagerAs(accessGrants, demoState, caller, managerPrincipal);
  };

  /// Set or clear the pretend "now" used while demo mode is on. Null restores
  /// the real clock.
  public shared ({ caller }) func setPretendDate(pretendDate : ?Common.PretendDate) : async Common.DemoActionResult {
    DemoLib.setPretendDate(accessGrants, demoState, caller, pretendDate);
  };

  /// Count the demo records currently loaded.
  public query func getDemoDataSummary() : async Common.DemoDataSummary {
    DemoLib.getDemoDataSummary(accessGrants, roadies, signups, crews, attendance, trainerNotes);
  };

  /// Seed the demo data set (Admin, demo mode only).
  public shared ({ caller }) func loadDemoData() : async Common.DemoDataSummary {
    DemoLib.loadDemoData(accessGrants, demoState, roadies, signups, crews, attendance, trainerNotes, positions, storeInfo, changeLog, counters, caller);
  };

  /// Remove every demo record (Admin, demo mode only). Real records are never
  /// touched.
  public shared ({ caller }) func clearDemoData() : async Common.DemoDataSummary {
    DemoLib.clearDemoData(accessGrants, demoState, roadies, signups, crews, attendance, trainerNotes, orientationCheckoffs, shiftBoards, groupChangeNotices, leaderTalks, finalSignOffs, changeLog, counters, caller);
  };
};
