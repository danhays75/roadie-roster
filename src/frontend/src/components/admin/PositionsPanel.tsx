import { House, type Position } from "@/backend";
import { StatusBadge } from "@/components/StatusBadge";
import { AdminSection, FormField } from "@/components/admin/FormField";
import { fill } from "@/components/admin/copy";
import { useAdminCopy } from "@/components/admin/useAdminCopy";
import { useAdjustBuildTo } from "@/components/dashboard/hooks";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/hooks/useI18n";
import {
  useCreatePosition,
  useDeletePosition,
  usePositions,
  useUpdatePosition,
} from "@/hooks/useQueries";
import { Loader2, Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

interface PositionDraft {
  id: bigint;
  name: string;
  house: House;
  code: string;
  needsAlcoholCert: boolean;
  minimumAge: string;
  shirtsRequired: string;
  hatsRequired: string;
  crewManager: string;
}

function emptyDraft(): PositionDraft {
  return {
    id: 0n,
    name: "",
    house: House.foh,
    code: "",
    needsAlcoholCert: false,
    minimumAge: "16",
    shirtsRequired: "0",
    hatsRequired: "0",
    crewManager: "",
  };
}

function toDraft(position: Position): PositionDraft {
  return {
    id: position.id,
    name: position.name,
    house: position.house,
    code: position.code,
    needsAlcoholCert: position.needsAlcoholCert,
    minimumAge: position.minimumAge.toString(),
    shirtsRequired: position.shirtsRequired.toString(),
    hatsRequired: position.hatsRequired.toString(),
    crewManager: position.crewManager ?? "",
  };
}

/** Floor a numeric draft field to a non-negative whole number. */
function toCount(value: string): bigint {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0n;
  return BigInt(Math.max(0, Math.floor(parsed)));
}

function toPosition(
  draft: PositionDraft,
  openingBuildTo: bigint,
  afterOpeningBuildTo: bigint,
): Position {
  return {
    id: draft.id,
    name: draft.name.trim(),
    house: draft.house,
    code: draft.code.trim(),
    openingBuildTo,
    afterOpeningBuildTo,
    needsAlcoholCert: draft.needsAlcoholCert,
    minimumAge: toCount(draft.minimumAge),
    shirtsRequired: toCount(draft.shirtsRequired),
    hatsRequired: toCount(draft.hatsRequired),
    crewManager: draft.crewManager.trim()
      ? draft.crewManager.trim()
      : undefined,
  };
}

/**
 * A build-to target shown as +1/−1 steppers only. Each tap saves a single
 * increment through `adjustBuildTo`, so the target is never typed as an
 * absolute value and every change is logged.
 */
function BuildToStepper({
  label,
  value,
  disabled,
  onDelta,
  ocid,
}: {
  label: string;
  value: number;
  disabled: boolean;
  onDelta: (delta: bigint) => void;
  ocid: string;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t("dashboard.adjust.decrease", { label })}
          data-ocid={`${ocid}.minus_button`}
          className="touch-target"
          disabled={disabled || value <= 0}
          onClick={() => onDelta(-1n)}
        >
          <Minus className="h-4 w-4" aria-hidden="true" />
        </Button>
        <span className="w-8 text-center font-display text-base font-bold tabular-nums">
          {value}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t("dashboard.adjust.increase", { label })}
          data-ocid={`${ocid}.plus_button`}
          className="touch-target"
          disabled={disabled}
          onClick={() => onDelta(1n)}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

function PositionRow({
  position,
  onEdit,
  onDelete,
}: {
  position: Position;
  onEdit: (position: Position) => void;
  onDelete: (position: Position) => void;
}) {
  const c = useAdminCopy();
  const adjust = useAdjustBuildTo();
  const [error, setError] = useState<string | null>(null);

  const applyDelta = (field: "opening" | "afterOpening", delta: bigint) => {
    setError(null);
    adjust.mutate(
      {
        positionId: position.id,
        openingDelta: field === "opening" ? delta : 0n,
        afterOpeningDelta: field === "afterOpening" ? delta : 0n,
      },
      {
        onError: (err) =>
          setError(err instanceof Error ? err.message : c.positionsSaveError),
      },
    );
  };

  return (
    <li
      data-ocid="admin.positions.item"
      className="flex flex-col gap-3 rounded-md border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-sm font-semibold uppercase tracking-wide">
            {position.name}
          </span>
          <StatusBadge tone="muted">
            {position.house === House.foh ? c.positionsFoh : c.positionsBoh}
          </StatusBadge>
          <StatusBadge tone="muted">{position.code}</StatusBadge>
          {position.needsAlcoholCert && (
            <StatusBadge tone="pending">{c.positionsAlcohol}</StatusBadge>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {fill(c.positionsBuildTo, {
            opening: position.openingBuildTo.toString(),
            after: position.afterOpeningBuildTo.toString(),
            age: position.minimumAge.toString(),
          })}
        </p>
        <div
          className="mt-2 max-w-xs space-y-1.5 rounded-md border border-border bg-muted/30 p-2"
          data-ocid="admin.positions.build_to.panel"
        >
          <BuildToStepper
            label={c.positionsOpeningBuildTo}
            value={Number(position.openingBuildTo)}
            disabled={adjust.isPending}
            onDelta={(delta) => applyDelta("opening", delta)}
            ocid="admin.positions.opening_build_to"
          />
          <BuildToStepper
            label={c.positionsAfterOpeningBuildTo}
            value={Number(position.afterOpeningBuildTo)}
            disabled={adjust.isPending}
            onDelta={(delta) => applyDelta("afterOpening", delta)}
            ocid="admin.positions.after_opening_build_to"
          />
          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="touch-target"
          data-ocid="admin.positions.edit_button"
          onClick={() => onEdit(position)}
        >
          <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
          {c.actionEdit}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="touch-target text-destructive"
          data-ocid="admin.positions.delete_button"
          onClick={() => onDelete(position)}
        >
          <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
          {c.actionDelete}
        </Button>
      </div>
    </li>
  );
}

export function PositionsPanel() {
  const c = useAdminCopy();
  const positions = usePositions();
  const create = useCreatePosition();
  const update = useUpdatePosition();
  const remove = useDeletePosition();
  const [draft, setDraft] = useState<PositionDraft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Position | null>(null);

  const isEditing = draft !== null && draft.id !== 0n;
  const mutation = isEditing ? update : create;

  const set = <K extends keyof PositionDraft>(
    key: K,
    value: PositionDraft[K],
  ) => {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft || !draft.name.trim()) return;
    // Build-to targets are owned by the +1/−1 steppers, so an edit preserves
    // the live targets and a new position starts at zero.
    const live = positions.data?.find((position) => position.id === draft.id);
    const payload = toPosition(
      draft,
      live?.openingBuildTo ?? 0n,
      live?.afterOpeningBuildTo ?? 0n,
    );
    mutation.mutate(payload, { onSuccess: () => setDraft(null) });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    remove.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
  };

  return (
    <AdminSection
      title={c.positionsTitle}
      description={c.positionsDescription}
      ocid="admin.positions.section"
      action={
        <Button
          type="button"
          className="touch-target"
          data-ocid="admin.positions.add_button"
          onClick={() => setDraft(emptyDraft())}
        >
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          {c.positionsAdd}
        </Button>
      }
    >
      {positions.isLoading && (
        <p className="text-sm text-muted-foreground">{c.positionsLoading}</p>
      )}
      {positions.isError && (
        <p className="text-sm text-destructive">{c.positionsError}</p>
      )}
      {!positions.isLoading &&
        !positions.isError &&
        (positions.data?.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground">{c.positionsEmpty}</p>
        )}

      {(positions.data?.length ?? 0) > 0 && (
        <ul className="space-y-2" data-ocid="admin.positions.list">
          {positions.data?.map((position) => (
            <PositionRow
              key={position.id.toString()}
              position={position}
              onEdit={(target) => setDraft(toDraft(target))}
              onDelete={setDeleteTarget}
            />
          ))}
        </ul>
      )}

      <Dialog
        open={draft !== null}
        onOpenChange={(open) => {
          if (!open) setDraft(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? c.positionsEditTitle : c.positionsAddTitle}
            </DialogTitle>
            <DialogDescription>{c.positionsFormDescription}</DialogDescription>
          </DialogHeader>
          {draft && (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label={c.positionsName} htmlFor="pos-name">
                  <Input
                    id="pos-name"
                    data-ocid="admin.positions.name.input"
                    className="touch-target"
                    value={draft.name}
                    onChange={(event) => set("name", event.target.value)}
                  />
                </FormField>
                <FormField label={c.positionsCode} htmlFor="pos-code">
                  <Input
                    id="pos-code"
                    data-ocid="admin.positions.code.input"
                    className="touch-target"
                    value={draft.code}
                    onChange={(event) => set("code", event.target.value)}
                  />
                </FormField>
                <FormField label={c.positionsHouse} htmlFor="pos-house">
                  <Select
                    value={draft.house}
                    onValueChange={(value) => set("house", value as House)}
                  >
                    <SelectTrigger
                      id="pos-house"
                      data-ocid="admin.positions.house.select"
                      className="touch-target"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={House.foh}>
                        {c.positionsFoh}
                      </SelectItem>
                      <SelectItem value={House.boh}>
                        {c.positionsBoh}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label={c.positionsMinimumAge} htmlFor="pos-age">
                  <Input
                    id="pos-age"
                    type="number"
                    min={0}
                    step={1}
                    data-ocid="admin.positions.minimum_age.input"
                    className="touch-target"
                    value={draft.minimumAge}
                    onChange={(event) => set("minimumAge", event.target.value)}
                  />
                </FormField>
                <FormField
                  label={c.positionsShirtsRequired}
                  htmlFor="pos-shirts"
                >
                  <Input
                    id="pos-shirts"
                    type="number"
                    min={0}
                    step={1}
                    data-ocid="admin.positions.shirts_required.input"
                    className="touch-target"
                    value={draft.shirtsRequired}
                    onChange={(event) =>
                      set("shirtsRequired", event.target.value)
                    }
                  />
                </FormField>
                <FormField label={c.positionsHatsRequired} htmlFor="pos-hats">
                  <Input
                    id="pos-hats"
                    type="number"
                    min={0}
                    step={1}
                    data-ocid="admin.positions.hats_required.input"
                    className="touch-target"
                    value={draft.hatsRequired}
                    onChange={(event) =>
                      set("hatsRequired", event.target.value)
                    }
                  />
                </FormField>
                <FormField
                  label={c.positionsCrewManager}
                  htmlFor="pos-crew-manager"
                  hint={c.optional}
                  className="sm:col-span-2"
                >
                  <Input
                    id="pos-crew-manager"
                    data-ocid="admin.positions.crew_manager.input"
                    className="touch-target"
                    value={draft.crewManager}
                    onChange={(event) => set("crewManager", event.target.value)}
                  />
                </FormField>
              </div>

              <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                {c.positionsDescription}
              </p>

              <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
                <label
                  htmlFor="pos-alcohol"
                  className="text-sm font-medium text-foreground"
                >
                  {c.positionsNeedsAlcoholCert}
                </label>
                <Switch
                  id="pos-alcohol"
                  data-ocid="admin.positions.alcohol_cert.switch"
                  checked={draft.needsAlcoholCert}
                  onCheckedChange={(checked) =>
                    set("needsAlcoholCert", checked)
                  }
                />
              </div>

              {mutation.isError && (
                <p
                  className="text-sm font-medium text-destructive"
                  data-ocid="admin.positions.error_state"
                >
                  {c.positionsSaveError}
                </p>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  className="touch-target"
                  data-ocid="admin.positions.cancel_button"
                  onClick={() => setDraft(null)}
                >
                  {c.actionCancel}
                </Button>
                <Button
                  type="submit"
                  className="touch-target"
                  data-ocid="admin.positions.save_button"
                  disabled={mutation.isPending || !draft.name.trim()}
                >
                  {mutation.isPending && (
                    <Loader2
                      className="mr-2 h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  )}
                  {c.actionSave}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{c.positionsDeleteTitle}</DialogTitle>
            <DialogDescription>
              {fill(c.positionsDeleteBody, { name: deleteTarget?.name ?? "" })}
            </DialogDescription>
          </DialogHeader>
          {remove.isError && (
            <p
              className="text-sm font-medium text-destructive"
              data-ocid="admin.positions.delete_error_state"
            >
              {c.positionsDeleteBlocked}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="touch-target"
              data-ocid="admin.positions.delete_cancel_button"
              onClick={() => setDeleteTarget(null)}
            >
              {c.actionCancel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="touch-target"
              data-ocid="admin.positions.delete_confirm_button"
              disabled={remove.isPending}
              onClick={confirmDelete}
            >
              {remove.isPending && (
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              )}
              {c.actionDelete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminSection>
  );
}
