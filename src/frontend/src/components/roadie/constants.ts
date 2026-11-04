import { RoadieStatus, Shift, Weekday } from "@/backend";

/** Phase 1 only surfaces these statuses; later phases add the rest. */
export const PHASE_ONE_STATUSES: RoadieStatus[] = [
  RoadieStatus.hired,
  RoadieStatus.paperworkDone,
  RoadieStatus.archived,
];

/** Archive reasons offered when moving a roadie out of the roster. */
export const ARCHIVE_REASONS = [
  { value: "noShow", labelKey: "roadie.reason.noShow" },
  { value: "quitDuringTraining", labelKey: "roadie.reason.quitDuringTraining" },
  { value: "tookAnotherJob", labelKey: "roadie.reason.tookAnotherJob" },
  { value: "letGo", labelKey: "roadie.reason.letGo" },
  { value: "other", labelKey: "roadie.reason.other" },
] as const;

export type ArchiveReasonValue = (typeof ARCHIVE_REASONS)[number]["value"];

/** Reasons that require a warning and a mandatory reason on rehire. */
export const REHIRE_WARN_REASONS: ArchiveReasonValue[] = ["noShow", "letGo"];

/** Weekday display order and copy keys. */
export const WEEKDAYS: { value: Weekday; labelKey: string }[] = [
  { value: Weekday.mon, labelKey: "roadie.weekday.mon" },
  { value: Weekday.tue, labelKey: "roadie.weekday.tue" },
  { value: Weekday.wed, labelKey: "roadie.weekday.wed" },
  { value: Weekday.thu, labelKey: "roadie.weekday.thu" },
  { value: Weekday.fri, labelKey: "roadie.weekday.fri" },
  { value: Weekday.sat, labelKey: "roadie.weekday.sat" },
  { value: Weekday.sun, labelKey: "roadie.weekday.sun" },
];

/** Shift display order and copy keys. */
export const SHIFTS: { value: Shift; labelKey: string }[] = [
  { value: Shift.am, labelKey: "roadie.shift.am" },
  { value: Shift.pm, labelKey: "roadie.shift.pm" },
];

/** Human label for an archive reason value. */
export function archiveReasonLabel(
  reason: ArchiveReasonValue,
  t: (key: string) => string,
): string {
  const match = ARCHIVE_REASONS.find((item) => item.value === reason);
  return match ? t(match.labelKey) : reason;
}

/**
 * The shared uniform size vocabulary. Shirt sizes run XS through 3XL and hat
 * sizes are One size, S/M and L/XL, matching the kiosk and staff profile
 * vocabulary so a size chosen anywhere is understood everywhere.
 */
export const SHIRT_SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL"] as const;

export const HAT_SIZES = ["One size", "S/M", "L/XL"] as const;

export type ShirtSizeValue = (typeof SHIRT_SIZES)[number];
export type HatSizeValue = (typeof HAT_SIZES)[number];
