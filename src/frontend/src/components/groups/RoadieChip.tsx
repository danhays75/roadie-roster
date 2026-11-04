import type { ShiftBoardRoadie } from "@/backend";
import { useGroupsCopy } from "@/components/groups/copy";
import { refToDataUrl } from "@/lib/format";
import { cn } from "@/lib/utils";
import { GripVertical } from "lucide-react";
import { useMemo } from "react";

/** The roadie's initials for the no-photo placeholder, at most two letters. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/**
 * One roadie chip on the board: photo, name and position code, plus a yellow
 * dot with the "Marked unavailable" tooltip when the roadie is scheduled on a
 * shift they marked unavailable on the kiosk. The chip is a button so tapping
 * it opens the shared card pop-up; a separate drag handle starts a drag, and a
 * select toggle supports the keyboard-accessible "Move to…" flow.
 */
export function RoadieChip({
  roadie,
  selected,
  draggable,
  onOpenCard,
  onToggleSelect,
  onDragStart,
  onDragEnd,
  ocid,
}: {
  roadie: ShiftBoardRoadie;
  selected: boolean;
  draggable: boolean;
  onOpenCard: (roadie: ShiftBoardRoadie) => void;
  onToggleSelect: (roadie: ShiftBoardRoadie) => void;
  onDragStart?: (roadie: ShiftBoardRoadie) => void;
  onDragEnd?: () => void;
  ocid: string;
}) {
  const { t } = useGroupsCopy();
  const photoUrl = useMemo(() => refToDataUrl(roadie.photo), [roadie.photo]);
  const position = roadie.positionCode || t("roadie.field.none");

  return (
    <li
      data-ocid={ocid}
      className={cn(
        "group/chip flex items-stretch gap-1 rounded-md border bg-card shadow-subtle transition-smooth",
        selected
          ? "border-primary ring-2 ring-primary/40"
          : "border-border hover:border-primary/50",
      )}
    >
      {draggable && (
        <button
          type="button"
          data-ocid={`${ocid}.drag_handle`}
          tabIndex={-1}
          aria-label={t("groups.board.dragHandle", { name: roadie.name })}
          draggable
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData(
              "text/plain",
              roadie.roadieId.toString(),
            );
            onDragStart?.(roadie);
          }}
          onDragEnd={() => onDragEnd?.()}
          className="flex cursor-grab items-center px-1 text-muted-foreground active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </button>
      )}

      <button
        type="button"
        data-ocid={`${ocid}.open_button`}
        aria-label={t("groups.board.openCard", { name: roadie.name })}
        onClick={() => onOpenCard(roadie)}
        className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={t("groups.board.roadiePhotoAlt")}
              className="h-full w-full object-cover"
            />
          ) : (
            <span
              className="font-display text-xs font-bold uppercase text-muted-foreground"
              aria-hidden="true"
            >
              {initialsOf(roadie.name)}
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate font-display text-sm font-semibold uppercase tracking-wide text-foreground">
              {roadie.name}
            </span>
            {roadie.markedUnavailable && (
              <span
                data-ocid={`${ocid}.unavailable`}
                title={t("groups.board.roadieUnavailable")}
                aria-label={t("groups.board.roadieUnavailable")}
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-[oklch(0.82_0.16_85)] ring-1 ring-[oklch(0.6_0.14_85)]"
              />
            )}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {position}
          </span>
        </span>
      </button>

      <button
        type="button"
        data-ocid={`${ocid}.select_button`}
        aria-pressed={selected}
        aria-label={
          selected
            ? t("groups.board.deselectRoadie", { name: roadie.name })
            : t("groups.board.selectRoadie", { name: roadie.name })
        }
        onClick={() => onToggleSelect(roadie)}
        className={cn(
          "flex w-8 shrink-0 items-center justify-center rounded-r-md border-l text-xs font-bold transition-smooth focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          selected
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border text-muted-foreground hover:bg-muted",
        )}
      >
        {selected ? "✓" : "+"}
      </button>
    </li>
  );
}
