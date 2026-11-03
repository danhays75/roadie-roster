import type { EventId, ScheduleEvent } from "@/backend";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMoveRoadieToSession } from "@/hooks/useQueries";
import { formatTimestamp } from "@/lib/format";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Move a roadie to another orientation session. The select lists every session
 * except the one the roadie is currently assigned to; the move is a manager
 * action and refreshes both session views.
 */
export function MoveSessionDialog({
  roadieId,
  roadieName,
  currentEventId,
  sessions,
  timeZone,
  open,
  onOpenChange,
}: {
  roadieId: bigint | undefined;
  roadieName: string;
  currentEventId: EventId | undefined;
  sessions: ScheduleEvent[];
  timeZone: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const c = useOrientationCopy();
  const move = useMoveRoadieToSession();
  const [target, setTarget] = useState("");
  const [done, setDone] = useState(false);

  const targets = sessions.filter((session) => session.id !== currentEventId);

  useEffect(() => {
    if (!open) {
      setTarget("");
      setDone(false);
    }
  }, [open]);

  const onSubmit = () => {
    if (roadieId === undefined || !target) return;
    move.mutate(
      { roadieId, eventId: BigInt(target) },
      {
        onSuccess: () => {
          setDone(true);
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-ocid="orientation.move.dialog"
        className="sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>{c.moveTitle}</DialogTitle>
          <DialogDescription>
            {roadieName} · {c.moveBody}
          </DialogDescription>
        </DialogHeader>

        {targets.length === 0 ? (
          <p
            data-ocid="orientation.move.empty_state"
            className="text-sm text-muted-foreground"
          >
            {c.moveNoTargets}
          </p>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="move-session">{c.moveTarget}</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger
                id="move-session"
                data-ocid="orientation.move.session_select"
                className="touch-target w-full"
              >
                <SelectValue placeholder={c.sessionPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {targets.map((session) => (
                  <SelectItem
                    key={session.id.toString()}
                    value={session.id.toString()}
                  >
                    {session.name} · {formatTimestamp(session.start, timeZone)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <DialogFooter className="items-center gap-3">
          {move.isError && (
            <span
              role="alert"
              data-ocid="orientation.move.error_state"
              className="text-sm text-destructive"
            >
              {c.errorGeneric}
            </span>
          )}
          {done && (
            <output
              data-ocid="orientation.move.success_state"
              className="text-sm text-accent"
            >
              {c.moveDone}
            </output>
          )}
          <Button
            type="button"
            variant="outline"
            className="touch-target"
            data-ocid="orientation.move.cancel_button"
            onClick={() => onOpenChange(false)}
          >
            {c.cancel}
          </Button>
          <Button
            type="button"
            className="touch-target"
            data-ocid="orientation.move.confirm_button"
            disabled={!target || move.isPending || targets.length === 0}
            onClick={onSubmit}
          >
            {move.isPending && (
              <Loader2
                className="mr-2 h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            )}
            {c.moveConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
