import {
  type CheckInRow,
  CheckInState,
  type EventId,
  type Shift,
} from "@/backend";
import { useCheckInCopy } from "@/components/checkin/copy";
import {
  storeTimeToTimestamp,
  timestampToStoreTime,
} from "@/components/checkin/time";
import { RoadiePhoto } from "@/components/roadie/RoadiePhoto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDemo } from "@/hooks/useDemo";
import { useRecordCheckIn, useStoreInfo } from "@/hooks/useQueries";
import { pretendDateToInstant } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Check, Clock, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

/** The three check-in choices, in display order. */
const CHOICES: Array<{
  state: CheckInState;
  labelKey: string;
  markKey: string;
  icon: typeof Check;
  activeClass: string;
}> = [
  {
    state: CheckInState.present,
    labelKey: "today.checkIn.present",
    markKey: "today.checkIn.markPresent",
    icon: Check,
    activeClass: "border-accent bg-accent text-accent-foreground",
  },
  {
    state: CheckInState.late,
    labelKey: "today.checkIn.late",
    markKey: "today.checkIn.markLate",
    icon: Clock,
    activeClass: "border-primary bg-primary text-primary-foreground",
  },
  {
    state: CheckInState.absent,
    labelKey: "today.checkIn.absent",
    markKey: "today.checkIn.markAbsent",
    icon: X,
    activeClass: "border-secondary bg-secondary text-secondary-foreground",
  },
];

/**
 * One roadie's row on the trainer check-in board: photo, name and three big
 * Present / Late / Absent buttons. Tapping Late records the tap time
 * automatically and reveals an editable time the trainer can adjust before or
 * after saving. The row is read-only when the board is locked.
 */
export function CheckInRowItem({
  row,
  index,
  eventId,
  shift,
  locked,
  timeZone,
}: {
  row: CheckInRow;
  index: number;
  eventId: EventId;
  shift: Shift;
  locked: boolean;
  timeZone: string;
}) {
  const { t } = useCheckInCopy();
  const record = useRecordCheckIn();
  const demo = useDemo();
  const { data: storeInfo } = useStoreInfo();
  const [error, setError] = useState<string | null>(null);
  const [lateTime, setLateTime] = useState<string>("");
  const [savedTime, setSavedTime] = useState<string | null>(null);

  // The instant a Late tap stands for: while demo mode is on with a pretend
  // date, that instant replaces the real clock so the recorded tap time follows
  // the pretend date.
  const now = useMemo(() => {
    if (demo.enabled && demo.pretendDate && storeInfo) {
      const instant = pretendDateToInstant(
        demo.pretendDate,
        storeInfo.timeZone,
        storeInfo.amShiftStart,
        storeInfo.pmShiftStart,
      );
      if (instant) return instant.getTime();
    }
    return Date.now();
  }, [demo.enabled, demo.pretendDate, storeInfo]);

  // Seed the editable late time from the stored value once per roadie, so a
  // refetch does not overwrite a time the trainer is mid-edit.
  useEffect(() => {
    if (row.state === CheckInState.late && row.lateAt !== undefined) {
      setLateTime(timestampToStoreTime(row.lateAt, timeZone) ?? "");
    }
  }, [row.state, row.lateAt, timeZone]);

  const stateLabel = row.state
    ? t(`today.checkIn.state.${row.state}`)
    : t("today.checkIn.state.none");

  const save = (state: CheckInState, lateAt?: bigint | null) => {
    setError(null);
    record.mutate(
      { eventId, shift, roadieId: row.roadieId, state, lateAt: lateAt ?? null },
      {
        onError: (err) =>
          setError(
            err instanceof Error ? err.message : t("today.checkIn.error"),
          ),
      },
    );
  };

  const onChoose = (state: CheckInState) => {
    if (locked || record.isPending) return;
    if (state === CheckInState.late) {
      // Record the tap time automatically, then let the trainer adjust it.
      const tapTime = BigInt(now) * 1_000_000n;
      setLateTime(timestampToStoreTime(tapTime, timeZone) ?? "");
      save(state, tapTime);
    } else {
      save(state);
    }
  };

  const onSaveTime = () => {
    if (locked || record.isPending) return;
    const base = row.lateAt ?? BigInt(now) * 1_000_000n;
    const adjusted = storeTimeToTimestamp(base, lateTime, timeZone);
    if (adjusted === null) {
      setError(t("checkIn.lateTimeInvalid"));
      return;
    }
    setError(null);
    record.mutate(
      {
        eventId,
        shift,
        roadieId: row.roadieId,
        state: CheckInState.late,
        lateAt: adjusted,
      },
      {
        onSuccess: () => setSavedTime(lateTime),
        onError: (err) =>
          setError(
            err instanceof Error ? err.message : t("today.checkIn.error"),
          ),
      },
    );
  };

  return (
    <li
      data-ocid={`today.checkIn.row.${index}`}
      className="rounded-lg border border-border bg-card p-3 shadow-subtle sm:p-4"
    >
      <div className="flex items-center gap-3">
        <RoadiePhoto
          id={row.roadieId}
          name={row.name}
          demoPhotoUrl={row.demoPhotoUrl}
          className="h-12 w-12 shrink-0"
          ocid={`today.checkIn.row.${index}.photo`}
          fallback={
            <span
              className="flex h-full w-full items-center justify-center font-display text-sm font-bold uppercase text-[#14284B]"
              aria-hidden="true"
            >
              {row.name.slice(0, 2).toUpperCase()}
            </span>
          }
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-semibold uppercase tracking-wide text-foreground">
            {row.name}
          </p>
          <p
            data-ocid={`today.checkIn.row.${index}.state`}
            className={cn(
              "mt-0.5 text-xs font-medium",
              row.state ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {stateLabel}
          </p>
        </div>
      </div>

      <fieldset className="mt-3 grid grid-cols-3 gap-2">
        <legend className="sr-only">
          {t("checkIn.rowLabel", { name: row.name, state: stateLabel })}
        </legend>
        {CHOICES.map((choice) => {
          const Icon = choice.icon;
          const active = row.state === choice.state;
          return (
            <Button
              key={choice.state}
              type="button"
              variant="outline"
              data-ocid={`today.checkIn.row.${index}.${choice.state}_button`}
              aria-pressed={active}
              aria-label={t(choice.markKey, { name: row.name })}
              disabled={locked || record.isPending}
              onClick={() => onChoose(choice.state)}
              className={cn(
                "touch-target h-12 justify-center gap-1.5 border-2 font-display text-xs font-bold uppercase tracking-wide",
                active
                  ? choice.activeClass
                  : "border-border bg-background text-foreground hover:border-primary/60",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {t(choice.labelKey)}
            </Button>
          );
        })}
      </fieldset>

      {row.state === CheckInState.late && (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-md border border-border bg-muted/40 p-2">
          <div className="min-w-0 flex-1">
            <Label
              htmlFor={`late-time-${index}`}
              className="text-xs text-muted-foreground"
            >
              {t("checkIn.lateTimeLabel")}
            </Label>
            <Input
              id={`late-time-${index}`}
              type="time"
              value={lateTime}
              disabled={locked || record.isPending}
              data-ocid={`today.checkIn.row.${index}.late_time_input`}
              onChange={(event) => {
                setLateTime(event.target.value);
                setSavedTime(null);
              }}
              className="mt-1 h-11 w-full max-w-[10rem]"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            data-ocid={`today.checkIn.row.${index}.late_time_save_button`}
            disabled={locked || record.isPending || lateTime === ""}
            onClick={onSaveTime}
            className="touch-target h-11"
          >
            {record.isPending ? (
              <Loader2
                className="h-4 w-4 motion-safe:animate-spin"
                aria-hidden="true"
              />
            ) : (
              t("checkIn.lateTimeSave")
            )}
          </Button>
          <p className="w-full text-xs text-muted-foreground">
            {savedTime ? t("checkIn.lateTimeSaved") : t("checkIn.lateTimeHint")}
          </p>
        </div>
      )}

      {error && (
        <p
          role="alert"
          data-ocid={`today.checkIn.row.${index}.error_state`}
          className="mt-2 text-xs text-destructive"
        >
          {error}
        </p>
      )}
    </li>
  );
}
