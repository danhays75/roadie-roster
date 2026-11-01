import { useKioskCopy } from "@/components/kiosk/copy";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

/** Success screen shown after a sign-up is submitted. */
export function KioskSuccess({ onReset }: { onReset: () => void }) {
  const t = useKioskCopy();
  return (
    <div
      className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 py-10 text-center"
      data-ocid="kiosk.success_state"
    >
      <span className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <CheckCircle2 className="h-10 w-10" aria-hidden="true" />
      </span>
      <div className="space-y-2">
        <h2 className="font-display text-3xl font-bold uppercase tracking-tight">
          {t("success.title")}
        </h2>
        <p className="text-base text-muted-foreground">{t("success.body")}</p>
      </div>
      <Button
        type="button"
        size="lg"
        data-ocid="kiosk.success.reset_button"
        onClick={onReset}
        className="touch-target h-14 rounded-full px-8 font-display text-base font-semibold uppercase tracking-wider"
      >
        {t("success.next")}
      </Button>
      <p className="text-xs text-muted-foreground">{t("success.auto")}</p>
    </div>
  );
}
