import {
  type RoadieId,
  type UniformCheckoffItem,
  UniformItemType,
} from "@/backend";
import { fill, useOrientationCopy } from "@/components/orientation/copy";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useSaveUniformCheckoff, useUniformCheckoff } from "@/hooks/useQueries";
import { cn } from "@/lib/utils";
import { Check, Loader2, Lock, Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";

/** A local editable copy of one uniform item. */
interface ItemDraft {
  itemId: bigint;
  text: string;
  itemType: UniformItemType;
  checked: boolean;
  count: number;
}

function toDraft(items: UniformCheckoffItem[]): ItemDraft[] {
  return items.map((item) => ({
    itemId: item.itemId,
    text: item.text,
    itemType: item.itemType,
    checked: item.checked,
    count: Number(item.count),
  }));
}

/** Whether a draft item is satisfied: a checked box, or a positive count. */
function isSatisfied(item: ItemDraft): boolean {
  return item.itemType === UniformItemType.checkbox
    ? item.checked
    : item.count > 0;
}

/**
 * The uniform check-off for one roadie. The items come from the orientation
 * uniform checklist with their checkbox or count type; shirt and hat counts are
 * pre-filled from the position defaults. Until the roadie's paperwork is 100%
 * complete the whole check-off is locked read-only with a "Paperwork
 * incomplete" note. Saving writes the check-off for this roadie and shows
 * "Uniform complete" or the missing items.
 */
export function UniformCheckoffDialog({
  roadieId,
  roadieName,
  open,
  onOpenChange,
}: {
  roadieId: RoadieId | undefined;
  roadieName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const c = useOrientationCopy();
  const { data, isLoading, isError } = useUniformCheckoff(roadieId, open);
  const save = useSaveUniformCheckoff();
  const [draft, setDraft] = useState<ItemDraft[]>([]);
  const [saved, setSaved] = useState(false);

  // Seed the editable draft from the loaded check-off once per open. The draft
  // is local UI state, so a refetch never overwrites the manager's edits.
  useEffect(() => {
    if (open && data) setDraft(toDraft(data.items));
  }, [open, data]);

  useEffect(() => {
    if (!open) setSaved(false);
  }, [open]);

  const locked = data?.locked ?? false;
  const missing = draft.filter((item) => !isSatisfied(item)).map((i) => i.text);
  const complete = draft.length > 0 && missing.length === 0;

  const setItem = (itemId: bigint, patch: Partial<ItemDraft>) => {
    setSaved(false);
    setDraft((current) =>
      current.map((item) =>
        item.itemId === itemId ? { ...item, ...patch } : item,
      ),
    );
  };

  const onSubmit = () => {
    if (roadieId === undefined) return;
    // Save only the uniform fields. The backend keeps the roadie's paperwork
    // items, so a uniform save never erases paperwork.
    save.mutate(
      {
        roadieId,
        uniformItems: draft
          .filter((item) => item.checked)
          .map((item) => item.itemId.toString()),
        uniformCounts: draft
          .filter((item) => item.itemType === UniformItemType.count)
          .map((item) => [item.itemId, BigInt(item.count)] as [bigint, bigint]),
      },
      { onSuccess: () => setSaved(true) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-ocid="orientation.uniform.dialog"
        className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle>{c.uniformTitle}</DialogTitle>
          <DialogDescription>
            {roadieName} · {c.uniformBody}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <p
            data-ocid="orientation.uniform.loading_state"
            className="text-sm text-muted-foreground"
          >
            {c.uniformLoading}
          </p>
        )}

        {isError && (
          <p
            role="alert"
            data-ocid="orientation.uniform.error_state"
            className="text-sm text-destructive"
          >
            {c.errorGeneric}
          </p>
        )}

        {!isLoading && !isError && locked && (
          <p
            data-ocid="orientation.uniform.locked_note"
            className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-foreground"
          >
            <Lock
              className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
              aria-hidden="true"
            />
            {c.uniformLocked}
          </p>
        )}

        {!isLoading && !isError && draft.length === 0 && (
          <p
            data-ocid="orientation.uniform.empty_state"
            className="text-sm text-muted-foreground"
          >
            {c.uniformEmpty}
          </p>
        )}

        {!isLoading && !isError && draft.length > 0 && (
          <ul className="space-y-2" data-ocid="orientation.uniform.list">
            {draft.map((item, index) => (
              <li
                key={item.itemId.toString()}
                data-ocid={`orientation.uniform.item.${index + 1}`}
                className="flex min-h-[44px] items-center justify-between gap-3 rounded-md border border-border bg-background p-3"
              >
                {item.itemType === UniformItemType.checkbox ? (
                  <div className="flex min-h-[44px] flex-1 items-center gap-3">
                    <Checkbox
                      checked={item.checked}
                      disabled={locked}
                      aria-label={fill(c.uniformCheckboxLabel, {
                        label: item.text,
                      })}
                      data-ocid={`orientation.uniform.checkbox.${index + 1}`}
                      onCheckedChange={(checked) =>
                        setItem(item.itemId, { checked: checked === true })
                      }
                    />
                    <span className="text-sm text-foreground">{item.text}</span>
                  </div>
                ) : (
                  <>
                    <Label
                      htmlFor={`uniform-count-${item.itemId.toString()}`}
                      className="flex-1 text-sm text-foreground"
                    >
                      {item.text}
                    </Label>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="touch-target"
                        aria-label={fill(c.uniformCountDecrease, {
                          label: item.text,
                        })}
                        data-ocid={`orientation.uniform.decrease_button.${index + 1}`}
                        disabled={locked || item.count <= 0}
                        onClick={() =>
                          setItem(item.itemId, {
                            count: Math.max(0, item.count - 1),
                          })
                        }
                      >
                        <Minus className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <input
                        id={`uniform-count-${item.itemId.toString()}`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={999}
                        value={item.count}
                        disabled={locked}
                        data-ocid={`orientation.uniform.count_input.${index + 1}`}
                        onChange={(event) => {
                          const next = Number.parseInt(event.target.value, 10);
                          setItem(item.itemId, {
                            count: Number.isNaN(next)
                              ? 0
                              : Math.min(999, Math.max(0, next)),
                          });
                        }}
                        className="h-11 w-16 rounded-md border border-input bg-background text-center text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="touch-target"
                        aria-label={fill(c.uniformCountIncrease, {
                          label: item.text,
                        })}
                        data-ocid={`orientation.uniform.increase_button.${index + 1}`}
                        disabled={locked || item.count >= 999}
                        onClick={() =>
                          setItem(item.itemId, {
                            count: Math.min(999, item.count + 1),
                          })
                        }
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        {!isLoading && !isError && draft.length > 0 && (
          <p
            data-ocid="orientation.uniform.status"
            className={cn(
              "flex items-center gap-2 text-sm font-medium",
              complete ? "text-accent" : "text-muted-foreground",
            )}
          >
            {complete ? (
              <>
                <Check className="h-4 w-4" aria-hidden="true" />
                {c.uniformComplete}
              </>
            ) : (
              fill(c.uniformMissing, { items: missing.join(", ") })
            )}
          </p>
        )}

        <DialogFooter className="items-center gap-3">
          {save.isError && (
            <span
              role="alert"
              data-ocid="orientation.uniform.save_error_state"
              className="text-sm text-destructive"
            >
              {c.uniformError}
            </span>
          )}
          {saved && (
            <output
              data-ocid="orientation.uniform.success_state"
              className="text-sm text-accent"
            >
              {c.uniformSaved}
            </output>
          )}
          <Button
            type="button"
            variant="outline"
            className="touch-target"
            data-ocid="orientation.uniform.close_button"
            onClick={() => onOpenChange(false)}
          >
            {c.close}
          </Button>
          <Button
            type="button"
            className="touch-target"
            data-ocid="orientation.uniform.save_button"
            disabled={locked || save.isPending || draft.length === 0}
            onClick={onSubmit}
          >
            {save.isPending && (
              <Loader2
                className="mr-2 h-4 w-4 motion-safe:animate-spin"
                aria-hidden="true"
              />
            )}
            {save.isPending ? c.uniformSaving : c.uniformSave}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
