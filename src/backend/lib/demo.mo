import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Principal "mo:core/Principal";
import Order "mo:core/Order";
import Text "mo:core/Text";
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

/// Demo-mode domain logic. Demo mode is off by default; only a real Admin may
/// turn it on, and turning it on requires the literal confirmation "DEMO". It
/// turns itself off automatically eight hours after it was turned on. Demo
/// records are stored alongside real records and separated by an `isDemo` flag,
/// so while demo mode is on every query and export returns only demo records,
/// and while it is off demo records are invisible everywhere.
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

  /// Nanoseconds in one day, for the demo date-of-birth math.
  let dayNs : Int = 86_400_000_000_000;

  /// The literal an Admin must type to turn demo mode on.
  let confirmWord : Text = "DEMO";

  /// The base URL every demo photo file is appended to. Demo-only: only Load
  /// demo data ever writes a `demoPhotoUrl`.
  let demoPhotoBase : Text = "https://cdn.openart.ai/openart/thumbnail/production/2026-11/create-image/user_2rgwx5FhHQr9nSA3Kp96bFk1tis/";

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

  /// One demo person from the seed table: full name, preferred name (null when
  /// none), age, the position name to match, the photo file name and the
  /// birthday as "MM-DD".
  type Person = {
    fullName : Text;
    preferredName : ?Text;
    age : Nat;
    positionName : Text;
    file : Text;
    birthday : Text;
  };

  /// The 40 demo roadies in loop order (index i = Ri).
  let people : [Person] = [
    { fullName = "Jasmine Thibodeaux"; preferredName = ?"Jaz"; age = 22; positionName = "Servers"; file = "021793885636990798132a7c84228b35f5c1a465b83379e670abb_0_1793885650053_864ee236.webp"; birthday = "03-14" },
    { fullName = "Tyler Guidry"; preferredName = ?"Ty"; age = 24; positionName = "Servers"; file = "02179388563917822877b9ff06629ca98d99f0267ba452b2b4d32_0_1793885650592_ea877f0a.webp"; birthday = "07-02" },
    { fullName = "Marisol Vega"; preferredName = ?"Mari"; age = 26; positionName = "Bartenders"; file = "02179388563919668bed1fb63597428c3971f167251da48ca5e9b_0_1793885666267_9746a479.webp"; birthday = "11-21" },
    { fullName = "Connor Broussard"; preferredName = null; age = 20; positionName = "Server assistants"; file = "0217938856420934dfea62baf69d67974043520385d8b3c3edc5d_0_1793885655441_f78c7e9d.webp"; birthday = "01-09" },
    { fullName = "Aaliyah Washington"; preferredName = ?"Liyah"; age = 21; positionName = "Hosts"; file = "021793885642969e14146857e7ceaf6846d2c1b56e6ac77a60ac6_0_1793885655543_2e905ac0.webp"; birthday = "05-30" },
    { fullName = "Brandon Nguyen"; preferredName = null; age = 23; positionName = "To-go"; file = "021793885643879f0a583d75381f7c0a662383f3247915eebde6f_0_1793885654179_bfa8d49c.webp"; birthday = "09-17" },
    { fullName = "Cody LeBlanc"; preferredName = null; age = 27; positionName = "Fry / Salad"; file = "021793885644410c95e3350f28d4e5f7ad155450ef541a3fd3430_0_1793885654562_2f029860.webp"; birthday = "12-05" },
    { fullName = "Emma Fontenot"; preferredName = null; age = 16; positionName = "Hosts"; file = "02179388564886732716c93dca5f9defc0d360fd0d690bd209045_0_1793885660222_636b1fea.webp"; birthday = "04-12" },
    { fullName = "DeShawn Moore"; preferredName = ?"Shawn"; age = 25; positionName = "Dish"; file = "02179388564910330d072d337ea6fcc7bbfbe2f0c485be2224459_0_1793885659383_86ddc378.webp"; birthday = "08-23" },
    { fullName = "Sofia Ramirez"; preferredName = null; age = 22; positionName = "Servers"; file = "0217938856508891f48ceb9aa55112abbdf6fec19339eb3fa438c_0_1793885672968_be4d661e.webp"; birthday = "02-28" },
    { fullName = "Jake Hebert"; preferredName = null; age = 29; positionName = "Pizza"; file = "0217938856527497afbd658227445da69c5198dc2d1b7085d5423_0_1793885664461_3ef34e9c.webp"; birthday = "06-11" },
    { fullName = "Kayla Richard"; preferredName = null; age = 19; positionName = "Server assistants"; file = "021793885680679c95e3350f28d4e5f7ad155450ef541a3df8be5_0_1793885702485_191e192a.webp"; birthday = "10-03" },
    { fullName = "Marcus Johnson"; preferredName = null; age = 31; positionName = "Broil / Saute"; file = "0217938856818284498c7002523dcce63b4e4e02dd9ae9c7975e8_0_1793885694031_58ec7356.webp"; birthday = "01-26" },
    { fullName = "Priya Patel"; preferredName = null; age = 24; positionName = "Servers"; file = "0217938856837176408ead186a36b7a71ea661df61e4b0cd6edd3_0_1793885693607_9906dbe8.webp"; birthday = "07-19" },
    { fullName = "Hunter Landry"; preferredName = null; age = 22; positionName = "Bartenders"; file = "021793885686225fdccfc102ca12157f94275e78054dc3b41b293_0_1793885696744_3e199b3e.webp"; birthday = "03-08" },
    { fullName = "Gabriela Torres"; preferredName = ?"Gabby"; age = 20; positionName = "To-go"; file = "021793885686859c2670fe791a5f29d61bdea8e0ada6c5df67f15_0_1793885696429_416c9574.webp"; birthday = "11-14" },
    { fullName = "Trey Batiste"; preferredName = null; age = 26; positionName = "Hot prep"; file = "02179388568781499a3f43520201fc0164769d66e52699f7fd5c9_0_1793885697632_f2f75e06.webp"; birthday = "05-22" },
    { fullName = "Madison Doucet"; preferredName = ?"Maddie"; age = 23; positionName = "Servers"; file = "0217938856983246097278e78ff109d0bf5de77146291ac94716d_0_1793885709116_c2a44ed1.webp"; birthday = "09-09" },
    { fullName = "Luis Hernandez"; preferredName = null; age = 30; positionName = "Sear"; file = "021793885700708dbab82a5e050003614ff9828ffe9bef21fd279_0_1793885713364_b4ee774f.webp"; birthday = "12-18" },
    { fullName = "Chloe Bergeron"; preferredName = null; age = 17; positionName = "Server assistants"; file = "021793885700753c305af2c12e62e554ff5b6f08b2a8ff791f2f2_0_1793885711935_ebdc3146.webp"; birthday = "09-23" },
    { fullName = "Andre Simmons"; preferredName = ?"Dre"; age = 28; positionName = "Bartenders"; file = "0217938857027394dfea62baf69d67974043520385d8b3caf84df_0_1793885713760_e04a1672.webp"; birthday = "02-07" },
    { fullName = "Hailey Granger"; preferredName = null; age = 21; positionName = "Hosts"; file = "02179388570377445ed1e5750293ff098e8b34eca79d24a2e71af_0_1793885711503_90a4f023.webp"; birthday = "06-25" },
    { fullName = "Kevin Tran"; preferredName = null; age = 25; positionName = "Point / Build"; file = "02179388573372399f4740eadd3360aa6250e68d85f7ec7d89952_0_1793885747056_f5d53efe.webp"; birthday = "10-30" },
    { fullName = "Destiny Jackson"; preferredName = null; age = 22; positionName = "Servers"; file = "021793885734728b965c2d2b2bb89ed3e2dfeb918ea3f765ece6f_0_1793885745900_6065b94c.webp"; birthday = "04-04" },
    { fullName = "Ethan Comeaux"; preferredName = null; age = 19; positionName = "Dish"; file = "02179388573574370c18af9f89e89788c62dbe222232361cac8a6_0_1793885750783_508b88cc.webp"; birthday = "08-15" },
    { fullName = "Isabella Morales"; preferredName = ?"Bella"; age = 24; positionName = "Servers"; file = "02179388573665768bed1fb63597428c3971f167251da4845985a_0_1793885754863_5c0a3c1b.webp"; birthday = "01-19" },
    { fullName = "Noah Arceneaux"; preferredName = null; age = 27; positionName = "Expo"; file = "02179388573886128c256f90ee836450e608b7d1b1192f38bf580_0_1793885764803_3e082653.webp"; birthday = "07-27" },
    { fullName = "Tiana Celestine"; preferredName = null; age = 23; positionName = "Bartenders"; file = "021793885739766dc50f194675e1cbc6bc0c2210aaea0b05359ec_0_1793885750155_a42bf0ec.webp"; birthday = "11-02" },
    { fullName = "Ryan Boudreaux"; preferredName = null; age = 20; positionName = "Fry / Salad"; file = "021793885740722b965c2d2b2bb89ed3e2dfeb918ea3f76f7070f_0_1793885751998_88218da4.webp"; birthday = "03-21" },
    { fullName = "Megan Schexnayder"; preferredName = null; age = 22; positionName = "Servers"; file = "021793885742780cceb5af4e027c6aad3bf6ae2fce15c1a81cde0_0_1793885752646_a981c4b8.webp"; birthday = "05-06" },
    { fullName = "Carlos Mendoza"; preferredName = null; age = 33; positionName = "Meat cutter"; file = "0217938857454286438f8a7da3edc67692fae0fdfd3f96176d775_0_1793885758948_ce5ded85.webp"; birthday = "09-28" },
    { fullName = "Jordan Babineaux"; preferredName = null; age = 21; positionName = "Server assistants"; file = "0217938857459623a96cb89bb0639877068f7507e34a86a21cd01_0_1793885759471_146f36bc.webp"; birthday = "12-12" },
    { fullName = "Samantha Romero"; preferredName = ?"Sam"; age = 25; positionName = "Servers"; file = "0217938857479219f6cd41e8514911883ec9f138006f90f82a4b9_0_1793885758539_7cf1d25f.webp"; birthday = "02-16" },
    { fullName = "Malik Francois"; preferredName = null; age = 24; positionName = "Pizza"; file = "021793885776869df1fe1cc6cb558c8468775817e951d5da3173c_0_1793885792287_488cab9f.webp"; birthday = "06-03" },
    { fullName = "Lauren Mouton"; preferredName = null; age = 26; positionName = "Cold prep"; file = "021793885777277f6ba3ba09f8d739ff3017972d8947b2ee70255_0_1793885790385_281db3d0.webp"; birthday = "10-24" },
    { fullName = "Darius Guillory"; preferredName = null; age = 22; positionName = "Dish"; file = "02179388577894715b33ccaa151d3ed7feaaa761bc71c373c0dfb_0_1793885792730_0231e60b.webp"; birthday = "01-31" },
    { fullName = "Ava Melancon"; preferredName = null; age = 20; positionName = "Servers"; file = "021793885788529e8ad6f8fac80a9b78040141fa10ae51d86983f_0_1793885799523_6c7f625b.webp"; birthday = "08-08" },
    { fullName = "Miguel Castillo"; preferredName = null; age = 29; positionName = "Hot prep"; file = "021793885791099d82d61e1341a38f1d55b18f5893f198bb0fb0d_0_1793885801392_2f876e59.webp"; birthday = "04-27" },
    { fullName = "Brianna Dupuis"; preferredName = ?"Bri"; age = 23; positionName = "Bake"; file = "0217938857927607dca00f85baedac28bed28ae8d5f3a99ad6532_0_1793885802623_02ced317.webp"; birthday = "07-13" },
    { fullName = "Xavier Lewis"; preferredName = ?"X"; age = 21; positionName = "Silverware roller"; file = "021793885794884f99996bc9b27db5cda0ac6dd5ae68eda601df6_0_1793885805985_3c1fafd5.webp"; birthday = "11-29" },
  ];

  /// A demo leader: full name, title, photo file, the role they hold, the
  /// trainer stations they cover (empty for non-trainers) and their home store
  /// number (null for the Market Partner and the store managers, who default to
  /// the store's own number).
  type Leader = {
    fullName : Text;
    title : Text;
    file : Text;
    role : Common.Role;
    stations : [Common.PositionId];
    homeStoreNumber : ?Text;
  };

  /// The demo leaders: Renee Hollier (Market Partner), the 6 store managers who
  /// each own a crew, and the 2 NSO Trainers. Terrence Wallace is gone.
  let leaders : [Leader] = [
    { fullName = "Renee Hollier"; title = "Market Partner"; file = "02179388579587334cb6184a92ddd9ae87302c189a666e5ca5bb3_0_1793885811668_24a7bc22.webp"; role = #leadership; stations = []; homeStoreNumber = null },
    { fullName = "Todd Samples"; title = "Kitchen Manager"; file = "02179405908045496d528c8df2143421f3e331d7739c2b1600af0_0_1794059092330_27ad7ec0.webp"; role = #storeManager; stations = []; homeStoreNumber = ?"Store 975" },
    { fullName = "Michael Ditmore"; title = "Kitchen Manager"; file = "021794059081947a56759b1655b332d491b27841bc4d041538990_0_1794059092039_9f0912c0.webp"; role = #storeManager; stations = []; homeStoreNumber = ?"Store 975" },
    { fullName = "Spencer Stawecki"; title = "Kitchen Manager"; file = "021794059082850e8a97f786c365ea5f8ca348976dbfcd2f8490d_0_1794059093942_00376dd7.webp"; role = #storeManager; stations = []; homeStoreNumber = ?"Store 975" },
    { fullName = "Cassy Smith"; title = "Service Manager"; file = "0217940590834328b571bdff213a087fe7b071b496c8689c211eb_0_1794059094040_fd3a76a5.webp"; role = #storeManager; stations = []; homeStoreNumber = ?"Store 975" },
    { fullName = "Alivia Abercrombie"; title = "Service Manager"; file = "0217940590859086438f8a7da3edc67692fae0fdfd3f961d8c338_0_1794059097177_d97c7fef.webp"; role = #storeManager; stations = []; homeStoreNumber = ?"Store 975" },
    { fullName = "Tasha Matthews"; title = "Service Manager"; file = "0217940590859262b8720b6d986e81ce95e9b006de0a2cb7d8b55_0_1794059095817_cdba58b0.webp"; role = #storeManager; stations = []; homeStoreNumber = ?"Store 975" },
    { fullName = "Kristen Marcotte"; title = "NSO Trainer"; file = "02179388580002411300f35b2a874e35aceb4d35afb57b8b7ff31_0_1793885812806_9a06e679.webp"; role = #trainer; stations = [0, 1]; homeStoreNumber = ?"Store 512" },
    { fullName = "Ramon Delgado"; title = "NSO Trainer"; file = "021793885801253d45041e92366fce25871fcc31e231b4dedc4a1_0_1793885811703_df19bec1.webp"; role = #trainer; stations = [2, 3]; homeStoreNumber = ?"Store 733" },
  ];

  // --- About Me pools: varied, believable answers selected per person. ---

  let hometowns : [Text] = [
    "Sulphur, LA", "Moss Bluff, LA", "Lafayette, LA", "Beaumont, TX",
    "DeRidder, LA", "Jennings, LA", "Lake Charles, LA", "Vinton, LA",
    "Iowa, LA", "Westlake, LA", "Carlyss, LA", "Hackberry, LA",
  ];

  let hobbies : [Text] = [
    "Fishing and kayaking", "Cooking for family", "Pickup basketball",
    "Hunting and camping", "Reading mystery novels", "Painting and sketching",
    "Running 5Ks", "Watching baseball", "Gardening", "Playing guitar",
    "Volunteering at church", "Working on my truck",
  ];

  let teams : [Text] = [
    "New Orleans Saints", "LSU Tigers", "McNeese Cowboys", "Houston Astros",
    "Dallas Cowboys", "New Orleans Pelicans", "Texas Longhorns", "Atlanta Braves",
    "New Orleans Saints", "McNeese Cowboys", "LSU Tigers", "New Orleans Saints",
  ];

  let snacks : [Text] = [
    "Boudin and crackers", "Chili cheese Fritos", "Beef jerky", "Trail mix",
    "Popcorn", "Cheese and grapes", "Chips and salsa", "Frozen grapes",
    "Peanut butter pretzels", "Cracklins", "Granola bars", "Dark chocolate",
  ];

  let drinks : [Text] = [
    "Sweet tea", "Dr Pepper", "Iced coffee", "Lemonade",
    "Root beer", "Water with lime", "Mango smoothie", "Hot chocolate",
    "Sprite", "Coconut water", "Sweet tea", "Dr Pepper",
  ];

  let colors : [Text] = [
    "Crimson red", "Navy blue", "Forest green", "Sunset orange",
    "Purple", "Teal", "Gold", "Sky blue",
    "Maroon", "Black", "Coral", "Silver",
  ];

  let funFacts : [Text] = [
    "I can juggle three balls", "I once caught a 30-pound catfish",
    "I speak a little Spanish", "I was on my high school dance team",
    "I can solve a Rubik's cube", "I've been to 12 states",
    "I make my own hot sauce", "I played trumpet in the band",
    "I can whistle through my teeth", "I've never broken a bone",
    "I collect vintage postcards", "I can name every parish in Louisiana",
  ];

  let goals : [Text] = [
    "To become a certified trainer", "To lead my own shift",
    "To save up for a car", "To finish my degree",
    "To move up to management", "To learn every station",
    "To be the best on my team", "To buy my first house",
    "To train new hires", "To open my own restaurant one day",
    "To get my bartending certification", "To earn a full-time spot",
  ];

  /// Internal: pick a pool entry for person `i`, spreading the choice with a
  /// per-field multiplier so no two people share the same combination.
  func pick(pool : [Text], i : Nat, mult : Nat) : Text {
    pool[(i * mult) % pool.size()];
  };

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
  /// `who`, and the pretend date and every caller's demo role are cleared,
  /// exactly like a manual off.
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

  /// Clear the demo-mode flags, the pretend date and every caller's stored demo
  /// role. Shared by the manual off and the automatic off so both leave the
  /// same clean state.
  func turnOff(demoState : Common.DemoState) {
    demoState.enabled := false;
    demoState.turnedOnAt := null;
    demoState.autoOffAt := null;
    demoState.pretendDate := null;
    demoState.demoRoles.clear();
  };

  /// Build the shared view of the demo state for one caller. `demoRole` and
  /// `demoTrainerStations` describe that caller's own demo role, or null/empty
  /// when demo mode is off or the caller is anonymous. `demoTrainerAs` is the
  /// demo leader the caller is viewing as, defaulting to the first demo leader
  /// who leads a group when the caller has not chosen one. `demoManagerAs` is
  /// the demo manager the caller is viewing as, defaulting to the first demo
  /// manager when the caller has not chosen one.
  func toView(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    caller : Principal,
    now : Int,
  ) : Demo.DemoStateView {
    let on = isOn(demoState, now);
    let role = if (on) { Auth.demoRoleFor(demoState, caller) } else { null };
    let stations = if (on) { Auth.demoTrainerStationsFor(demoState, caller) } else { [] };
    let trainerAs = if (on) {
      switch (demoState.demoTrainerAs.get(caller)) {
        case (?leader) { ?leader };
        case null { defaultDemoTrainer(accessGrants) };
      };
    } else { null };
    let managerAs = if (on) {
      switch (demoState.demoManagerAs.get(caller)) {
        case (?manager) { ?manager };
        case null { defaultDemoManager(accessGrants) };
      };
    } else { null };
    {
      enabled = on;
      turnedOnAt = demoState.turnedOnAt;
      autoOffAt = demoState.autoOffAt;
      pretendDate = demoState.pretendDate;
      demoRole = role;
      demoTrainerStations = stations;
      demoTrainerAs = trainerAs;
      demoManagerAs = managerAs;
    };
  };

  /// Read the current demo state as a shared view for the calling principal.
  /// Any caller, including unregistered users, so the banner can render on the
  /// sign-in and waiting screens.
  public func getDemoState(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    caller : Principal,
  ) : Demo.DemoStateView {
    toView(accessGrants, demoState, caller, Time.now());
  };

  /// Turn demo mode on or off. Both directions require a **real** Admin grant
  /// (demo impersonation is ignored). Turning it on requires the literal
  /// confirmation "DEMO" and sets the eight-hour auto-off time; turning it on
  /// while it is already on is refused, so the eight-hour window cannot be
  /// extended. Every on/off is written to the change log.
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
      if (isOn(demoState, now)) {
        return #err("Demo mode is already on");
      };
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
    #ok(toView(accessGrants, demoState, caller, now));
  };

  /// Set the calling principal's own impersonated demo role and, for a demo NSO
  /// Trainer, the stations that role may see. Any signed-in caller may choose a
  /// demo role while demo mode is on; the choice is stored per caller, so it
  /// changes only the choosing caller's view. The backend enforces the same
  /// permission rules for the impersonated role as for a real user with that
  /// role.
  public func setDemoRole(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
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
    demoState.demoRoles.add(caller, { role; stations });
    #ok(toView(accessGrants, demoState, caller, now));
  };

  /// Set the calling principal's chosen demo leader to view as while demo mode
  /// is on. Any signed-in caller may choose; the choice is stored per caller so
  /// it changes only the choosing caller's view. The chosen principal must be a
  /// demo leader who leads a group.
  public func setDemoTrainerAs(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    caller : Principal,
    trainerPrincipal : Principal,
  ) : Demo.DemoActionResult {
    if (caller.isAnonymous()) {
      return #err("Sign in to choose a demo trainer");
    };
    let now = Time.now();
    if (not isOn(demoState, now)) {
      return #err("Demo mode is off");
    };
    if (not demoGroupLeaders(accessGrants).contains(trainerPrincipal)) {
      return #err("Pick a demo trainer");
    };
    demoState.demoTrainerAs.add(caller, trainerPrincipal);
    #ok(toView(accessGrants, demoState, caller, now));
  };

  /// Set the calling principal's chosen demo manager to view as while demo mode
  /// is on and their demo role is Store Manager or Training Manager. Any
  /// signed-in caller may choose; the choice is stored per caller so it changes
  /// only the choosing caller's view. The chosen principal must be a demo
  /// manager (an approved Admin, Store Manager or Training Manager leader).
  public func setDemoManagerAs(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    caller : Principal,
    managerPrincipal : Principal,
  ) : Demo.DemoActionResult {
    if (caller.isAnonymous()) {
      return #err("Sign in to choose a demo manager");
    };
    let now = Time.now();
    if (not isOn(demoState, now)) {
      return #err("Demo mode is off");
    };
    if (not demoManagers(accessGrants).contains(managerPrincipal)) {
      return #err("Pick a demo manager");
    };
    demoState.demoManagerAs.add(caller, managerPrincipal);
    #ok(toView(accessGrants, demoState, caller, now));
  };

  /// Set or clear the pretend "now" used while demo mode is on. Null restores
  /// the real clock.
  public func setPretendDate(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
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
    #ok(toView(accessGrants, demoState, caller, now));
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

  /// Internal: the demo leaders who lead a group, ordered by principal so the
  /// default choice is stable. A demo leader leads a group when their role is
  /// NSO Trainer — trainers lead the training groups on the shift boards.
  func demoGroupLeaders(accessGrants : Map.Map<Principal, Access.AccessGrant>) : [Principal] {
    accessGrants.values()
      .filter(func(g) = isDemoLeader(g) and g.role == #trainer)
      .map(func(g) = g.principal)
      .toArray()
      .sort();
  };

  /// Internal: the default demo trainer for a caller who has not chosen one —
  /// the first demo leader who leads a group, or null when there is none.
  func defaultDemoTrainer(accessGrants : Map.Map<Principal, Access.AccessGrant>) : ?Principal {
    let leaders = demoGroupLeaders(accessGrants);
    if (leaders.size() == 0) { null } else { ?leaders[0] };
  };

  /// Internal: the demo managers, ordered by principal so the default choice is
  /// stable. A demo manager is a demo leader whose role is Admin, Store Manager
  /// or Training Manager — the roles eligible to own a crew.
  func demoManagers(accessGrants : Map.Map<Principal, Access.AccessGrant>) : [Principal] {
    accessGrants.values()
      .filter(func(g) = isDemoLeader(g) and (g.role == #admin or g.role == #storeManager or g.role == #trainingManager))
      .map(func(g) = g.principal)
      .toArray()
      .sort();
  };

  /// Internal: the default demo manager for a caller who has not chosen one —
  /// the first demo manager, or null when there is none.
  func defaultDemoManager(accessGrants : Map.Map<Principal, Access.AccessGrant>) : ?Principal {
    let managers = demoManagers(accessGrants);
    if (managers.size() == 0) { null } else { ?managers[0] };
  };

  /// The derived stage each demo roadie should show, indexed by loop position
  /// `i`. The two archived indices (11 and 29) are placeholders and ignored.
  /// The demo starts at the beginning of the pipeline: every non-archived
  /// roadie is booked into the demo Orientation event with rosterState
  /// #pending, so the only stages are Hired (0–3 paperwork items checked) and
  /// Paperwork Done (every applicable item checked). The spread is 20 Hired and
  /// 18 Paperwork Done, interleaved so positions and crews mix across stages;
  /// the two minors (indices 7 and 19) are Paperwork Done.
  let demoStages : [Roadie.RoadieStage] = [
    #hired, #paperworkDone, #hired, #paperworkDone,
    #hired, #paperworkDone, #hired, #paperworkDone,
    #hired, #paperworkDone, #hired, #hired,
    #paperworkDone, #hired, #paperworkDone, #hired,
    #paperworkDone, #hired, #paperworkDone, #paperworkDone,
    #hired, #paperworkDone, #hired, #paperworkDone,
    #hired, #paperworkDone, #hired, #paperworkDone,
    #hired, #hired, #paperworkDone, #hired,
    #paperworkDone, #hired, #paperworkDone, #hired,
    #paperworkDone, #hired, #hired, #hired,
  ];

  /// Internal: the id of the first schedule event of `kind`, or null when the
  /// schedule has none.
  func firstEventOfKind(
    schedule : Map.Map<Common.EventId, Store.ScheduleEvent>,
    kind : Store.EventKind,
  ) : ?Common.EventId {
    switch (schedule.values().find(func(e) = e.kind == kind)) {
      case (?e) { ?e.id };
      case null { null };
    };
  };

  /// Internal: the ids (as text) of the paperwork items that apply to a roadie
  /// with `position` and `isMinor`, mirroring the backend's applicable-paperwork
  /// rule (respecting "Only alcohol positions" and "Only under 18", and skipping
  /// disabled items).
  func applicablePaperworkIds(
    checklists : Store.Checklists,
    position : ?Store.Position,
    isMinor : Bool,
  ) : [Text] {
    let needsAlcohol = switch (position) {
      case (?p) { p.needsAlcoholCert };
      case null { false };
    };
    checklists.paperwork
      .filter(func(item) = item.enabled and (not item.requiresAlcoholCert or needsAlcohol) and (not item.minorOnly or isMinor))
      .map(func(item) = item.id.toText());
  };

  /// Internal: the first `n` entries of `items` (all of them when `n` is at
  /// least the size).
  func takeItems(items : [Text], n : Nat) : [Text] {
    var out : [Text] = [];
    var k = 0;
    while (k < items.size() and k < n) {
      out := out.concat([items[k]]);
      k += 1;
    };
    out;
  };

  /// Seed the demo data set (real Admin, demo mode only): 40 realistic roadies
  /// spread across positions with demo photo URLs and full About Me answers,
  /// 2 minors and 2 archived; 6 crews each owned by one of the 6 demo managers;
  /// Renee Hollier and the two NSO Trainers; and 3 pending kiosk sign-ups
  /// including one phone duplicate. Every non-archived roadie is booked into the
  /// demo Orientation event and assigned to a crew: back-of-house positions
  /// round-robin across the three kitchen-manager crews, front-of-house
  /// positions round-robin across the three service-manager crews. The demo
  /// starts at the beginning of the pipeline: every non-archived roadie is
  /// pending with no orientation attendance, no check-ins, no shift boards and
  /// no uniform check-offs, so the derived stage shows only Hired (0–3 paperwork
  /// items checked) and Paperwork Done (every applicable item checked): about 20
  /// Hired and 18 Paperwork Done.
  /// Returns the new counts. Idempotent: loading again does not duplicate the
  /// seed.
  public func loadDemoData(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    signups : Map.Map<Common.SignupId, Signup.SignupSubmission>,
    crews : Map.Map<Common.CrewId, Roadie.Crew>,
    attendance : Map.Map<Nat, Phase23.AttendanceRecord>,
    trainerNotes : Map.Map<Nat, Phase23.TrainerNote>,
    orientationCheckoffs : Map.Map<Common.RoadieId, Phase23.OrientationCheckoff>,
    checkIns : Map.Map<Text, Phase23.CheckInRecord>,
    schedule : Map.Map<Common.EventId, Store.ScheduleEvent>,
    checklists : { var value : Store.Checklists },
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
    // Loading demo data starts the caller at the beginning: clear the pretend
    // date, reset the caller's View as back to the default demo Admin (by
    // dropping their stored role entry), and clear any demo practice progress
    // (their chosen demo trainer and manager).
    demoState.pretendDate := null;
    demoState.demoRoles.remove(caller);
    demoState.demoTrainerAs.remove(caller);
    demoState.demoManagerAs.remove(caller);
    // Idempotent: if any demo roadie already exists, the seed is already loaded.
    if (roadies.values().any(func(r) = r.isDemo)) {
      return getDemoDataSummary(accessGrants, roadies, signups, crews, attendance, trainerNotes);
    };

    let openingDate = storeInfo.value.openingDate;

    // --- Leaders (9): Renee Hollier, the 6 store managers, the 2 NSO Trainers.
    // Stored as demo access grants so they appear on the Leaders page; marked
    // by a DEMO work email so they are counted and cleared as demo data.
    var leaderPrincipals : [Principal] = [];
    var li = 0;
    while (li < leaders.size()) {
      leaderPrincipals := leaderPrincipals.concat([seedLeader(accessGrants, leaders[li], 40 + li)]);
      li += 1;
    };

    // --- Crews (6), one per store manager, named "<First>'s Crew" ---
    // leaders[1..6] are the six store managers, in order.
    var managerCrewIds : [Common.CrewId] = [];
    var mi = 1;
    while (mi <= 6) {
      let manager = leaders[mi];
      let nameParts = manager.fullName.split(#char ' ').toArray();
      let firstName = if (nameParts.size() > 0) { nameParts[0] } else { manager.fullName };
      managerCrewIds := managerCrewIds.concat([seedCrew(crews, counters, firstName # "'s Crew", leaderPrincipals[mi])]);
      mi += 1;
    };
    // Back-of-house crews: Todd, Michael, Spencer (indices 0,1,2).
    // Front-of-house crews: Cassy, Alivia, Tasha (indices 3,4,5).
    let bohCrews = [managerCrewIds[0], managerCrewIds[1], managerCrewIds[2]];
    let fohCrews = [managerCrewIds[3], managerCrewIds[4], managerCrewIds[5]];

    // --- The demo Orientation event, from the schedule ---
    let orientationEventId : ?Common.EventId = firstEventOfKind(schedule, #orientation);

    // --- Roadies (40) ---
    let positionIds = positions.keys().toArray();
    var bohCount = 0;
    var fohCount = 0;
    var i = 0;
    while (i < 40) {
      let person = people[i];
      let id = counters.nextRoadieId;
      counters.nextRoadieId := id + 1;
      let fallback = if (positionIds.size() == 0) { 0 } else { positionIds[i % positionIds.size()] };
      let positionId = positionIdFor(positions, person.positionName, fallback);
      let isMinor = i == 7 or i == 19;
      let isArchived = i == 11 or i == 29;
      // The derived stage this roadie should show. Archived roadies have no
      // stage; the placeholder is ignored.
      let stage : Roadie.RoadieStage = if (isArchived) { #hired } else { demoStages[i] };
      // Every non-archived roadie is assigned to a crew: back-of-house
      // positions round-robin across the kitchen-manager crews, front-of-house
      // positions round-robin across the service-manager crews.
      let isBoh = switch (positions.get(positionId)) {
        case (?p) { p.house == #boh };
        case null { false };
      };
      let crewId : ?Common.CrewId = if (isArchived) {
        null;
      } else if (isBoh) {
        let c = bohCrews[bohCount % 3];
        bohCount += 1;
        ?c;
      } else {
        let c = fohCrews[fohCount % 3];
        fohCount += 1;
        ?c;
      };
      let position = positions.get(positionId);
      let applicable = applicablePaperworkIds(checklists.value, position, isMinor);
      // The demo starts at the beginning of the pipeline: every non-archived
      // roadie is booked into the demo Orientation event and pending, so the
      // only stages are Hired and Paperwork Done. Paperwork Done roadies have
      // every applicable item checked; Hired roadies have 0–3 items checked
      // (never all of them, so they stay Hired).
      let paperworkItems = switch (stage) {
        case (#hired) {
          let want = i % 4;
          let maxChecked = if (applicable.size() == 0) { 0 } else { applicable.size() - 1 };
          let checkedCount = if (want > maxChecked) { maxChecked } else { want };
          takeItems(applicable, checkedCount);
        };
        case _ { applicable };
      };
      roadies.add(id, {
        id;
        profile = demoProfile(person.fullName, person.preferredName, i);
        photo = null;
        demoPhotoUrl = ?(demoPhotoBase # person.file);
        mainPositionId = positionId;
        secondPositionId = null;
        crossTrainedPositionId = null;
        crewId;
        orientationEventId = if (isArchived) { null } else { orientationEventId };
        startDate = ?openingDate;
        status = if (isArchived) { #archived } else { #hired };
        corporateEmployeeId = null;
        contactSet = ?demoContactSet(i, person.birthday, person.age, now);
        isMinor;
        birthdayMonthDay = ?person.birthday;
        archivedReason = if (isArchived) { ?#noShow } else { null };
        archivedAt = if (isArchived) { ?now } else { null };
        hiredAt = now;
        hireDate = ?openingDate;
        signedBy = null;
        rosterState = #pending;
        isDemo = true;
        stage = null;
        paperworkStep = null;
      });
      // Paperwork check-off for every non-archived roadie. No uniform
      // check-offs, no orientation attendance and no check-ins are seeded.
      if (not isArchived) {
        orientationCheckoffs.add(id, {
          roadieId = id;
          uniformItems = [];
          uniformCounts = [];
          paperworkItems;
          shirtsCount = 0;
          hatsCount = 0;
          updatedAt = now;
          isDemo = true;
        });
      };
      i += 1;
    };

    // --- Pending kiosk sign-ups (3), one a phone duplicate of another ---
    let duplicatePhone = "555-0100";
    seedSignup(signups, counters, 0, "Brittany Landry", ?"Britt", duplicatePhone, "brittany.landry@example.com", "Servers", "02179409844976945fbeaee288e5855715c9c7643a6f5a868d286_0_1794098471182_477bc68b.webp", now);
    seedSignup(signups, counters, 1, "Cameron Hebert", null, duplicatePhone, "cameron.hebert@example.com", "Broil / Saute", "021794098450810fea0cb63916d8b7cee037e8f30dc2746679fb1_0_1794098460748_9128231b.webp", now);
    seedSignup(signups, counters, 2, "Natalie Fontenot", ?"Nat", "555-0199", "natalie.fontenot@example.com", "Hosts", "021794098451872f39d09b715cb307c823cd4ff1a5ec1abd30527_0_1794098479850_32075eb3.webp", now);

    ignore ChangeLog.record(changeLog, counters, caller, "loadDemoData", null, false, "Loaded demo data");
    getDemoDataSummary(accessGrants, roadies, signups, crews, attendance, trainerNotes);
  };

  /// Remove every demo record (real Admin, demo mode only). Real records are
  /// never touched. Returns the counts that were removed.
  public func clearDemoData(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    demoState : Common.DemoState,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    signups : Map.Map<Common.SignupId, Signup.SignupSubmission>,
    crews : Map.Map<Common.CrewId, Roadie.Crew>,
    attendance : Map.Map<Nat, Phase23.AttendanceRecord>,
    trainerNotes : Map.Map<Nat, Phase23.TrainerNote>,
    orientationCheckoffs : Map.Map<Common.RoadieId, Phase23.OrientationCheckoff>,
    checkIns : Map.Map<Text, Phase23.CheckInRecord>,
    shiftBoards : Map.Map<Text, Phase23.ShiftBoard>,
    groupChangeNotices : Map.Map<Nat, Phase23.GroupChangeNotice>,
    leaderTalks : Map.Map<Common.LeaderTalkId, Phase23.LeaderTalk>,
    finalSignOffs : Map.Map<Common.RoadieId, Phase23.FinalSignOff>,
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
    removeWhere(orientationCheckoffs, Nat.compare, func(c) = c.isDemo);
    removeWhere(checkIns, Text.compare, func(c) = c.isDemo);
    removeWhere(shiftBoards, Text.compare, func(b) = b.isDemo);
    removeWhere(groupChangeNotices, Nat.compare, func(n) = n.isDemo);
    removeWhere(leaderTalks, Nat.compare, func(t) = t.isDemo);
    removeWhere(finalSignOffs, Nat.compare, func(s) = s.isDemo);
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

  /// Internal: the id of the position whose name matches `name`
  /// case-insensitively, or `fallback` when no position matches.
  func positionIdFor(
    positions : Map.Map<Common.PositionId, Store.Position>,
    name : Text,
    fallback : Common.PositionId,
  ) : Common.PositionId {
    let target = name.toLower();
    switch (positions.values().find(func(p) = p.name.toLower() == target)) {
      case (?p) { p.id };
      case null { fallback };
    };
  };

  /// Internal: seed one demo leader as a demo access grant. `aboutIndex` picks
  /// the leader's About Me answers from the shared pools.
  func seedLeader(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    leader : Leader,
    aboutIndex : Nat,
  ) : Principal {
    // A distinct synthetic principal per leader keeps them separate records.
    let principal = Principal.fromBlob(leader.fullName.encodeUtf8());
    let profile : Access.StaffProfile = {
      fullName = leader.fullName;
      requestedRole = leader.role;
      title = leader.title;
      homeStoreNumber = leader.homeStoreNumber ?? "Store 512";
      homeStoreCity = "Lake Charles";
      preferredName = null;
      workPhone = null;
      workEmail = ?demoLeaderMarker;
      photo = null;
      demoPhotoUrl = ?(demoPhotoBase # leader.file);
      trainerPositionIds = leader.stations;
      arrivalDate = null;
      departureDate = null;
      hometown = ?pick(hometowns, aboutIndex, 1);
      hobbies = ?pick(hobbies, aboutIndex, 5);
      favoriteTeam = ?pick(teams, aboutIndex, 7);
      favoriteSnack = ?pick(snacks, aboutIndex, 11);
      favoriteDrink = ?pick(drinks, aboutIndex, 13);
      favoriteColor = ?pick(colors, aboutIndex, 17);
      funFact = ?pick(funFacts, aboutIndex, 19);
      goalHere = ?pick(goals, aboutIndex, 23);
      shirtSize = ?"L";
      hatSize = ?"M";
    };
    accessGrants.add(principal, {
      principal;
      role = leader.role;
      approvedAt = Time.now();
      approvedBy = systemActor();
      accessEndsAt = null;
      trainerPositionIds = leader.stations;
      linkedRoadieId = null;
      staffProfile = ?profile;
    });
    principal;
  };

  /// Internal: seed one demo crew owned by `leaderPrincipal`, returning its id.
  func seedCrew(
    crews : Map.Map<Common.CrewId, Roadie.Crew>,
    counters : Counters,
    name : Text,
    leaderPrincipal : Principal,
  ) : Common.CrewId {
    let id = counters.nextCrewId;
    counters.nextCrewId := id + 1;
    crews.add(id, { id; name; leaderPrincipal = ?leaderPrincipal; isDemo = true });
    id;
  };

  /// Internal: a full About Me profile for demo person `i`.
  func demoProfile(name : Text, preferredName : ?Text, i : Nat) : Roadie.RoadieProfile {
    {
      name;
      preferredName;
      hometown = ?pick(hometowns, i, 1);
      hobbies = ?pick(hobbies, i, 5);
      favoriteMovie = null;
      favoriteSnack = ?pick(snacks, i, 11);
      favoriteTeam = ?pick(teams, i, 7);
      favoriteDrink = ?pick(drinks, i, 13);
      favoriteColor = ?pick(colors, i, 17);
      funFact = ?pick(funFacts, i, 19);
      goalHere = ?pick(goals, i, 23);
      positionAppliedFor = null;
      shirtSize = ?"M";
      hatSize = ?"M";
      shiftsWantedPerWeek = ?4;
      weekdayLunch = ?true;
    };
  };

  /// Internal: a contact set for demo roadie `i`. Demo contact data is fake;
  /// the date of birth is derived from the person's age and birthday so the
  /// age math and the two minors stay correct.
  func demoContactSet(i : Nat, birthday : Text, age : Nat, now : Common.Timestamp) : Roadie.ContactSet {
    {
      phone = "555-01" # pad2(i);
      email = "demo" # i.toText() # "@example.com";
      emergencyContactName = "Emergency Contact";
      emergencyContactPhone = "555-0199";
      dateOfBirth = dateOfBirthFor(birthday, age, now);
      availability = [];
      availabilitySignature = null;
      availabilitySignedAt = null;
      availabilityResignPending = false;
      managerSignature = null;
      managerSignedAt = null;
      managerSignedBy = null;
    };
  };

  /// Internal: the UTC-midnight date-of-birth timestamp for someone of `age`
  /// with the given "MM-DD" birthday, as of `now`.
  func dateOfBirthFor(birthday : Text, age : Nat, now : Common.Timestamp) : Common.DateOnly {
    let parts = birthday.split(#char '-').toArray();
    let bm = if (parts.size() == 2) { parts[0].toInt() ?? 1 } else { 1 };
    let bd = if (parts.size() == 2) { parts[1].toInt() ?? 1 } else { 1 };
    let (ny, _, _) = civilFromDays(floorDiv(now, dayNs));
    let by = ny - age.toInt();
    daysFromCivil(by, bm, bd) * dayNs;
  };

  /// Internal: zero-pad a small Nat to two digits.
  func pad2(n : Nat) : Text {
    if (n < 10) { "0" # n.toText() } else { n.toText() };
  };

  /// Internal: seed one pending demo kiosk sign-up. `positionAppliedFor` is the
  /// position name the applicant asked for, so the approval form's Main position
  /// pre-fills; `photoFile` is the demo photo file name appended to the shared
  /// demo photo base.
  func seedSignup(
    signups : Map.Map<Common.SignupId, Signup.SignupSubmission>,
    counters : Counters,
    i : Nat,
    name : Text,
    preferredName : ?Text,
    phone : Text,
    email : Text,
    positionAppliedFor : Text,
    photoFile : Text,
    now : Int,
  ) {
    let id = counters.nextSignupId;
    counters.nextSignupId := id + 1;
    signups.add(id, {
      id;
      submittedAt = now;
      profile = {
        demoProfile(name, preferredName, 44 + i) with
        positionAppliedFor = ?positionAppliedFor;
      };
      photo = null;
      demoPhotoUrl = ?(demoPhotoBase # photoFile);
      signature = null;
      contactSet = {
        phone;
        email;
        emergencyContactName = "Emergency Contact";
        emergencyContactPhone = "555-0199";
        dateOfBirth = dateOfBirthFor("06-15", 22, now);
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

  // --- Civil-date helpers (Howard Hinnant's algorithms), used only to derive
  // demo dates of birth from an age and a birthday. ---

  /// Internal: civil (year, month, day) from days since the Unix epoch.
  func civilFromDays(days : Int) : (Int, Int, Int) {
    let z = days + 719_468;
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

  /// Internal: floor division that works for negative numerators.
  func floorDiv(a : Int, b : Int) : Int {
    let q = a / b;
    if (a % b != 0 and (a < 0) != (b < 0)) { q - 1 } else { q };
  };
};
