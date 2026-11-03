import type {
  AccessGrant,
  ApprovalRequest,
  DemoDataSummary,
  DemoRole,
  DemoStateView,
  LeaderSummary,
  MyAccessView,
  OrientationCheckoff,
  OrientationRoadieRow,
  OrientationSessionView,
  Position,
  PositionId,
  PretendDate,
  Roadie,
  RoadieId,
  RoadieProfile,
  RoadieStatus,
  Role,
  RosterState,
  RosterSummary,
  StoreInfo,
  Timestamp,
  UniformCheckoffItem,
  UniformCheckoffView,
} from "@/backend";

export type {
  AccessGrant,
  ApprovalRequest,
  DemoDataSummary,
  DemoRole,
  DemoStateView,
  LeaderSummary,
  MyAccessView,
  OrientationCheckoff,
  OrientationRoadieRow,
  OrientationSessionView,
  Position,
  PositionId,
  PretendDate,
  Roadie,
  RoadieId,
  RoadieProfile,
  RoadieStatus,
  Role,
  RosterState,
  RosterSummary,
  StoreInfo,
  UniformCheckoffItem,
  UniformCheckoffView,
};

/**
 * The demo state as the app consumes it: the backend view plus the caller's own
 * demo role. `demoRole` is the caller's own impersonated role while demo mode is
 * on, or null while it is off (or before the caller has chosen one).
 */
export interface DemoState {
  /** Whether demo mode is currently on. */
  enabled: boolean;
  /** The caller's own impersonated role while demo mode is on, else null. */
  demoRole: DemoRole | null;
  /** The stations a demo NSO Trainer may see. */
  demoTrainerStations: PositionId[];
  /** The pretend "now" (date + AM/PM), or null to use the real clock. */
  pretendDate: PretendDate | null;
  /** When demo mode was turned on, if it is on. */
  turnedOnAt: Timestamp | null;
  /** When demo mode turns itself off, if it is on. */
  autoOffAt: Timestamp | null;
}

/** A selectable demo role, with its display label. */
export interface DemoRoleOption {
  role: DemoRole;
  label: string;
}

/** A navigation entry shown in the app shell, gated by role. */
export interface NavItem {
  labelKey: string;
  to: string;
  /** Roles allowed to see this item. Empty means every signed-in user. */
  allowedRoles: Role[];
  /** Optional badge source key resolved at render time. */
  badge?: "pendingApprovals";
}

/** The signed-in user's resolved access, or a pending/denied state. */
export type AccessState =
  | { kind: "loading" }
  | { kind: "pending" }
  | { kind: "granted"; grant: AccessGrant; demo?: boolean }
  | { kind: "error"; message: string };

/** Copy dictionary shape: a flat map of dotted keys to localized strings. */
export type CopyDictionary = Record<string, string>;
