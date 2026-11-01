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
import { roleLabel } from "@/lib/format";
import { Check } from "lucide-react";

/**
 * Confirmation step shown before granting a high-privilege role. The admin
 * must explicitly confirm before the approval is sent.
 */
export function ApprovalConfirmDialog({
  open,
  role,
  pending,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  role: string;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const { t } = useI18n();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-ocid="approvals.confirm.dialog">
        <DialogHeader>
          <DialogTitle>{t("approvals.confirm.title")}</DialogTitle>
          <DialogDescription>
            {t("approvals.confirm.body", { role: roleLabel(role) })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="touch-target"
            data-ocid="approvals.cancel_button"
            onClick={() => onOpenChange(false)}
          >
            {t("approvals.cancel")}
          </Button>
          <Button
            type="button"
            className="touch-target"
            data-ocid="approvals.confirm_button"
            disabled={pending}
            onClick={onConfirm}
          >
            <Check className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("approvals.confirm.action")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
