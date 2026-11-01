import type { TimeOfDay } from "@/backend";

const NS_PER_MINUTE = 60_000_000_000n;

/** Format a Motoko `TimeOfDay` (ns since midnight) as `HH:MM`. */
export function timeOfDayToInput(value: TimeOfDay): string {
  const totalMinutes = Number(value / NS_PER_MINUTE);
  if (!Number.isFinite(totalMinutes) || totalMinutes < 0) return "00:00";
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Parse an `HH:MM` input value into a Motoko `TimeOfDay` (ns since midnight). */
export function inputToTimeOfDay(value: string): TimeOfDay {
  const [hoursPart, minutesPart] = value.split(":");
  const hours = Number(hoursPart);
  const minutes = Number(minutesPart);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0n;
  return BigInt(hours * 60 + minutes) * NS_PER_MINUTE;
}

/** Format a `TimeOfDay` for display, e.g. `7:30 AM`. */
export function formatTimeOfDay(value: TimeOfDay): string {
  const totalMinutes = Number(value / NS_PER_MINUTE);
  if (!Number.isFinite(totalMinutes) || totalMinutes < 0) return "—";
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}
