import Common "common";

module {
  /// One row of a position-group export tab. The Full export fills the whole
  /// contact set (phone, email, emergency contact, date of birth, availability
  /// by day and shift); the Shareable export leaves those fields null/empty.
  public type ExportRow = {
    dateHired : ?Common.DateOnly;
    shirtSize : ?Text;
    weekdayLunch : ?Bool;
    name : Text;
    phone : ?Common.Phone;
    email : ?Common.Email;
    emergencyContactName : ?Text;
    emergencyContactPhone : ?Common.Phone;
    dateOfBirth : ?Common.DateOnly;
    availabilityByDay : [(Common.Weekday, [Common.Shift])];
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

  /// The full export payload. `fohTotal`/`bohTotal`/`grandTotal` are hired
  /// counts; the matching `*TotalPar` and `*Need` fields fill the Total Par and
  /// Need cells of the FOH, BOH and Grand total rows on the overview sheet.
  public type ExportData = {
    overview : [OverviewRow];
    fohTotal : Nat;
    bohTotal : Nat;
    grandTotal : Nat;
    fohTotalPar : Nat;
    fohNeed : Nat;
    bohTotalPar : Nat;
    bohNeed : Nat;
    grandTotalPar : Nat;
    grandNeed : Nat;
    groups : [(Text, [ExportRow])];
  };
};
