import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const { profileId } = await req.json();
    if (!profileId) return NextResponse.json({ error: "Missing profile." }, { status: 400 });
    const supabase = supabaseAdmin();
    const { data: profile, error: profileError } = await supabase
      .from("profiles").select("id,tracking_enabled").eq("id", profileId).single();
    if (profileError || !profile) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    if (!profile.tracking_enabled) return NextResponse.json({ error: "Tracking is not enabled for this person." }, { status: 400 });

    const { data: active, error: activeError } = await supabase
      .from("timer_sessions").select("id").eq("profile_id", profileId).is("ended_at", null).limit(1).maybeSingle();
    if (activeError) throw activeError;
    if (active) return NextResponse.json({ ok: true, alreadyRunning: true });

    const { error } = await supabase.from("timer_sessions").insert({ profile_id: profileId, started_at: new Date().toISOString() });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not start timer." }, { status: 500 });
  }
}
