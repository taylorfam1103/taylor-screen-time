import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { ensureCurrentLedger } from "@/lib/data";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Parent mode required." }, { status: 401 });
  try {
    const body = await req.json();
    const profileId = String(body.profileId || "");
    const weekly = Math.max(0, Math.min(7 * 24 * 60, Math.round(Number(body.weeklyAllowanceMinutes))));
    const daily = Math.max(15, Math.min(24 * 60, Math.round(Number(body.dailyLimitMinutes))));
    const enabled = Boolean(body.trackingEnabled);
    if (!profileId || !Number.isFinite(weekly) || !Number.isFinite(daily)) {
      return NextResponse.json({ error: "Invalid settings." }, { status: 400 });
    }
    const supabase = supabaseAdmin();
    const { data: profile, error } = await supabase
      .from("profiles")
      .update({ weekly_allowance_minutes: weekly, daily_limit_minutes: daily, tracking_enabled: enabled })
      .eq("id", profileId)
      .select("*")
      .single();
    if (error) throw error;

    const ledger = await ensureCurrentLedger(profile);
    const rawOpening = weekly + Number(ledger.carryover_minutes);
    const opening = Math.min(rawOpening, Number(profile.weekly_start_cap_minutes));
    const { error: ledgerError } = await supabase
      .from("weekly_ledgers")
      .update({ base_minutes: weekly, opening_minutes: Math.round(opening * 100) / 100 })
      .eq("profile_id", profileId)
      .eq("week_start", ledger.week_start);
    if (ledgerError) throw ledgerError;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not update settings." }, { status: 500 });
  }
}
