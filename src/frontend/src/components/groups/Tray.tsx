import type { ShiftBoardRoadie } from "@/backend";
import { RoadieChip } from "@/components/groups/RoadieChip";
import { useGroupsCopy } from "@/components/groups/copy";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useState } from "react";

/** A station filter option: the position id and its display name. */
export interface StationOption {
  id: bigint;
  name: string;
}

/**
 * A tray of roadies: the Unassigned tray (filterable by station, with a count)
 * or the Off this shift tray. Both are drop targets; dropping a roadie moves
 * them into the tray. The Unassigned tray filters by the roadie's main station.
 */
export function Tray({
  title,
  hint,
  roadies,
  editable,
  selectedId,
  onOpenCard,
  onToggleSelect,
  onDropRoadie,
  onDragStart,
  onDragEnd,
  stationFilter,
  onStationFilterChange,
  stationOptions,
  ocid,
}: {
  title: string;
  hint: string;
  roadies: ShiftBoardRoadie[];
  editable: boolean;
  selectedId: string | null;
  onOpenCard: (roadie: ShiftBoardRoadie) => void;
  onToggleSelect: (roadie: ShiftBoardRoadie) => void;
  onDropRoadie: (roadieId: bigint) => void;
  onDragStart: (roadie: ShiftBoardRoadie) => void;
  onDragEnd: () => void;
  stationFilter?: string;
  onStationFilterChange?: (value: string) => void;
  stationOptions?: StationOption[];
  ocid: string;
}) {
  const { t } = useGroupsCopy();
  const [dragOver, setDragOver] = useState(false);

  const filtered =
    stationFilter && stationFilter !== "all"
      ? roadies.filter(
          (roadie) => roadie.positionId.toString() === stationFilter,
        )
      : roadies;

  return (
    <section
      data-ocid={ocid}
      aria-label={title}
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
        "flex w-72 shrink-0 flex-col rounded-lg border bg-muted/30 shadow-subtle transition-smooth",
        dragOver ? "border-primary ring-2 ring-primary/40" : "border-border",
      )}
    >
      <header className="flex flex-col gap-2 border-b border-border p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-foreground">
            {title}
          </h3>
          <span
            data-ocid={`${ocid}.count`}
            className="rounded-full bg-muted px-2 py-0.5 font-display text-xs font-bold tabular-nums text-muted-foreground"
          >
            {filtered.length}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{hint}</p>
        {stationOptions && onStationFilterChange && (
          <Select
            value={stationFilter ?? "all"}
            onValueChange={onStationFilterChange}
          >
            <SelectTrigger
              data-ocid={`${ocid}.station_filter`}
              aria-label={t("groups.board.stationFilter")}
              className="h-9 w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("groups.board.allStations")}
              </SelectItem>
              {stationOptions.map((station) => (
                <SelectItem
                  key={station.id.toString()}
                  value={station.id.toString()}
                >
                  {station.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </header>

      <ul
        data-ocid={`${ocid}.list`}
        className="flex min-h-24 flex-1 flex-col gap-1.5 p-2"
      >
        {filtered.map((roadie, index) => (
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
        {filtered.length === 0 && (
          <li className="flex flex-1 items-center justify-center rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
            {t("groups.board.dropHere")}
          </li>
        )}
      </ul>
    </section>
  );
}
