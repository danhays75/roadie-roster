import { EventKind, type ScheduleEvent } from "@/backend";
import { DemoSettingsNote } from "@/components/DemoBanner";
import { StatusBadge } from "@/components/StatusBadge";
import { AdminSection, FormField } from "@/components/admin/FormField";
import { fill } from "@/components/admin/copy";
import { useAdminCopy } from "@/components/admin/useAdminCopy";
import {
  DEFAULT_TIME_ZONE,
  zonedWallTimeToDate,
} from "@/components/approvals/timeZone";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDemo } from "@/hooks/useDemo";
import {
  useCreateScheduleEvent,
  useDeleteScheduleEvent,
  useSchedule,
  useStoreInfo,
  useUpdateScheduleEvent,
} from "@/hooks/useQueries";
import { dateToTimestamp, formatTimestamp } from "@/lib/format";
import { CalendarPlus, Loader2, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

const EVENT_KINDS: EventKind[] = [
  EventKind.deadline,
  EventKind.orientation,
  EventKind.trainingDay,
  EventKind.friendsAndFamily,
  EventKind.openingDay,
  EventKind.signOff,
  EventKind.other,
];

interface EventDraft {
  id: bigint;
  kind: EventKind;
  name: string;
  start: string;
  end: string;
}

/**
 * A `datetime-local` value (`YYYY-MM-DDTHH:mm`) is a wall-clock time in the
 * store's time zone, so it is resolved to an instant in that zone rather than
 * the device's. Returns 0n for an empty or malformed value.
 */
function inputToDateTime(value: string, timeZone: string): bigint {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return 0n;
  const [, year, month, day, hour, minute] = match;
  const date = zonedWallTimeToDate(
    `${year}-${month}-${day}`,
    Number(hour),
    Number(minute),
    0,
    timeZone,
  );
  return Number.isNaN(date.getTime()) ? 0n : dateToTimestamp(date);
}

/**
 * A Motoko `DateTime` (ns) -> `datetime-local` value, rendered as the wall-clock
 * time in the store's time zone so the field reads the same on every device.
 */
function dateTimeToInput(value: bigint, timeZone: string): string {
  const date = new Date(Number(value / 1_000_000n));
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  // Some ICU builds render midnight as "24"; a datetime-local field expects 00.
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

export function SchedulePanel() {
  const c = useAdminCopy();
  const demo = useDemo();
  const schedule = useSchedule();
  const { data: storeInfo } = useStoreInfo();
  const timeZone = storeInfo?.timeZone || DEFAULT_TIME_ZONE;
  const create = useCreateScheduleEvent();
  const update = useUpdateScheduleEvent();
  const remove = useDeleteScheduleEvent();
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScheduleEvent | null>(null);

  // While demo mode is on the schedule edit controls are hidden: they change
  // real settings, which demo mode must not touch. The list stays readable.
  const readOnly = demo.enabled;

  const events = schedule.data ?? [];
  const isEditing = draft !== null && draft.id !== 0n;
  const mutation = isEditing ? update : create;

  // Training-day labels are derived from chronological order, so they renumber
  // automatically when a training day is added or removed.
  const trainingDayLabels = new Map<string, number>();
  events
    .filter((event) => event.kind === EventKind.trainingDay)
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))
    .forEach((event, index) => {
      trainingDayLabels.set(event.id.toString(), index + 1);
    });

  const set = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) => {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  };

  const openNew = () => {
    setDraft({
      id: 0n,
      kind: EventKind.trainingDay,
      name: "",
      start: "",
      end: "",
    });
  };

  const openEdit = (event: ScheduleEvent) => {
    setDraft({
      id: event.id,
      kind: event.kind,
      name: event.name,
      start: dateTimeToInput(event.start, timeZone),
      end: event.end !== undefined ? dateTimeToInput(event.end, timeZone) : "",
    });
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft || !draft.name.trim() || !draft.start) return;
    const payload: ScheduleEvent = {
      id: draft.id,
      kind: draft.kind,
      name: draft.name.trim(),
      start: inputToDateTime(draft.start, timeZone),
      end: draft.end ? inputToDateTime(draft.end, timeZone) : undefined,
    };
    mutation.mutate(payload, { onSuccess: () => setDraft(null) });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    remove.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
  };

  return (
    <AdminSection
      title={c.scheduleTitle}
      description={c.scheduleDescription}
      ocid="admin.schedule.section"
      action={
        readOnly ? undefined : (
          <Button
            type="button"
            className="touch-target"
            data-ocid="admin.schedule.add_button"
            onClick={openNew}
          >
            <CalendarPlus className="mr-2 h-4 w-4" aria-hidden="true" />
            {c.scheduleAdd}
          </Button>
        )
      }
    >
      {readOnly && <DemoSettingsNote />}
      {schedule.isLoading && (
        <p className="text-sm text-muted-foreground">{c.scheduleLoading}</p>
      )}
      {schedule.isError && (
        <p className="text-sm text-destructive">{c.scheduleError}</p>
      )}
      {!schedule.isLoading && !schedule.isError && events.length === 0 && (
        <p className="text-sm text-muted-foreground">{c.scheduleEmpty}</p>
      )}

      {events.length > 0 && (
        <ul className="space-y-2" data-ocid="admin.schedule.list">
          {[...events]
            .sort((a, b) =>
              a.start < b.start ? -1 : a.start > b.start ? 1 : 0,
            )
            .map((event) => {
              const trainingNumber = trainingDayLabels.get(event.id.toString());
              return (
                <li
                  key={event.id.toString()}
                  data-ocid="admin.schedule.item"
                  className="flex flex-col gap-3 rounded-md border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-sm font-semibold uppercase tracking-wide">
                        {event.name}
                      </span>
                      <StatusBadge tone="muted">
                        {c.scheduleKinds[event.kind]}
                      </StatusBadge>
                      {trainingNumber !== undefined && (
                        <StatusBadge tone="hired">
                          {fill(c.scheduleTrainingDayLabel, {
                            number: trainingNumber,
                          })}
                        </StatusBadge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatTimestamp(event.start, timeZone)}
                      {event.end !== undefined
                        ? ` – ${formatTimestamp(event.end, timeZone)}`
                        : ""}
                    </p>
                  </div>
                  {!readOnly && (
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="touch-target"
                        data-ocid="admin.schedule.edit_button"
                        onClick={() => openEdit(event)}
                      >
                        <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                        {c.actionEdit}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="touch-target text-destructive"
                        data-ocid="admin.schedule.delete_button"
                        onClick={() => setDeleteTarget(event)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                        {c.actionDelete}
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
        </ul>
      )}

      <Dialog
        open={draft !== null}
        onOpenChange={(open) => {
          if (!open) setDraft(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? c.scheduleEditTitle : c.scheduleAddTitle}
            </DialogTitle>
            <DialogDescription>{c.scheduleFormDescription}</DialogDescription>
          </DialogHeader>
          {draft && (
            <form onSubmit={onSubmit} className="space-y-4">
              <FormField label={c.scheduleName} htmlFor="event-name">
                <Input
                  id="event-name"
                  data-ocid="admin.schedule.name.input"
                  className="touch-target"
                  value={draft.name}
                  onChange={(event) => set("name", event.target.value)}
                />
              </FormField>
              <FormField label={c.scheduleKind} htmlFor="event-kind">
                <Select
                  value={draft.kind}
                  onValueChange={(value) => set("kind", value as EventKind)}
                >
                  <SelectTrigger
                    id="event-kind"
                    data-ocid="admin.schedule.kind.select"
                    className="touch-target"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_KINDS.map((kind) => (
                      <SelectItem key={kind} value={kind}>
                        {c.scheduleKinds[kind]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label={c.scheduleStart} htmlFor="event-start">
                  <Input
                    id="event-start"
                    type="datetime-local"
                    data-ocid="admin.schedule.start.input"
                    className="touch-target"
                    value={draft.start}
                    onChange={(event) => set("start", event.target.value)}
                  />
                </FormField>
                <FormField
                  label={c.scheduleEnd}
                  htmlFor="event-end"
                  hint={c.optional}
                >
                  <Input
                    id="event-end"
                    type="datetime-local"
                    data-ocid="admin.schedule.end.input"
                    className="touch-target"
                    value={draft.end}
                    onChange={(event) => set("end", event.target.value)}
                  />
                </FormField>
              </div>

              {mutation.isError && (
                <p
                  className="text-sm font-medium text-destructive"
                  data-ocid="admin.schedule.error_state"
                >
                  {c.scheduleSaveError}
                </p>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  className="touch-target"
                  data-ocid="admin.schedule.cancel_button"
                  onClick={() => setDraft(null)}
                >
                  {c.actionCancel}
                </Button>
                <Button
                  type="submit"
                  className="touch-target"
                  data-ocid="admin.schedule.save_button"
                  disabled={
                    mutation.isPending || !draft.name.trim() || !draft.start
                  }
                >
                  {mutation.isPending && (
                    <Loader2
                      className="mr-2 h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  )}
                  {c.actionSave}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{c.scheduleDeleteTitle}</DialogTitle>
            <DialogDescription>
              {fill(c.scheduleDeleteBody, { name: deleteTarget?.name ?? "" })}
            </DialogDescription>
          </DialogHeader>
          {remove.isError && (
            <p
              className="text-sm font-medium text-destructive"
              data-ocid="admin.schedule.delete_error_state"
            >
              {c.scheduleDeleteBlocked}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="touch-target"
              data-ocid="admin.schedule.delete_cancel_button"
              onClick={() => setDeleteTarget(null)}
            >
              {c.actionCancel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="touch-target"
              data-ocid="admin.schedule.delete_confirm_button"
              disabled={remove.isPending}
              onClick={confirmDelete}
            >
              {remove.isPending && (
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              )}
              {c.actionDelete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminSection>
  );
}
