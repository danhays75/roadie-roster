import type {
  AccessGrant,
  ApprovalRequest,
  Position,
  PositionId,
  Roadie,
  RoadieId,
  RoadieStatus,
  Role,
  StoreInfo,
} from "@/backend";

export type {
  AccessGrant,
  ApprovalRequest,
  Position,
  PositionId,
  Roadie,
  RoadieId,
  RoadieStatus,
  Role,
  StoreInfo,
};

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
  | { kind: "granted"; grant: AccessGrant }
  | { kind: "error"; message: string };

/** Copy dictionary shape: a flat map of dotted keys to localized strings. */
export type CopyDictionary = Record<string, string>;
