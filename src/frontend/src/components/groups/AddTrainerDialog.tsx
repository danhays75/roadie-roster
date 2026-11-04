import { type LeaderSummary, Role } from "@/backend";
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
import { refToDataUrl, staffDisplayName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { useMemo, useState } from "react";

/** The role label key for a leader's role. */
function roleLabelKey(role: Role): string {
  switch (role) {
    case Role.admin:
      return "groups.board.adminRole";
    case Role.storeManager:
      return "groups.board.managerRole";
    case Role.trainingManager:
      return "groups.board.trainingManagerRole";
    case Role.visitingManager:
      return "groups.board.visitingManagerRole";
    case Role.leadership:
      return "groups.board.leadershipRole";
    default:
      return "groups.board.trainerRole";
  }
}

/** Whether a leader may be added to a shift board. */
function isEligibleRole(role: Role): boolean {
  return (
    role === Role.trainer ||
    role === Role.storeManager ||
    role === Role.trainingManager ||
    role === Role.visitingManager ||
    role === Role.admin
  );
}

/**
 * Whether a leader's access covers the given date. A leader with no arrival or
 * departure date covers every date; otherwise the date must fall within the
 * inclusive range. Dates are UTC calendar days.
 */
function accessCoversDate(
  leader: LeaderSummary,
  dateOnly: bigint | undefined,
): boolean {
  if (dateOnly === undefined) return true;
  const day = Number(dateOnly / 1_000_000n);
  if (leader.arrivalDate !== undefined) {
    const arrival = Number(leader.arrivalDate / 1_000_000n);
    if (day < arrival) return false;
  }
  if (leader.departureDate !== undefined) {
    const departure = Number(leader.departureDate / 1_000_000n);
    if (day > departure) return false;
  }
  return true;
}

/**
 * The "Add trainer to this shift" dialog. It lists approved NSO trainers whose
 * access covers the shift's date, plus managers and the Training Manager, and
 * excludes leaders already on the shift. The user picks one and confirms.
 */
export function AddTrainerDialog({
  leaders,
  existingPrincipals,
  shiftDate,
  open,
  onOpenChange,
  onConfirm,
  pending,
  error,
}: {
  leaders: LeaderSummary[];
  existingPrincipals: Set<string>;
  shiftDate: bigint | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (leader: LeaderSummary) => void;
  pending: boolean;
  error: boolean;
}) {
  const { t } = useGroupsCopy();
  const [chosen, setChosen] = useState<string | null>(null);

  const available = useMemo(
    () =>
      leaders.filter(
        (leader) =>
          isEligibleRole(leader.role) &&
          !existingPrincipals.has(leader.principal.toString()) &&
          accessCoversDate(leader, shiftDate),
      ),
    [leaders, existingPrincipals, shiftDate],
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setChosen(null);
        onOpenChange(next);
      }}
    >
      <DialogContent
        data-ocid="groups.add_trainer.dialog"
        className="max-h-[90dvh] overflow-y-auto sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>{t("groups.board.addTrainerTitle")}</DialogTitle>
          <DialogDescription>
            {t("groups.board.addTrainerHint")}
          </DialogDescription>
        </DialogHeader>

        {available.length === 0 ? (
          <p
            data-ocid="groups.add_trainer.empty_state"
            className="text-sm text-muted-foreground"
          >
            {t("groups.board.noAvailableTrainers")}
          </p>
        ) : (
          <ul className="space-y-1" data-ocid="groups.add_trainer.list">
            {available.map((leader) => {
              const key = leader.principal.toString();
              const name = staffDisplayName(
                leader.staffProfile,
                t("groups.board.unnamedTrainer"),
              );
              const photoUrl = refToDataUrl(leader.staffProfile?.photo);
              const isChosen = chosen === key;
              return (
                <li key={key}>
                  <button
                    type="button"
                    data-ocid={`groups.add_trainer.option.${key}`}
                    aria-pressed={isChosen}
                    onClick={() => setChosen(key)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-smooth focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                      isChosen
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted",
                    )}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
                      {photoUrl ? (
                        <img
                          src={photoUrl}
                          alt={t("groups.board.trainerPhotoAlt")}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span
                          className="font-display text-xs font-bold uppercase text-muted-foreground"
                          aria-hidden="true"
                        >
                          {name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-sm font-semibold uppercase tracking-wide text-foreground">
                        {name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {t(roleLabelKey(leader.role))}
                      </span>
                    </span>
                    {isChosen && (
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
        )}

        {error && (
          <p
            role="alert"
            data-ocid="groups.add_trainer.error_state"
            className="text-sm font-medium text-destructive"
          >
            {t("groups.board.addTrainerError")}
          </p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="touch-target"
            data-ocid="groups.add_trainer.cancel_button"
            onClick={() => {
              setChosen(null);
              onOpenChange(false);
            }}
          >
            {t("groups.board.cancel")}
          </Button>
          <Button
            type="button"
            className="touch-target"
            data-ocid="groups.add_trainer.confirm_button"
            disabled={!chosen || pending}
            onClick={() => {
              const leader = available.find(
                (candidate) => candidate.principal.toString() === chosen,
              );
              if (leader) onConfirm(leader);
            }}
          >
            {t("groups.board.addTrainerConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
