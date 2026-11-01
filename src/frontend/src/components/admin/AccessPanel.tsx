import { type AccessGrant, Role } from "@/backend";
import { AdminSection } from "@/components/admin/FormField";
import { useAdminCopy } from "@/components/admin/useAdminCopy";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/hooks/useI18n";
import {
  useAccessGrants,
  useAdminCount,
  useRemoveUser,
  useUpdateUserRole,
} from "@/hooks/useQueries";
import { formatTimestamp, roleLabel, shortPrincipal } from "@/lib/format";

const ALL_ROLES: Role[] = [
  Role.admin,
  Role.storeManager,
  Role.trainingManager,
  Role.leadership,
  Role.visitingManager,
  Role.trainer,
  Role.kiosk,
  Role.integration,
];

function GrantRow({
  grant,
  adminCount,
}: {
  grant: AccessGrant;
  adminCount: number;
}) {
  const { t } = useI18n();
  const updateRole = useUpdateUserRole();
  const removeUser = useRemoveUser();
  const isLastAdmin = grant.role === Role.admin && adminCount <= 1;

  return (
    <li
      data-ocid="admin.access.item"
      className="flex flex-col gap-3 rounded-md border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <p className="font-display text-sm font-semibold uppercase tracking-wide">
          {shortPrincipal(grant.principal)}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("admin.access.approvedAt")}: {formatTimestamp(grant.approvedAt)}
        </p>
        {grant.accessEndsAt !== undefined && (
          <p className="text-xs text-muted-foreground">
            {t("admin.access.accessEnd")}: {formatTimestamp(grant.accessEndsAt)}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={grant.role}
          onValueChange={(value) =>
            updateRole.mutate({
              principal: grant.principal,
              role: value as Role,
            })
          }
        >
          <SelectTrigger
            data-ocid="admin.access.role.select"
            className="touch-target w-44"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ALL_ROLES.map((role) => (
              <SelectItem key={role} value={role}>
                {roleLabel(role)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          className="touch-target text-destructive"
          data-ocid="admin.access.remove_button"
          disabled={isLastAdmin || removeUser.isPending}
          title={isLastAdmin ? t("admin.access.lastAdmin") : undefined}
          onClick={() => removeUser.mutate(grant.principal)}
        >
          {t("admin.access.action.remove")}
        </Button>
      </div>
    </li>
  );
}

export function AccessPanel() {
  const { t } = useI18n();
  const c = useAdminCopy();
  const grants = useAccessGrants();
  const adminCount = useAdminCount();

  return (
    <AdminSection
      title={t("admin.section.access")}
      description={c.accessDescription}
      ocid="admin.access.section"
    >
      <p className="mb-3 text-sm text-muted-foreground">
        {t("admin.access.adminCount", {
          count: (adminCount.data ?? 0n).toString(),
        })}
      </p>
      {grants.isLoading && (
        <p className="text-sm text-muted-foreground">
          {t("admin.access.loading")}
        </p>
      )}
      {grants.isError && (
        <p className="text-sm text-destructive">{t("admin.access.error")}</p>
      )}
      {!grants.isLoading &&
        !grants.isError &&
        (grants.data?.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground">
            {t("admin.access.empty")}
          </p>
        )}
      {(grants.data?.length ?? 0) > 0 && (
        <ul className="space-y-3" data-ocid="admin.access.list">
          {grants.data?.map((grant) => (
            <GrantRow
              key={grant.principal.toText()}
              grant={grant}
              adminCount={Number(adminCount.data ?? 0n)}
            />
          ))}
        </ul>
      )}
    </AdminSection>
  );
}
