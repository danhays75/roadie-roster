import type { GroupChangeNotice } from "@/backend";
import { useGroupsCopy } from "@/components/groups/copy";
import { Button } from "@/components/ui/button";
import { useDismissGroupChangeNotice } from "@/hooks/useQueries";
import { formatTimestamp } from "@/lib/format";
import { BellRing, X } from "lucide-react";

/**
 * The dismissible "Your group changed" notice card shown at the top of the
 * Groups page for the signed-in trainer until dismissed. Each notice lists the
 * roadies added and removed, who edited the board and when.
 */
export function GroupChangeNoticeCard({
  notice,
  timeZone,
}: {
  notice: GroupChangeNotice;
  timeZone?: string;
}) {
  const { t } = useGroupsCopy();
  const dismiss = useDismissGroupChangeNotice();

  return (
    <section
      data-ocid="groups.notice.card"
      className="rounded-lg border border-primary/40 bg-primary/5 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <BellRing
            className="mt-0.5 h-4 w-4 shrink-0 text-primary"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
              {t("groups.notice.title")}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {notice.shiftLabel} ·{" "}
              {formatTimestamp(notice.createdAt, timeZone)}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label={t("groups.notice.dismiss")}
          data-ocid="groups.notice.dismiss_button"
          disabled={dismiss.isPending}
          onClick={() => dismiss.mutate(notice.id)}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="mt-2 space-y-1 text-sm">
        {notice.addedNames.length > 0 && (
          <p data-ocid="groups.notice.added">
            {t("groups.notice.added", { names: notice.addedNames.join(", ") })}
          </p>
        )}
        {notice.removedNames.length > 0 && (
          <p data-ocid="groups.notice.removed">
            {t("groups.notice.removed", {
              names: notice.removedNames.join(", "),
            })}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {t("groups.notice.by", { name: notice.editorName })}
        </p>
      </div>

      {dismiss.isError && (
        <p
          role="alert"
          data-ocid="groups.notice.error_state"
          className="mt-2 text-xs font-medium text-destructive"
        >
          {t("groups.notice.dismissError")}
        </p>
      )}
    </section>
  );
}
