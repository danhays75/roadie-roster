import { House, type Position } from "@/backend";
import { StatusBadge } from "@/components/StatusBadge";
import { AdminSection, FormField } from "@/components/admin/FormField";
import { fill } from "@/components/admin/copy";
import { useAdminCopy } from "@/components/admin/useAdminCopy";
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
import {
  useCreatePosition,
  useDeletePosition,
  usePositions,
  useUpdatePosition,
} from "@/hooks/useQueries";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

interface PositionDraft {
  id: bigint;
  name: string;
  house: House;
  code: string;
  openingBuildTo: string;
  afterOpeningBuildTo: string;
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
    openingBuildTo: "0",
    afterOpeningBuildTo: "0",
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
    openingBuildTo: position.openingBuildTo.toString(),
    afterOpeningBuildTo: position.afterOpeningBuildTo.toString(),
    needsAlcoholCert: position.needsAlcoholCert,
    minimumAge: position.minimumAge.toString(),
    shirtsRequired: position.shirtsRequired.toString(),
    hatsRequired: position.hatsRequired.toString(),
    crewManager: position.crewManager ?? "",
  };
}

function toPosition(draft: PositionDraft): Position {
  const num = (value: string) => BigInt(Math.max(0, Number(value) || 0));
  return {
    id: draft.id,
    name: draft.name.trim(),
    house: draft.house,
    code: draft.code.trim(),
    openingBuildTo: num(draft.openingBuildTo),
    afterOpeningBuildTo: num(draft.afterOpeningBuildTo),
    needsAlcoholCert: draft.needsAlcoholCert,
    minimumAge: num(draft.minimumAge),
    shirtsRequired: num(draft.shirtsRequired),
    hatsRequired: num(draft.hatsRequired),
    crewManager: draft.crewManager.trim()
      ? draft.crewManager.trim()
      : undefined,
  };
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
    const payload = toPosition(draft);
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
            <li
              key={position.id.toString()}
              data-ocid="admin.positions.item"
              className="flex flex-col gap-3 rounded-md border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-sm font-semibold uppercase tracking-wide">
                    {position.name}
                  </span>
                  <StatusBadge tone="muted">
                    {position.house === House.foh
                      ? c.positionsFoh
                      : c.positionsBoh}
                  </StatusBadge>
                  <StatusBadge tone="muted">{position.code}</StatusBadge>
                  {position.needsAlcoholCert && (
                    <StatusBadge tone="pending">
                      {c.positionsAlcohol}
                    </StatusBadge>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {fill(c.positionsBuildTo, {
                    opening: position.openingBuildTo.toString(),
                    after: position.afterOpeningBuildTo.toString(),
                    age: position.minimumAge.toString(),
                  })}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="touch-target"
                  data-ocid="admin.positions.edit_button"
                  onClick={() => setDraft(toDraft(position))}
                >
                  <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                  {c.actionEdit}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="touch-target text-destructive"
                  data-ocid="admin.positions.delete_button"
                  onClick={() => setDeleteTarget(position)}
                >
                  <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                  {c.actionDelete}
                </Button>
              </div>
            </li>
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
                    data-ocid="admin.positions.minimum_age.input"
                    className="touch-target"
                    value={draft.minimumAge}
                    onChange={(event) => set("minimumAge", event.target.value)}
                  />
                </FormField>
                <FormField
                  label={c.positionsOpeningBuildTo}
                  htmlFor="pos-opening"
                >
                  <Input
                    id="pos-opening"
                    type="number"
                    min={0}
                    data-ocid="admin.positions.opening_build_to.input"
                    className="touch-target"
                    value={draft.openingBuildTo}
                    onChange={(event) =>
                      set("openingBuildTo", event.target.value)
                    }
                  />
                </FormField>
                <FormField
                  label={c.positionsAfterOpeningBuildTo}
                  htmlFor="pos-after"
                >
                  <Input
                    id="pos-after"
                    type="number"
                    min={0}
                    data-ocid="admin.positions.after_opening_build_to.input"
                    className="touch-target"
                    value={draft.afterOpeningBuildTo}
                    onChange={(event) =>
                      set("afterOpeningBuildTo", event.target.value)
                    }
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
