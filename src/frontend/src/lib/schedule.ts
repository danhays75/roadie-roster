import { EventKind, type ScheduleEvent } from "@/backend";

/**
 * The schedule's "Paperwork due" deadline event, the single source of the
 * paperwork due date. Matches the `#deadline` event named "Paperwork due";
 * returns undefined when the schedule carries no such event, so the paperwork
 * window stays closed rather than reading a different deadline.
 */
export function paperworkDueEvent(
  events: ScheduleEvent[],
): ScheduleEvent | undefined {
  let named: ScheduleEvent | undefined;
  for (const event of events) {
    if (event.kind !== EventKind.deadline) continue;
    if (event.name !== "Paperwork due") continue;
    if (!named || event.start < named.start) named = event;
  }
  return named;
}
