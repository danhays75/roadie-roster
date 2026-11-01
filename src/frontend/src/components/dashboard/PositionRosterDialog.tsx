import type { ArchiveReason, Position, Roadie } from "@/backend";
import { RoadieStatus } from "@/backend";
import { StatusBadge } from "@/components/StatusBadge";
import { StoreLogo } from "@/components/StoreLogo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateOnly, roadieStatusLabel } from "@/lib/format";
import { Loader2, RotateCcw, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { useDashboardCopy } from "./copy";
import { useRehireRoadie, useRosterForPosition } from "./hooks";

/** Human label for an archive reason. */
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

function RoadiePhotoCard({ roadie }: { roadie: Roadie }) {
  const name = roadie.profile.preferredName || roadie.profile.name;
  return (
    <li
      data-ocid="dashboard.roster.item"
      className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-3 text-center shadow-subtle"
    >
      <StoreLogo className="h-14 w-14" />
      <p className="w-full truncate font-display text-sm font-semibold uppercase tracking-wide text-foreground">
        {name}
      </p>
      <StatusBadge tone="hired">{roadieStatusLabel(roadie.status)}</StatusBadge>
    </li>
  );
}

function OpenSpotTile({ index }: { index: number }) {
  const { t } = useDashboardCopy();
  return (
    <li
      data-ocid={`dashboard.roster.open_spot.${index}`}
      className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 p-3 text-center"
    >
      <UserPlus className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
      <span className="font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {t("dashboard.roster.openSpot")}
      </span>
    </li>
  );
}

function ArchivedRow({
  roadie,
  canRehire,
}: {
  roadie: Roadie;
  canRehire: boolean;
}) {
  const { t } = useDashboardCopy();
  const rehire = useRehireRoadie();
  const [error, setError] = useState<string | null>(null);
  const name = roadie.profile.preferredName || roadie.profile.name;

  return (
    <li
      data-ocid="dashboard.roster.archived.item"
      className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/30 p-3"
    >
      <div className="min-w-0">
        <p className="truncate font-display text-sm font-semibold uppercase tracking-wide text-foreground">
          {name}
        </p>
        <p className="text-xs text-muted-foreground">
          {archiveReasonLabel(roadie.archivedReason)}
          {roadie.archivedAt !== undefined
            ? ` · ${formatDateOnly(roadie.archivedAt)}`
            : ""}
        </p>
        {error && (
          <p className="mt-1 text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
      {canRehire && (
        <Button
          type="button"
          variant="outline"
          className="touch-target"
          data-ocid="dashboard.roster.rehire_button"
          disabled={rehire.isPending}
          onClick={() => {
            setError(null);
            rehire.mutate(
              { id: roadie.id, reason: null },
              {
                onError: (err) =>
                  setError(
                    err instanceof Error
                      ? err.message
                      : t("dashboard.roster.rehireError"),
                  ),
              },
            );
          }}
        >
          {rehire.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
          )}
          {t("dashboard.roster.rehire")}
        </Button>
      )}
    </li>
  );
}

/**
 * The roster for one position: active photo cards, dashed open-spot tiles for
 * each still-needed hire, and an archived section with rehire for managers.
 */
export function PositionRosterDialog({
  position,
  open,
  onOpenChange,
  canRehire,
}: {
  position: Position | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canRehire: boolean;
}) {
  const { t } = useDashboardCopy();
  const {
    data: roster,
    isLoading,
    isError,
  } = useRosterForPosition(position?.id);

  const { active, archived } = useMemo(() => {
    const list = roster ?? [];
    return {
      active: list.filter((r) => r.status !== RoadieStatus.archived),
      archived: list.filter((r) => r.status === RoadieStatus.archived),
    };
  }, [roster]);

  const target = position ? Number(position.openingBuildTo) : 0;
  const openSpots = Math.max(0, target - active.length);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-ocid="dashboard.roster.dialog"
        className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-bold uppercase tracking-wide">
            {position?.name ?? t("dashboard.roster.title")}
          </DialogTitle>
          <DialogDescription>
            {t("dashboard.roster.summary", {
              onHand: active.length,
              target,
            })}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <p
            className="flex items-center gap-2 py-6 text-sm text-muted-foreground"
            data-ocid="dashboard.roster.loading_state"
          >
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {t("dashboard.roster.loading")}
          </p>
        )}

        {isError && (
          <p
            className="py-6 text-sm text-destructive"
            role="alert"
            data-ocid="dashboard.roster.error_state"
          >
            {t("dashboard.roster.error")}
          </p>
        )}

        {!isLoading && !isError && (
          <>
            {active.length === 0 && openSpots === 0 ? (
              <p
                className="py-6 text-sm text-muted-foreground"
                data-ocid="dashboard.roster.empty_state"
              >
                {t("dashboard.roster.empty")}
              </p>
            ) : (
              <ul
                className="grid grid-cols-2 gap-3 sm:grid-cols-3"
                data-ocid="dashboard.roster.list"
              >
                {active.map((roadie) => (
                  <RoadiePhotoCard key={roadie.id.toString()} roadie={roadie} />
                ))}
                {Array.from({ length: openSpots }, (_, i) => `open-${i}`).map(
                  (id, index) => (
                    <OpenSpotTile key={id} index={index + 1} />
                  ),
                )}
              </ul>
            )}

            {archived.length > 0 && (
              <section
                className="mt-2 space-y-2"
                data-ocid="dashboard.roster.archived.section"
              >
                <h3 className="font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">
                  {t("dashboard.roster.archivedTitle")}
                </h3>
                <ul className="space-y-2">
                  {archived.map((roadie) => (
                    <ArchivedRow
                      key={roadie.id.toString()}
                      roadie={roadie}
                      canRehire={canRehire}
                    />
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
