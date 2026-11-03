import type { OrientationSessionOption, ScheduleEvent } from "@/backend";
import { fill } from "@/components/admin/copy";
import { useAdminCopy } from "@/components/admin/useAdminCopy";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMoveAllRoadiesToSession } from "@/hooks/useQueries";
import { formatTimestamp } from "@/lib/format";
import { Loader2, MoveRight } from "lucide-react";
import { useState } from "react";

/**
 * The "Move everyone" confirmation for one orientation session. The manager
 * picks a target session (the source is never offered), confirms, and the
 * backend moves every non-archived roadie from the source to the target and
 * returns the count moved. The dialog reports that count and explains that the
 * now-empty source session can be deleted.
 */
export function MoveEveryoneDialog({
  source,
  sessions,
  timeZone,
  onClose,
}: {
  source: ScheduleEvent;
  sessions: OrientationSessionOption[];
  timeZone: string;
  onClose: () => void;
}) {
  const c = useAdminCopy();
  const move = useMoveAllRoadiesToSession();
  const [target, setTarget] = useState("");
  const [movedCount, setMovedCount] = useState<bigint | null>(null);

  // The source session is never a valid target: moving a session onto itself
  // is a no-op the manager cannot intend.
  const targets = sessions.filter((session) => session.eventId !== source.id);

  const onConfirm = () => {
    if (!target) return;
    move.mutate(
      { fromEventId: source.id, toEventId: BigInt(target) },
      { onSuccess: (count) => setMovedCount(count) },
    );
  };

  const done = movedCount !== null;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{c.scheduleMoveEveryoneTitle}</DialogTitle>
          <DialogDescription>
            {fill(c.scheduleMoveEveryoneBody, { name: source.name })}
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="space-y-3">
            <p
              className="text-sm font-medium text-accent"
              data-ocid="admin.schedule.move_everyone.success_state"
            >
              {fill(c.scheduleMoveEveryoneDone, {
                count: movedCount.toString(),
              })}
            </p>
            <p className="text-sm text-muted-foreground">
              {c.scheduleMoveEveryoneDeleteHint}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {targets.length === 0 ? (
              <p
                className="text-sm text-muted-foreground"
                data-ocid="admin.schedule.move_everyone.empty_state"
              >
                {c.scheduleMoveEveryoneNoTargets}
              </p>
            ) : (
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger
                  data-ocid="admin.schedule.move_everyone.target_select"
                  className="touch-target w-full"
                  aria-label={c.scheduleMoveEveryoneTarget}
                >
                  <SelectValue
                    placeholder={c.scheduleMoveEveryoneTargetPlaceholder}
                  />
                </SelectTrigger>
                <SelectContent>
                  {targets.map((session) => (
                    <SelectItem
                      key={session.eventId.toString()}
                      value={session.eventId.toString()}
                    >
                      {session.name} ·{" "}
                      {formatTimestamp(session.start, timeZone)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {move.isError && (
              <p
                className="text-sm font-medium text-destructive"
                data-ocid="admin.schedule.move_everyone.error_state"
              >
                {c.scheduleMoveEveryoneError}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="touch-target"
            data-ocid="admin.schedule.move_everyone.cancel_button"
            onClick={onClose}
          >
            {done ? c.scheduleMoveEveryoneClose : c.actionCancel}
          </Button>
          {!done && (
            <Button
              type="button"
              className="touch-target"
              data-ocid="admin.schedule.move_everyone.confirm_button"
              disabled={!target || move.isPending || targets.length === 0}
              onClick={onConfirm}
            >
              {move.isPending ? (
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <MoveRight className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              {c.scheduleMoveEveryoneConfirm}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
