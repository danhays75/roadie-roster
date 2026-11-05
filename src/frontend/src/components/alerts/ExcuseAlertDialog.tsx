import type { AlertId } from "@/backend";
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
import { useI18n } from "@/hooks/useI18n";
import { useExcuseAbsentAlert } from "@/hooks/useQueries";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Excuse an absent alert with a short required reason. The alert stays visible
 * with the reason attached; the backend records the excuse and the change log.
 */
export function ExcuseAlertDialog({
  alertId,
  name,
  open,
  onOpenChange,
}: {
  alertId: AlertId;
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const excuse = useExcuseAbsentAlert();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Reset the draft whenever the dialog opens so a previous reason never leaks
  // into the next alert.
  useEffect(() => {
    if (open) {
      setReason("");
      setError(null);
    }
  }, [open]);

  const submit = () => {
    const trimmed = reason.trim();
    if (trimmed === "") {
      setError(t("today.alerts.excuseRequired"));
      return;
    }
    setError(null);
    excuse.mutate(
      { id: alertId, reason: trimmed },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-ocid="alerts.excuse.dialog" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("today.alerts.excuseTitle", { name })}</DialogTitle>
          <DialogDescription>{t("today.alerts.excuseBody")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="alert-excuse-reason">
            {t("today.alerts.excuseLabel")}
          </Label>
          <Textarea
            id="alert-excuse-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t("today.alerts.excusePlaceholder")}
            data-ocid="alerts.excuse.reason_input"
          />
        </div>

        {error && (
          <p
            role="alert"
            data-ocid="alerts.excuse.validation_error"
            className="text-sm text-destructive"
          >
            {error}
          </p>
        )}

        {excuse.isError && (
          <p
            role="alert"
            data-ocid="alerts.excuse.error_state"
            className="text-sm text-destructive"
          >
            {t("today.alerts.error")}
          </p>
        )}

        <DialogFooter className="items-center gap-3">
          <Button
            type="button"
            variant="outline"
            className="touch-target"
            data-ocid="alerts.excuse.cancel_button"
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            className="touch-target"
            data-ocid="alerts.excuse.confirm_button"
            disabled={excuse.isPending}
            onClick={submit}
          >
            {excuse.isPending && (
              <Loader2
                className="mr-2 h-4 w-4 motion-safe:animate-spin"
                aria-hidden="true"
              />
            )}
            {t("today.alerts.excuseConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
