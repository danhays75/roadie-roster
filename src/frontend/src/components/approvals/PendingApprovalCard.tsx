import { Role } from "@/backend";
import type { PendingUser } from "@/backend";
import { ApprovalConfirmDialog } from "@/components/approvals/ApprovalConfirmDialog";
import {
  ApprovalRoleSelect,
  needsConfirmation,
} from "@/components/approvals/ApprovalRoleSelect";
import { TrainerStationsPicker } from "@/components/approvals/TrainerStationsPicker";
import { Button } from "@/components/ui/button";
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
import { useApproveUser, usePositions, useRoadies } from "@/hooks/useQueries";
import { dateToTimestamp, formatTimestamp, shortPrincipal } from "@/lib/format";
import { UserCheck } from "lucide-react";
import { useState } from "react";

/**
 * One pending sign-in with the full approval form: role, trainer stations,
 * optional access end date, and an optional link to an existing roadie card.
 */
export function PendingApprovalCard({ user }: { user: PendingUser }) {
  const { t } = useI18n();
  const { data: positions } = usePositions();
  const { data: roadies } = useRoadies();
  const approve = useApproveUser();

  const [role, setRole] = useState<Role | "">("");
  const [stationIds, setStationIds] = useState<string[]>([]);
  const [accessEnd, setAccessEnd] = useState("");
  const [linkedRoadieId, setLinkedRoadieId] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const principalText = user.principal.toText();
  const needsStations = role === Role.trainer;

  const submit = () => {
    if (role === "") {
      setError(t("approvals.role.required"));
      return;
    }
    setError(null);
    approve.mutate(
      {
        principal: user.principal,
        role,
        trainerPositionIds: needsStations
          ? stationIds.map((id) => BigInt(id))
          : [],
        accessEndsAt: accessEnd
          ? dateToTimestamp(new Date(accessEnd))
          : undefined,
        linkedRoadieId: linkedRoadieId ? BigInt(linkedRoadieId) : undefined,
      },
      {
        onSuccess: () => {
          setConfirmOpen(false);
          setRole("");
          setStationIds([]);
          setAccessEnd("");
          setLinkedRoadieId("");
        },
        onError: () => setError(t("approvals.error.generic")),
      },
    );
  };

  const handleApproveClick = () => {
    if (role === "") {
      setError(t("approvals.role.required"));
      return;
    }
    setError(null);
    if (needsConfirmation(role)) {
      setConfirmOpen(true);
    } else {
      submit();
    }
  };

  return (
    <li
      data-ocid="approvals.item"
      className="rounded-lg border border-border bg-card p-4 shadow-subtle"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold uppercase tracking-wide">
            {shortPrincipal(user.principal)}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("approvals.requestedAt")}: {formatTimestamp(user.requestedAt)}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <ApprovalRoleSelect
          id={`role-${principalText}`}
          value={role}
          onChange={setRole}
        />

        <div className="space-y-1.5">
          <Label htmlFor={`link-${principalText}`}>
            {t("approvals.link.label")}
          </Label>
          <Select value={linkedRoadieId} onValueChange={setLinkedRoadieId}>
            <SelectTrigger
              id={`link-${principalText}`}
              data-ocid="approvals.link.select"
              className="touch-target w-full"
            >
              <SelectValue placeholder={t("approvals.link.none")} />
            </SelectTrigger>
            <SelectContent>
              {(roadies ?? []).map((roadie) => (
                <SelectItem
                  key={roadie.id.toString()}
                  value={roadie.id.toString()}
                >
                  {roadie.profile.preferredName || roadie.profile.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {t("approvals.link.hint")}
          </p>
        </div>

        {needsStations && (
          <TrainerStationsPicker
            positions={positions ?? []}
            selectedIds={stationIds}
            onChange={setStationIds}
          />
        )}

        <div className="space-y-1.5">
          <Label htmlFor={`end-${principalText}`}>
            {t("approvals.accessEnd.label")}
          </Label>
          <Input
            id={`end-${principalText}`}
            type="date"
            value={accessEnd}
            onChange={(event) => setAccessEnd(event.target.value)}
            data-ocid="approvals.access_end.input"
            className="touch-target"
          />
          <p className="text-xs text-muted-foreground">
            {t("approvals.accessEnd.hint")}
          </p>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          data-ocid="approvals.error_state"
          className="mt-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <div className="mt-4 flex justify-end">
        <Button
          type="button"
          className="touch-target"
          data-ocid="approvals.approve_button"
          disabled={approve.isPending}
          onClick={handleApproveClick}
        >
          <UserCheck className="mr-2 h-4 w-4" aria-hidden="true" />
          {t("approvals.action.approve")}
        </Button>
      </div>

      <ApprovalConfirmDialog
        open={confirmOpen}
        role={role}
        pending={approve.isPending}
        onOpenChange={setConfirmOpen}
        onConfirm={submit}
      />
    </li>
  );
}
