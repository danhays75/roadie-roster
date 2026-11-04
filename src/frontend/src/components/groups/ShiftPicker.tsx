import { Shift } from "@/backend";
import { useGroupsCopy } from "@/components/groups/copy";
import type { ShiftOption } from "@/components/groups/shiftOptions";
import { shiftOptionDayLabel } from "@/components/groups/shiftOptions";
import { cn } from "@/lib/utils";

/**
 * The shift picker: a row of day chips (Training Day 1-4, Friends & Family
 * nights) plus an AM/PM toggle. Friends & Family nights are PM only, so their
 * chip disables AM. The selected chip and shift are highlighted.
 */
export function ShiftPicker({
  options,
  selected,
  onSelect,
}: {
  options: ShiftOption[];
  selected: ShiftOption | undefined;
  onSelect: (option: ShiftOption) => void;
}) {
  const { t } = useGroupsCopy();

  // One chip per event, in schedule order. A training day has both AM and PM
  // options; a Friends & Family night has only PM.
  const events: {
    eventId: bigint;
    label: string;
    am?: ShiftOption;
    pm?: ShiftOption;
  }[] = [];
  for (const option of options) {
    const existing = events.find((event) => event.eventId === option.eventId);
    const label = shiftOptionDayLabel(option, t);
    if (existing) {
      if (option.shift === Shift.am) existing.am = option;
      else existing.pm = option;
    } else {
      events.push({
        eventId: option.eventId,
        label,
        am: option.shift === Shift.am ? option : undefined,
        pm: option.shift === Shift.pm ? option : undefined,
      });
    }
  }

  if (options.length === 0) {
    return (
      <p
        data-ocid="groups.shift.empty_state"
        className="text-sm text-muted-foreground"
      >
        {t("groups.board.noShifts")}
      </p>
    );
  }

  return (
    <div
      data-ocid="groups.shift.picker"
      aria-label={t("groups.board.shiftPickerLabel")}
      className="space-y-3"
    >
      <div className="flex flex-wrap gap-2">
        {events.map((event) => {
          const isSelected = selected?.eventId === event.eventId;
          const target = event.am ?? event.pm;
          return (
            <button
              key={event.eventId.toString()}
              type="button"
              data-ocid={`groups.shift.day.${event.eventId}`}
              aria-pressed={isSelected}
              onClick={() => {
                if (target) onSelect(target);
              }}
              className={cn(
                "touch-target rounded-full border px-4 py-2 font-display text-sm font-semibold uppercase tracking-wide transition-smooth focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:border-primary/50",
              )}
            >
              {event.label}
            </button>
          );
        })}
      </div>

      <fieldset
        aria-label={t("groups.board.shiftPickerLabel")}
        className="inline-flex overflow-hidden rounded-full border border-border bg-card"
      >
        {[Shift.am, Shift.pm].map((shift) => {
          const option = selected
            ? options.find(
                (candidate) =>
                  candidate.eventId === selected.eventId &&
                  candidate.shift === shift,
              )
            : undefined;
          const disabled = !option;
          const isSelected = selected?.shift === shift && !disabled;
          return (
            <button
              key={shift}
              type="button"
              data-ocid={`groups.shift.${shift}`}
              aria-pressed={isSelected}
              disabled={disabled}
              title={
                disabled ? t("groups.board.friendsFamilyPmOnly") : undefined
              }
              onClick={() => {
                if (option) onSelect(option);
              }}
              className={cn(
                "touch-target px-5 py-2 font-display text-sm font-semibold uppercase tracking-wide transition-smooth focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted",
                disabled &&
                  "cursor-not-allowed opacity-40 hover:bg-transparent",
              )}
            >
              {shift === Shift.am
                ? t("groups.board.shiftAm")
                : t("groups.board.shiftPm")}
            </button>
          );
        })}
      </fieldset>
    </div>
  );
}
