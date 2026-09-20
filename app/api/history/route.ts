import { NextRequest, NextResponse } from "next/server";
import { DateTime } from "luxon";
import { calculateRange, ensureCurrentLedger, getProfiles } from "@/lib/data";
import { APP_TIMEZONE, formatDateKey, nowLocal, weekBounds } from "@/lib/time";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const profileId = new URL(req.url).searchParams.get("profileId");
    if (!profileId) return NextResponse.json({ error: "Missing profile." }, { status: 400 });
    const profiles = await getProfiles();
    const profile = profiles.find((p) => p.id === profileId);
    if (!profile) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    await ensureCurrentLedger(profile);

    const now = nowLocal();
    const { start: currentWeek } = weekBounds(now);
    const daily = [];
    for (let i = 0; i < 7; i++) {
      const start = currentWeek.plus({ days: i });
      const end = start.plus({ days: 1 });
      const r = await calculateRange(profileId, start, end);
      daily.push({
        date: formatDateKey(start),
        label: start.toFormat("ccc"),
        usedSeconds: Math.round(r.sessionSeconds + r.deductionMinutes * 60)
      });
    }

    const supabase = supabaseAdmin();
    const { data: ledgers, error: ledgerError } = await supabase
      .from("weekly_ledgers")
      .select("week_start,opening_minutes")
      .eq("profile_id", profileId)
      .order("week_start", { ascending: false })
      .limit(8);
    if (ledgerError) throw ledgerError;

    const weeks = [];
    for (const ledger of ledgers || []) {
      const start = DateTime.fromISO(ledger.week_start, { zone: APP_TIMEZONE }).startOf("day");
      const end = start.plus({ days: 7 });
      const r = await calculateRange(profileId, start, end);
      const usedMinutes = (r.sessionSeconds / 60) + r.deductionMinutes;
      weeks.push({
        weekStart: ledger.week_start,
        openingMinutes: Math.round(Number(ledger.opening_minutes)),
        usedMinutes: Math.round(usedMinutes),
        bonusMinutes: r.bonusMinutes,
        endingMinutes: Math.round(Number(ledger.opening_minutes) + r.bonusMinutes - usedMinutes)
      });
    }

    const activityStart = now.minus({ days: 30 }).startOf("day");
    const [sessionsResult, adjustmentsResult] = await Promise.all([
      supabase.from("timer_sessions")
        .select("id,started_at,ended_at")
        .eq("profile_id", profileId)
        .gte("started_at", activityStart.toUTC().toISO())
        .order("started_at", { ascending: false })
        .limit(30),
      supabase.from("adjustments")
        .select("id,kind,minutes,note,occurred_on,created_at")
        .eq("profile_id", profileId)
        .gte("occurred_on", formatDateKey(activityStart))
        .order("created_at", { ascending: false })
        .limit(30)
    ]);
    if (sessionsResult.error) throw sessionsResult.error;
    if (adjustmentsResult.error) throw adjustmentsResult.error;

    const activity = [
      ...(sessionsResult.data || []).map((s) => ({
        id: s.id,
        kind: "session" as const,
        occurredAt: s.started_at,
        minutes: s.ended_at ? Math.max(0, Math.round((DateTime.fromISO(s.ended_at).toMillis() - DateTime.fromISO(s.started_at).toMillis()) / 60000)) : 0,
        note: s.ended_at ? "Tracked screen time" : "Screen time active",
        editable: false
      })),
      ...(adjustmentsResult.data || []).map((a) => ({
        id: a.id,
        kind: a.kind as "bonus" | "deduction",
        occurredAt: a.created_at,
        minutes: a.minutes,
        note: a.note,
        editable: true
      }))
    ].sort((a, b) => DateTime.fromISO(b.occurredAt).toMillis() - DateTime.fromISO(a.occurredAt).toMillis()).slice(0, 25);

    return NextResponse.json({ daily, weeks, activity });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not load history." }, { status: 500 });
  }
}
