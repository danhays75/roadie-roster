import type { LeaderSummary, ShiftBoardRoadie } from "@/backend";
import { RoadieChip } from "@/components/groups/RoadieChip";
import { useGroupsCopy } from "@/components/groups/copy";
import { Button } from "@/components/ui/button";
import { refToDataUrl, staffDisplayName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Minus, Plus, UserMinus } from "lucide-react";
import { useMemo, useState } from "react";

/** The roadie's initials for the no-photo placeholder, at most two letters. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/**
 * One trainer column on the board: the trainer's photo, name and stations, a
 * "3 / 4" capacity that turns yellow when over, and the roadies in the group.
 * The column is a drop target; dropping a roadie moves them into this group.
 * Editors can change the capacity and remove the trainer from the shift.
 */
export function TrainerColumn({
  roadies,
  capacity,
  leader,
  stationNames,
  editable,
  selectedId,
  onOpenCard,
  onToggleSelect,
  onDropRoadie,
  onDragStart,
  onDragEnd,
  onCapacityChange,
  onRemoveTrainer,
  ocid,
}: {
  roadies: ShiftBoardRoadie[];
  capacity: number;
  leader: LeaderSummary | undefined;
  stationNames: string[];
  editable: boolean;
  selectedId: string | null;
  onOpenCard: (roadie: ShiftBoardRoadie) => void;
  onToggleSelect: (roadie: ShiftBoardRoadie) => void;
  onDropRoadie: (roadieId: bigint) => void;
  onDragStart: (roadie: ShiftBoardRoadie) => void;
  onDragEnd: () => void;
  onCapacityChange: (capacity: bigint) => void;
  onRemoveTrainer: () => void;
  ocid: string;
}) {
  const { t } = useGroupsCopy();
  const [dragOver, setDragOver] = useState(false);
  const photoUrl = useMemo(
    () => refToDataUrl(leader?.staffProfile?.photo),
    [leader?.staffProfile?.photo],
  );
  const name = leader
    ? staffDisplayName(leader.staffProfile, t("groups.board.unnamedTrainer"))
    : t("groups.board.unnamedTrainer");
  const count = roadies.length;
  const over = count > capacity;

  return (
    <section
      data-ocid={ocid}
      aria-label={name}
      onDragOver={(event) => {
        if (!editable) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        if (!editable) return;
        event.preventDefault();
        setDragOver(false);
        const raw = event.dataTransfer.getData("text/plain");
        if (!raw) return;
        try {
          onDropRoadie(BigInt(raw));
        } catch {
          // Ignore a malformed drag payload.
        }
      }}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-lg border bg-card shadow-subtle transition-smooth",
        dragOver ? "border-primary ring-2 ring-primary/40" : "border-border",
      )}
    >
      <header className="flex items-start gap-3 border-b border-border p-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-primary bg-muted">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={t("groups.board.trainerPhotoAlt")}
              className="h-full w-full object-cover"
            />
          ) : (
            <span
              className="font-display text-sm font-bold uppercase text-muted-foreground"
              aria-hidden="true"
            >
              {initialsOf(name)}
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-semibold uppercase tracking-wide text-foreground">
            {name}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {stationNames.length > 0
              ? stationNames.join(", ")
              : t("groups.board.noStations")}
          </p>
        </div>
        <span
          data-ocid={`${ocid}.capacity`}
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 font-display text-xs font-bold tabular-nums",
            over
              ? "bg-[oklch(0.9_0.14_85)] text-[oklch(0.35_0.1_85)]"
              : "bg-muted text-muted-foreground",
          )}
        >
          {t("groups.board.capacityOf", { count, capacity })}
        </span>
      </header>

      {editable && (
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              aria-label={t("groups.board.capacityDecrease")}
              data-ocid={`${ocid}.capacity_decrease`}
              disabled={capacity <= 0}
              onClick={() =>
                onCapacityChange(BigInt(Math.max(0, capacity - 1)))
              }
            >
              <Minus className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              aria-label={t("groups.board.capacityIncrease")}
              data-ocid={`${ocid}.capacity_increase`}
              onClick={() => onCapacityChange(BigInt(capacity + 1))}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-muted-foreground hover:text-destructive"
            data-ocid={`${ocid}.remove_trainer`}
            onClick={onRemoveTrainer}
          >
            <UserMinus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            {t("groups.board.removeTrainer")}
          </Button>
        </div>
      )}

      <ul
        data-ocid={`${ocid}.list`}
        className="flex min-h-24 flex-1 flex-col gap-1.5 p-2"
      >
        {roadies.map((roadie, index) => (
          <RoadieChip
            key={roadie.roadieId.toString()}
            roadie={roadie}
            selected={selectedId === roadie.roadieId.toString()}
            draggable={editable}
            onOpenCard={onOpenCard}
            onToggleSelect={onToggleSelect}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            ocid={`${ocid}.roadie.${index + 1}`}
          />
        ))}
        {roadies.length === 0 && (
          <li className="flex flex-1 items-center justify-center rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
            {t("groups.board.dropHere")}
          </li>
        )}
      </ul>
    </section>
  );
}
