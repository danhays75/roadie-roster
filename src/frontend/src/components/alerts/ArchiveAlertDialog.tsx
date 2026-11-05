import type { AlertId } from "@/backend";
import {
  ARCHIVE_REASONS,
  type ArchiveReasonValue,
} from "@/components/roadie/constants";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/hooks/useI18n";
import { useArchiveAbsentAlert } from "@/hooks/useQueries";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Archive an absent roadie as a no-show. The dialog reuses the roster's archive
 * reason vocabulary so the same reasons are offered everywhere; the backend
 * records the archive and the change log.
 */
export function ArchiveAlertDialog({
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
  const archive = useArchiveAbsentAlert();
  const [reason, setReason] = useState<ArchiveReasonValue | "">("");
  const [other, setOther] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Reset the draft whenever the dialog opens so a previous reason never leaks
  // into the next alert.
  useEffect(() => {
    if (open) {
      setReason("");
      setOther("");
      setError(null);
    }
  }, [open]);

  const submit = () => {
    if (!reason) {
      setError(t("today.alerts.archiveReasonRequired"));
      return;
    }
    if (reason === "other" && other.trim() === "") {
      setError(t("today.alerts.archiveOtherRequired"));
      return;
    }
    setError(null);
    archive.mutate(alertId, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-ocid="alerts.archive.dialog" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("today.alerts.archiveTitle")}</DialogTitle>
          <DialogDescription>
            {t("today.alerts.archiveConfirm", { name })}{" "}
            {t("today.alerts.archiveBody")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="alert-archive-reason">
              {t("today.alerts.archiveReason")}
            </Label>
            <Select
              value={reason}
              onValueChange={(value) => setReason(value as ArchiveReasonValue)}
            >
              <SelectTrigger
                id="alert-archive-reason"
                className="touch-target w-full"
                data-ocid="alerts.archive.reason_select"
              >
                <SelectValue placeholder={t("today.alerts.archiveReason")} />
              </SelectTrigger>
              <SelectContent>
                {ARCHIVE_REASONS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {t(item.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {reason === "other" && (
            <div className="space-y-1.5">
              <Label htmlFor="alert-archive-other">
                {t("today.alerts.archiveOther")}
              </Label>
              <Textarea
                id="alert-archive-other"
                value={other}
                onChange={(event) => setOther(event.target.value)}
                data-ocid="alerts.archive.other_input"
              />
            </div>
          )}

          {error && (
            <p
              role="alert"
              data-ocid="alerts.archive.validation_error"
              className="text-sm text-destructive"
            >
              {error}
            </p>
          )}

          {archive.isError && (
            <p
              role="alert"
              data-ocid="alerts.archive.error_state"
              className="text-sm text-destructive"
            >
              {t("today.alerts.error")}
            </p>
          )}
        </div>

        <DialogFooter className="items-center gap-3">
          <Button
            type="button"
            variant="outline"
            className="touch-target"
            data-ocid="alerts.archive.cancel_button"
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="touch-target"
            data-ocid="alerts.archive.confirm_button"
            disabled={archive.isPending}
            onClick={submit}
          >
            {archive.isPending && (
              <Loader2
                className="mr-2 h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            )}
            {t("today.alerts.archive")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
