import { Role } from "@/backend";
import { demoRoleToRole, useDemo } from "@/hooks/useDemo";
import { useMyAccess } from "@/hooks/useQueries";
import type { AccessGrant, AccessState, NavItem } from "@/types";
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

/** The full navigation model; each item declares which roles may see it. */
export const NAV_ITEMS: NavItem[] = [
  { labelKey: "nav.today", to: "/today", allowedRoles: [] },
  { labelKey: "nav.dashboard", to: "/dashboard", allowedRoles: [] },
  { labelKey: "nav.roster", to: "/roster", allowedRoles: [] },
  { labelKey: "nav.myProfile", to: "/my-profile", allowedRoles: [] },
  { labelKey: "nav.leaders", to: "/leaders", allowedRoles: LEADERS_ROLES },
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
 * Resolve the caller's access state from the backend grant.
 *
 * While demo mode is on the effective role follows the chosen demo role: a
 * caller with a real grant keeps their grant but acts as the demo role, and a
 * caller with no grant (pending or unregistered) is treated as granted with a
 * synthetic grant carrying the demo role, so the whole app renders against demo
 * data. The backend enforces the same permission rules for the impersonated
 * role as for a real user with that role.
 */
export function useAccessState(): AccessState {
  const { data, isLoading, isError, error, isReady } = useMyAccess();
  const demo = useDemo();
  const { identity } = useInternetIdentity();

  return useMemo(() => {
    // Until the backend actor is ready the read has not run; report loading so
    // the waiting screen does not flash before the grant is known.
    if (!isReady || isLoading) return { kind: "loading" };

    const demoOn = demo.enabled;
    const demoRole = demoRoleToRole(demo.demoRole);

    if (demoOn) {
      // A real grant keeps its identity but acts as the demo role.
      if (data) {
        return {
          kind: "granted",
          grant: { ...data, role: demoRole },
          demo: true,
        };
      }
      // No grant yet: synthesize one so an unapproved caller can act as the
      // demo role against demo data only.
      const principal =
        identity && !identity.getPrincipal().isAnonymous()
          ? identity.getPrincipal()
          : undefined;
      if (principal) {
        const synthetic: AccessGrant = {
          principal,
          approvedAt: 0n,
          approvedBy: principal,
          role: demoRole,
          trainerPositionIds: demo.demoTrainerStations,
        };
        return { kind: "granted", grant: synthetic, demo: true };
      }
    }

    // Prefer a resolved grant over a failed poll: one transient error must not
    // replace the app (or a kiosk sign-up in progress) with the error screen.
    if (data) return { kind: "granted", grant: data };
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
