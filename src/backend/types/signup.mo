import Common "common";
import Roadie "roadie";

module {
  /// A kiosk sign-up submission awaiting manager approval.
  public type SignupSubmission = {
    id : Common.SignupId;
    submittedAt : Common.Timestamp;
    profile : Roadie.RoadieProfile;
    photo : ?Common.PhotoRef;
    signature : ?Common.SignatureRef;
    contactSet : Roadie.ContactSet;
    status : SignupStatus;
  };

  /// The approval state of a submission.
  public type SignupStatus = {
    #pending;
    #approved : Common.RoadieId;
    #rejected;
  };

  /// A duplicate match found during approval review.
  public type DuplicateMatch = {
    roadieId : Common.RoadieId;
    matchedOn : Text;
    archived : Bool;
  };

  /// The manager's approval decision for a submission.
  public type ApprovalDecision = {
    mainPositionId : Common.PositionId;
    secondPositionId : ?Common.PositionId;
    crewId : ?Common.CrewId;
    orientationEventId : ?Common.EventId;
    startDate : ?Common.DateOnly;
  };
};
