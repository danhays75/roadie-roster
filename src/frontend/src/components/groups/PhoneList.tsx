import type { ShiftBoardRoadie } from "@/backend";
import { RoadieChip } from "@/components/groups/RoadieChip";
import { useGroupsCopy } from "@/components/groups/copy";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowRightLeft } from "lucide-react";

/** One group section in the phone list. */
export interface PhoneGroup {
  key: string;
  title: string;
  subtitle?: string;
  roadies: ShiftBoardRoadie[];
}

/**
 * The phone view: a list grouped by trainer, with an Unassigned and an Off
 * section. Tapping a roadie selects it; a "Move to…" button then opens the move
 * dialog. The list is the phone alternative to the drag-and-drop board.
 */
export function PhoneList({
  groups,
  editable,
  selectedId,
  onOpenCard,
  onToggleSelect,
  onMoveSelected,
  ocid,
}: {
  groups: PhoneGroup[];
  editable: boolean;
  selectedId: string | null;
  onOpenCard: (roadie: ShiftBoardRoadie) => void;
  onToggleSelect: (roadie: ShiftBoardRoadie) => void;
  onMoveSelected: () => void;
  ocid: string;
}) {
  const { t } = useGroupsCopy();
  const selectedRoadie = groups
    .flatMap((group) => group.roadies)
    .find((roadie) => roadie.roadieId.toString() === selectedId);

  return (
    <div data-ocid={ocid} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t("groups.board.phoneHint")}
      </p>

      {groups.map((group) => (
        <section
          key={group.key}
          data-ocid={`${ocid}.group.${group.key}`}
          className="rounded-lg border border-border bg-card shadow-subtle"
        >
          <header className="flex items-center justify-between gap-2 border-b border-border p-3">
            <div className="min-w-0">
              <h3 className="truncate font-display text-sm font-semibold uppercase tracking-wide text-foreground">
                {group.title}
              </h3>
              {group.subtitle && (
                <p className="truncate text-xs text-muted-foreground">
                  {group.subtitle}
                </p>
              )}
            </div>
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 font-display text-xs font-bold tabular-nums text-muted-foreground">
              {group.roadies.length}
            </span>
          </header>
          <ul className="flex flex-col gap-1.5 p-2">
            {group.roadies.map((roadie, index) => (
              <RoadieChip
                key={roadie.roadieId.toString()}
                roadie={roadie}
                selected={selectedId === roadie.roadieId.toString()}
                draggable={false}
                onOpenCard={onOpenCard}
                onToggleSelect={onToggleSelect}
                ocid={`${ocid}.group.${group.key}.roadie.${index + 1}`}
              />
            ))}
            {group.roadies.length === 0 && (
              <li className="px-3 py-4 text-center text-xs text-muted-foreground">
                {t("groups.board.phoneEmpty")}
              </li>
            )}
          </ul>
        </section>
      ))}

      {editable && selectedRoadie && (
        <div
          data-ocid={`${ocid}.move_bar`}
          className={cn(
            "sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-lg border border-primary bg-card p-3 shadow-elevated",
          )}
        >
          <span className="min-w-0 truncate text-sm font-medium text-foreground">
            {t("groups.board.selected", { name: selectedRoadie.name })}
          </span>
          <Button
            type="button"
            className="touch-target shrink-0"
            data-ocid={`${ocid}.move_button`}
            onClick={onMoveSelected}
          >
            <ArrowRightLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("groups.roadie.moveTo")}
          </Button>
        </div>
      )}
    </div>
  );
}
