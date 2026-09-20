import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { setAdminCookie } from "@/lib/adminAuth";

export async function POST(req: NextRequest) {
  const { pin } = await req.json();
  const expected = process.env.PARENT_PIN || "";
  const supplied = String(pin || "");
  if (!expected || supplied.length !== expected.length) {
    return NextResponse.json({ error: "Incorrect PIN." }, { status: 401 });
  }
  const valid = crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
  if (!valid) return NextResponse.json({ error: "Incorrect PIN." }, { status: 401 });
  await setAdminCookie();
  return NextResponse.json({ ok: true });
}
