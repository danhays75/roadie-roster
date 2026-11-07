import {
  type OrientationRoadieRow as OrientationRoadieRowData,
  PaperworkStatus,
  type RoadieId,
} from "@/backend";
import { StatusBadge } from "@/components/StatusBadge";
import { useOrientationCopy } from "@/components/orientation/copy";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/hooks/useI18n";
import { refToDataUrl, roadieStageLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AlertTriangle, Check, Loader2, MoveRight, Undo2 } from "lucide-react";
import { useMemo } from "react";

/** The roadie's initials for the no-photo placeholder, at most two letters. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/**
 * One roadie assigned to an orientation session: photo, name, position, crew
 * and paperwork status, with a large Present button. When paperwork is
 * incomplete the Present button is replaced by a warning plus an Archive:
 * Paperwork Incomplete action and, for a store manager or admin, a small
 * Override and mark Present action. A roadie still Pending whose session has
 * passed shows a red No-Show tag. Tapping the row opens the uniform check-off.
 */
export function OrientationRoadieRow({
  row,
  index,
  canManage,
  canPresent,
  canOverride,
  presentPending,
  onMarkPresent,
  onUndoPresent,
  onArchiveIncomplete,
  onOverride,
  onMove,
  onOpenUniform,
}: {
  row: OrientationRoadieRowData;
  index: number;
  canManage: boolean;
  canPresent: boolean;
  canOverride: boolean;
  presentPending: boolean;
  onMarkPresent: (roadieId: RoadieId) => void;
  onUndoPresent: (roadieId: RoadieId) => void;
  onArchiveIncomplete: (roadieId: RoadieId) => void;
  onOverride: (roadieId: RoadieId) => void;
  onMove: (roadieId: RoadieId) => void;
  onOpenUniform: (roadieId: RoadieId) => void;
}) {
  const c = useOrientationCopy();
  const { t } = useI18n();
  const photoUrl = useMemo(() => refToDataUrl(row.photo), [row.photo]);
  const paperworkIncomplete =
    row.paperworkStatus === PaperworkStatus.incomplete;

  return (
    <li
      data-ocid={`orientation.roadie.item.${index + 1}`}
      className="rounded-lg border border-border bg-card p-3 shadow-subtle"
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          data-ocid={`orientation.roadie.open_button.${index + 1}`}
          onClick={() => onOpenUniform(row.roadieId)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left transition-smooth hover:bg-muted/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <span
            data-ocid={`orientation.roadie.photo.${index + 1}`}
            className="relative block h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-primary bg-[#F5F3EE]"
          >
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={row.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span
                className="flex h-full w-full items-center justify-center font-display text-lg font-bold uppercase tracking-wide text-[#14284B]"
                aria-hidden="true"
              >
                {initialsOf(row.name)}
              </span>
            )}
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="truncate font-display text-sm font-semibold uppercase tracking-wide text-foreground">
                {row.name}
              </span>
              {row.noShow && (
                <StatusBadge
                  tone="danger"
                  ocid={`orientation.roadie.no_show.${index + 1}`}
                >
                  {c.noShowTag}
                </StatusBadge>
              )}
            </span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {row.positionName || c.positionNone}
              {row.crewName ? ` · ${row.crewName}` : ` · ${c.crewNone}`}
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-1.5">
              <StatusBadge
                tone="hired"
                ocid={`orientation.roadie.stage.${index + 1}`}
              >
                {roadieStageLabel(row.stage, t)}
              </StatusBadge>
              {paperworkIncomplete ? (
                <StatusBadge
                  tone="pending"
                  ocid={`orientation.roadie.paperwork.${index + 1}`}
                >
                  {c.paperworkIncomplete}
                </StatusBadge>
              ) : (
                <StatusBadge
                  tone="hired"
                  ocid={`orientation.roadie.paperwork.${index + 1}`}
                >
                  {c.presentDone}
                </StatusBadge>
              )}
            </span>
          </span>
        </button>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {row.present ? (
            <Button
              type="button"
              variant="outline"
              className="touch-target"
              data-ocid={`orientation.roadie.undo_button.${index + 1}`}
              disabled={!canManage || presentPending}
              onClick={() => onUndoPresent(row.roadieId)}
            >
              <Undo2 className="mr-2 h-4 w-4" aria-hidden="true" />
              {c.undoButton}
            </Button>
          ) : paperworkIncomplete ? (
            <span
              data-ocid={`orientation.roadie.paperwork_warning.${index + 1}`}
              className="flex items-center gap-1.5 text-xs font-medium text-destructive"
            >
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              {c.paperworkIncomplete}
            </span>
          ) : (
            <Button
              type="button"
              className="touch-target min-w-[7rem]"
              data-ocid={`orientation.roadie.present_button.${index + 1}`}
              disabled={!canPresent || presentPending}
              onClick={() => onMarkPresent(row.roadieId)}
            >
              {presentPending ? (
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Check className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              {presentPending ? c.presentSaving : c.presentButton}
            </Button>
          )}
        </div>
      </div>

      {canManage && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          {paperworkIncomplete && !row.present && (
            <Button
              type="button"
              variant="destructive"
              className="touch-target"
              data-ocid={`orientation.roadie.archive_incomplete_button.${index + 1}`}
              onClick={() => onArchiveIncomplete(row.roadieId)}
            >
              {c.archiveIncomplete}
            </Button>
          )}
          {paperworkIncomplete && !row.present && canOverride && (
            <Button
              type="button"
              variant="outline"
              className="touch-target"
              data-ocid={`orientation.roadie.override_button.${index + 1}`}
              onClick={() => onOverride(row.roadieId)}
            >
              {c.overrideButton}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            className="touch-target"
            data-ocid={`orientation.roadie.move_button.${index + 1}`}
            onClick={() => onMove(row.roadieId)}
          >
            <MoveRight className="mr-2 h-4 w-4" aria-hidden="true" />
            {c.moveButton}
          </Button>
        </div>
      )}
    </li>
  );
}
