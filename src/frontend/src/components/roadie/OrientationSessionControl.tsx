import type { OrientationSessionOption, Roadie } from "@/backend";
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
import { canOrientation, useAccessState } from "@/hooks/useAccess";
import { useI18n } from "@/hooks/useI18n";
import {
  useMoveRoadieToSession,
  useOrientationSessions,
} from "@/hooks/useQueries";
import { formatTimestamp } from "@/lib/format";
import { CalendarClock, Loader2, MoveRight } from "lucide-react";
import { useState } from "react";

/**
 * The roadie's current orientation session, resolved from the session options.
 * Returns null when the roadie has no `orientationEventId` or it points to a
 * session that no longer exists, so the caller renders the "No session" state.
 */
function currentSession(
  roadie: Roadie,
  sessions: OrientationSessionOption[],
): OrientationSessionOption | null {
  const eventId = roadie.orientationEventId;
  if (eventId === undefined) return null;
  return sessions.find((session) => session.eventId === eventId) ?? null;
}

/**
 * The manager tab's orientation session row: the roadie's current session name
 * and date, or a clear "No session" state, with a Change control that opens a
 * picker of the available sessions and moves the roadie through
 * `moveRoadieToSession`. The move invalidates the roadie and orientation reads,
 * so the row and the session views refresh on success.
 */
export function OrientationSessionControl({ roadie }: { roadie: Roadie }) {
  const { t } = useI18n();
  const access = useAccessState();
  const role = access.kind === "granted" ? access.grant.role : undefined;
  const mayChange = canOrientation(role);

  const { data: sessions, isLoading } = useOrientationSessions(mayChange);
  const move = useMoveRoadieToSession();

  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("");

  const options = sessions ?? [];
  const current = currentSession(roadie, options);

  // The roadie's own session is never a valid target: moving onto the session
  // they already attend is a no-op the manager cannot intend.
  const targets = options.filter(
    (session) => session.eventId !== roadie.orientationEventId,
  );

  const openPicker = () => {
    setTarget("");
    setOpen(true);
  };

  const onConfirm = () => {
    if (!target) return;
    move.mutate(
      { roadieId: roadie.id, eventId: BigInt(target) },
      {
        onSuccess: () => {
          setOpen(false);
        },
      },
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p
            data-ocid="roadie.orientation.session"
            className="break-words text-sm text-foreground"
          >
            {isLoading ? (
              t("common.loading")
            ) : current ? (
              <>
                <span className="font-medium">{current.name}</span>
                <span className="text-muted-foreground">
                  {" · "}
                  {formatTimestamp(current.start)}
                </span>
              </>
            ) : (
              <span
                data-ocid="roadie.orientation.no_session"
                className="text-muted-foreground"
              >
                {t("roadie.orientation.none")}
              </span>
            )}
          </p>
        </div>

        {mayChange && (
          <Button
            type="button"
            variant="outline"
            className="touch-target shrink-0"
            data-ocid="roadie.orientation.change_button"
            disabled={isLoading || options.length === 0}
            onClick={openPicker}
          >
            <CalendarClock className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("roadie.orientation.change")}
          </Button>
        )}
      </div>

      {move.isError && (
        <p
          role="alert"
          data-ocid="roadie.orientation.error_state"
          className="text-sm text-destructive"
        >
          {t("roadie.orientation.error")}
        </p>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) setOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("roadie.orientation.changeTitle")}</DialogTitle>
            <DialogDescription>
              {t("roadie.orientation.changeBody")}
            </DialogDescription>
          </DialogHeader>

          {targets.length === 0 ? (
            <p
              data-ocid="roadie.orientation.empty_state"
              className="text-sm text-muted-foreground"
            >
              {t("roadie.orientation.noTargets")}
            </p>
          ) : (
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger
                data-ocid="roadie.orientation.session_select"
                className="touch-target w-full"
                aria-label={t("roadie.orientation.sessionLabel")}
              >
                <SelectValue
                  placeholder={t("roadie.orientation.sessionPlaceholder")}
                />
              </SelectTrigger>
              <SelectContent>
                {targets.map((session) => (
                  <SelectItem
                    key={session.eventId.toString()}
                    value={session.eventId.toString()}
                  >
                    {session.name} · {formatTimestamp(session.start)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="touch-target"
              data-ocid="roadie.orientation.cancel_button"
              onClick={() => setOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              className="touch-target"
              data-ocid="roadie.orientation.confirm_button"
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
              {t("roadie.orientation.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
