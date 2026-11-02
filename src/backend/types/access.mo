import Common "common";

module {
  /// A staff profile supplied by a signed-in user on the "Tell us who you are"
  /// form. Required fields are always present; the optional fields are null when
  /// the user did not supply them. The trainer fields are only meaningful for
  /// the NSO Trainer and Visiting Manager roles.
  public type StaffProfile = {
    fullName : Common.PersonName;
    requestedRole : Common.Role;
    title : Text;
    homeStoreNumber : Text;
    homeStoreCity : Text;
    preferredName : ?Text;
    workPhone : ?Common.Phone;
    workEmail : ?Common.Email;
    photo : ?Common.PhotoRef;
    trainerPositionIds : [Common.PositionId];
    arrivalDate : ?Common.DateOnly;
    departureDate : ?Common.DateOnly;
    hometown : ?Text;
    hobbies : ?Text;
    favoriteTeam : ?Text;
    favoriteSnack : ?Text;
    favoriteDrink : ?Text;
    favoriteColor : ?Text;
    funFact : ?Text;
    goalHere : ?Text;
    shirtSize : ?Common.ShirtSize;
    hatSize : ?Common.HatSize;
  };

  /// A leader shown on the Leaders page: their role, title, staff profile,
  /// trainer stations and arrival/departure dates. Leaders are the manager,
  /// trainer and leadership roles (Admin, Store Manager, Training Manager,
  /// Visiting Manager, Trainer, Leadership). Readable by every role except
  /// kiosk and integration. Never carries phone or email.
  public type LeaderSummary = {
    principal : Principal;
    role : Common.Role;
    title : Text;
    staffProfile : ?StaffProfile;
    trainerPositionIds : [Common.PositionId];
    arrivalDate : ?Common.DateOnly;
    departureDate : ?Common.DateOnly;
  };

  /// An access grant for a signed-in principal.
  public type AccessGrant = {
    principal : Principal;
    role : Common.Role;
    approvedAt : Common.Timestamp;
    approvedBy : Principal;
    accessEndsAt : ?Common.Timestamp;
    trainerPositionIds : [Common.PositionId];
    linkedRoadieId : ?Common.RoadieId;
    staffProfile : ?StaffProfile;
  };

  /// A pending access request shown on the approval screen.
  public type PendingUser = {
    principal : Principal;
    requestedAt : Common.Timestamp;
    staffProfile : ?StaffProfile;
  };

  /// The payload an admin supplies when approving a user.
  public type ApprovalRequest = {
    principal : Principal;
    role : Common.Role;
    trainerPositionIds : [Common.PositionId];
    accessEndsAt : ?Common.Timestamp;
    linkedRoadieId : ?Common.RoadieId;
    staffProfile : ?StaffProfile;
  };
};
