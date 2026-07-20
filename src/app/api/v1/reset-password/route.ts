import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/reset-password
 * Body: { token, password }
 *
 * Validates the single-use reset token, sets the new password through Supabase
 * Auth (the distributor id is the auth user id), and clears the token.
 */
export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Server not configured" }, { status: 503 });

  let body: { token?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const token = body.token?.trim();
  const password = body.password ?? "";
  if (!token || !UUID_RE.test(token)) {
    return NextResponse.json({ error: "This reset link is invalid." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const { data: distributor, error } = await supabase
    .from("distributors")
    .select("id, reset_expires_at")
    .eq("reset_token", token)
    .maybeSingle();

  if (error) {
    console.error("[reset-password] Supabase error:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
  if (!distributor) {
    return NextResponse.json({ error: "This reset link is invalid or has already been used." }, { status: 404 });
  }
  if (distributor.reset_expires_at && Date.now() > new Date(distributor.reset_expires_at).getTime()) {
    return NextResponse.json({ error: "This reset link has expired. Please request a new one." }, { status: 410 });
  }

  // The distributor row id is the Supabase Auth user id (login matches on it).
  const { error: authErr } = await supabase.auth.admin.updateUserById(distributor.id, { password });
  if (authErr) {
    console.error("[reset-password] Auth update error:", authErr);
    return NextResponse.json({ error: "Could not update password. Please try again." }, { status: 500 });
  }

  // Single-use: clear the token so the link can't be reused.
  await supabase
    .from("distributors")
    .update({ reset_token: null, reset_expires_at: null })
    .eq("id", distributor.id);

  return NextResponse.json({ ok: true });
}
