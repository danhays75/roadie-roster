import type { EventId, RoadieId } from "@/backend";
import { useOrientationCopy } from "@/components/orientation/copy";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMarkPresent } from "@/hooks/useQueries";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Override incomplete paperwork and mark a roadie Present. The reason is
 * required and the override is logged by the backend. Store Manager and Admin
 * only; the caller gates the trigger.
 */
export function OverridePresentDialog({
  roadieId,
  roadieName,
  eventId,
  open,
  onOpenChange,
}: {
  roadieId: RoadieId | undefined;
  roadieName: string;
  eventId: EventId | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const c = useOrientationCopy();
  const markPresent = useMarkPresent();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setReason("");
      setError(null);
    }
  }, [open]);

  const onSubmit = () => {
    if (roadieId === undefined || eventId === undefined) return;
    if (reason.trim() === "") {
      setError(c.overrideRequired);
      return;
    }
    setError(null);
    markPresent.mutate(
      { roadieId, eventId, overrideReason: reason.trim() },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-ocid="orientation.override.dialog"
        className="sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>{c.overrideTitle}</DialogTitle>
          <DialogDescription>
            {roadieName} · {c.overrideBody}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="override-reason">{c.overrideReason}</Label>
          <Textarea
            id="override-reason"
            value={reason}
            placeholder={c.overrideReasonPlaceholder}
            data-ocid="orientation.override.reason_input"
            onChange={(event) => setReason(event.target.value)}
          />
        </div>

        {error && (
          <p
            role="alert"
            data-ocid="orientation.override.validation_error"
            className="text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <DialogFooter className="items-center gap-3">
          {markPresent.isError && (
            <span
              role="alert"
              data-ocid="orientation.override.error_state"
              className="text-sm text-destructive"
            >
              {c.errorGeneric}
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            className="touch-target"
            data-ocid="orientation.override.cancel_button"
            onClick={() => onOpenChange(false)}
          >
            {c.cancel}
          </Button>
          <Button
            type="button"
            className="touch-target"
            data-ocid="orientation.override.confirm_button"
            disabled={markPresent.isPending}
            onClick={onSubmit}
          >
            {markPresent.isPending && (
              <Loader2
                className="mr-2 h-4 w-4 motion-safe:animate-spin"
                aria-hidden="true"
              />
            )}
            {c.overrideConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
