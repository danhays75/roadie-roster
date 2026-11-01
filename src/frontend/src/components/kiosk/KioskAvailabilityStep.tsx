import { Shift, Weekday } from "@/backend";
import { useKioskCopy } from "@/components/kiosk/copy";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

/** The kiosk availability grid order: Wednesday through Tuesday. */
export const WEEKDAY_ORDER: Weekday[] = [
  Weekday.wed,
  Weekday.thu,
  Weekday.fri,
  Weekday.sat,
  Weekday.sun,
  Weekday.mon,
  Weekday.tue,
];

const SHIFTS: Shift[] = [Shift.am, Shift.pm];

/** A stable key for one availability cell. */
export function slotKey(day: Weekday, shift: Shift): string {
  return `${day}-${shift}`;
}

/** Availability step: a Wed–Tue × AM/PM toggle grid. */
export function KioskAvailabilityStep({
  selected,
  onToggle,
  error,
}: {
  selected: Set<string>;
  onToggle: (day: Weekday, shift: Shift) => void;
  error?: string;
}) {
  const t = useKioskCopy();

  return (
    <div className="space-y-6" data-ocid="kiosk.availability_step">
      <div className="space-y-1">
        <h2 className="font-display text-2xl font-bold uppercase tracking-tight">
          {t("availability.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("availability.body")}
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{t("availability.title")}</caption>
          <thead>
            <tr className="bg-secondary text-secondary-foreground">
              <th
                scope="col"
                className="px-3 py-3 text-left font-display text-xs font-semibold uppercase tracking-wider"
              >
                {t("availability.day")}
              </th>
              {SHIFTS.map((shift) => (
                <th
                  key={shift}
                  scope="col"
                  className="px-3 py-3 text-center font-display text-xs font-semibold uppercase tracking-wider"
                >
                  {shift === Shift.am
                    ? t("availability.am")
                    : t("availability.pm")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {WEEKDAY_ORDER.map((day, index) => (
              <tr
                key={day}
                className={cn(
                  "border-t border-border",
                  index % 2 === 1 && "bg-muted/30",
                )}
              >
                <th
                  scope="row"
                  className="px-3 py-2 text-left font-display text-sm font-medium uppercase tracking-wide text-foreground"
                >
                  {t(`kiosk.weekday.${day}`)}
                </th>
                {SHIFTS.map((shift) => {
                  const key = slotKey(day, shift);
                  const active = selected.has(key);
                  return (
                    <td key={shift} className="px-2 py-2 text-center">
                      <button
                        type="button"
                        data-ocid={`kiosk.availability.${day}.${shift}`}
                        aria-pressed={active}
                        aria-label={`${t(`kiosk.weekday.${day}`)} ${
                          shift === Shift.am
                            ? t("availability.am")
                            : t("availability.pm")
                        }`}
                        onClick={() => onToggle(day, shift)}
                        className={cn(
                          "touch-target mx-auto flex h-11 w-full max-w-24 items-center justify-center gap-1.5 rounded-md border font-display text-xs font-semibold uppercase tracking-wider transition-colors",
                          active
                            ? "border-accent bg-accent text-accent-foreground"
                            : "border-input bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        {active && (
                          <Check className="h-4 w-4" aria-hidden="true" />
                        )}
                        {active
                          ? t("availability.available")
                          : t("availability.unavailable")}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-muted-foreground">
        {t("availability.selected", { count: selected.size })}
      </p>

      {error && (
        <p
          role="alert"
          data-ocid="kiosk.availability.error_state"
          className="text-sm font-medium text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}
