import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const { profileId } = await req.json();
    if (!profileId) return NextResponse.json({ error: "Missing profile." }, { status: 400 });
    const supabase = supabaseAdmin();
    const { data: active, error: activeError } = await supabase
      .from("timer_sessions")
      .select("id")
      .eq("profile_id", profileId)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (activeError) throw activeError;
    if (!active) return NextResponse.json({ ok: true, alreadyStopped: true });
    const { error } = await supabase.from("timer_sessions").update({ ended_at: new Date().toISOString() }).eq("id", active.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not stop timer." }, { status: 500 });
  }
}
