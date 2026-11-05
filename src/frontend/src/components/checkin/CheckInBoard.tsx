import type { EventId, Shift } from "@/backend";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { CheckInRowItem } from "@/components/checkin/CheckInRow";
import { useCheckInCopy } from "@/components/checkin/copy";
import { useCheckInBoard, useStoreInfo } from "@/hooks/useQueries";
import { Lock } from "lucide-react";

/**
 * The trainer check-in board for one shift: the "My group · <shift>" heading,
 * the checked-in count and lock state, and one row per roadie with photo, name
 * and Present / Late / Absent buttons. When the shift is past the trainer lock
 * window the board renders read-only with the "Locked: ask a manager to change."
 * message.
 */
export function CheckInBoard({
  eventId,
  shift,
  shiftLabel,
}: {
  eventId: EventId;
  shift: Shift;
  shiftLabel: string;
}) {
  const { t } = useCheckInCopy();
  const { data: storeInfo } = useStoreInfo();
  const {
    data: board,
    isLoading,
    isError,
    refetch,
  } = useCheckInBoard(eventId, shift);

  const timeZone = storeInfo?.timeZone ?? "UTC";

  return (
    <section className="space-y-4" data-ocid="today.checkIn.section">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide text-foreground">
            {t("today.myGroup.shift", { shift: shiftLabel })}
          </h2>
          {board && (
            <p
              data-ocid="today.checkIn.progress"
              className="mt-1 text-sm text-muted-foreground"
            >
              {t("today.checkIn.progress", {
                checkedIn: Number(board.checkedInCount),
                total: Number(board.totalCount),
              })}
            </p>
          )}
        </div>
        {board?.locked && (
          <span
            data-ocid="today.checkIn.locked"
            className="inline-flex items-center gap-1.5 rounded-full border border-[#B22234]/40 bg-[#B22234]/10 px-3 py-1 text-xs font-semibold text-[#B22234]"
          >
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            {t("checkIn.lockedMessage")}
          </span>
        )}
      </div>

      {isLoading && (
        <LoadingState
          label={t("today.loading")}
          ocid="today.checkIn.loading_state"
        />
      )}

      {isError && (
        <ErrorState
          message={t("today.error")}
          onRetry={() => void refetch()}
          ocid="today.checkIn.error_state"
        />
      )}

      {!isLoading && !isError && board && board.roadies.length === 0 && (
        <EmptyState
          title={t("today.checkIn.empty")}
          ocid="today.checkIn.empty_state"
        />
      )}

      {!isLoading && !isError && board && board.roadies.length > 0 && (
        <ul className="space-y-3" data-ocid="today.checkIn.list">
          {board.roadies.map((row, index) => (
            <CheckInRowItem
              key={row.roadieId.toString()}
              row={row}
              index={index}
              eventId={eventId}
              shift={shift}
              locked={board.locked}
              timeZone={timeZone}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
