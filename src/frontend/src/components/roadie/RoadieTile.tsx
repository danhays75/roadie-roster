import type {
  ArchiveReason,
  ChecklistItem,
  OrientationCheckoff,
  Position,
  Roadie,
  RoadieId,
  Timestamp,
} from "@/backend";
import { RoadieStatus, createActor } from "@/backend";
import { StatusBadge } from "@/components/StatusBadge";
import { useI18n } from "@/hooks/useI18n";
import {
  useChecklists,
  usePositions,
  useRoadiePhoto,
  useSchedule,
} from "@/hooks/useQueries";
import { refToDataUrl, roadieStageLabel } from "@/lib/format";
import { paperworkDueEvent } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import { useActor } from "@caffeineai/core-infrastructure";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

/** The roadie's initials for the no-photo placeholder, at most two letters. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
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
    case "ncnsOrientation":
      return "NCNS Orientation";
    case "paperworkIncomplete":
      return "Paperwork Incomplete";
    case "other":
      return reason.other || "Other";
    default:
      return "Archived";
  }
}

/**
 * Whether a roadie's paperwork is overdue: the schedule's "Paperwork due"
 * deadline has passed and at least one paperwork item that applies to them
 * (respecting "Only alcohol positions" and "Only under 18") is not checked.
 * Mirrors the backend's `paperworkStatusWith` so the flag matches the
 * orientation screen.
 */
export function paperworkIncomplete(
  roadie: Roadie,
  checkoff: OrientationCheckoff | null | undefined,
  paperworkItems: ChecklistItem[],
  position: Position | undefined,
  dueInstant: Timestamp | undefined,
  now: number,
): boolean {
  if (dueInstant === undefined) return false;
  if (now <= Number(dueInstant / 1_000_000n)) return false;
  const needsAlcohol = position?.needsAlcoholCert ?? false;
  const applicable = paperworkItems.filter(
    (item) =>
      (!item.requiresAlcoholCert || needsAlcohol) &&
      (!item.minorOnly || roadie.isMinor),
  );
  if (applicable.length === 0) return false;
  const checked = checkoff?.paperworkItems ?? [];
  return !applicable.every((item) => checked.includes(item.id.toString()));
}

/**
 * The paperwork-overdue flag for each roadie, keyed by roadie id. Reads the
 * schedule's "Paperwork due" deadline event, the paperwork checklist and the
 * positions, then fetches the orientation check-off for the roadies already
 * past the due date (the check-off read is Admin/Store Manager only, so callers
 * pass `enabled`). Returns an empty map for callers that may not read
 * check-offs.
 */
export function usePaperworkIncompleteMap(
  roadies: Roadie[],
  enabled: boolean,
): Map<string, boolean> {
  const { actor, isFetching } = useActor(createActor);
  const { data: schedule } = useSchedule();
  const { data: checklists } = useChecklists();
  const { data: positions } = usePositions();

  const dueInstant = useMemo(
    () => paperworkDueEvent(schedule ?? [])?.start,
    [schedule],
  );
  const now = Date.now();
  const pastDue = useMemo(
    () =>
      dueInstant === undefined || now <= Number(dueInstant / 1_000_000n)
        ? []
        : roadies,
    [roadies, dueInstant, now],
  );
  const ids = useMemo(() => pastDue.map((r) => r.id), [pastDue]);
  const idsKey = ids.map((id) => id.toString()).join(",");

  const { data: checkoffs } = useQuery({
    queryKey: ["orientationCheckoffs", idsKey],
    queryFn: async (): Promise<Map<string, OrientationCheckoff>> => {
      if (!actor) return new Map();
      const entries = await Promise.all(
        ids.map(async (id: RoadieId) => {
          const checkoff = await actor.getOrientationCheckoff(id);
          return [id.toString(), checkoff] as const;
        }),
      );
      const map = new Map<string, OrientationCheckoff>();
      for (const [key, checkoff] of entries) {
        if (checkoff) map.set(key, checkoff);
      }
      return map;
    },
    enabled: enabled && !!actor && !isFetching && ids.length > 0,
  });

  const positionMap = useMemo(() => {
    const map = new Map<string, Position>();
    for (const position of positions ?? []) {
      map.set(position.id.toString(), position);
    }
    return map;
  }, [positions]);

  return useMemo(() => {
    const flags = new Map<string, boolean>();
    if (!enabled || dueInstant === undefined) return flags;
    const items = checklists?.paperwork ?? [];
    for (const roadie of pastDue) {
      const key = roadie.id.toString();
      flags.set(
        key,
        paperworkIncomplete(
          roadie,
          checkoffs?.get(key),
          items,
          positionMap.get(roadie.mainPositionId.toString()),
          dueInstant,
          now,
        ),
      );
    }
    return flags;
  }, [enabled, dueInstant, pastDue, checkoffs, checklists, positionMap, now]);
}

/**
 * A roadie's tile: the photo fills the top at roughly a 4:3 ratio with
 * `object-cover`, or the roadie's initials in navy on cream when no photo is
 * stored. Below the photo sit the name, a single stage badge derived from the
 * backend's computed stage, a crew tag when the roadie has a crew, and a MINOR
 * tag when the roadie is a minor. The tile is a button so tapping it opens the
 * shared card pop-up. A former roadie's tile is grayscale and shows "Former"
 * instead of a stage badge. When `paperworkIncomplete` is set, a red "Paperwork
 * incomplete" flag is shown.
 */
export function RoadieTile({
  roadie,
  positionName,
  crewName,
  crewLabel,
  paperworkIncomplete: paperworkFlag,
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
  /** When true, show the red "Paperwork incomplete" flag on the tile. */
  paperworkIncomplete?: boolean;
  onOpen: (roadie: Roadie) => void;
  ocid?: string;
  statusOcid?: string;
  photoOcid?: string;
  className?: string;
}) {
  const { data: photo } = useRoadiePhoto(roadie.id);
  const { t } = useI18n();
  // A stored photo always wins; a record with no stored photo falls back to its
  // demo-only photo URL, which never touches real records.
  const photoUrl = useMemo(
    () => refToDataUrl(photo) ?? roadie.demoPhotoUrl ?? null,
    [photo, roadie.demoPhotoUrl],
  );
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
              className="h-full w-full object-cover object-top"
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
            <StatusBadge
              tone={isArchived ? "muted" : "hired"}
              ocid={statusOcid}
            >
              {isArchived
                ? t("roster.stage.former")
                : roadieStageLabel(roadie.stage, t)}
            </StatusBadge>
            {isArchived && roadie.archivedReason && (
              <StatusBadge
                tone="muted"
                ocid={ocid ? `${ocid}.archive_reason` : undefined}
              >
                {archiveReasonLabel(roadie.archivedReason)}
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
            {paperworkFlag && !isArchived && (
              <StatusBadge
                tone="danger"
                ocid={ocid ? `${ocid}.paperwork` : undefined}
              >
                Paperwork incomplete
              </StatusBadge>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}
