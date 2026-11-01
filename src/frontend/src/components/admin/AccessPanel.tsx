import { type AccessGrant, Role, createActor } from "@/backend";
import { AdminSection } from "@/components/admin/FormField";
import { useAdminCopy } from "@/components/admin/useAdminCopy";
import { TrainerStationsPicker } from "@/components/approvals/TrainerStationsPicker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  usePositions,
  useRemoveUser,
  useStoreInfo,
  useUpdateAccessEnd,
  useUpdateTrainerStations,
  useUpdateUserRole,
} from "@/hooks/useQueries";
import {
  dateToDateOnly,
  formatTimestamp,
  roleLabel,
  shortPrincipal,
  timestampToDate,
} from "@/lib/format";
import { useActor } from "@caffeineai/core-infrastructure";
import { Loader2 } from "lucide-react";
import { useState } from "react";

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

/** Roles that require an explicit confirmation before they are granted. */
const CONFIRM_ROLES: Role[] = [Role.admin, Role.storeManager];

/** A `YYYY-MM-DD` value for a date input, read in the store's time zone. */
function timestampToDateInput(
  timestamp: bigint,
  timeZone: string | undefined,
): string {
  const date = timestampToDate(timestamp);
  if (!date) return "";
  // en-CA renders as YYYY-MM-DD, which is what a date input expects.
  return date.toLocaleDateString("en-CA", { timeZone });
}

function sameIds(a: string[], b: bigint[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(b.map((id) => id.toString()));
  return a.every((id) => set.has(id));
}

function GrantRow({
  grant,
  adminCount,
  timeZone,
}: {
  grant: AccessGrant;
  adminCount: number;
  timeZone: string | undefined;
}) {
  const { t } = useI18n();
  const c = useAdminCopy();
  const { actor } = useActor(createActor);
  const { data: positions } = usePositions();
  const updateRole = useUpdateUserRole();
  const updateStations = useUpdateTrainerStations();
  const updateAccessEnd = useUpdateAccessEnd();
  const removeUser = useRemoveUser();

  const isLastAdmin = grant.role === Role.admin && adminCount <= 1;

  const [draftRole, setDraftRole] = useState<Role>(grant.role);
  const [stationIds, setStationIds] = useState<string[]>(
    grant.trainerPositionIds.map((id) => id.toString()),
  );
  const [accessEnd, setAccessEnd] = useState(
    grant.accessEndsAt !== undefined
      ? timestampToDateInput(grant.accessEndsAt, timeZone)
      : "",
  );
  const [confirm, setConfirm] = useState<"role" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const roleChanged = draftRole !== grant.role;
  const stationsChanged =
    draftRole === Role.trainer &&
    !sameIds(stationIds, grant.trainerPositionIds);
  const demotingLastAdmin = isLastAdmin && draftRole !== Role.admin;

  const applyRole = () => {
    if (demotingLastAdmin) {
      setError(t("admin.access.lastAdmin"));
      return;
    }
    setError(null);
    updateRole.mutate(
      { principal: grant.principal, role: draftRole },
      {
        onSuccess: () => {
          if (draftRole === Role.trainer) {
            updateStations.mutate({
              principal: grant.principal,
              positionIds: stationIds.map((id) => BigInt(id)),
            });
          }
        },
        onError: () => setError(t("common.error")),
      },
    );
  };

  const handleRoleSave = () => {
    if (demotingLastAdmin) {
      setError(t("admin.access.lastAdmin"));
      return;
    }
    if (CONFIRM_ROLES.includes(draftRole)) {
      setConfirm("role");
    } else {
      applyRole();
    }
  };

  const saveStations = () => {
    setError(null);
    updateStations.mutate(
      {
        principal: grant.principal,
        positionIds: stationIds.map((id) => BigInt(id)),
      },
      { onError: () => setError(t("common.error")) },
    );
  };

  const saveAccessEnd = async () => {
    if (!actor) return;
    setError(null);
    try {
      const accessEndsAt = accessEnd
        ? await actor.accessEndForDay(
            dateToDateOnly(new Date(`${accessEnd}T00:00:00Z`)),
          )
        : null;
      updateAccessEnd.mutate(
        { principal: grant.principal, accessEndsAt },
        { onError: () => setError(t("common.error")) },
      );
    } catch {
      setError(t("common.error"));
    }
  };

  const confirmRemove = () => {
    removeUser.mutate(grant.principal, {
      onSuccess: () => setConfirm(null),
      onError: () => {
        setConfirm(null);
        setError(t("common.error"));
      },
    });
  };

  const busy =
    updateRole.isPending ||
    updateStations.isPending ||
    updateAccessEnd.isPending ||
    removeUser.isPending;

  return (
    <li
      data-ocid="admin.access.item"
      className="flex flex-col gap-4 rounded-md border border-border bg-background p-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold uppercase tracking-wide">
            {shortPrincipal(grant.principal)}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("admin.access.approvedAt")}: {formatTimestamp(grant.approvedAt)}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("admin.access.accessEnd")}:{" "}
            {grant.accessEndsAt !== undefined
              ? formatTimestamp(grant.accessEndsAt, timeZone)
              : t("common.none")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={draftRole}
            onValueChange={(value) => {
              setError(null);
              setDraftRole(value as Role);
            }}
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
            className="touch-target"
            data-ocid="admin.access.change_role_button"
            disabled={busy || (!roleChanged && !stationsChanged)}
            onClick={handleRoleSave}
          >
            {t("admin.access.action.changeRole")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="touch-target text-destructive"
            data-ocid="admin.access.remove_button"
            disabled={isLastAdmin || busy}
            title={isLastAdmin ? t("admin.access.lastAdmin") : undefined}
            onClick={() => setConfirm("remove")}
          >
            {t("admin.access.action.remove")}
          </Button>
        </div>
      </div>

      {draftRole === Role.trainer && (
        <div className="rounded-md border border-border bg-muted/30 p-3">
          <TrainerStationsPicker
            positions={positions ?? []}
            selectedIds={stationIds}
            onChange={setStationIds}
          />
          <div className="mt-2 flex justify-end">
            <Button
              type="button"
              variant="outline"
              className="touch-target"
              data-ocid="admin.access.save_stations_button"
              disabled={busy || !stationsChanged}
              onClick={saveStations}
            >
              {t("admin.access.stations")}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor={`access-end-${grant.principal.toText()}`}>
            {t("admin.access.accessEnd")}
          </Label>
          <Input
            id={`access-end-${grant.principal.toText()}`}
            type="date"
            value={accessEnd}
            onChange={(event) => setAccessEnd(event.target.value)}
            data-ocid="admin.access.access_end.input"
            className="touch-target"
          />
          <p className="text-xs text-muted-foreground">
            {t("approvals.accessEnd.hint")}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="touch-target"
          data-ocid="admin.access.save_access_end_button"
          disabled={busy}
          onClick={() => void saveAccessEnd()}
        >
          {updateAccessEnd.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          )}
          {c.actionSave}
        </Button>
      </div>

      {error && (
        <p
          role="alert"
          data-ocid="admin.access.error_state"
          className="text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <Dialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        <DialogContent data-ocid="admin.access.confirm.dialog">
          <DialogHeader>
            <DialogTitle>
              {confirm === "remove"
                ? t("admin.access.action.remove")
                : t("approvals.confirm.title")}
            </DialogTitle>
            <DialogDescription>
              {confirm === "remove"
                ? roleLabel(grant.role)
                : t("approvals.confirm.body", { role: roleLabel(draftRole) })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="touch-target"
              data-ocid="admin.access.confirm_cancel_button"
              onClick={() => setConfirm(null)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant={confirm === "remove" ? "destructive" : "default"}
              className="touch-target"
              data-ocid="admin.access.confirm_button"
              disabled={busy}
              onClick={() => {
                if (confirm === "remove") {
                  confirmRemove();
                } else {
                  setConfirm(null);
                  applyRole();
                }
              }}
            >
              {confirm === "remove"
                ? t("admin.access.action.remove")
                : t("approvals.confirm.action")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}

export function AccessPanel() {
  const { t } = useI18n();
  const c = useAdminCopy();
  const grants = useAccessGrants();
  const adminCount = useAdminCount();
  const { data: storeInfo } = useStoreInfo();

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
              timeZone={storeInfo?.timeZone}
            />
          ))}
        </ul>
      )}
    </AdminSection>
  );
}
