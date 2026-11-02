import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Common "../types/common";
import Roadie "../types/roadie";
import Store "../types/store";
import GiftBags "../types/giftbags";
import Access "../types/access";
import GiftBagsLib "../lib/giftbags";

mixin (
  accessGrants : Map.Map<Principal, Access.AccessGrant>,
  roadies : Map.Map<Common.RoadieId, Roadie.Roadie>,
  positions : Map.Map<Common.PositionId, Store.Position>,
) {
  /// Build the Gift Bags shopping list and printable labels for the selected
  /// filter, across active (non-archived) roadies only. Visible to Admin, Store
  /// Manager and Training Manager. Never includes phone, email or date of birth.
  public query ({ caller }) func getGiftBags(filter : GiftBags.GiftBagFilter) : async GiftBags.GiftBagsData {
    GiftBagsLib.getGiftBags(accessGrants, roadies, positions, caller, filter);
  };
};
