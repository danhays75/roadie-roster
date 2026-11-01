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
import { Check, X } from "lucide-react";

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

/**
 * Confirmation step shown before rejecting a pending sign-up. Rejecting is
 * destructive, so the manager must explicitly confirm before it is sent.
 */
export function RejectConfirmDialog({
  open,
  pending,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const { t } = useI18n();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-ocid="approvals.reject.dialog"
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle>{t("approvals.action.reject")}</DialogTitle>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="touch-target"
            data-ocid="approvals.reject.cancel_button"
            onClick={() => onOpenChange(false)}
          >
            {t("approvals.cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="touch-target"
            data-ocid="approvals.reject.confirm_button"
            disabled={pending}
            onClick={onConfirm}
          >
            <X className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("common.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
