import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Common "../types/common";
import Access "../types/access";
import KioskLib "../lib/kiosk";

mixin (
  accessGrants : Map.Map<Principal, Access.AccessGrant>,
  kioskPin : KioskLib.KioskPinState,
  demoState : Common.DemoState,
) {
  /// Set the kiosk staff PIN (Admin only). Stored hashed; never returned.
  public shared ({ caller }) func setKioskPin(pin : Text) : async () {
    KioskLib.setKioskPin(accessGrants, demoState, kioskPin, caller, pin);
  };

  /// Check a candidate kiosk PIN. Returns true when it matches the stored hash.
  public query func checkKioskPin(pin : Text) : async Bool {
    KioskLib.checkKioskPin(kioskPin, pin);
  };

  /// True when an Admin has set a kiosk PIN.
  public query func hasKioskPin() : async Bool {
    KioskLib.hasKioskPin(kioskPin);
  };
};
