import { House, type Position } from "@/backend";
import { DemoSettingsNote } from "@/components/DemoBanner";
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
import { useDemo } from "@/hooks/useDemo";
import { useI18n } from "@/hooks/useI18n";
import {
  useCreatePosition,
  useDeletePosition,
  usePositions,
  useUpdatePosition,
} from "@/hooks/useQueries";
import { Loader2, Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/* ---------------------------------------------------------------------------
   Per-position uniform defaults. The labels live in the admin copy dictionary
   (copy.ts) and are read through useAdminCopy().
--------------------------------------------------------------------------- */

interface PositionDraft {
  id: bigint;
  /**
   * True only for a draft created by the Add button. Create-vs-update is
   * decided by this flag, never by the id: the seeded Servers position has
   * id 0, so an id-based sentinel would turn every edit of it into a create.
   */
  isNew: boolean;
  name: string;
  house: House;
  code: string;
  needsAlcoholCert: boolean;
  minimumAge: string;
  defaultShirts: string;
  defaultHats: string;
  shirtType: string;
  shirtQty: string;
  hatType: string;
  hatQty: string;
}

function emptyDraft(): PositionDraft {
  return {
    id: 0n,
    isNew: true,
    name: "",
    house: House.foh,
    code: "",
    needsAlcoholCert: false,
    minimumAge: "16",
    defaultShirts: "0",
    defaultHats: "0",
    shirtType: "",
    shirtQty: "0",
    hatType: "",
    hatQty: "0",
  };
}

function toDraft(position: Position): PositionDraft {
  return {
    id: position.id,
    isNew: false,
    name: position.name,
    house: position.house,
    code: position.code,
    needsAlcoholCert: position.needsAlcoholCert,
    minimumAge: position.minimumAge.toString(),
    defaultShirts: position.defaultShirts.toString(),
    defaultHats: position.defaultHats.toString(),
    shirtType: position.shirtType,
    shirtQty: position.shirtQty.toString(),
    hatType: position.hatType,
    hatQty: position.hatQty.toString(),
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
    defaultShirts: toCount(draft.defaultShirts),
    defaultHats: toCount(draft.defaultHats),
    shirtType: draft.shirtType.trim(),
    shirtQty: toCount(draft.shirtQty),
    hatType: draft.hatType.trim(),
    hatQty: toCount(draft.hatQty),
  };
}

const BUILD_TO_MAX = 999;

/** The heading for the single per-position uniform group. */
const UNIFORM_GROUP_LABEL = "Uniform";

/**
 * A build-to target shown as an editable number input flanked by +1/−1
 * steppers. The steppers save a single-unit delta; typing an absolute value
 * saves the difference from the current target on blur or Enter. Invalid
 * entries (non-integer, negative, or above 999) revert to the saved value.
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
  const [text, setText] = useState(String(value));
  const focused = useRef(false);

  // Keep the field in step with the saved value while the user is not editing.
  useEffect(() => {
    if (!focused.current) setText(String(value));
  }, [value]);

  const commit = () => {
    const parsed = Number(text);
    const valid =
      text.trim() !== "" &&
      Number.isInteger(parsed) &&
      parsed >= 0 &&
      parsed <= BUILD_TO_MAX;
    if (!valid) {
      setText(String(value));
      return;
    }
    if (parsed === value) return;
    onDelta(BigInt(parsed - value));
  };

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
        <Input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          aria-label={label}
          data-ocid={`${ocid}.input`}
          className="h-9 w-14 touch-target px-1 text-center font-display text-base font-bold tabular-nums"
          value={text}
          disabled={disabled}
          onFocus={() => {
            focused.current = true;
          }}
          onChange={(event) => setText(event.target.value)}
          onBlur={() => {
            focused.current = false;
            commit();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            }
          }}
        />
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
  readOnly,
  onEdit,
  onDelete,
}: {
  position: Position;
  readOnly: boolean;
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
        <p
          className="mt-1 text-xs text-muted-foreground"
          data-ocid="admin.positions.uniform_summary"
        >
          {fill(c.positionsUniformSummary, {
            shirtQty: position.shirtQty.toString(),
            shirtType: position.shirtType || c.positionsShirtType,
            hatQty: position.hatQty.toString(),
            hatType: position.hatType || c.positionsHatType,
          })}
        </p>
        {!readOnly && (
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
        )}
      </div>
      {!readOnly && (
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
      )}
    </li>
  );
}

export function PositionsPanel() {
  const c = useAdminCopy();
  const demo = useDemo();
  const positions = usePositions();
  const create = useCreatePosition();
  const update = useUpdatePosition();
  const remove = useDeletePosition();
  const [draft, setDraft] = useState<PositionDraft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Position | null>(null);

  // While demo mode is on the position edit controls are hidden: they change
  // real settings, which demo mode must not touch. The list stays readable.
  const readOnly = demo.enabled;

  // Create-vs-update is decided by the draft's own isNew flag, set only by the
  // Add button. The seeded Servers position has id 0, so an id-based sentinel
  // would turn every edit of it into a duplicate create.
  const isEditing = draft !== null && !draft.isNew;
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
    // the live targets and a new position starts at zero. A new draft carries
    // id 0n, which can collide with the seeded Servers position, so the lookup
    // is skipped entirely for a new draft.
    const live = draft.isNew
      ? undefined
      : positions.data?.find((position) => position.id === draft.id);
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
        readOnly ? undefined : (
          <Button
            type="button"
            className="touch-target"
            data-ocid="admin.positions.add_button"
            onClick={() => setDraft(emptyDraft())}
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            {c.positionsAdd}
          </Button>
        )
      }
    >
      {readOnly && <DemoSettingsNote />}
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
              readOnly={readOnly}
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
                <fieldset
                  className="sm:col-span-2 rounded-md border border-border bg-muted/30 p-3"
                  data-ocid="admin.positions.uniform.panel"
                >
                  <legend className="px-1 font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {UNIFORM_GROUP_LABEL}
                  </legend>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      label={c.positionsShirtType}
                      htmlFor="pos-shirt-type"
                    >
                      <Input
                        id="pos-shirt-type"
                        data-ocid="admin.positions.shirt_type.input"
                        className="touch-target"
                        placeholder={c.positionsShirtTypePlaceholder}
                        value={draft.shirtType}
                        onChange={(event) =>
                          set("shirtType", event.target.value)
                        }
                      />
                    </FormField>
                    <FormField
                      label={c.positionsShirtQty}
                      htmlFor="pos-shirt-qty"
                    >
                      <Input
                        id="pos-shirt-qty"
                        type="number"
                        min={0}
                        step={1}
                        data-ocid="admin.positions.shirt_qty.input"
                        className="touch-target"
                        value={draft.shirtQty}
                        onChange={(event) =>
                          set("shirtQty", event.target.value)
                        }
                      />
                    </FormField>
                    <FormField
                      label={c.positionsHatType}
                      htmlFor="pos-hat-type"
                    >
                      <Input
                        id="pos-hat-type"
                        data-ocid="admin.positions.hat_type.input"
                        className="touch-target"
                        placeholder={c.positionsHatTypePlaceholder}
                        value={draft.hatType}
                        onChange={(event) => set("hatType", event.target.value)}
                      />
                    </FormField>
                    <FormField label={c.positionsHatQty} htmlFor="pos-hat-qty">
                      <Input
                        id="pos-hat-qty"
                        type="number"
                        min={0}
                        step={1}
                        data-ocid="admin.positions.hat_qty.input"
                        className="touch-target"
                        value={draft.hatQty}
                        onChange={(event) => set("hatQty", event.target.value)}
                      />
                    </FormField>
                  </div>
                </fieldset>
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
