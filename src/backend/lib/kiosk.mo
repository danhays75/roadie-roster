import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Text "mo:core/Text";
import Nat64 "mo:core/Nat64";
import Access "../types/access";
import Auth "auth";

/// Kiosk staff PIN: an Admin sets a PIN, stored only as a hash, and the kiosk
/// verifies a candidate PIN through a check endpoint. The plaintext PIN is
/// never stored or returned.
module {
  /// The stored kiosk PIN state. `value` is the hash of the current PIN, or
  /// null when no PIN has been set yet.
  public type KioskPinState = {
    var value : ?Text;
  };

  /// A fixed salt mixed into every PIN digest so the stored value is not a
  /// bare digest of a short numeric PIN.
  let salt : Text = "roadie-roster-kiosk-pin-v1";

  /// Set the kiosk staff PIN (Admin only). The PIN is hashed before storage;
  /// the plaintext is never persisted.
  public func setKioskPin(
    accessGrants : Map.Map<Principal, Access.AccessGrant>,
    kioskPin : KioskPinState,
    caller : Principal,
    pin : Text,
  ) : () {
    Auth.requireAdmin(accessGrants, caller);
    if (pin.size() == 0) {
      Runtime.trap("Kiosk PIN must not be empty");
    };
    kioskPin.value := ?hash(pin);
  };

  /// Check a candidate kiosk PIN against the stored hash. Returns true when the
  /// PIN matches. Callable by any signed-in caller so the kiosk can gate entry.
  public func checkKioskPin(
    kioskPin : KioskPinState,
    pin : Text,
  ) : Bool {
    switch (kioskPin.value) {
      case (?stored) { stored == hash(pin) };
      case null { false };
    };
  };

  /// True when an Admin has set a kiosk PIN.
  public func hasKioskPin(kioskPin : KioskPinState) : Bool {
    switch (kioskPin.value) {
      case (?_) { true };
      case null { false };
    };
  };

  /// Internal: a deterministic, non-reversible digest of the salted PIN. This
  /// is a gate for a short numeric PIN, not a password store; the digest is
  /// one-way and never returned to a caller.
  func hash(pin : Text) : Text {
    let bytes = (salt # ":" # pin).encodeUtf8();
    var h : Nat64 = 14_695_981_039_346_656_037;
    for (b in bytes.toArray().values()) {
      h := (h ^ b.toNat64()) *% 1_099_511_628_211;
      h := h ^ (h >> 27);
      h := h *% 2_862_933_555_777_941_757;
      h := h ^ (h >> 31);
    };
    // Fold the 64-bit state into a 32-hex-character digest.
    let hi = (h >> 32).toNat32();
    let lo = h.toNat32();
    hi.toText() # "-" # lo.toText();
  };
};
