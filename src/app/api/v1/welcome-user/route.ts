import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, welcomeEmail } from "@/lib/brevo";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/welcome-user
 * Body: { app_user_id: string }
 *
 * Sends the new-user welcome email (doc item 1) immediately after a distributor
 * registers an app user. Best-effort: never blocks the caller — if Brevo isn't
 * configured the send is skipped gracefully. No access key is included here; the
 * key ships separately via /api/v1/generate-license.
 */
export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  let body: { app_user_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const appUserId = body.app_user_id?.trim();
  if (!appUserId) {
    return NextResponse.json({ error: "app_user_id is required" }, { status: 400 });
  }

  const { data: appUser, error } = await supabase
    .from("app_users")
    .select("id, email, distributor_id")
    .eq("id", appUserId)
    .maybeSingle();

  if (error) {
    console.error("[welcome-user] Supabase error:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
  if (!appUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { data: branding } = await supabase
    .from("branding")
    .select("app_name")
    .eq("distributor_id", appUser.distributor_id)
    .maybeSingle();

  const { subject, htmlContent } = welcomeEmail(branding?.app_name || "EA Access");
  const result = await sendEmail({ to: appUser.email, subject, htmlContent });

  return NextResponse.json({
    ok: true,
    emailSent: result.sent,
    emailSkipped: result.skipped ?? false,
  });
}
