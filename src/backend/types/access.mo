import Common "common";

module {
  /// An access grant for a signed-in principal.
  public type AccessGrant = {
    principal : Principal;
    role : Common.Role;
    approvedAt : Common.Timestamp;
    approvedBy : Principal;
    accessEndsAt : ?Common.Timestamp;
    trainerPositionIds : [Common.PositionId];
    linkedRoadieId : ?Common.RoadieId;
  };

  /// A pending access request shown on the approval screen.
  public type PendingUser = {
    principal : Principal;
    requestedAt : Common.Timestamp;
  };

  /// The payload an admin supplies when approving a user.
  public type ApprovalRequest = {
    principal : Principal;
    role : Common.Role;
    trainerPositionIds : [Common.PositionId];
    accessEndsAt : ?Common.Timestamp;
    linkedRoadieId : ?Common.RoadieId;
  };
};
