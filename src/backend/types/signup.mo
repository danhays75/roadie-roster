import Common "common";
import Roadie "roadie";

module {
  /// A kiosk sign-up submission awaiting manager approval. The photo and the
  /// roadie's drawn signature are real platform file-storage references; the
  /// signature also lives in the contact set.
  public type SignupSubmission = {
    id : Common.SignupId;
    submittedAt : Common.Timestamp;
    profile : Roadie.RoadieProfile;
    photo : ?Common.PhotoRef;
    /// Demo-only photo URL, set on seeded demo sign-ups so the approval card can
    /// show an applicant photo when there is no stored kiosk photo. Null for
    /// real sign-ups.
    demoPhotoUrl : ?Text;
    signature : ?Common.SignatureRef;
    contactSet : Roadie.ContactSet;
    status : SignupStatus;
    /// True when this submission is a demo record. Demo sign-ups are invisible
    /// while demo mode is off.
    isDemo : Bool;
  };

  /// The approval state of a submission.
  public type SignupStatus = {
    #pending;
    #approved : Common.RoadieId;
    #rejected;
  };

  /// A duplicate match found during approval review. `name` and
  /// `mainPositionName` describe the matched roadie so the UI can name them
  /// without showing a raw id; `matchedOn` is "phone", "email" or "both".
  public type DuplicateMatch = {
    roadieId : Common.RoadieId;
    name : Text;
    mainPositionName : Text;
    matchedOn : Text;
    archived : Bool;
    /// The matched roadie's demo-only photo URL, so the Possible duplicates box
    /// can show a demo roadie's photo. Null for real roadies.
    demoPhotoUrl : ?Text;
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
