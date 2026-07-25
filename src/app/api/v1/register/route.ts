import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
};

function corsJson(body: object, init?: { status?: number }) {
  return NextResponse.json(body, { ...init, headers: CORS_HEADERS });
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * POST /api/v1/register
 * Body: { email: string, mentor_id: string }   (mentor_id = distributor number)
 *
 * Registers an end-user under the distributor's EA so they appear in the
 * distributor's Users list, ready to be issued a license key. Called by the
 * app right after a successful Stripe checkout. Idempotent.
 *
 * Note: the license KEY (issued by the distributor) remains the real access
 * gate — this only creates the pending user record.
 */
export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return corsJson({ error: "Server not configured" }, { status: 503 });
  }

  let body: { email?: string; mentor_id?: string | number };
  try {
    body = await req.json();
  } catch {
    return corsJson({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const mentorId = String(body.mentor_id ?? "").trim();
  if (!email || !email.includes("@")) {
    return corsJson({ error: "Valid email is required" }, { status: 400 });
  }
  if (!/^\d+$/.test(mentorId)) {
    return corsJson({ error: "Invalid Mentor ID" }, { status: 400 });
  }

  const { data: distributor } = await supabase
    .from("distributors")
    .select("id")
    .eq("mentor_number", parseInt(mentorId, 10))
    .maybeSingle();
  if (!distributor) {
    return corsJson({ error: "Mentor ID not found" }, { status: 404 });
  }

  const { data: ea } = await supabase
    .from("eas")
    .select("id")
    .eq("distributor_id", distributor.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!ea) {
    return corsJson({ error: "This provider has no active EA yet" }, { status: 400 });
  }

  // Idempotent: reactivate if already there, else create.
  const { data: existing } = await supabase
    .from("app_users")
    .select("id")
    .eq("ea_id", ea.id)
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    await supabase.from("app_users").update({ is_active: true }).eq("id", existing.id);
    return corsJson({ ok: true, already: true });
  }

  const { error: insErr } = await supabase
    .from("app_users")
    .insert({ distributor_id: distributor.id, ea_id: ea.id, email, is_active: true, access_via: "payment" });
  if (insErr) {
    console.error("[register] insert error:", insErr);
    return corsJson({ error: "Could not register" }, { status: 500 });
  }

  return corsJson({ ok: true });
}
