import { Shift, Weekday } from "@/backend";
import { WEEKDAY_ORDER } from "@/components/kiosk/KioskAvailabilityStep";
import type { KioskContact } from "@/components/kiosk/KioskContactStep";
import type { KioskDetails } from "@/components/kiosk/KioskDetailsStep";
import { useKioskCopy } from "@/components/kiosk/copy";

/** Review step: a read-only summary of everything the roadie entered. */
export function KioskReviewStep({
  details,
  contact,
  availability,
  hasPhoto,
  hasSignature,
}: {
  details: KioskDetails;
  contact: KioskContact;
  availability: Set<string>;
  hasPhoto: boolean;
  hasSignature: boolean;
}) {
  const t = useKioskCopy();

  const rows: Array<{ label: string; value: string }> = [
    { label: t("field.name"), value: details.name },
    {
      label: t("field.preferredName"),
      value: details.preferredName || t("common.none"),
    },
    {
      label: t("field.position"),
      value: details.positionAppliedFor,
    },
    {
      label: t("field.hometown"),
      value: details.hometown || t("common.none"),
    },
    {
      label: t("field.shirtSize"),
      value: details.shirtSize || t("common.none"),
    },
    {
      label: t("field.hatSize"),
      value: details.hatSize || t("common.none"),
    },
    {
      label: t("field.shiftsWanted"),
      value: details.shiftsWantedPerWeek || t("common.none"),
    },
    {
      label: t("field.weekdayLunch"),
      value:
        details.weekdayLunch === "yes"
          ? t("common.yes")
          : details.weekdayLunch === "no"
            ? t("common.no")
            : t("common.none"),
    },
    { label: t("field.email"), value: contact.email },
    { label: t("field.phone"), value: contact.phone },
    { label: t("field.dateOfBirth"), value: contact.dateOfBirth },
    {
      label: t("field.emergencyContact"),
      value: contact.emergencyContactName,
    },
    {
      label: t("field.emergencyPhone"),
      value: contact.emergencyContactPhone,
    },
    {
      label: t("field.hobbies"),
      value: details.hobbies || t("common.none"),
    },
    {
      label: t("field.favoriteMovie"),
      value: details.favoriteMovie || t("common.none"),
    },
    {
      label: t("field.favoriteSnack"),
      value: details.favoriteSnack || t("common.none"),
    },
    {
      label: t("field.funFact"),
      value: details.funFact || t("common.none"),
    },
    {
      label: t("field.goalHere"),
      value: details.goalHere || t("common.none"),
    },
  ];

  const availabilityLabel = WEEKDAY_ORDER.flatMap((day) =>
    ([Shift.am, Shift.pm] as Shift[])
      .filter((shift) => availability.has(`${day}-${shift}`))
      .map(
        (shift) =>
          `${t(`kiosk.weekday.${day}`)} ${
            shift === Shift.am ? t("availability.am") : t("availability.pm")
          }`,
      ),
  );

  return (
    <div className="space-y-6" data-ocid="kiosk.review_step">
      <div className="space-y-1">
        <h2 className="font-display text-2xl font-bold uppercase tracking-tight">
          {t("review.title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("review.body")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("review.photo")}
          </p>
          <p className="mt-1 text-sm text-foreground">
            {hasPhoto ? t("review.photoReady") : t("common.none")}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("review.signature")}
          </p>
          <p className="mt-1 text-sm text-foreground">
            {hasSignature ? t("review.signatureReady") : t("common.none")}
          </p>
        </div>
      </div>

      <dl className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
          >
            <dt className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {row.label}
            </dt>
            <dd className="break-words text-sm text-foreground sm:text-right">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="rounded-lg border border-border bg-card p-4">
        <p className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("availability.title")}
        </p>
        <p className="mt-2 text-sm text-foreground">
          {availabilityLabel.length > 0
            ? availabilityLabel.join(" · ")
            : t("availability.noneSelected")}
        </p>
      </div>
    </div>
  );
}
