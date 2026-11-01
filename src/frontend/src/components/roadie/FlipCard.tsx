import type { Crew, Position, Roadie } from "@/backend";
import { RoadieStatus } from "@/backend";
import { StatusBadge } from "@/components/StatusBadge";
import { StoreLogo } from "@/components/StoreLogo";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/hooks/useI18n";
import { dateOnlyToDate, roadieStatusLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ImageIcon, RotateCcw } from "lucide-react";
import { useState } from "react";

function statusTone(status: RoadieStatus) {
  if (status === RoadieStatus.archived) return "muted" as const;
  if (status === RoadieStatus.needsMoreTime) return "pending" as const;
  return "hired" as const;
}

/** Month and day only, e.g. "Mar 14". */
function formatBirthday(dateOnly: bigint | undefined): string | null {
  if (dateOnly === undefined) return null;
  const date = dateOnlyToDate(dateOnly);
  if (!date) return null;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function BackField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-display text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-sm text-foreground">{value}</dd>
    </div>
  );
}

/**
 * The roadie card. Front shows the photo, name, position, crew, position code,
 * logo and the opening-team line. Back shows the personal details, status
 * badges and the Minor badge when the roadie is under 18.
 */
export function FlipCard({
  roadie,
  position,
  secondPosition,
  crossTrainedPosition,
  crew,
  isMinor,
}: {
  roadie: Roadie;
  position: Position | undefined;
  secondPosition: Position | undefined;
  crossTrainedPosition: Position | undefined;
  crew: Crew | undefined;
  isMinor: boolean;
}) {
  const { t } = useI18n();
  const [flipped, setFlipped] = useState(false);
  const name = roadie.profile.preferredName || roadie.profile.name;
  const birthday = formatBirthday(roadie.contactSet?.dateOfBirth);
  const none = t("roadie.field.none");

  return (
    <div className="space-y-3" data-ocid="roadie.flip_card">
      <div
        className={cn(
          "relative w-full [perspective:1600px]",
          flipped ? "min-h-[26rem]" : "min-h-[24rem]",
        )}
      >
        <div
          className={cn(
            "relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d] motion-reduce:transition-none",
            flipped && "[transform:rotateY(180deg)]",
          )}
        >
          {/* Front */}
          <div
            aria-hidden={flipped}
            className={cn(
              "absolute inset-0 flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-subtle [backface-visibility:hidden]",
              flipped && "pointer-events-none",
            )}
          >
            <div className="flex items-center justify-between gap-3 bg-secondary px-4 py-3 text-secondary-foreground">
              <StoreLogo className="h-9 w-9" />
              <span className="font-display text-xs font-semibold uppercase tracking-widest">
                {t("roadie.openingTeam")}
              </span>
            </div>

            <div className="flex flex-1 flex-col items-center gap-4 p-6 text-center">
              <div className="flex h-40 w-40 items-center justify-center overflow-hidden rounded-full border-4 border-primary bg-muted">
                {roadie.photo ? (
                  <img
                    src={roadie.photo}
                    alt={name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImageIcon
                    className="h-12 w-12 text-muted-foreground"
                    aria-hidden="true"
                  />
                )}
              </div>

              <div className="min-w-0">
                <h2 className="break-words font-display text-2xl font-bold uppercase tracking-tight text-foreground">
                  {name}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {position?.name ?? none}
                </p>
              </div>

              <dl className="grid w-full grid-cols-2 gap-3 text-left">
                <BackField
                  label={t("roadie.field.crew")}
                  value={crew?.name ?? none}
                />
                <BackField
                  label={t("roadie.positionCode")}
                  value={position?.code ?? none}
                />
              </dl>

              <div className="mt-auto flex flex-wrap items-center justify-center gap-2">
                <StatusBadge tone={statusTone(roadie.status)}>
                  {roadieStatusLabel(roadie.status)}
                </StatusBadge>
                {isMinor && (
                  <StatusBadge tone="pending" ocid="roadie.minor_badge">
                    {t("roadie.minor")}
                  </StatusBadge>
                )}
              </div>
            </div>
          </div>

          {/* Back */}
          <div
            aria-hidden={!flipped}
            className={cn(
              "absolute inset-0 flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-subtle [backface-visibility:hidden] [transform:rotateY(180deg)]",
              !flipped && "pointer-events-none",
            )}
          >
            <div className="flex items-center justify-between gap-3 bg-secondary px-4 py-3 text-secondary-foreground">
              <span className="font-display text-xs font-semibold uppercase tracking-widest">
                {t("roadie.section.card")}
              </span>
              <StoreLogo className="h-8 w-8" />
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={statusTone(roadie.status)}>
                  {roadieStatusLabel(roadie.status)}
                </StatusBadge>
                {isMinor && (
                  <StatusBadge tone="pending">{t("roadie.minor")}</StatusBadge>
                )}
              </div>

              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <BackField
                  label={t("roadie.field.preferredName")}
                  value={roadie.profile.preferredName ?? none}
                />
                <BackField
                  label={t("roadie.field.hometown")}
                  value={roadie.profile.hometown ?? none}
                />
                <BackField
                  label={t("roadie.field.hobbies")}
                  value={roadie.profile.hobbies ?? none}
                />
                <BackField
                  label={t("roadie.field.favoriteMovie")}
                  value={roadie.profile.favoriteMovie ?? none}
                />
                <BackField
                  label={t("roadie.field.favoriteSnack")}
                  value={roadie.profile.favoriteSnack ?? none}
                />
                <BackField
                  label={t("roadie.field.funFact")}
                  value={roadie.profile.funFact ?? none}
                />
                <BackField
                  label={t("roadie.field.goalHere")}
                  value={roadie.profile.goalHere ?? none}
                />
                <BackField
                  label={t("roadie.field.birthday")}
                  value={birthday ?? none}
                />
                <BackField
                  label={t("roadie.field.orientation")}
                  value={
                    roadie.orientationEventId !== undefined
                      ? `#${roadie.orientationEventId.toString()}`
                      : none
                  }
                />
                <BackField
                  label={t("roadie.field.crossTrained")}
                  value={crossTrainedPosition?.name ?? none}
                />
                <BackField
                  label={t("roadie.field.secondPosition")}
                  value={secondPosition?.name ?? none}
                />
                <BackField
                  label={t("roadie.field.weekdayLunchShort")}
                  value={
                    roadie.profile.weekdayLunch === undefined
                      ? none
                      : roadie.profile.weekdayLunch
                        ? t("common.yes")
                        : t("common.no")
                  }
                />
              </dl>
            </div>
          </div>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className="touch-target w-full"
        data-ocid="roadie.flip_button"
        aria-pressed={flipped}
        onClick={() => setFlipped((value) => !value)}
      >
        <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
        {flipped ? t("roadie.action.flipBack") : t("roadie.action.flip")}
      </Button>
    </div>
  );
}
