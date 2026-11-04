import { useGroupsCopy } from "@/components/groups/copy";
import { TriangleAlert } from "lucide-react";

/**
 * The yellow, never-blocking warnings banner. It lists the count of active
 * roadies unassigned, any trainer over capacity, and roadies scheduled while
 * unavailable. It renders nothing when there are no warnings, and never blocks
 * the board.
 */
export function WarningsBanner({
  unassignedCount,
  overCapacityCount,
  unavailableCount,
}: {
  unassignedCount: number;
  overCapacityCount: number;
  unavailableCount: number;
}) {
  const { t } = useGroupsCopy();
  const total = unassignedCount + overCapacityCount + unavailableCount;
  if (total === 0) return null;

  return (
    <section
      data-ocid="groups.warnings.banner"
      aria-label={t("groups.board.warningsTitle")}
      className="rounded-lg border border-[oklch(0.75_0.14_85)] bg-[oklch(0.96_0.06_90)] p-3 text-[oklch(0.35_0.08_85)]"
    >
      <p className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide">
        <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
        {t("groups.board.warningsTitle")}
      </p>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {unassignedCount > 0 && (
          <li data-ocid="groups.warnings.unassigned">
            {t("groups.warnings.unassigned", { count: unassignedCount })}
          </li>
        )}
        {overCapacityCount > 0 && (
          <li data-ocid="groups.warnings.over_capacity">
            {t("groups.warnings.overCapacity", { count: overCapacityCount })}
          </li>
        )}
        {unavailableCount > 0 && (
          <li data-ocid="groups.warnings.unavailable">
            {t("groups.warnings.unavailable", { count: unavailableCount })}
          </li>
        )}
      </ul>
    </section>
  );
}
