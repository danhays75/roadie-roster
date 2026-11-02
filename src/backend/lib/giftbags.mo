import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Char "mo:core/Char";
import Text "mo:core/Text";
import Common "../types/common";
import Roadie "../types/roadie";
import Store "../types/store";
import GiftBags "../types/giftbags";
import Access "../types/access";
import Auth "auth";

module {
  /// Build the Gift Bags payload for the selected filter, across active
  /// (non-archived) roadies and, for `#all` and `#leaders`, the leader roles.
  /// Visible to Admin, Store Manager and Training Manager. Never includes
  /// phone, email or date of birth.
  public func getGiftBags(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
    positions : Map.Map<Common.PositionId, Store.Position>,
    caller : Principal,
    filter : GiftBags.GiftBagFilter,
  ) : GiftBags.GiftBagsData {
    let role = Auth.requireRegistered(accessGrants, caller);
    if (role != #admin and role != #storeManager and role != #trainingManager) {
      Runtime.trap("Access denied: Admin, Store Manager or Training Manager role required");
    };

    let active = roadies.values().filter(func r = r.status != #archived).toArray();
    let selectedRoadies = active.filter(func r = matchesFilter(r, positions, filter));
    let selectedLeaders = if (includesLeaders(filter)) {
      accessGrants.values().filter(func g = isLeaderRole(g.role)).toArray();
    } else {
      [];
    };

    let groups : [GiftBags.GiftBagGroup] = [
      buildGroup(#candySnack, selectedRoadies, selectedLeaders, func r = r.profile.favoriteSnack, func l = leaderSnack(l)),
      buildGroup(#drink, selectedRoadies, selectedLeaders, func r = r.profile.favoriteDrink, func l = leaderDrink(l)),
      buildGroup(#sportsTeam, selectedRoadies, selectedLeaders, func r = r.profile.favoriteTeam, func l = leaderTeam(l)),
      buildGroup(#color, selectedRoadies, selectedLeaders, func r = r.profile.favoriteColor, func l = leaderColor(l)),
      buildGroup(#shirtSize, selectedRoadies, selectedLeaders, func r = r.profile.shirtSize, func l = leaderShirt(l)),
      buildGroup(#hatSize, selectedRoadies, selectedLeaders, func r = r.profile.hatSize, func l = leaderHat(l)),
    ];

    let roadieLabels = selectedRoadies.map(func r = toLabel(r, positions));
    let leaderLabels = selectedLeaders.map(func g = leaderLabel(g));
    let labels = roadieLabels.concat(leaderLabels);

    { groups; labels };
  };

  /// Internal: whether the filter includes leaders.
  func includesLeaders(filter : GiftBags.GiftBagFilter) : Bool {
    switch (filter) {
      case (#all) { true };
      case (#leaders) { true };
      case (_) { false };
    };
  };

  /// Internal: whether a role is shown on the Leaders page.
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

  /// Internal: whether a roadie matches the selected filter. `#all` and
  /// `#roadies` select every active roadie; `#leaders` selects none.
  func matchesFilter(
    roadie : Roadie.Roadie,
    positions : Map.Map<Common.PositionId, Store.Position>,
    filter : GiftBags.GiftBagFilter,
  ) : Bool {
    switch (filter) {
      case (#all) { true };
      case (#roadies) { true };
      case (#leaders) { false };
      case (#foh) { houseOf(roadie, positions) == #foh };
      case (#boh) { houseOf(roadie, positions) == #boh };
      case (#position(pid)) { roadie.mainPositionId == pid };
    };
  };

  /// Internal: the house of a roadie's main position, defaulting to FOH when the
  /// position is unknown.
  func houseOf(
    roadie : Roadie.Roadie,
    positions : Map.Map<Common.PositionId, Store.Position>,
  ) : Common.House {
    switch (positions.get(roadie.mainPositionId)) {
      case (?p) { p.house };
      case null { #foh };
    };
  };

  /// Internal: one printable label for a roadie.
  func toLabel(
    roadie : Roadie.Roadie,
    positions : Map.Map<Common.PositionId, Store.Position>,
  ) : GiftBags.GiftBagLabel {
    let positionName = switch (positions.get(roadie.mainPositionId)) {
      case (?p) { p.name };
      case null { "" };
    };
    {
      roadieId = roadie.id;
      name = roadie.profile.name;
      positionName;
      house = houseOf(roadie, positions);
      candySnack = roadie.profile.favoriteSnack;
      drink = roadie.profile.favoriteDrink;
      sportsTeam = roadie.profile.favoriteTeam;
      color = roadie.profile.favoriteColor;
      shirtSize = roadie.profile.shirtSize;
      hatSize = roadie.profile.hatSize;
    };
  };

  /// Internal: one printable label for a leader. The label's position name
  /// carries the leader's title; leaders have no roadie id or house, so the id
  /// is 0 and the house defaults to FOH. Never carries contact information.
  func leaderLabel(grant : Access.AccessGrant) : GiftBags.GiftBagLabel {
    {
      roadieId = 0;
      name = leaderName(grant);
      positionName = leaderTitle(grant);
      house = #foh;
      candySnack = leaderSnack(grant);
      drink = leaderDrink(grant);
      sportsTeam = leaderTeam(grant);
      color = leaderColor(grant);
      shirtSize = leaderShirt(grant);
      hatSize = leaderHat(grant);
    };
  };

  /// Internal: a leader's display name from their staff profile, falling back
  /// to "Unnamed user".
  func leaderName(grant : Access.AccessGrant) : Text {
    switch (grant.staffProfile) {
      case (?p) {
        let preferred = switch (p.preferredName) {
          case (?n) { n.trim(#predicate(func(c : Char) : Bool { c.isWhitespace() })) };
          case null { "" };
        };
        if (preferred.size() > 0) { preferred } else { p.fullName };
      };
      case null { "Unnamed user" };
    };
  };

  /// Internal: a leader's display title, falling back to a role label.
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

  /// Internal: a leader's favorite snack from their staff profile.
  func leaderSnack(grant : Access.AccessGrant) : ?Text {
    switch (grant.staffProfile) { case (?p) { p.favoriteSnack }; case null { null } };
  };

  /// Internal: a leader's favorite drink from their staff profile.
  func leaderDrink(grant : Access.AccessGrant) : ?Text {
    switch (grant.staffProfile) { case (?p) { p.favoriteDrink }; case null { null } };
  };

  /// Internal: a leader's favorite team from their staff profile.
  func leaderTeam(grant : Access.AccessGrant) : ?Text {
    switch (grant.staffProfile) { case (?p) { p.favoriteTeam }; case null { null } };
  };

  /// Internal: a leader's favorite color from their staff profile.
  func leaderColor(grant : Access.AccessGrant) : ?Text {
    switch (grant.staffProfile) { case (?p) { p.favoriteColor }; case null { null } };
  };

  /// Internal: a leader's shirt size from their staff profile.
  func leaderShirt(grant : Access.AccessGrant) : ?Text {
    switch (grant.staffProfile) { case (?p) { p.shirtSize }; case null { null } };
  };

  /// Internal: a leader's hat size from their staff profile.
  func leaderHat(grant : Access.AccessGrant) : ?Text {
    switch (grant.staffProfile) { case (?p) { p.hatSize }; case null { null } };
  };

  /// Internal: group one category's answers across the selected roadies and
  /// leaders, case-insensitively and ignoring extra spaces and punctuation,
  /// showing the most common spelling, sorted by count highest first, plus a No
  /// answer count.
  func buildGroup(
    category : GiftBags.GiftBagCategory,
    roadies : [Roadie.Roadie],
    leaders : [Access.AccessGrant],
    extractRoadie : Roadie.Roadie -> ?Text,
    extractLeader : Access.AccessGrant -> ?Text,
  ) : GiftBags.GiftBagGroup {
    // Group key -> (spelling -> frequency within the group).
    let groups = Map.empty<Text, Map.Map<Text, Nat>>();
    var noAnswer = 0;
    for (roadie in roadies.values()) {
      switch (extractRoadie(roadie)) {
        case (?raw) { if (not tally(groups, raw)) { noAnswer += 1 } };
        case null { noAnswer += 1 };
      };
    };
    for (leader in leaders.values()) {
      switch (extractLeader(leader)) {
        case (?raw) { if (not tally(groups, raw)) { noAnswer += 1 } };
        case null { noAnswer += 1 };
      };
    };

    let answers = groups.values().map(func(spellings) {
      // Total count across every spelling in the group, and the most common
      // spelling (ties broken by text for stability).
      var total = 0;
      var bestSpelling = "";
      var bestCount = 0;
      for ((spelling, freq) in spellings.entries()) {
        total += freq;
        if (freq > bestCount or (freq == bestCount and spelling < bestSpelling)) {
          bestSpelling := spelling;
          bestCount := freq;
        };
      };
      { answer = bestSpelling; count = total };
    }).toArray();

    // Sort by count highest first; break ties by answer text for stability.
    let sorted = answers.sort(func(a, b) {
      if (a.count > b.count) { #less }
      else if (a.count < b.count) { #greater }
      else { Text.compare(a.answer, b.answer) };
    });

    { category; answers = sorted; noAnswer };
  };

  /// Internal: add one raw answer to the grouping. Returns false when the
  /// answer is blank, so the caller counts it as "no answer".
  func tally(
    groups : Map.Map<Text, Map.Map<Text, Nat>>,
    raw : Text,
  ) : Bool {
    let trimmed = raw.trim(#predicate(func(c : Char) : Bool { c.isWhitespace() }));
    if (trimmed.size() == 0) {
      return false;
    };
    let key = normalize(trimmed);
    let spellings = switch (groups.get(key)) {
      case (?existing) { existing };
      case null {
        let fresh = Map.empty<Text, Nat>();
        groups.add(key, fresh);
        fresh;
      };
    };
    spellings.add(trimmed, (spellings.get(trimmed) ?? 0) + 1);
    true;
  };

  /// Internal: normalize an answer for case-insensitive grouping that ignores
  /// extra spaces and punctuation. Lowercases, drops every non-alphanumeric
  /// character, and collapses runs of whitespace.
  func normalize(text : Text) : Text {
    let lowered = text.toLower();
    let kept = lowered.toArray().filter(func(c : Char) : Bool {
      c.isAlphabetic() or c.isDigit();
    });
    Text.fromArray(kept);
  };
};
