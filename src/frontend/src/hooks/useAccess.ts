import { Role } from "@/backend";
import { demoRoleToRole, useDemo } from "@/hooks/useDemo";
import { useMyAccess } from "@/hooks/useQueries";
import type { AccessGrant, AccessState, MyAccessView, NavItem } from "@/types";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { useMemo } from "react";

/** Roles allowed to archive or rehire a roadie. */
export const ARCHIVE_ROLES: Role[] = [Role.storeManager, Role.admin];

/** Roles allowed to see the Admin surface. */
export const ADMIN_ROLES: Role[] = [Role.admin];

/** Roles allowed to see the approvals queue. */
export const APPROVAL_ROLES: Role[] = [Role.admin, Role.storeManager];

/** Roles allowed to see the kiosk sign-up surface. */
export const KIOSK_ROLES: Role[] = [Role.kiosk, Role.admin, Role.storeManager];

/** Roles allowed to see the export surface. */
export const EXPORT_ROLES: Role[] = [
  Role.admin,
  Role.storeManager,
  Role.trainingManager,
  Role.leadership,
];

/** Roles allowed to edit a roadie's details or change their position. */
export const EDIT_ROADIE_ROLES: Role[] = [Role.admin, Role.storeManager];

/** Roles allowed to see the Gift Bags surface. */
export const GIFT_BAGS_ROLES: Role[] = [
  Role.admin,
  Role.storeManager,
  Role.trainingManager,
];

/**
 * Roles allowed to see the Leaders surface. Every readable role except Kiosk
 * and Integration, which have no roster read access.
 */
export const LEADERS_ROLES: Role[] = [
  Role.admin,
  Role.storeManager,
  Role.trainingManager,
  Role.trainer,
  Role.visitingManager,
  Role.leadership,
];

/**
 * Roles allowed to see the Orientation check-in surface: the roles that may
 * read an orientation session view on the backend.
 */
export const ORIENTATION_ROLES: Role[] = [
  Role.admin,
  Role.storeManager,
  Role.trainingManager,
  Role.visitingManager,
];

/** The full navigation model; each item declares which roles may see it. */
export const NAV_ITEMS: NavItem[] = [
  { labelKey: "nav.today", to: "/today", allowedRoles: [] },
  { labelKey: "nav.dashboard", to: "/dashboard", allowedRoles: [] },
  { labelKey: "nav.roster", to: "/roster", allowedRoles: [] },
  { labelKey: "nav.myProfile", to: "/my-profile", allowedRoles: [] },
  { labelKey: "nav.leaders", to: "/leaders", allowedRoles: LEADERS_ROLES },
  {
    labelKey: "nav.orientation",
    to: "/orientation",
    allowedRoles: ORIENTATION_ROLES,
  },
  {
    labelKey: "nav.approvals",
    to: "/approvals",
    allowedRoles: APPROVAL_ROLES,
    badge: "pendingApprovals",
  },
  { labelKey: "nav.admin", to: "/admin", allowedRoles: ADMIN_ROLES },
  { labelKey: "nav.kiosk", to: "/kiosk", allowedRoles: KIOSK_ROLES },
  { labelKey: "nav.export", to: "/export", allowedRoles: EXPORT_ROLES },
  {
    labelKey: "nav.giftBags",
    to: "/gift-bags",
    allowedRoles: GIFT_BAGS_ROLES,
  },
];

/**
 * Normalize the `getMyAccess` result. The current binding returns a
 * `MyAccessView` with a separate `grant` and `demoRole`; an older actor (or a
 * test mock) may return a bare `AccessGrant`, which is treated as a real grant
 * with no demo role.
 */
function normalizeAccessView(value: unknown): {
  grant: AccessGrant | null;
  demoRole: MyAccessView["demoRole"];
} {
  if (typeof value !== "object" || value === null) {
    return { grant: null, demoRole: undefined };
  }
  const record = value as Record<string, unknown>;
  if ("grant" in record || "demoRole" in record) {
    const view = value as MyAccessView;
    return { grant: view.grant ?? null, demoRole: view.demoRole };
  }
  return { grant: value as AccessGrant, demoRole: undefined };
}

/**
 * Resolve the caller's access state from the backend access view.
 *
 * The backend returns the caller's real grant (or null) plus a separate
 * `demoRole` carrying the caller's own demo role while demo mode is on. A
 * caller with no real grant is never presented as really approved: while demo
 * mode is on they act as their chosen demo role against demo data only, and
 * while it is off they stay pending. The backend enforces the same permission
 * rules for the impersonated role as for a real user with that role.
 */
export function useAccessState(): AccessState {
  const { data, isLoading, isError, error, isReady } = useMyAccess();
  const demo = useDemo();
  const { identity } = useInternetIdentity();

  return useMemo(() => {
    // Until the backend actor is ready the read has not run; report loading so
    // the waiting screen does not flash before the grant is known.
    if (!isReady || isLoading) return { kind: "loading" };

    const { grant, demoRole } = normalizeAccessView(data);
    const demoOn = demo.enabled;
    // The caller's own demo role: prefer the per-caller value from the access
    // view, falling back to the demo state read.
    const callerDemoRole = demoRole ?? demo.demoRole;

    if (demoOn && callerDemoRole !== null && callerDemoRole !== undefined) {
      const effectiveRole = demoRoleToRole(callerDemoRole);
      // A real grant keeps its identity but acts as the demo role.
      if (grant) {
        return {
          kind: "granted",
          grant: { ...grant, role: effectiveRole },
          demo: true,
        };
      }
      // No real grant: synthesize a demo-only grant so an unapproved caller can
      // act as the demo role against demo data only.
      const principal =
        identity && !identity.getPrincipal().isAnonymous()
          ? identity.getPrincipal()
          : undefined;
      if (principal) {
        const synthetic: AccessGrant = {
          principal,
          approvedAt: 0n,
          approvedBy: principal,
          role: effectiveRole,
          trainerPositionIds: demo.demoTrainerStations,
        };
        return { kind: "granted", grant: synthetic, demo: true };
      }
    }

    // Prefer a resolved grant over a failed poll: one transient error must not
    // replace the app (or a kiosk sign-up in progress) with the error screen.
    if (grant) return { kind: "granted", grant };
    if (isError) {
      return {
        kind: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
    return { kind: "pending" };
  }, [
    data,
    isLoading,
    isError,
    error,
    isReady,
    demo.enabled,
    demo.demoRole,
    demo.demoTrainerStations,
    identity,
  ]);
}

/**
 * The caller's real access grant, ignoring any demo impersonation. Used by the
 * demo banner so the "Turn off" control stays real-Admin only even while the
 * caller is viewing as another demo role. Returns null while loading or when
 * the caller has no real grant.
 */
export function useRealAccessGrant(): AccessGrant | null {
  const { data } = useMyAccess();
  return useMemo(() => normalizeAccessView(data).grant, [data]);
}

/** Whether the given role may see a nav item. */
export function canSeeNavItem(item: NavItem, role: Role | undefined): boolean {
  if (item.allowedRoles.length === 0) return true;
  if (!role) return false;
  return item.allowedRoles.includes(role);
}

/** Whether the given role may archive or rehire. */
export function canArchive(role: Role | undefined): boolean {
  return !!role && ARCHIVE_ROLES.includes(role);
}

/** Whether the given role may open the Admin surface. */
export function canAdmin(role: Role | undefined): boolean {
  return !!role && ADMIN_ROLES.includes(role);
}

/** Whether the given role may open the approvals queue. */
export function canApprove(role: Role | undefined): boolean {
  return !!role && APPROVAL_ROLES.includes(role);
}

/** Whether the given role may open the export surface. */
export function canExport(role: Role | undefined): boolean {
  return !!role && EXPORT_ROLES.includes(role);
}

/** Whether the given role may edit a roadie's details or position. */
export function canEditRoadie(role: Role | undefined): boolean {
  return !!role && EDIT_ROADIE_ROLES.includes(role);
}

/** Whether the given role may open the Gift Bags surface. */
export function canGiftBags(role: Role | undefined): boolean {
  return !!role && GIFT_BAGS_ROLES.includes(role);
}

/** Whether the given role may open the Leaders surface. */
export function canLeaders(role: Role | undefined): boolean {
  return !!role && LEADERS_ROLES.includes(role);
}

/** Whether the given role may open the Orientation check-in surface. */
export function canOrientation(role: Role | undefined): boolean {
  return !!role && ORIENTATION_ROLES.includes(role);
}
