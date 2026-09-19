import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { nowLocal } from "@/lib/time";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Parent mode required." }, { status: 401 });
  try {
    const body = await req.json();
    const profileId = String(body.profileId || "");
    const kind = body.kind === "bonus" ? "bonus" : body.kind === "deduction" ? "deduction" : null;
    const minutes = Math.round(Number(body.minutes));
    const occurredOn = String(body.occurredOn || nowLocal().toFormat("yyyy-LL-dd"));
    const note = String(body.note || (kind === "bonus" ? "Parent bonus" : "Manual screen time"));
    if (!profileId || !kind || !Number.isFinite(minutes) || minutes <= 0 || minutes > 1440) {
      return NextResponse.json({ error: "Invalid adjustment." }, { status: 400 });
    }
    const supabase = supabaseAdmin();
    const { data, error } = await supabase.from("adjustments").insert({ profile_id: profileId, kind, minutes, note, occurred_on: occurredOn }).select("*").single();
    if (error) throw error;
    return NextResponse.json({ ok: true, adjustment: data });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not save adjustment." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Parent mode required." }, { status: 401 });
  try {
    const body = await req.json();
    const id = String(body.id || "");
    const minutes = Math.round(Number(body.minutes));
    const note = String(body.note || "Manual adjustment");
    const occurredOn = String(body.occurredOn || nowLocal().toFormat("yyyy-LL-dd"));
    if (!id || !Number.isFinite(minutes) || minutes <= 0 || minutes > 1440) {
      return NextResponse.json({ error: "Invalid adjustment." }, { status: 400 });
    }
    const supabase = supabaseAdmin();
    const { error } = await supabase.from("adjustments").update({ minutes, note, occurred_on: occurredOn }).eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not edit adjustment." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Parent mode required." }, { status: 401 });
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing adjustment." }, { status: 400 });
    const supabase = supabaseAdmin();
    const { error } = await supabase.from("adjustments").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not undo adjustment." }, { status: 500 });
  }
}
