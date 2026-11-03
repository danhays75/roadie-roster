import type { ArchiveReason, Roadie } from "@/backend";
import { RoadieStatus } from "@/backend";
import { StatusBadge } from "@/components/StatusBadge";
import { useRoadiePhoto } from "@/hooks/useQueries";
import { refToDataUrl, roadieStatusLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

/** The roadie's initials for the no-photo placeholder, at most two letters. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/** The badge tone for a roadie status: blue for hired/done, red for pending. */
function statusTone(status: RoadieStatus) {
  if (status === RoadieStatus.archived) return "muted" as const;
  if (status === RoadieStatus.needsMoreTime) return "pending" as const;
  return "hired" as const;
}

/** Human label for an archive reason, shown on a former roadie's tile. */
export function archiveReasonLabel(reason: ArchiveReason | undefined): string {
  if (!reason) return "Archived";
  switch (reason.__kind__) {
    case "noShow":
      return "No-show";
    case "quitDuringTraining":
      return "Quit during training";
    case "tookAnotherJob":
      return "Took another job";
    case "letGo":
      return "Let go";
    case "other":
      return reason.other || "Other";
    default:
      return "Archived";
  }
}

/**
 * A roadie's tile: the photo fills the top at roughly a 4:3 ratio with
 * `object-cover`, or the roadie's initials in navy on cream when no photo is
 * stored. Below the photo sit the name, a status badge, a crew tag when the
 * roadie has a crew, and a MINOR tag when the roadie is a minor. The tile is a
 * button so tapping it opens the shared card pop-up. A former roadie's tile is
 * grayscale and shows the archive reason instead of the status badge.
 */
export function RoadieTile({
  roadie,
  positionName,
  crewName,
  crewLabel,
  onOpen,
  ocid = "roadie.tile",
  statusOcid,
  photoOcid,
  className,
}: {
  roadie: Roadie;
  positionName?: string;
  crewName?: string;
  /**
   * When set, the crew tag always renders as `{crewLabel}: {crewName}` (with a
   * fallback value when the roadie has no crew). When omitted, the tag renders
   * only when the roadie has a crew.
   */
  crewLabel?: string;
  onOpen: (roadie: Roadie) => void;
  ocid?: string;
  statusOcid?: string;
  photoOcid?: string;
  className?: string;
}) {
  const { data: photo } = useRoadiePhoto(roadie.id);
  const photoUrl = useMemo(() => refToDataUrl(photo), [photo]);
  const name = roadie.profile.preferredName || roadie.profile.name;
  const isArchived = roadie.status === RoadieStatus.archived;

  return (
    <li data-ocid={ocid} className={cn("h-full", className)}>
      <button
        type="button"
        data-ocid={ocid ? `${ocid}.link` : undefined}
        onClick={() => onOpen(roadie)}
        className={cn(
          "group flex h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-card text-left shadow-subtle transition-smooth hover:-translate-y-0.5 hover:shadow-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          isArchived && "opacity-80 grayscale",
        )}
      >
        <span
          data-ocid={photoOcid}
          className="relative block aspect-[4/3] w-full overflow-hidden bg-[#F5F3EE]"
        >
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={name}
              className="h-full w-full object-cover"
            />
          ) : (
            <span
              className="flex h-full w-full items-center justify-center font-display text-3xl font-bold uppercase tracking-wide text-[#14284B]"
              aria-hidden="true"
            >
              {initialsOf(name)}
            </span>
          )}
          {roadie.isMinor && (
            <span
              data-ocid={ocid ? `${ocid}.minor` : undefined}
              className="absolute right-2 top-2 rounded-full bg-primary px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-wider text-primary-foreground"
            >
              Minor
            </span>
          )}
        </span>

        <span className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
          <span className="truncate font-display text-sm font-semibold uppercase tracking-wide text-foreground">
            {name}
          </span>
          {positionName && (
            <span className="truncate text-xs text-muted-foreground">
              {positionName}
            </span>
          )}
          <span className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
            {isArchived ? (
              <StatusBadge tone="muted" ocid={statusOcid}>
                {archiveReasonLabel(roadie.archivedReason)}
              </StatusBadge>
            ) : (
              <StatusBadge tone={statusTone(roadie.status)} ocid={statusOcid}>
                {roadieStatusLabel(roadie.status)}
              </StatusBadge>
            )}
            {(crewLabel || crewName) && (
              <span
                data-ocid={ocid ? `${ocid}.crew` : undefined}
                className="inline-flex max-w-full items-center truncate rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
              >
                {crewLabel ? `${crewLabel}: ${crewName ?? ""}` : crewName}
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}
