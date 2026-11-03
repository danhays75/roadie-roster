import type { OrientationSessionOption } from "@/backend";
import { useOrientationCopy } from "@/components/orientation/copy";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useMoveRoadieToSession,
  useUnassignedPendingRoadies,
} from "@/hooks/useQueries";
import { formatTimestamp, refToDataUrl } from "@/lib/format";
import { Loader2, MoveRight, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

/** The roadie's initials for the no-photo placeholder, at most two letters. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/**
 * The next upcoming orientation session: the soonest one whose start is at or
 * after now, otherwise the most recent past session. Returns undefined when
 * there are no sessions at all.
 */
function nextSessionId(
  sessions: OrientationSessionOption[],
  now: number,
): string {
  if (sessions.length === 0) return "";
  const upcoming = sessions.find(
    (session) => Number(session.start / 1_000_000n) >= now,
  );
  if (upcoming) return upcoming.eventId.toString();
  return sessions[sessions.length - 1].eventId.toString();
}

/**
 * The Unassigned section of the orientation screen: pending roadies with no
 * valid session, each with an Assign to session control defaulting to the next
 * upcoming session, plus an Assign all control. Visible to orientation staff;
 * the assign controls are manager-only, matching the per-row move control.
 */
export function UnassignedSection({
  sessions,
  timeZone,
  canManage,
  enabled,
}: {
  sessions: OrientationSessionOption[];
  timeZone: string;
  canManage: boolean;
  enabled: boolean;
}) {
  const c = useOrientationCopy();
  const { data, isLoading, isError, refetch } =
    useUnassignedPendingRoadies(enabled);
  const moveOne = useMoveRoadieToSession();

  const roadies = useMemo(() => data ?? [], [data]);

  // The default target for every assign control: the next upcoming session.
  const defaultTarget = useMemo(
    () => nextSessionId(sessions, Date.now()),
    [sessions],
  );

  // Per-row target overrides, keyed by roadie id. A row with no override uses
  // the default target.
  const [targets, setTargets] = useState<Record<string, string>>({});

  // Drop overrides for roadies that are no longer listed (they were assigned).
  useEffect(() => {
    setTargets((current) => {
      const listed = new Set(roadies.map((row) => row.roadieId.toString()));
      const keys = Object.keys(current);
      if (keys.every((key) => listed.has(key))) return current;
      const next: Record<string, string> = {};
      for (const [key, value] of Object.entries(current)) {
        if (listed.has(key)) next[key] = value;
      }
      return next;
    });
  }, [roadies]);

  const targetFor = (roadieId: string) => targets[roadieId] ?? defaultTarget;

  const onAssign = (roadieId: bigint) => {
    const target = targetFor(roadieId.toString());
    if (!target) return;
    moveOne.mutate({ roadieId, eventId: BigInt(target) });
  };

  // Assign every listed roadie to the next upcoming session. The backend's
  // bulk move only relocates roadies already attached to a source session, so
  // each unassigned roadie is assigned through the per-roadie move, which is
  // the operation that attaches a session to a roadie with none.
  const onAssignAll = () => {
    if (!defaultTarget) return;
    const eventId = BigInt(defaultTarget);
    for (const row of roadies) {
      moveOne.mutate({ roadieId: row.roadieId, eventId });
    }
  };

  const assignAllLabel = defaultTarget
    ? (() => {
        const session = sessions.find(
          (option) => option.eventId.toString() === defaultTarget,
        );
        return session
          ? c.unassignedAssignAll.replace("{session}", session.name)
          : c.unassignedAssign;
      })()
    : c.unassignedAssign;

  return (
    <section
      data-ocid="orientation.unassigned.section"
      className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-subtle"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-display text-sm font-bold uppercase tracking-widest text-foreground">
            {c.unassignedTitle}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {c.unassignedHint}
          </p>
        </div>
        {canManage && (
          <Button
            type="button"
            className="touch-target shrink-0"
            data-ocid="orientation.unassigned.assign_all_button"
            disabled={
              roadies.length === 0 || !defaultTarget || moveOne.isPending
            }
            onClick={onAssignAll}
          >
            {moveOne.isPending ? (
              <Loader2
                className="mr-2 h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            {moveOne.isPending ? c.unassignedAssigning : assignAllLabel}
          </Button>
        )}
      </div>

      {isLoading && (
        <p
          data-ocid="orientation.unassigned.loading_state"
          className="text-sm text-muted-foreground"
        >
          {c.unassignedLoading}
        </p>
      )}

      {isError && (
        <div
          data-ocid="orientation.unassigned.error_state"
          className="flex items-center gap-3"
        >
          <span role="alert" className="text-sm text-destructive">
            {c.unassignedError}
          </span>
          <Button
            type="button"
            variant="outline"
            className="touch-target"
            data-ocid="orientation.unassigned.retry_button"
            onClick={() => void refetch()}
          >
            {c.confirm}
          </Button>
        </div>
      )}

      {!isLoading && !isError && roadies.length === 0 && (
        <p
          data-ocid="orientation.unassigned.empty_state"
          className="text-sm text-muted-foreground"
        >
          {c.unassignedEmpty}
        </p>
      )}

      {!isLoading && !isError && roadies.length > 0 && (
        <ul className="space-y-3" data-ocid="orientation.unassigned.list">
          {roadies.map((row, index) => {
            const key = row.roadieId.toString();
            const target = targetFor(key);
            const photoUrl = refToDataUrl(row.photo);
            const pending =
              moveOne.isPending && moveOne.variables?.roadieId === row.roadieId;
            return (
              <li
                key={key}
                data-ocid={`orientation.unassigned.item.${index + 1}`}
                className="rounded-lg border border-border bg-background p-3"
              >
                <div className="flex items-start gap-3">
                  <span
                    data-ocid={`orientation.unassigned.photo.${index + 1}`}
                    className="relative block h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-primary bg-[#F5F3EE]"
                  >
                    {photoUrl ? (
                      <img
                        src={photoUrl}
                        alt={row.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span
                        className="flex h-full w-full items-center justify-center font-display text-base font-bold uppercase tracking-wide text-[#14284B]"
                        aria-hidden="true"
                      >
                        {initialsOf(row.name)}
                      </span>
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-sm font-semibold uppercase tracking-wide text-foreground">
                      {row.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {row.positionName || c.positionNone}
                      {row.crewName ? ` · ${row.crewName}` : ` · ${c.crewNone}`}
                    </p>
                  </div>
                </div>

                {canManage && (
                  <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center">
                    <Select
                      value={target}
                      onValueChange={(value) =>
                        setTargets((current) => ({ ...current, [key]: value }))
                      }
                    >
                      <SelectTrigger
                        data-ocid={`orientation.unassigned.session_select.${index + 1}`}
                        className="touch-target w-full sm:max-w-xs"
                        aria-label={c.unassignedAssign}
                      >
                        <SelectValue placeholder={c.sessionPlaceholder} />
                      </SelectTrigger>
                      <SelectContent>
                        {sessions.map((session) => (
                          <SelectItem
                            key={session.eventId.toString()}
                            value={session.eventId.toString()}
                          >
                            {session.name} ·{" "}
                            {formatTimestamp(session.start, timeZone)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      className="touch-target shrink-0"
                      data-ocid={`orientation.unassigned.assign_button.${index + 1}`}
                      disabled={!target || pending}
                      onClick={() => onAssign(row.roadieId)}
                    >
                      {pending ? (
                        <Loader2
                          className="mr-2 h-4 w-4 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <MoveRight
                          className="mr-2 h-4 w-4"
                          aria-hidden="true"
                        />
                      )}
                      {pending ? c.unassignedAssigning : c.unassignedAssign}
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
