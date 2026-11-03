import type {
  AccessGrant,
  ApprovalRequest,
  DemoDataSummary,
  DemoRole,
  DemoStateView,
  LeaderSummary,
  Position,
  PositionId,
  PretendDate,
  Roadie,
  RoadieId,
  RoadieProfile,
  RoadieStatus,
  Role,
  StoreInfo,
  Timestamp,
} from "@/backend";

export type {
  AccessGrant,
  ApprovalRequest,
  DemoDataSummary,
  DemoRole,
  DemoStateView,
  LeaderSummary,
  Position,
  PositionId,
  PretendDate,
  Roadie,
  RoadieId,
  RoadieProfile,
  RoadieStatus,
  Role,
  StoreInfo,
};

/**
 * The demo state as the app consumes it: the backend view plus a resolved
 * `effectiveRole`. While demo mode is on the effective role is the chosen demo
 * role; while it is off it is the caller's real grant role (or undefined when
 * the caller has no grant).
 */
export interface DemoState {
  /** Whether demo mode is currently on. */
  enabled: boolean;
  /** The impersonated role while demo mode is on. */
  demoRole: DemoRole;
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
