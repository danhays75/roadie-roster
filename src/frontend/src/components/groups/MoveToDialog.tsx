import type { ShiftBoardRoadie } from "@/backend";
import { useGroupsCopy } from "@/components/groups/copy";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { useState } from "react";

/** A trainer target for the move dialog. */
export interface MoveTrainerTarget {
  principalText: string;
  name: string;
}

/** A same-day other-shift target for the move dialog. */
export interface MoveShiftTarget {
  key: string;
  label: string;
}

/** The chosen destination for a move. */
export type MoveDestination =
  | { kind: "trainer"; principalText: string }
  | { kind: "off" }
  | { kind: "otherShift"; key: string };

/**
 * The keyboard-accessible "Move to…" dialog. It lists the trainers on the
 * shift, Off this shift, and the same day's other shift. The user picks one and
 * confirms; the caller performs the move. This is the alternative to dragging
 * for keyboard and phone users.
 */
export function MoveToDialog({
  roadie,
  trainers,
  otherShifts,
  open,
  onOpenChange,
  onConfirm,
  pending,
  error,
}: {
  roadie: ShiftBoardRoadie | null;
  trainers: MoveTrainerTarget[];
  otherShifts: MoveShiftTarget[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (destination: MoveDestination) => void;
  pending: boolean;
  error: boolean;
}) {
  const { t } = useGroupsCopy();
  const [choice, setChoice] = useState<MoveDestination | null>(null);

  const hasTargets = trainers.length > 0 || otherShifts.length > 0;

  const choose = (destination: MoveDestination) => setChoice(destination);

  const isChosen = (destination: MoveDestination) => {
    if (!choice) return false;
    if (choice.kind !== destination.kind) return false;
    if (choice.kind === "trainer" && destination.kind === "trainer") {
      return choice.principalText === destination.principalText;
    }
    if (choice.kind === "otherShift" && destination.kind === "otherShift") {
      return choice.key === destination.key;
    }
    return true;
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setChoice(null);
        onOpenChange(next);
      }}
    >
      <DialogContent
        data-ocid="groups.move.dialog"
        className="max-h-[90dvh] overflow-y-auto sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>
            {t("groups.board.moveTitle", { name: roadie?.name ?? "" })}
          </DialogTitle>
          <DialogDescription>{t("groups.board.moveBody")}</DialogDescription>
        </DialogHeader>

        {!hasTargets ? (
          <p
            data-ocid="groups.move.empty_state"
            className="text-sm text-muted-foreground"
          >
            {t("groups.board.moveNoTargets")}
          </p>
        ) : (
          <div className="space-y-4">
            {trainers.length > 0 && (
              <div className="space-y-1.5">
                <p className="font-display text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("groups.board.moveTrainerSection")}
                </p>
                <ul className="space-y-1">
                  {trainers.map((trainer) => {
                    const destination: MoveDestination = {
                      kind: "trainer",
                      principalText: trainer.principalText,
                    };
                    const chosen = isChosen(destination);
                    return (
                      <li key={trainer.principalText}>
                        <button
                          type="button"
                          data-ocid={`groups.move.trainer.${trainer.principalText}`}
                          aria-pressed={chosen}
                          onClick={() => choose(destination)}
                          className={cn(
                            "flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2.5 text-left text-sm transition-smooth focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                            chosen
                              ? "border-primary bg-primary/5"
                              : "border-border hover:bg-muted",
                          )}
                        >
                          <span className="min-w-0 truncate">
                            {trainer.name}
                          </span>
                          {chosen && (
                            <Check
                              className="h-4 w-4 shrink-0 text-primary"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div className="space-y-1.5">
              <p className="font-display text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("groups.board.moveOtherShiftSection")}
              </p>
              <ul className="space-y-1">
                <li>
                  <button
                    type="button"
                    data-ocid="groups.move.off"
                    aria-pressed={isChosen({ kind: "off" })}
                    onClick={() => choose({ kind: "off" })}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2.5 text-left text-sm transition-smooth focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                      isChosen({ kind: "off" })
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted",
                    )}
                  >
                    <span className="min-w-0 truncate">
                      {t("groups.roadie.moveToOff")}
                    </span>
                    {isChosen({ kind: "off" }) && (
                      <Check
                        className="h-4 w-4 shrink-0 text-primary"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                </li>
                {otherShifts.map((shift) => {
                  const destination: MoveDestination = {
                    kind: "otherShift",
                    key: shift.key,
                  };
                  const chosen = isChosen(destination);
                  return (
                    <li key={shift.key}>
                      <button
                        type="button"
                        data-ocid={`groups.move.shift.${shift.key}`}
                        aria-pressed={chosen}
                        onClick={() => choose(destination)}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2.5 text-left text-sm transition-smooth focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                          chosen
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted",
                        )}
                      >
                        <span className="min-w-0 truncate">{shift.label}</span>
                        {chosen && (
                          <Check
                            className="h-4 w-4 shrink-0 text-primary"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}

        {error && (
          <p
            role="alert"
            data-ocid="groups.move.error_state"
            className="text-sm font-medium text-destructive"
          >
            {t("groups.board.moveError")}
          </p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="touch-target"
            data-ocid="groups.move.cancel_button"
            onClick={() => {
              setChoice(null);
              onOpenChange(false);
            }}
          >
            {t("groups.board.moveCancel")}
          </Button>
          <Button
            type="button"
            className="touch-target"
            data-ocid="groups.move.confirm_button"
            disabled={!choice || pending}
            onClick={() => {
              if (choice) onConfirm(choice);
            }}
          >
            {t("groups.board.moveConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
