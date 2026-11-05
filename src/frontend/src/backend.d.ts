import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface AbsentAlertView {
    id: AlertId;
    eventId: EventId;
    demoPhotoUrl?: string;
    roadieId: RoadieId;
    name: string;
    createdAt: Timestamp;
    shift: Shift;
    shiftLabel: string;
    excused?: string;
    phone?: Phone;
    photo?: PhotoRef;
    archived: boolean;
}
export interface AccessGrant {
    principal: Principal;
    linkedRoadieId?: RoadieId;
    approvedAt: Timestamp;
    approvedBy: Principal;
    role: Role;
    staffProfile?: StaffProfile;
    trainerPositionIds: Array<PositionId>;
    accessEndsAt?: Timestamp;
}
export interface Alert {
    id: AlertId;
    createdAt: Timestamp;
    acknowledged: boolean;
    message: string;
}
export type AlertId = bigint;
export interface ApprovalDecision {
    orientationEventId?: EventId;
    mainPositionId: PositionId;
    crewId?: CrewId;
    secondPositionId?: PositionId;
    startDate?: DateOnly;
}
export interface ApprovalRequest {
    principal: Principal;
    linkedRoadieId?: RoadieId;
    role: Role;
    staffProfile?: StaffProfile;
    trainerPositionIds: Array<PositionId>;
    accessEndsAt?: Timestamp;
}
export type ArchiveReason = {
    __kind__: "noShow";
    noShow: null;
} | {
    __kind__: "quitDuringTraining";
    quitDuringTraining: null;
} | {
    __kind__: "other";
    other: string;
} | {
    __kind__: "paperworkIncomplete";
    paperworkIncomplete: null;
} | {
    __kind__: "letGo";
    letGo: null;
} | {
    __kind__: "ncnsOrientation";
    ncnsOrientation: null;
} | {
    __kind__: "tookAnotherJob";
    tookAnotherJob: null;
};
export interface AttendanceRecord {
    eventId?: EventId;
    roadieId: RoadieId;
    isDemo: boolean;
    recordedAt: Timestamp;
    recordedBy: Principal;
    shift?: Shift;
    state: AttendanceState;
}
export interface AvailabilitySlot {
    day: Weekday;
    shift: Shift;
}
export interface Cell {
    value: Value;
    name: string;
}
export interface ChangeLogEntry {
    at: Timestamp;
    by: Principal;
    id: ChangeLogId;
    action: string;
    isDemo: boolean;
    detail: string;
    touchesContactSet: boolean;
    subjectRoadieId?: RoadieId;
}
export type ChangeLogId = bigint;
export interface CheckInBoardView {
    roadies: Array<CheckInRow>;
    eventId: EventId;
    checkedInCount: bigint;
    totalCount: bigint;
    locked: boolean;
    shift: Shift;
    shiftLabel: string;
}
export interface CheckInRow {
    demoPhotoUrl?: string;
    roadieId: RoadieId;
    name: string;
    lateAt?: Timestamp;
    state?: CheckInState;
    excused?: string;
    photo?: PhotoRef;
}
export interface ChecklistItem {
    id: bigint;
    requiresAlcoholCert: boolean;
    text: string;
    minorOnly: boolean;
    itemType: UniformItemType;
}
export interface Checklists {
    paperwork: Array<ChecklistItem>;
    orientationUniform: Array<ChecklistItem>;
}
export interface ContactSet {
    managerSignedAt?: Timestamp;
    managerSignedBy?: Principal;
    availabilitySignedAt?: Timestamp;
    dateOfBirth: DateOnly;
    email: Email;
    availabilitySignature?: SignatureRef;
    availability: Array<AvailabilitySlot>;
    availabilityResignPending: boolean;
    emergencyContactPhone: Phone;
    emergencyContactName: string;
    phone: Phone;
    managerSignature?: SignatureRef;
}
export interface Crew {
    id: CrewId;
    name: string;
    isDemo: boolean;
    leaderPrincipal?: Principal;
}
export type CrewId = bigint;
export interface DashboardView {
    boh: Array<Position>;
    foh: Array<Position>;
    active: bigint;
    hired: bigint;
    pending: bigint;
    showedAtOrientation?: bigint;
    certified?: bigint;
    stillNeeded: bigint;
    buildToTotal: bigint;
}
export type DateOnly = bigint;
export type DateTime = bigint;
export type DemoActionResult = {
    __kind__: "ok";
    ok: DemoStateView;
} | {
    __kind__: "err";
    err: string;
};
export interface DemoDataSummary {
    roadies: bigint;
    leaders: bigint;
    signups: bigint;
    crews: bigint;
    attendance: bigint;
    notes: bigint;
}
export interface DemoStateView {
    autoOffAt?: Timestamp;
    turnedOnAt?: Timestamp;
    pretendDate?: PretendDate;
    demoRole?: DemoRole;
    demoTrainerAs?: Principal;
    enabled: boolean;
    demoTrainerStations: Array<PositionId>;
}
export interface DuplicateMatch {
    matchedOn: string;
    roadieId: RoadieId;
    name: string;
    mainPositionName: string;
    archived: boolean;
}
export type Email = string;
export type Error_ = {
    __kind__: "FrontendOriginsNotConfigured";
    FrontendOriginsNotConfigured: null;
} | {
    __kind__: "MixedSsoSources";
    MixedSsoSources: {
        otherKeys: Array<string>;
        ssoKeys: Array<string>;
    };
} | {
    __kind__: "Stale";
    Stale: {
        ageNs: bigint;
    };
} | {
    __kind__: "MalformedCandid";
    MalformedCandid: null;
} | {
    __kind__: "AmbiguousAttribute";
    AmbiguousAttribute: {
        field: string;
        sources: Array<string>;
    };
} | {
    __kind__: "NoAttributes";
    NoAttributes: null;
} | {
    __kind__: "UnknownNonce";
    UnknownNonce: null;
} | {
    __kind__: "UntrustedSsoSource";
    UntrustedSsoSource: {
        domain: string;
    };
} | {
    __kind__: "MissingField";
    MissingField: string;
} | {
    __kind__: "FrontendOriginMismatch";
    FrontendOriginMismatch: {
        got: string;
        expected: Array<string>;
    };
};
export type EventId = bigint;
export interface ExportData {
    fohNeed: bigint;
    fohTotal: bigint;
    groups: Array<[string, Array<ExportRow>]>;
    bohTotal: bigint;
    overview: Array<OverviewRow>;
    bohNeed: bigint;
    grandTotal: bigint;
    grandTotalPar: bigint;
    bohTotalPar: bigint;
    fohTotalPar: bigint;
    grandNeed: bigint;
}
export interface ExportRow {
    dateHired?: DateOnly;
    favoriteSnack?: string;
    dateOfBirth?: DateOnly;
    availabilityByDay: Array<[Weekday, Array<Shift>]>;
    name: string;
    onboardingComplete: boolean;
    favoriteTeam?: string;
    email?: Email;
    availability: Array<Shift>;
    foodHandlers: boolean;
    favoriteDrink?: string;
    shirtSize?: string;
    emergencyContactPhone?: Phone;
    emergencyContactName?: string;
    policiesComplete: boolean;
    phone?: Phone;
    alcoholCert: boolean;
    favoriteColor?: string;
    weekdayLunch?: boolean;
}
export interface FinalSignOff {
    roadieId: RoadieId;
    isDemo: boolean;
    signedAt: Timestamp;
    signedBy: Principal;
    outcome: SignOffOutcome;
    futureTrainer: boolean;
}
export interface GiftBagAnswerCount {
    count: bigint;
    answer: string;
}
export type GiftBagFilter = {
    __kind__: "all";
    all: null;
} | {
    __kind__: "boh";
    boh: null;
} | {
    __kind__: "foh";
    foh: null;
} | {
    __kind__: "roadies";
    roadies: null;
} | {
    __kind__: "leaders";
    leaders: null;
} | {
    __kind__: "position";
    position: PositionId;
};
export interface GiftBagGroup {
    noAnswer: bigint;
    answers: Array<GiftBagAnswerCount>;
    category: GiftBagCategory;
}
export interface GiftBagLabel {
    roadieId: RoadieId;
    house: House;
    name: string;
    color?: string;
    positionName: string;
    candySnack?: string;
    shirtSize?: string;
    hatSize?: string;
    sportsTeam?: string;
    drink?: string;
}
export interface GiftBagsData {
    groups: Array<GiftBagGroup>;
    labels: Array<GiftBagLabel>;
}
export interface GroupChangeNotice {
    id: bigint;
    eventId: EventId;
    addedNames: Array<string>;
    createdAt: Timestamp;
    isDemo: boolean;
    removedNames: Array<string>;
    trainerPrincipal: Principal;
    shift: Shift;
    shiftLabel: string;
    editorName: string;
    dismissed: boolean;
}
export type HatSize = string;
export interface LeaderSummary {
    title: string;
    principal: Principal;
    demoPhotoUrl?: string;
    arrivalDate?: DateOnly;
    departureDate?: DateOnly;
    role: Role;
    staffProfile?: StaffProfile;
    trainerPositionIds: Array<PositionId>;
}
export interface LeaderTalk {
    id: LeaderTalkId;
    day: DateOnly;
    name: string;
    isDemo: boolean;
    attendees: Array<RoadieId>;
}
export type LeaderTalkId = bigint;
export interface MyAccessView {
    demoRole?: DemoRole;
    grant?: AccessGrant;
}
export interface MyGroupView {
    roadies: Array<ShiftBoardRoadie>;
    eventId: EventId;
    shift: Shift;
    shiftLabel: string;
    capacity: bigint;
}
export interface NextEventView {
    eventId: EventId;
    name: string;
    start: Timestamp;
    startsInMs: bigint;
}
export interface OrientationCheckoff {
    hatsCount: bigint;
    roadieId: RoadieId;
    uniformCounts: Array<[bigint, bigint]>;
    paperworkItems: Array<string>;
    isDemo: boolean;
    updatedAt: Timestamp;
    uniformItems: Array<string>;
    shirtsCount: bigint;
}
export interface OrientationRoadieRow {
    demoPhotoUrl?: string;
    noShow: boolean;
    roadieId: RoadieId;
    present: boolean;
    name: string;
    positionName: string;
    positionId: PositionId;
    crewId?: CrewId;
    rosterState: RosterState;
    paperworkStatus: PaperworkStatus;
    crewName?: string;
    photo?: PhotoRef;
}
export interface OrientationSessionOption {
    end?: DateTime;
    eventId: EventId;
    name: string;
    start: DateTime;
}
export interface OrientationSessionView {
    end?: DateTime;
    roadies: Array<OrientationRoadieRow>;
    eventId: EventId;
    name: string;
    assignedCount: bigint;
    presentCount: bigint;
    start: DateTime;
}
export interface OverviewRow {
    hired: bigint;
    need: bigint;
    positionName: string;
    totalPar: bigint;
}
export interface PendingRequestSummary {
    hasProfile: boolean;
    requestedAt: Timestamp;
}
export interface PendingUser {
    principal: Principal;
    staffProfile?: StaffProfile;
    requestedAt: Timestamp;
}
export type PersonName = string;
export type Phone = string;
export type PhotoRef = Uint8Array;
export interface Position {
    id: PositionId;
    openingBuildTo: bigint;
    defaultHats: bigint;
    defaultShirts: bigint;
    house: House;
    afterOpeningBuildTo: bigint;
    minimumAge: bigint;
    code: string;
    name: string;
    shirtQty: bigint;
    shirtType: string;
    hatType: string;
    hatQty: bigint;
    needsAlcoholCert: boolean;
}
export type PositionId = bigint;
export interface PretendDate {
    day: DateOnly;
    shift: DemoShift;
}
export interface Result {
    hasMore: boolean;
    rows: Array<Array<Cell>>;
}
export type Result__1 = {
    __kind__: "ok";
    ok: null;
} | {
    __kind__: "err";
    err: Error_;
};
export interface RetentionSettings {
    notesDays: bigint;
    archivedContactSetDays: bigint;
    archivedPhotoDays: bigint;
    changeLogDays: bigint;
}
export interface Roadie {
    id: RoadieId;
    status: RoadieStatus;
    orientationEventId?: EventId;
    mainPositionId: PositionId;
    demoPhotoUrl?: string;
    crossTrainedPositionId?: PositionId;
    hireDate?: Timestamp;
    corporateEmployeeId?: string;
    contactSet?: ContactSet;
    isDemo: boolean;
    crewId?: CrewId;
    rosterState: RosterState;
    signedBy?: Principal;
    birthdayMonthDay?: string;
    isMinor: boolean;
    archivedReason?: ArchiveReason;
    photo?: PhotoRef;
    hiredAt: Timestamp;
    secondPositionId?: PositionId;
    profile: RoadieProfile;
    startDate?: DateOnly;
    archivedAt?: Timestamp;
}
export type RoadieId = bigint;
export interface RoadieProfile {
    favoriteSnack?: string;
    positionAppliedFor?: string;
    goalHere?: string;
    name: PersonName;
    hometown?: string;
    favoriteTeam?: string;
    favoriteDrink?: string;
    preferredName?: string;
    shirtSize?: ShirtSize;
    hatSize?: HatSize;
    shiftsWantedPerWeek?: bigint;
    favoriteMovie?: string;
    funFact?: string;
    hobbies?: string;
    favoriteColor?: string;
    weekdayLunch?: boolean;
}
export interface RosterSummary {
    active: bigint;
    pending: bigint;
    positionName: string;
    buildTo: bigint;
    positionId: PositionId;
    onHand: bigint;
    openSpots: bigint;
}
export interface ScheduleEvent {
    id: EventId;
    end?: DateTime;
    kind: EventKind;
    name: string;
    start: DateTime;
}
export interface ShiftBoard {
    eventId: EventId;
    groups: Array<ShiftBoardGroup>;
    offRoadieIds: Array<RoadieId>;
    isDemo: boolean;
    shift: Shift;
    editedAt: Timestamp;
}
export interface ShiftBoardGroup {
    roadieIds: Array<RoadieId>;
    trainerPrincipal: Principal;
    capacity: bigint;
}
export interface ShiftBoardGroupView {
    roadies: Array<ShiftBoardRoadie>;
    trainerPrincipal: Principal;
    capacity: bigint;
}
export interface ShiftBoardRoadie {
    markedUnavailable: boolean;
    demoPhotoUrl?: string;
    roadieId: RoadieId;
    name: string;
    positionCode: string;
    positionId: PositionId;
    photo?: PhotoRef;
}
export interface ShiftBoardView {
    offThisShift: Array<ShiftBoardRoadie>;
    eventId: EventId;
    groups: Array<ShiftBoardGroupView>;
    isDemo: boolean;
    shift: Shift;
    unassigned: Array<ShiftBoardRoadie>;
    editedAt: Timestamp;
}
export interface ShiftCheckInSummary {
    eventId: EventId;
    total: bigint;
    present: bigint;
    late: bigint;
    shift: Shift;
    shiftLabel: string;
    absent: bigint;
}
export type ShirtSize = string;
export type SignOffOutcome = {
    __kind__: "certified";
    certified: null;
} | {
    __kind__: "needsMoreTime";
    needsMoreTime: string;
};
export type SignatureRef = Uint8Array;
export type SignupId = bigint;
export type SignupStatus = {
    __kind__: "pending";
    pending: null;
} | {
    __kind__: "approved";
    approved: RoadieId;
} | {
    __kind__: "rejected";
    rejected: null;
};
export interface SignupSubmission {
    id: SignupId;
    status: SignupStatus;
    signature?: SignatureRef;
    contactSet: ContactSet;
    submittedAt: Timestamp;
    isDemo: boolean;
    photo?: PhotoRef;
    profile: RoadieProfile;
}
export interface SizeCurve {
    shirts: Array<SizeCurveEntry>;
    hats: Array<SizeCurveEntry>;
}
export interface SizeCurveEntry {
    size: string;
    percent: bigint;
}
export interface StaffProfile {
    title: string;
    demoPhotoUrl?: string;
    arrivalDate?: DateOnly;
    workEmail?: Email;
    favoriteSnack?: string;
    departureDate?: DateOnly;
    goalHere?: string;
    hometown?: string;
    fullName: PersonName;
    favoriteTeam?: string;
    workPhone?: Phone;
    favoriteDrink?: string;
    trainerPositionIds: Array<PositionId>;
    preferredName?: string;
    shirtSize?: ShirtSize;
    homeStoreNumber: string;
    hatSize?: HatSize;
    requestedRole: Role;
    photo?: PhotoRef;
    homeStoreCity: string;
    funFact?: string;
    hobbies?: string;
    favoriteColor?: string;
}
export interface StoreInfo {
    amShiftEnd: TimeOfDay;
    pmShiftStart: TimeOfDay;
    storeNumber: string;
    leaderTalkName: string;
    appName: string;
    leaderTalkSize: bigint;
    logo?: PhotoRef;
    amShiftStart: TimeOfDay;
    openingDate: DateOnly;
    pmShiftEnd: TimeOfDay;
    trainingGroupSize: bigint;
    address: string;
    secondaryLogo?: PhotoRef;
    locationName: string;
    timeZone: TimeZone;
    storePhone: Phone;
}
export interface StoreLogos {
    logo?: PhotoRef;
    secondaryLogo?: PhotoRef;
}
export interface StoreTemplateFile {
    leaderTalkName: string;
    leaderTalkSize: bigint;
    version: bigint;
    trainingGroupSize: bigint;
    schedule: Array<TemplateScheduleEvent>;
    positions: Array<TemplatePosition>;
    checklists: Checklists;
}
export type TemplateLoadResult = {
    __kind__: "ok";
    ok: TemplatePreview;
} | {
    __kind__: "err";
    err: string;
};
export interface TemplatePosition {
    openingBuildTo: bigint;
    defaultHats: bigint;
    defaultShirts: bigint;
    house: House;
    afterOpeningBuildTo: bigint;
    minimumAge: bigint;
    code: string;
    name: string;
    shirtQty: bigint;
    shirtType: string;
    hatType: string;
    hatQty: bigint;
    needsAlcoholCert: boolean;
}
export interface TemplatePreview {
    leaderTalkName: string;
    scheduleCount: bigint;
    orientationUniformCount: bigint;
    positionCount: bigint;
    paperworkCount: bigint;
}
export interface TemplateScheduleEvent {
    kind: EventKind;
    name: string;
    endOffsetDays?: bigint;
    startOffsetDays: bigint;
}
export type TimeOfDay = bigint;
export type TimeZone = string;
export type Timestamp = bigint;
export interface TodayView {
    checkIn?: CheckInBoardView;
    nextEvent?: NextEventView;
    shiftSummaries: Array<ShiftCheckInSummary>;
    myGroup?: MyGroupView;
    role: Role;
    absentAlerts: Array<AbsentAlertView>;
}
export interface TrainerNote {
    id: bigint;
    day: DateOnly;
    didWell: string;
    roadieId: RoadieId;
    createdAt: Timestamp;
    isDemo: boolean;
    author: Principal;
    shift: Shift;
    workOn: string;
}
export interface UnassignedRoadieRow {
    demoPhotoUrl?: string;
    roadieId: RoadieId;
    name: string;
    positionName: string;
    positionId: PositionId;
    crewId?: CrewId;
    crewName?: string;
    photo?: PhotoRef;
}
export interface UniformCheckoffItem {
    itemId: bigint;
    checked: boolean;
    count: bigint;
    text: string;
    itemType: UniformItemType;
}
export interface UniformCheckoffView {
    roadieId: RoadieId;
    missing: Array<string>;
    locked: boolean;
    complete: boolean;
    items: Array<UniformCheckoffItem>;
}
export interface UniformOrderRow {
    hired: bigint;
    item: string;
    orderTotal: bigint;
    size: string;
    projected: bigint;
}
export interface UniformOrderTotalsRow {
    hired: bigint;
    item: string;
    orderTotal: bigint;
    projected: bigint;
}
export interface UniformOrderView {
    rows: Array<UniformOrderRow>;
    filter: UniformHouseFilter;
    sizeUnknown: Array<UniformSizeUnknownRow>;
    totals: Array<UniformOrderTotalsRow>;
    bufferPercent: bigint;
}
export interface UniformSettings {
    sizeCurve: SizeCurve;
    bufferPercent: bigint;
}
export interface UniformSizeUnknownRow {
    roadieId: RoadieId;
    name: string;
    missingHat: boolean;
    missingShirt: boolean;
}
export type Value = {
    __kind__: "int";
    int: bigint;
} | {
    __kind__: "nat";
    nat: bigint;
} | {
    __kind__: "float";
    float: number;
} | {
    __kind__: "bool";
    bool: boolean;
} | {
    __kind__: "null";
    null: null;
} | {
    __kind__: "text";
    text: string;
};
export enum AttendanceState {
    present = "present",
    late = "late",
    absent = "absent"
}
export enum CheckInState {
    present = "present",
    late = "late",
    absent = "absent"
}
export enum DemoRole {
    admin = "admin",
    trainingManager = "trainingManager",
    trainer = "trainer",
    leadership = "leadership",
    visitingManager = "visitingManager",
    storeManager = "storeManager",
    kiosk = "kiosk"
}
export enum DemoShift {
    am = "am",
    pm = "pm"
}
export enum EventKind {
    other = "other",
    signOff = "signOff",
    deadline = "deadline",
    friendsAndFamily = "friendsAndFamily",
    openingDay = "openingDay",
    trainingDay = "trainingDay",
    orientation = "orientation"
}
export enum GiftBagCategory {
    color = "color",
    candySnack = "candySnack",
    shirtSize = "shirtSize",
    hatSize = "hatSize",
    sportsTeam = "sportsTeam",
    drink = "drink"
}
export enum House {
    boh = "boh",
    foh = "foh"
}
export enum PaperworkStatus {
    incomplete = "incomplete",
    complete = "complete"
}
export enum RoadieStatus {
    active = "active",
    hired = "hired",
    inTraining = "inTraining",
    paperworkDone = "paperworkDone",
    oriented = "oriented",
    certified = "certified",
    needsMoreTime = "needsMoreTime",
    archived = "archived"
}
export enum Role {
    integration = "integration",
    admin = "admin",
    trainingManager = "trainingManager",
    trainer = "trainer",
    leadership = "leadership",
    visitingManager = "visitingManager",
    storeManager = "storeManager",
    kiosk = "kiosk"
}
export enum RosterState {
    active = "active",
    pending = "pending"
}
export enum Shift {
    am = "am",
    pm = "pm"
}
export enum UniformHouseFilter {
    all = "all",
    boh = "boh",
    foh = "foh"
}
export enum UniformItemType {
    count = "count",
    checkbox = "checkbox"
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export enum Weekday {
    fri = "fri",
    mon = "mon",
    sat = "sat",
    sun = "sun",
    thu = "thu",
    tue = "tue",
    wed = "wed"
}
export interface backendInterface {
    /**
     * / Build the access end timestamp for a chosen calendar day: 11:59:59 PM
     * / America/Chicago on that day. `day` is a UTC-midnight date-only timestamp.
     * / Any signed-in caller may call this so the approval and access panels can
     * / set an end date without reimplementing the store-time-zone rule.
     */
    accessEndForDay(day: DateOnly): Promise<Timestamp>;
    /**
     * / Acknowledge an alert (Admin/Store Manager only).
     */
    acknowledgeAlert(id: AlertId): Promise<void>;
    /**
     * / Add a trainer note (Trainer/Admin/Store Manager only).
     */
    addTrainerNote(note: TrainerNote): Promise<bigint>;
    /**
     * / Apply a +1/−1 build-to adjustment (Store Manager/Admin only).
     */
    adjustBuildTo(positionId: PositionId, openingDelta: bigint, afterOpeningDelta: bigint): Promise<void>;
    /**
     * / Count the current admins.
     */
    adminCount(): Promise<bigint>;
    /**
     * / Approve a submission (Admin/Store Manager only).
     */
    approveSignup(id: SignupId, decision: ApprovalDecision, signature: SignatureRef): Promise<RoadieId>;
    /**
     * / Approve a pending user (Admin only).
     */
    approveUser(request: ApprovalRequest): Promise<void>;
    /**
     * / Archive an absent alert (Admin, Store Manager or Training Manager).
     */
    archiveAbsentAlert(id: AlertId): Promise<void>;
    /**
     * / Archive every no-show at a session as NCNS Orientation (Admin/Store
     * / Manager only). Returns the archived roadie ids.
     */
    archiveNoShows(eventId: EventId): Promise<Array<RoadieId>>;
    /**
     * / Archive a roadie (Admin/Store Manager only).
     */
    archiveRoadie(id: RoadieId, reason: ArchiveReason): Promise<void>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    /**
     * / Fill empty capacity from the Unassigned tray (Admin, Store Manager or
     * / Training Manager).
     */
    autoFillShiftBoard(eventId: EventId, shift: Shift): Promise<void>;
    /**
     * / Bootstrap the first app Admin from the platform's shared authorization
     * / grant. The first principal to sign in is made an admin by the platform
     * / mixin; this bridges that grant into the app's access model so the first
     * / caller can approve users. Returns true when the caller holds an app Admin
     * / grant after the call.
     */
    bootstrapAdmin(): Promise<boolean>;
    /**
     * / Build the Full export including contact set (Admin/Store Manager only).
     */
    buildFullExport(): Promise<ExportData>;
    /**
     * / Build the Shareable export (no contact set).
     */
    buildShareableExport(): Promise<ExportData>;
    /**
     * / Change a roadie's position or crew (Admin/Store Manager only).
     */
    changePosition(id: RoadieId, mainPositionId: PositionId, secondPositionId: PositionId | null, crewId: CrewId | null): Promise<void>;
    /**
     * / Check a candidate kiosk PIN. Returns true when it matches the stored hash.
     */
    checkKioskPin(pin: string): Promise<boolean>;
    /**
     * / Remove every demo record (Admin, demo mode only). Real records are never
     * / touched.
     */
    clearDemoData(): Promise<DemoDataSummary>;
    /**
     * / Clear one shift board's groups and Off list (Admin, Store Manager or
     * / Training Manager).
     */
    clearShiftBoard(eventId: EventId, shift: Shift): Promise<void>;
    /**
     * / Copy another shift's groups, capacities and Off list onto this shift,
     * / replacing the current board (Admin, Store Manager or Training Manager).
     */
    copyShiftBoard(eventId: EventId, shift: Shift, fromEventId: EventId, fromShift: Shift): Promise<void>;
    /**
     * / Create a crew (Admin/Store Manager only).
     */
    createCrew(name: string): Promise<CrewId>;
    /**
     * / Create a leader talk (Admin/Store Manager only).
     */
    createLeaderTalk(talk: LeaderTalk): Promise<LeaderTalkId>;
    /**
     * / Create a position (Admin only).
     */
    createPosition(position: Position): Promise<PositionId>;
    /**
     * / Create a schedule event (Admin only).
     */
    createScheduleEvent(event: ScheduleEvent): Promise<EventId>;
    /**
     * / Delete a crew (Admin/Store Manager only). Refuses while any roadie is
     * / assigned to the crew.
     */
    deleteCrew(id: CrewId): Promise<void>;
    /**
     * / Delete a position (Admin only).
     */
    deletePosition(id: PositionId): Promise<void>;
    /**
     * / Delete a schedule event (Admin only).
     */
    deleteScheduleEvent(id: EventId): Promise<void>;
    /**
     * / Dismiss one of the caller's own group-change notices.
     */
    dismissGroupChangeNotice(id: bigint): Promise<void>;
    /**
     * / Build the downloadable store template file (Admin only).
     */
    downloadStoreTemplate(): Promise<StoreTemplateFile>;
    /**
     * / Re-seed the store when it has no positions yet. Idempotent; returns true
     * / when a seed was applied, false when the store already had positions.
     */
    ensureSeeded(): Promise<boolean>;
    /**
     * / Excuse an absent roadie with a short reason (Admin, Store Manager or
     * / Training Manager).
     */
    excuseAbsentAlert(id: AlertId, reason: string): Promise<void>;
    execute(qJson: string): Promise<Result>;
    /**
     * / Find duplicate cards matching a submission (Admin/Store Manager only).
     * / Each match names the matched roadie and their main position.
     */
    findDuplicates(id: SignupId): Promise<Array<DuplicateMatch>>;
    /**
     * / Return the backend API documentation as Markdown.
     */
    getApiDoc(): Promise<string>;
    getCallerUserRole(): Promise<UserRole>;
    /**
     * / The trainer check-in screen for the caller's own group on one shift.
     */
    getCheckInBoard(eventId: EventId, shift: Shift): Promise<CheckInBoardView | null>;
    /**
     * / Read the editable checklists.
     */
    getChecklists(): Promise<Checklists>;
    /**
     * / Read a roadie's contact set. Admin and Store Manager receive the contact
     * / set; every other read-capable role receives an empty array.
     */
    getContactSet(id: RoadieId): Promise<Array<ContactSet>>;
    /**
     * / Dashboard summary tiles and per-position progress, including the
     * / pending/active breakdown and the Hired → Active funnel.
     */
    getDashboard(): Promise<DashboardView>;
    /**
     * / Count the demo records currently loaded.
     */
    getDemoDataSummary(): Promise<DemoDataSummary>;
    /**
     * / Read the current demo state for the calling principal. Any caller,
     * / including unregistered users, so the banner can render on the sign-in and
     * / waiting screens. `demoRole` and `demoTrainerStations` describe the
     * / caller's own demo role.
     */
    getDemoState(): Promise<DemoStateView>;
    /**
     * / Build the Gift Bags shopping list and printable labels for the selected
     * / filter, across active (non-archived) roadies only. Visible to Admin, Store
     * / Manager and Training Manager. Never includes phone, email or date of birth.
     */
    getGiftBags(filter: GiftBagFilter): Promise<GiftBagsData>;
    /**
     * / Read the caller's own access view: their real grant (or null) plus a
     * / separate `demoRole` carrying the caller's own demo role while demo mode is
     * / on, or null when demo mode is off. Returns null grant until an Admin has
     * / approved the caller, so the frontend keeps showing the waiting screen.
     */
    getMyAccess(): Promise<MyAccessView>;
    /**
     * / The caller's own group for the current or next shift, for the Today
     * / screen. Null when the caller trains no group on that shift.
     */
    getMyGroup(): Promise<MyGroupView | null>;
    /**
     * / Read the caller's own pending access request, if any. Returns null when
     * / the caller has no pending entry; otherwise the requestedAt of that pending
     * / entry and hasProfile = true when a staff profile has been submitted.
     */
    getMyPendingRequest(): Promise<PendingRequestSummary | null>;
    /**
     * / Read the orientation check-off for a roadie (Admin/Store Manager only).
     */
    getOrientationCheckoff(roadieId: RoadieId): Promise<OrientationCheckoff | null>;
    /**
     * / The orientation check-in screen for one session: assigned roadies with
     * / photo, name, position, crew and paperwork status, plus Present x / y
     * / counts. Admin, Store Manager, Training Manager and Visiting Manager.
     */
    getOrientationSessionView(eventId: EventId): Promise<OrientationSessionView | null>;
    /**
     * / Read a roadie's photo bytes by id, for a caller allowed to see the roadie.
     * / Returns null when the roadie has no photo or is not visible to the caller.
     */
    getPhoto(id: RoadieId): Promise<PhotoRef | null>;
    /**
     * / Read retention settings.
     */
    getRetentionSettings(): Promise<RetentionSettings>;
    /**
     * / Read one roadie card.
     */
    getRoadie(id: RoadieId): Promise<Roadie | null>;
    /**
     * / Per-position roster counts: on-hand roadies and open spots.
     */
    getRosterSummary(): Promise<Array<RosterSummary>>;
    /**
     * / Read one shift board with its trainer columns, Unassigned tray and Off
     * / this shift tray (every read role except kiosk and integration).
     */
    getShiftBoard(eventId: EventId, shift: Shift): Promise<ShiftBoardView | null>;
    /**
     * / Read one submission (Admin/Store Manager only).
     */
    getSignup(id: SignupId): Promise<SignupSubmission | null>;
    /**
     * / Read a pending submission's photo bytes by id (Admin/Store Manager only).
     * / Returns null when the submission has no photo.
     */
    getSignupPhoto(id: SignupId): Promise<PhotoRef | null>;
    /**
     * / Read the store configuration.
     */
    getStoreInfo(): Promise<StoreInfo>;
    /**
     * / Read both store logos (main and secondary). Any caller, including Kiosk
     * / and unregistered users.
     */
    getStoreLogo(): Promise<StoreLogos>;
    /**
     * / The Today page payload, shaped by the caller's role.
     */
    getToday(): Promise<TodayView>;
    /**
     * / The uniform check-off for a roadie (Admin, Store Manager, Training Manager
     * / or Visiting Manager). Locked until the roadie's paperwork is 100% complete.
     */
    getUniformCheckoff(roadieId: RoadieId): Promise<UniformCheckoffView | null>;
    /**
     * / Build the uniform order for one house filter (Admin, Store Manager or
     * / Training Manager).
     */
    getUniformOrder(filter: UniformHouseFilter): Promise<UniformOrderView>;
    /**
     * / Read the uniform settings (size curve and order buffer). Admin, Store
     * / Manager and Training Manager.
     */
    getUniformSettings(): Promise<UniformSettings>;
    /**
     * / True when an Admin has set a kiosk PIN.
     */
    hasKioskPin(): Promise<boolean>;
    isCallerAdmin(): Promise<boolean>;
    /**
     * / Compute whether a roadie is a minor as of now.
     */
    isMinor(id: RoadieId): Promise<boolean>;
    /**
     * / List the unarchived absent alerts (Admin, Store Manager or Training
     * / Manager). `phone` is present only for Admin and Store Manager.
     */
    listAbsentAlerts(): Promise<Array<AbsentAlertView>>;
    /**
     * / List all access grants (Admin only).
     */
    listAccessGrants(): Promise<Array<AccessGrant>>;
    /**
     * / List alerts (Admin/Store Manager only).
     */
    listAlerts(): Promise<Array<Alert>>;
    /**
     * / List attendance records for an event (Admin/Store Manager only).
     */
    listAttendanceForEvent(eventId: EventId): Promise<Array<AttendanceRecord>>;
    /**
     * / List change-log entries visible to the caller.
     */
    listChangeLog(): Promise<Array<ChangeLogEntry>>;
    /**
     * / List crews.
     */
    listCrews(): Promise<Array<Crew>>;
    /**
     * / List the caller's undismissed group-change notices, newest first.
     */
    listGroupChangeNotices(): Promise<Array<GroupChangeNotice>>;
    /**
     * / List the leaders shown on the Leaders page: the manager, trainer and
     * / leadership roles. Readable by every role except Kiosk and Integration.
     * / Never carries phone or email.
     */
    listLeaders(): Promise<Array<LeaderSummary>>;
    /**
     * / List the orientation sessions available for assignment, ordered by start
     * / (Admin, Store Manager, Training Manager or Visiting Manager).
     */
    listOrientationSessions(): Promise<Array<OrientationSessionOption>>;
    /**
     * / List pending sign-up submissions (Admin/Store Manager only).
     */
    listPendingSignups(): Promise<Array<SignupSubmission>>;
    /**
     * / List pending access requests (Admin only).
     */
    listPendingUsers(): Promise<Array<PendingUser>>;
    /**
     * / List all positions.
     */
    listPositions(): Promise<Array<Position>>;
    /**
     * / List roadie cards visible to the caller.
     */
    listRoadies(): Promise<Array<Roadie>>;
    /**
     * / List the roster for one position.
     */
    listRosterForPosition(positionId: PositionId): Promise<Array<Roadie>>;
    /**
     * / List the opening schedule.
     */
    listSchedule(): Promise<Array<ScheduleEvent>>;
    /**
     * / List every shift board for the current partition (every read role except
     * / kiosk and integration).
     */
    listShiftBoards(): Promise<Array<ShiftBoardView>>;
    /**
     * / List trainer notes for a roadie. Restricted the same way roadies are:
     * / Integration sees nothing, and a trainer sees notes only for roadies in
     * / their assigned stations.
     */
    listTrainerNotes(roadieId: RoadieId): Promise<Array<TrainerNote>>;
    /**
     * / List the pending roadies with no usable orientation session (Admin, Store
     * / Manager, Training Manager or Visiting Manager).
     */
    listUnassignedPendingRoadies(): Promise<Array<UnassignedRoadieRow>>;
    /**
     * / Seed the demo data set (Admin, demo mode only).
     */
    loadDemoData(): Promise<DemoDataSummary>;
    /**
     * / Load a store template file, replacing positions, schedule and checklists
     * / (Admin only). Refuses when any roadie exists.
     */
    loadStoreTemplate(file: StoreTemplateFile): Promise<TemplateLoadResult>;
    /**
     * / Mark a roadie Present at an orientation session (Admin, Store Manager,
     * / Training Manager or Visiting Manager). Idempotent so concurrent managers
     * / converge. Rejects an archived roadie. When the roadie's paperwork is
     * / incomplete it traps "Paperwork incomplete" unless `overrideReason` is a
     * / non-empty string and the caller is Admin or Store Manager.
     */
    markPresent(roadieId: RoadieId, eventId: EventId, overrideReason: string | null): Promise<void>;
    /**
     * / Move an absent roadie to the same day's other shift, into that shift's
     * / Unassigned tray (Admin, Store Manager or Training Manager).
     */
    moveAbsentRoadieToOtherShift(id: AlertId): Promise<void>;
    /**
     * / Move every non-archived roadie from one orientation session to another
     * / (Admin/Store Manager only, logged). Returns the number moved.
     */
    moveAllRoadiesToSession(fromEventId: EventId, toEventId: EventId): Promise<bigint>;
    /**
     * / Move a roadie to another orientation session (Admin/Store Manager only).
     */
    moveRoadieToSession(roadieId: RoadieId, eventId: EventId): Promise<void>;
    /**
     * / Record attendance for a roadie (Admin/Store Manager only).
     */
    recordAttendance(record: AttendanceRecord): Promise<void>;
    /**
     * / Create or change one roadie's check-in record for a shift (upsert). Admin,
     * / Store Manager and Training Manager may check in anyone; a trainer may
     * / check in only roadies in their own group on that shift's board. A trainer
     * / may write only from 30 minutes before the shift start until 2 hours after
     * / the shift end; after that only Admin, Store Manager or Training Manager
     * / may change records. Marking a roadie absent raises an absent alert.
     */
    recordCheckIn(eventId: EventId, shift: Shift, roadieId: RoadieId, state: CheckInState, lateAt: Timestamp | null, excused: string | null): Promise<void>;
    /**
     * / Record a final sign-off for a roadie (Admin/Store Manager only).
     */
    recordFinalSignOff(signOff: FinalSignOff): Promise<void>;
    /**
     * / Rehire an archived roadie (Admin/Store Manager only). Returns the roadie
     * / to pending and assigns the next upcoming orientation session.
     */
    rehireRoadie(id: RoadieId, reason: string | null): Promise<void>;
    /**
     * / Reject a pending submission (Admin/Store Manager only).
     */
    rejectSignup(id: SignupId): Promise<void>;
    /**
     * / Remove a user's access (Admin only).
     */
    removeUser(principal: Principal): Promise<void>;
    /**
     * / Register the caller for approval. Any signed-in caller may call this once;
     * / it is idempotent and returns true when the caller is already registered or
     * / already pending. The first caller approved by an Admin becomes an Admin.
     */
    requestAccess(): Promise<boolean>;
    /**
     * / Re-sign a roadie's availability (Admin/Store Manager only).
     */
    resignAvailability(id: RoadieId, signature: SignatureRef): Promise<void>;
    /**
     * / Replace one shift board's groups, capacities and Off list (Admin, Store
     * / Manager or Training Manager).
     */
    saveShiftBoard(board: ShiftBoard): Promise<void>;
    /**
     * / Save the current store configuration as a template (Admin only).
     */
    saveStoreTemplate(name: string): Promise<void>;
    /**
     * / Save the uniform check-off for a roadie (Admin, Store Manager, Training
     * / Manager or Visiting Manager). Updates only the uniform fields and keeps
     * / the roadie's paperwork items.
     */
    saveUniformCheckoff(roadieId: RoadieId, uniformItems: Array<string>, uniformCounts: Array<[bigint, bigint]>): Promise<void>;
    schema(): Promise<string>;
    /**
     * / Turn demo mode on or off (Admin only). Turning it on requires the literal
     * / confirmation "DEMO"; turning it on sets the eight-hour auto-off time.
     * / Every on/off is written to the change log.
     */
    setDemoMode(enabled: boolean, confirmation: string): Promise<DemoActionResult>;
    /**
     * / Set the impersonated demo role and, for a demo NSO Trainer, the stations
     * / that role may see. Any signed-in caller may choose a demo role while demo
     * / mode is on.
     */
    setDemoRole(role: DemoRole, stations: Array<PositionId>): Promise<DemoActionResult>;
    /**
     * / Choose which demo leader a demo NSO Trainer views as, so "View as NSO
     * / Trainer" can see that leader's group. Stored per caller while demo mode is
     * / on; ignored outside demo mode.
     */
    setDemoTrainerAs(trainerPrincipal: Principal): Promise<DemoActionResult>;
    /**
     * / Set the kiosk staff PIN (Admin only). Stored hashed; never returned.
     */
    setKioskPin(pin: string): Promise<void>;
    /**
     * / Record per-roadie attendance for a leader talk (Admin/Store Manager only).
     */
    setLeaderTalkAttendance(id: LeaderTalkId, attendees: Array<RoadieId>): Promise<void>;
    /**
     * / Set the paperwork items for a roadie (Admin or Store Manager only, logged).
     * / Updates only `paperworkItems` and keeps the uniform fields.
     */
    setPaperworkItems(roadieId: RoadieId, paperworkItems: Array<string>): Promise<void>;
    /**
     * / Set or clear the pretend "now" used while demo mode is on. Null restores
     * / the real clock.
     */
    setPretendDate(pretendDate: PretendDate | null): Promise<DemoActionResult>;
    /**
     * / Submit a new sign-up from the kiosk (Kiosk, Store Manager or Admin only).
     */
    submitSignup(profile: RoadieProfile, photo: PhotoRef | null, signature: SignatureRef | null, contactSet: ContactSet): Promise<SignupId>;
    /**
     * / Store the signed-in caller's staff profile on their pending request. The
     * / caller must already have a pending request (created by `requestAccess`).
     */
    submitStaffProfile(profile: StaffProfile): Promise<void>;
    /**
     * / Undo a roadie's Present mark at an orientation session (Admin/Store
     * / Manager only, logged). Returns the roadie to pending.
     */
    undoPresent(roadieId: RoadieId, eventId: EventId): Promise<void>;
    /**
     * / Update a user's access end date (Admin only).
     */
    updateAccessEnd(principal: Principal, accessEndsAt: Timestamp | null): Promise<void>;
    /**
     * / Update the editable checklists (Admin only).
     */
    updateChecklists(value: Checklists): Promise<void>;
    /**
     * / Update a roadie's contact set (Admin/Store Manager only).
     */
    updateContactSet(id: RoadieId, contactSet: ContactSet): Promise<void>;
    /**
     * / Rename a crew and/or change its leader (Admin/Store Manager only).
     */
    updateCrew(id: CrewId, name: string, leaderPrincipal: Principal | null): Promise<void>;
    /**
     * / Update the signed-in caller's own staff profile on their access grant.
     */
    updateMyStaffProfile(profile: StaffProfile): Promise<void>;
    /**
     * / Update a position (Admin only).
     */
    updatePosition(position: Position): Promise<void>;
    /**
     * / Update retention settings (Admin only).
     */
    updateRetentionSettings(settings: RetentionSettings): Promise<void>;
    /**
     * / Edit a roadie's non-contact details (Admin/Store Manager only).
     */
    updateRoadieDetails(id: RoadieId, profile: RoadieProfile): Promise<void>;
    /**
     * / Update a roadie's status (Admin/Store Manager only).
     */
    updateRoadieStatus(id: RoadieId, status: RoadieStatus): Promise<void>;
    /**
     * / Update a schedule event (Admin only).
     */
    updateScheduleEvent(event: ScheduleEvent): Promise<void>;
    /**
     * / Update the store configuration (Admin only).
     */
    updateStoreInfo(info: StoreInfo): Promise<void>;
    /**
     * / Edit a trainer note within its 24-hour lock window (author only).
     */
    updateTrainerNote(note: TrainerNote): Promise<void>;
    /**
     * / Update a user's trainer stations (Admin only).
     */
    updateTrainerStations(principal: Principal, positionIds: Array<PositionId>): Promise<void>;
    /**
     * / Update the uniform settings (Admin or Store Manager only, logged).
     */
    updateUniformSettings(settings: UniformSettings): Promise<void>;
    /**
     * / Change an existing user's role (Admin only).
     */
    updateUserRole(principal: Principal, role: Role): Promise<void>;
}
