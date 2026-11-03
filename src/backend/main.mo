import Map "mo:core/Map";
import Principal "mo:core/Principal";
import AccessControl "mo:caffeineai-authorization/access-control";
import MixinAuthorization "mo:caffeineai-authorization/MixinAuthorization";
import MixinObjectStorage "mo:caffeineai-object-storage/Mixin";
import Expose "mo:caffeineai-oql/Expose";
import Entity "mo:caffeineai-oql/Entity";
import MapEntity "mo:caffeineai-oql/MapEntity";
import RecordValue "mo:caffeineai-oql/RecordValue";
import NatValue "mo:caffeineai-oql/NatValue";
import IntValue "mo:caffeineai-oql/IntValue";
import BoolValue "mo:caffeineai-oql/BoolValue";
import TextValue "mo:caffeineai-oql/TextValue";
import PrincipalValue "mo:caffeineai-oql/PrincipalValue";

import Common "types/common";
import Store "types/store";
import Roadie "types/roadie";
import Signup "types/signup";
import Access "types/access";
import Phase23 "types/phase23";

import StoreApi "mixins/store-api";
import RoadieApi "mixins/roadie-api";
import SignupApi "mixins/signup-api";
import AccessApi "mixins/access-api";
import Phase23Api "mixins/phase23-api";
import ExportApi "mixins/export-api";
import GiftBagsApi "mixins/giftbags-api";
import KioskApi "mixins/kiosk-api";
import SeedApi "mixins/seed-api";
import DemoApi "mixins/demo-api";
import ApiDocMixin "mixins/api-doc";

actor {
  // --- Platform infrastructure state ---
  let accessControlState : AccessControl.AccessControlState;
  include MixinAuthorization(accessControlState, null);
  include MixinObjectStorage();

  // --- Application state ---
  let storeInfo : { var value : Store.StoreInfo };
  let positions : Map.Map<Common.PositionId, Store.Position>;
  let buildToAdjustments : Map.Map<Nat, Store.BuildToAdjustment>;
  let schedule : Map.Map<Common.EventId, Store.ScheduleEvent>;
  let checklists : { var value : Store.Checklists };
  let retention : { var value : Store.RetentionSettings };
  let storeTemplates : Map.Map<Text, Store.StoreTemplate>;

  let roadies : Map.Map<Common.RoadieId, Roadie.Roadie>;
  let crews : Map.Map<Common.CrewId, Roadie.Crew>;
  let changeLog : Map.Map<Common.ChangeLogId, Roadie.ChangeLogEntry>;

  let signups : Map.Map<Common.SignupId, Signup.SignupSubmission>;

  let accessGrants : Map.Map<Principal, Access.AccessGrant>;
  let pendingUsers : Map.Map<Principal, Access.PendingUser>;

  // Admin-set kiosk staff PIN, stored only as a hash.
  let kioskPin : { var value : ?Text };

  // Demo-mode state: off by default, with the auto-off time, the pretend date
  // and the impersonated demo role. Demo records are stored alongside real
  // records and separated by an `isDemo` flag on each record.
  let demoState : Common.DemoState;

  let orientationCheckoffs : Map.Map<Common.RoadieId, Phase23.OrientationCheckoff>;
  let attendance : Map.Map<Nat, Phase23.AttendanceRecord>;
  let trainingGroups : Map.Map<Common.TrainingGroupId, Phase23.TrainingGroup>;
  let trainerNotes : Map.Map<Nat, Phase23.TrainerNote>;
  let leaderTalks : Map.Map<Common.LeaderTalkId, Phase23.LeaderTalk>;
  let finalSignOffs : Map.Map<Common.RoadieId, Phase23.FinalSignOff>;
  let alerts : Map.Map<Common.AlertId, Phase23.Alert>;

  let counters : {
    var nextRoadieId : Nat;
    var nextPositionId : Nat;
    var nextEventId : Nat;
    var nextCrewId : Nat;
    var nextSignupId : Nat;
    var nextChangeLogId : Nat;
    var nextTrainingGroupId : Nat;
    var nextLeaderTalkId : Nat;
    var nextAlertId : Nat;
    var nextAttendanceId : Nat;
    var nextTrainerNoteId : Nat;
    var nextBuildToAdjustmentId : Nat;
  };

  // --- Domain APIs ---
  include StoreApi(
    accessGrants,
    storeInfo,
    positions,
    buildToAdjustments,
    schedule,
    checklists,
    retention,
    storeTemplates,
    roadies,
    attendance,
    changeLog,
    counters,
    demoState,
  );
  include RoadieApi(accessGrants, roadies, crews, positions, changeLog, counters, demoState);
  include SignupApi(accessGrants, signups, roadies, positions, storeInfo, changeLog, counters, demoState);
  include AccessApi(accessGrants, pendingUsers, accessControlState, demoState);
  include Phase23Api(
    accessGrants,
    roadies,
    positions,
    orientationCheckoffs,
    attendance,
    trainingGroups,
    trainerNotes,
    leaderTalks,
    finalSignOffs,
    alerts,
    changeLog,
    counters,
    demoState,
  );
  include ExportApi(accessGrants, roadies, positions, orientationCheckoffs, changeLog, counters, demoState);
  include GiftBagsApi(accessGrants, roadies, positions, demoState);
  include KioskApi(accessGrants, kioskPin, demoState);

  // --- Demo mode ---
  include DemoApi(
    accessGrants,
    demoState,
    roadies,
    signups,
    crews,
    attendance,
    trainerNotes,
    positions,
    storeInfo,
    changeLog,
    counters,
  );

  // --- Idempotent runtime re-seed ---
  include SeedApi(
    accessGrants,
    demoState,
    storeInfo,
    positions,
    schedule,
    checklists,
    retention,
    counters,
  );

  // --- Behavioral API documentation ---
  include ApiDocMixin();

  // --- OQL exposure ---
  include Expose({
    entities = [
      positions.toEntityManual("position", "Position", "id")
        .sample({
          id = 0;
          name = "";
          house = #foh;
          code = "";
          openingBuildTo = 0;
          afterOpeningBuildTo = 0;
          needsAlcoholCert = false;
          minimumAge = 0;
          shirtsRequired = 0;
          hatsRequired = 0;
          crewManager = null;
        })
        .payload("id", func p = p.id)
        .payload("name", func p = p.name)
        .payload("house", func p = switch p.house { case (#foh) "foh"; case (#boh) "boh" })
        .payload("code", func p = p.code)
        .payload("openingBuildTo", func p = p.openingBuildTo)
        .payload("afterOpeningBuildTo", func p = p.afterOpeningBuildTo)
        .payload("needsAlcoholCert", func p = p.needsAlcoholCert)
        .payload("minimumAge", func p = p.minimumAge)
        .controllerOnly()
        .build(),
      roadies.toEntityManual("roadie", "Roadie", "id")
        .sample({
          id = 0;
          profile = {
            name = "";
            preferredName = null;
            hometown = null;
            hobbies = null;
            favoriteMovie = null;
            favoriteSnack = null;
            favoriteTeam = null;
            favoriteDrink = null;
            favoriteColor = null;
            funFact = null;
            goalHere = null;
            positionAppliedFor = null;
            shirtSize = null;
            hatSize = null;
            shiftsWantedPerWeek = null;
            weekdayLunch = null;
          };
          photo = null;
          mainPositionId = 0;
          secondPositionId = null;
          crossTrainedPositionId = null;
          crewId = null;
          orientationEventId = null;
          startDate = null;
          status = #hired;
          corporateEmployeeId = null;
          contactSet = null;
          isMinor = false;
          birthdayMonthDay = null;
          archivedReason = null;
          archivedAt = null;
          hiredAt = 0;
          hireDate = null;
          signedBy = null;
          isDemo = false;
        })
        .payload("id", func r = r.id)
        .payload("name", func r = r.profile.name)
        .payload("mainPositionId", func r = r.mainPositionId)
        .payload("status", func r = switch r.status {
          case (#hired) "hired";
          case (#paperworkDone) "paperworkDone";
          case (#oriented) "oriented";
          case (#inTraining) "inTraining";
          case (#certified) "certified";
          case (#needsMoreTime) "needsMoreTime";
          case (#active) "active";
          case (#archived) "archived";
        })
        .payload("hiredAt", func r = r.hiredAt)
        .controllerOnly()
        .build(),
      schedule.toEntityManual("scheduleEvent", "ScheduleEvent", "id")
        .sample({ id = 0; kind = #other; name = ""; start = 0; end = null })
        .payload("id", func e = e.id)
        .payload("kind", func e = switch e.kind {
          case (#deadline) "deadline";
          case (#orientation) "orientation";
          case (#trainingDay) "trainingDay";
          case (#friendsAndFamily) "friendsAndFamily";
          case (#openingDay) "openingDay";
          case (#signOff) "signOff";
          case (#other) "other";
        })
        .payload("name", func e = e.name)
        .payload("start", func e = e.start)
        .controllerOnly()
        .build(),
      crews.toEntity("crew", "Crew", "id")
        .sample({ id = 0; name = ""; leaderPrincipal = null; isDemo = false })
        .controllerOnly()
        .build(),
      changeLog.toEntity("changeLogEntry", "ChangeLogEntry", "id")
        .sample({
          id = 0;
          at = 0;
          by = Principal.fromText("aaaaa-aa");
          action = "";
          subjectRoadieId = null;
          touchesContactSet = false;
          detail = "";
          isDemo = false;
        })
        .controllerOnly()
        .build(),
      signups.toEntityManual("signup", "SignupSubmission", "id")
        .sample({
          id = 0;
          submittedAt = 0;
          profile = {
            name = "";
            preferredName = null;
            hometown = null;
            hobbies = null;
            favoriteMovie = null;
            favoriteSnack = null;
            favoriteTeam = null;
            favoriteDrink = null;
            favoriteColor = null;
            funFact = null;
            goalHere = null;
            positionAppliedFor = null;
            shirtSize = null;
            hatSize = null;
            shiftsWantedPerWeek = null;
            weekdayLunch = null;
          };
          photo = null;
          signature = null;
          contactSet = {
            phone = "";
            email = "";
            emergencyContactName = "";
            emergencyContactPhone = "";
            dateOfBirth = 0;
            availability = [];
            availabilitySignature = null;
            availabilitySignedAt = null;
            availabilityResignPending = false;
            managerSignature = null;
            managerSignedAt = null;
            managerSignedBy = null;
          };
          status = #pending;
          isDemo = false;
        })
        .payload("id", func s = s.id)
        .payload("submittedAt", func s = s.submittedAt)
        .payload("name", func s = s.profile.name)
        .payload("status", func s = switch s.status {
          case (#pending) "pending";
          case (#approved(_)) "approved";
          case (#rejected) "rejected";
        })
        .controllerOnly()
        .build(),
      accessGrants.toEntityManual("accessGrant", "AccessGrant", "principal")
        .sample({
          principal = Principal.fromText("aaaaa-aa");
          role = #admin;
          approvedAt = 0;
          approvedBy = Principal.fromText("aaaaa-aa");
          accessEndsAt = null;
          trainerPositionIds = [];
          linkedRoadieId = null;
          staffProfile = null;
        })
        .payload("principal", func g = g.principal)
        .payload("role", func g = switch g.role {
          case (#admin) "admin";
          case (#storeManager) "storeManager";
          case (#trainingManager) "trainingManager";
          case (#leadership) "leadership";
          case (#visitingManager) "visitingManager";
          case (#trainer) "trainer";
          case (#kiosk) "kiosk";
          case (#integration) "integration";
        })
        .payload("approvedAt", func g = g.approvedAt)
        .controllerOnly()
        .build(),
      trainingGroups.toEntityManual("trainingGroup", "TrainingGroup", "id")
        .sample({
          id = 0;
          day = 0;
          shift = #am;
          positionId = 0;
          trainerPrincipal = null;
          memberRoadieIds = [];
        })
        .payload("id", func g = g.id)
        .payload("day", func g = g.day)
        .payload("shift", func g = switch g.shift { case (#am) "am"; case (#pm) "pm" })
        .payload("positionId", func g = g.positionId)
        .payload("memberCount", func g = g.memberRoadieIds.size())
        .controllerOnly()
        .build(),
      leaderTalks.toEntityManual("leaderTalk", "LeaderTalk", "id")
        .sample({ id = 0; name = ""; day = 0; attendees = [] })
        .payload("id", func t = t.id)
        .payload("name", func t = t.name)
        .payload("day", func t = t.day)
        .payload("attendeeCount", func t = t.attendees.size())
        .controllerOnly()
        .build(),
      alerts.toEntity("alert", "Alert", "id")
        .sample({ id = 0; message = ""; createdAt = 0; acknowledged = false })
        .controllerOnly()
        .build(),
      buildToAdjustments.toEntityManual("buildToAdjustment", "BuildToAdjustment", "positionId")
        .sample({
          positionId = 0;
          openingDelta = 0;
          afterOpeningDelta = 0;
          at = 0;
          by = Principal.fromText("aaaaa-aa");
        })
        .payload("positionId", func a = a.positionId)
        .payload("openingDelta", func a = a.openingDelta)
        .payload("afterOpeningDelta", func a = a.afterOpeningDelta)
        .payload("at", func a = a.at)
        .controllerOnly()
        .build(),
      storeTemplates.toEntityManual("storeTemplate", "StoreTemplate", "name")
        .sample({
          name = "";
          schedule = [];
          positions = [];
          checklists = { orientationUniform = []; paperwork = [] };
          leaderTalkName = "";
        })
        .payload("name", func t = t.name)
        .payload("leaderTalkName", func t = t.leaderTalkName)
        .payload("positionCount", func t = t.positions.size())
        .controllerOnly()
        .build(),
      pendingUsers.toEntityManual("pendingUser", "PendingUser", "principal")
        .sample({ principal = Principal.fromText("aaaaa-aa"); requestedAt = 0; staffProfile = null })
        .payload("principal", func u = u.principal)
        .payload("requestedAt", func u = u.requestedAt)
        .controllerOnly()
        .build(),
      orientationCheckoffs.toEntityManual("orientationCheckoff", "OrientationCheckoff", "roadieId")
        .sample({
          roadieId = 0;
          uniformItems = [];
          paperworkItems = [];
          shirtsCount = 0;
          hatsCount = 0;
          updatedAt = 0;
        })
        .payload("roadieId", func c = c.roadieId)
        .payload("shirtsCount", func c = c.shirtsCount)
        .payload("hatsCount", func c = c.hatsCount)
        .payload("updatedAt", func c = c.updatedAt)
        .controllerOnly()
        .build(),
      attendance.toEntityManual("attendance", "AttendanceRecord", "roadieId")
        .sample({
          roadieId = 0;
          eventId = null;
          shift = null;
          state = #present;
          recordedAt = 0;
          recordedBy = Principal.fromText("aaaaa-aa");
          isDemo = false;
        })
        .payload("roadieId", func a = a.roadieId)
        .payload("eventId", func a = a.eventId)
        .payload("state", func a = switch a.state {
          case (#present) "present";
          case (#late) "late";
          case (#absent) "absent";
        })
        .payload("recordedAt", func a = a.recordedAt)
        .controllerOnly()
        .build(),
      trainerNotes.toEntityManual("trainerNote", "TrainerNote", "id")
        .sample({
          id = 0;
          author = Principal.fromText("aaaaa-aa");
          roadieId = 0;
          shift = #am;
          day = 0;
          didWell = "";
          workOn = "";
          createdAt = 0;
          isDemo = false;
        })
        .payload("id", func n = n.id)
        .payload("roadieId", func n = n.roadieId)
        .payload("shift", func n = switch n.shift { case (#am) "am"; case (#pm) "pm" })
        .payload("day", func n = n.day)
        .payload("createdAt", func n = n.createdAt)
        .controllerOnly()
        .build(),
      finalSignOffs.toEntityManual("finalSignOff", "FinalSignOff", "roadieId")
        .sample({
          roadieId = 0;
          outcome = #certified;
          futureTrainer = false;
          signedBy = Principal.fromText("aaaaa-aa");
          signedAt = 0;
        })
        .payload("roadieId", func s = s.roadieId)
        .payload("outcome", func s = switch s.outcome {
          case (#certified) "certified";
          case (#needsMoreTime(_)) "needsMoreTime";
        })
        .payload("futureTrainer", func s = s.futureTrainer)
        .payload("signedAt", func s = s.signedAt)
        .controllerOnly()
        .build(),
    ];
  });
};
