import type { EventId } from "@/backend";
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
import { useArchiveNoShows } from "@/hooks/useQueries";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Archive every no-show at a session as NCNS Orientation. The confirmation
 * lists the names that will be archived; the backend refuses while the session
 * has not passed yet.
 */
export function ArchiveNoShowsDialog({
  eventId,
  names,
  open,
  onOpenChange,
}: {
  eventId: EventId | undefined;
  names: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const c = useOrientationCopy();
  const archive = useArchiveNoShows();
  const [done, setDone] = useState(false);

  // Names may repeat, so pair each with its position to build a stable key.
  const nameRows = names.map((name, position) => ({
    key: `${position}-${name}`,
    name,
  }));

  useEffect(() => {
    if (!open) setDone(false);
  }, [open]);

  const onConfirm = () => {
    if (eventId === undefined) return;
    archive.mutate(eventId, {
      onSuccess: () => {
        setDone(true);
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-ocid="orientation.archive_no_shows.dialog"
        className="sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>{c.archiveNoShowsTitle}</DialogTitle>
          <DialogDescription>{c.archiveNoShowsBody}</DialogDescription>
        </DialogHeader>

        {names.length === 0 ? (
          <p
            data-ocid="orientation.archive_no_shows.empty_state"
            className="text-sm text-muted-foreground"
          >
            {c.archiveNoShowsEmpty}
          </p>
        ) : (
          <ul
            data-ocid="orientation.archive_no_shows.list"
            className="max-h-60 space-y-1 overflow-y-auto rounded-md border border-border bg-background p-3 text-sm text-foreground"
          >
            {nameRows.map((row, index) => (
              <li
                key={row.key}
                data-ocid={`orientation.archive_no_shows.item.${index + 1}`}
              >
                {row.name}
              </li>
            ))}
          </ul>
        )}

        <DialogFooter className="items-center gap-3">
          {archive.isError && (
            <span
              role="alert"
              data-ocid="orientation.archive_no_shows.error_state"
              className="text-sm text-destructive"
            >
              {c.errorGeneric}
            </span>
          )}
          {done && (
            <output
              data-ocid="orientation.archive_no_shows.success_state"
              className="text-sm text-accent"
            >
              {c.archiveNoShowsDone}
            </output>
          )}
          <Button
            type="button"
            variant="outline"
            className="touch-target"
            data-ocid="orientation.archive_no_shows.cancel_button"
            onClick={() => onOpenChange(false)}
          >
            {c.cancel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="touch-target"
            data-ocid="orientation.archive_no_shows.confirm_button"
            disabled={archive.isPending || names.length === 0}
            onClick={onConfirm}
          >
            {archive.isPending && (
              <Loader2
                className="mr-2 h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            )}
            {c.archiveNoShowsConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
