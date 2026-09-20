import { DateTime } from "luxon";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { APP_TIMEZONE, formatDateKey, overlapSeconds, weekBounds } from "@/lib/time";

export type DbProfile = {
  id: string;
  slug: string;
  name: string;
  color: "blue" | "green" | "orange" | "gold" | "pink";
  avatar_path: string;
  weekly_allowance_minutes: number;
  daily_limit_minutes: number;
  rollover_cap_minutes: number;
  weekly_start_cap_minutes: number;
  tracking_enabled: boolean;
  sort_order: number;
};

async function getSessionsOverlapping(profileId: string, start: DateTime, end: DateTime) {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("timer_sessions")
    .select("id,started_at,ended_at")
    .eq("profile_id", profileId)
    .lt("started_at", end.toUTC().toISO())
    .or(`ended_at.is.null,ended_at.gt.${start.toUTC().toISO()}`);
  if (error) throw error;
  return data || [];
}

async function getAdjustments(profileId: string, start: DateTime, end: DateTime) {
  const supabase = supabaseAdmin();
  const startKey = formatDateKey(start.setZone(APP_TIMEZONE));
  const endKey = formatDateKey(end.setZone(APP_TIMEZONE));
  const { data, error } = await supabase
    .from("adjustments")
    .select("id,kind,minutes,note,occurred_on,created_at")
    .eq("profile_id", profileId)
    .gte("occurred_on", startKey)
    .lt("occurred_on", endKey)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function calculateRange(profileId: string, start: DateTime, end: DateTime) {
  const now = DateTime.now();
  const [sessions, adjustments] = await Promise.all([
    getSessionsOverlapping(profileId, start, end),
    getAdjustments(profileId, start, end)
  ]);
  const sessionSeconds = sessions.reduce(
    (sum, s) => sum + overlapSeconds(s.started_at, s.ended_at, start, end, now),
    0
  );
  const bonusMinutes = adjustments
    .filter((a) => a.kind === "bonus")
    .reduce((sum, a) => sum + a.minutes, 0);
  const deductionMinutes = adjustments
    .filter((a) => a.kind === "deduction")
    .reduce((sum, a) => sum + a.minutes, 0);
  return { sessions, adjustments, sessionSeconds, bonusMinutes, deductionMinutes };
}

async function calculateWeekEnding(profileId: string, weekStart: DateTime, openingMinutes: number) {
  const end = weekStart.plus({ days: 7 });
  const range = await calculateRange(profileId, weekStart, end);
  return openingMinutes + range.bonusMinutes - range.deductionMinutes - range.sessionSeconds / 60;
}

export async function ensureCurrentLedger(profile: DbProfile) {
  const supabase = supabaseAdmin();
  const { start: currentStart } = weekBounds();
  const currentKey = formatDateKey(currentStart);

  const { data: existing, error: existingError } = await supabase
    .from("weekly_ledgers")
    .select("*")
    .eq("profile_id", profile.id)
    .eq("week_start", currentKey)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return existing;

  const { data: latest, error: latestError } = await supabase
    .from("weekly_ledgers")
    .select("*")
    .eq("profile_id", profile.id)
    .lt("week_start", currentKey)
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) throw latestError;

  if (!latest) {
    const opening = Math.min(profile.weekly_allowance_minutes, profile.weekly_start_cap_minutes);
    const row = {
      profile_id: profile.id,
      week_start: currentKey,
      base_minutes: profile.weekly_allowance_minutes,
      carryover_minutes: 0,
      opening_minutes: opening
    };
    const { data, error } = await supabase.from("weekly_ledgers").insert(row).select("*").single();
    if (error) throw error;
    return data;
  }

  let previousStart = DateTime.fromISO(latest.week_start, { zone: APP_TIMEZONE }).startOf("day");
  let previousOpening = Number(latest.opening_minutes);
  let cursor = previousStart.plus({ days: 7 });
  let created = latest;

  while (cursor <= currentStart) {
    const previousEnding = await calculateWeekEnding(profile.id, previousStart, previousOpening);
    const carryover = previousEnding > 0
      ? Math.min(previousEnding, profile.rollover_cap_minutes)
      : previousEnding;
    const rawOpening = profile.weekly_allowance_minutes + carryover;
    const opening = Math.min(rawOpening, profile.weekly_start_cap_minutes);
    const row = {
      profile_id: profile.id,
      week_start: formatDateKey(cursor),
      base_minutes: profile.weekly_allowance_minutes,
      carryover_minutes: Math.round(carryover * 100) / 100,
      opening_minutes: Math.round(opening * 100) / 100
    };
    const { data, error } = await supabase
      .from("weekly_ledgers")
      .upsert(row, { onConflict: "profile_id,week_start" })
      .select("*")
      .single();
    if (error) throw error;
    created = data;
    previousStart = cursor;
    previousOpening = Number(created.opening_minutes);
    cursor = cursor.plus({ days: 7 });
  }
  return created;
}

export async function getProfiles(): Promise<DbProfile[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from("profiles").select("*").order("sort_order");
  if (error) throw error;
  return (data || []) as DbProfile[];
}
