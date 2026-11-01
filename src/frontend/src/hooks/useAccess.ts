import { Role } from "@/backend";
import { useMyAccess } from "@/hooks/useQueries";
import type { AccessState, NavItem } from "@/types";
import { useMemo } from "react";

/** Roles allowed to archive or rehire a roadie. */
export const ARCHIVE_ROLES: Role[] = [Role.storeManager, Role.admin];

/** Roles allowed to see the Admin surface. */
export const ADMIN_ROLES: Role[] = [Role.admin];

/** Roles allowed to see the approvals queue. */
export const APPROVAL_ROLES: Role[] = [Role.admin];

/** Roles allowed to see the kiosk sign-up surface. */
export const KIOSK_ROLES: Role[] = [Role.kiosk, Role.admin, Role.storeManager];

/** Roles allowed to see the export surface. */
export const EXPORT_ROLES: Role[] = [
  Role.admin,
  Role.storeManager,
  Role.trainingManager,
  Role.leadership,
];

/** The full navigation model; each item declares which roles may see it. */
export const NAV_ITEMS: NavItem[] = [
  { labelKey: "nav.today", to: "/today", allowedRoles: [] },
  { labelKey: "nav.dashboard", to: "/dashboard", allowedRoles: [] },
  { labelKey: "nav.roster", to: "/roster", allowedRoles: [] },
  {
    labelKey: "nav.approvals",
    to: "/approvals",
    allowedRoles: APPROVAL_ROLES,
    badge: "pendingApprovals",
  },
  { labelKey: "nav.admin", to: "/admin", allowedRoles: ADMIN_ROLES },
  { labelKey: "nav.kiosk", to: "/kiosk", allowedRoles: KIOSK_ROLES },
  { labelKey: "nav.export", to: "/export", allowedRoles: EXPORT_ROLES },
];

/** Resolve the caller's access state from the backend grant. */
export function useAccessState(): AccessState {
  const { data, isLoading, isError, error } = useMyAccess();
  return useMemo(() => {
    if (isLoading) return { kind: "loading" };
    if (isError) {
      return {
        kind: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
    if (!data) return { kind: "pending" };
    return { kind: "granted", grant: data };
  }, [data, isLoading, isError, error]);
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
