import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { calculateRange, ensureCurrentLedger, getProfiles } from "@/lib/data";
import { APP_TIMEZONE, dayBounds, formatDateKey, nowLocal, weekBounds } from "@/lib/time";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const profiles = await getProfiles();
    const localNow = nowLocal();
    const { start: weekStart, end: weekEnd } = weekBounds(localNow);
    const { start: dayStart, end: dayEnd } = dayBounds(localNow);
    const supabase = supabaseAdmin();

    const summaries = await Promise.all(profiles.map(async (profile) => {
      const ledger = await ensureCurrentLedger(profile);
      const [weekRange, todayRange, activeResult] = await Promise.all([
        calculateRange(profile.id, weekStart, weekEnd),
        calculateRange(profile.id, dayStart, dayEnd),
        supabase.from("timer_sessions")
          .select("started_at")
          .eq("profile_id", profile.id)
          .is("ended_at", null)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      ]);
      if (activeResult.error) throw activeResult.error;

      const weekUsedSeconds = weekRange.sessionSeconds + weekRange.deductionMinutes * 60;
      const todayUsedSeconds = todayRange.sessionSeconds + todayRange.deductionMinutes * 60;
      const totalAvailableSeconds = (Number(ledger.opening_minutes) + weekRange.bonusMinutes) * 60;
      const remainingSeconds = Math.round(totalAvailableSeconds - weekUsedSeconds);
      const daysRemaining = Math.max(1, Math.ceil(weekEnd.diff(localNow, "days").days));

      return {
        id: profile.id,
        slug: profile.slug,
        name: profile.name,
        color: profile.color,
        avatarPath: profile.avatar_path,
        trackingEnabled: profile.tracking_enabled,
        weeklyAllowanceMinutes: profile.weekly_allowance_minutes,
        dailyLimitMinutes: profile.daily_limit_minutes,
        remainingSeconds,
        todayUsedSeconds: Math.round(todayUsedSeconds),
        weekUsedSeconds: Math.round(weekUsedSeconds),
        openingBalanceMinutes: Number(ledger.opening_minutes),
        rolloverMinutes: Number(ledger.carryover_minutes),
        bonusMinutes: weekRange.bonusMinutes,
        deductionMinutes: weekRange.deductionMinutes,
        activeSessionStartedAt: activeResult.data?.started_at || null,
        daysRemaining,
        suggestedDailySeconds: Math.max(0, Math.round(remainingSeconds / daysRemaining)),
        dailyLimitReached: todayUsedSeconds >= profile.daily_limit_minutes * 60
      };
    }));

    return NextResponse.json({
      serverNow: DateTime.now().toUTC().toISO(),
      weekStart: formatDateKey(weekStart),
      weekEnd: formatDateKey(weekEnd.minus({ days: 1 })),
      profiles: summaries
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not load screen-time data." }, { status: 500 });
  }
}
