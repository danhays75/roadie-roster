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
import { useI18n } from "@/hooks/useI18n";
import { useMoveAbsentRoadieToOtherShift } from "@/hooks/useQueries";
import { Loader2 } from "lucide-react";

/**
 * Move an absent roadie to the same day's other shift. The alert clears once
 * the move succeeds; the backend records the move and the change log.
 */
export function MoveAlertDialog({
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
  const move = useMoveAbsentRoadieToOtherShift();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-ocid="alerts.move.dialog" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("today.alerts.moveTitle")}</DialogTitle>
          <DialogDescription>{t("today.alerts.moveBody")}</DialogDescription>
        </DialogHeader>

        <p
          data-ocid="alerts.move.confirm_text"
          className="text-sm font-medium text-foreground"
        >
          {t("today.alerts.moveConfirm", { name })}
        </p>

        {move.isError && (
          <p
            role="alert"
            data-ocid="alerts.move.error_state"
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
            data-ocid="alerts.move.cancel_button"
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            className="touch-target"
            data-ocid="alerts.move.confirm_button"
            disabled={move.isPending}
            onClick={() =>
              move.mutate(alertId, { onSuccess: () => onOpenChange(false) })
            }
          >
            {move.isPending && (
              <Loader2
                className="mr-2 h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            )}
            {t("today.alerts.move")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
