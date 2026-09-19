import { DateTime } from "luxon";

export const APP_TIMEZONE = process.env.APP_TIMEZONE || "America/Chicago";

export function nowLocal() {
  return DateTime.now().setZone(APP_TIMEZONE);
}

export function weekBounds(reference = nowLocal()) {
  const start = reference.startOf("week").startOf("day");
  const end = start.plus({ days: 7 });
  return { start, end };
}

export function dayBounds(reference = nowLocal()) {
  const start = reference.startOf("day");
  const end = start.plus({ days: 1 });
  return { start, end };
}

export function formatDateKey(dt: DateTime) {
  return dt.toFormat("yyyy-LL-dd");
}

export function overlapSeconds(
  startedAt: string,
  endedAt: string | null,
  rangeStart: DateTime,
  rangeEnd: DateTime,
  now = DateTime.now()
) {
  const sessionStart = DateTime.fromISO(startedAt);
  const sessionEnd = endedAt ? DateTime.fromISO(endedAt) : now;
  const startMs = Math.max(sessionStart.toMillis(), rangeStart.toMillis());
  const endMs = Math.min(sessionEnd.toMillis(), rangeEnd.toMillis());
  return Math.max(0, Math.floor((endMs - startMs) / 1000));
}
