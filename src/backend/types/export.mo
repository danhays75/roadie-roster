import Common "common";

module {
  /// One row of a position-group export tab.
  public type ExportRow = {
    dateHired : ?Common.DateOnly;
    shirtSize : ?Text;
    weekdayLunch : ?Bool;
    name : Text;
    phone : ?Common.Phone;
    onboardingComplete : Bool;
    policiesComplete : Bool;
    alcoholCert : Bool;
    foodHandlers : Bool;
    availability : [Common.Shift];
  };

  /// One row of the Staff Pars and Overview tab.
  public type OverviewRow = {
    positionName : Text;
    totalPar : Nat;
    hired : Nat;
    need : Nat;
  };

  /// The full export payload.
  public type ExportData = {
    overview : [OverviewRow];
    fohTotal : Nat;
    bohTotal : Nat;
    grandTotal : Nat;
    groups : [(Text, [ExportRow])];
  };
};
