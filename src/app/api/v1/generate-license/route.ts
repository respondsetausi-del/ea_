import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, licenseEmail } from "@/lib/brevo";
import { isSuperAdminEmail, isAdminEmailInTable, resolveCaller } from "@/lib/admin";
import { generateUniqueKey } from "@/lib/license";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/generate-license
 * Body: { app_user_id: string }   (the invited user to issue a license to)
 *
 * Generates a unique license key, stores it on the app_user, and EMAILS it to
 * the user via Brevo. The key is NEVER returned in the response or placed in a
 * URL — it only reaches the user through their inbox.
 */
export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  let body: { app_user_id?: string; caller_email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const appUserId = body.app_user_id?.trim();
  if (!appUserId) {
    return NextResponse.json({ error: "app_user_id is required" }, { status: 400 });
  }

  // This endpoint was unauthenticated, and it mints a FRESH key on every call
  // — so anyone able to POST could rotate a paying user's licence and lock
  // them out of the app. Issuing a key is now restricted to the mentor who
  // owns the row, or an admin.
  const caller = await resolveCaller(req);
  if (!caller.ok || !caller.user) {
    return NextResponse.json({ error: caller.error ?? "Unauthorized" }, { status: caller.status });
  }
  const isAdmin = caller.role === "super" || caller.role === "staff";

  // Load the invited user + their distributor's branding (for the app name).
  const { data: appUser, error } = await supabase
    .from("app_users")
    .select("id, email, distributor_id, license_key")
    .eq("id", appUserId)
    .maybeSingle();

  if (error) {
    console.error("[generate-license] Supabase error:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
  if (!appUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (!isAdmin && appUser.distributor_id !== caller.user.id) {
    return NextResponse.json({ error: "That user isn't yours" }, { status: 403 });
  }

  // Always generate a fresh key (even on resend).
  const licenseKey = await generateUniqueKey(supabase);

  const { data: branding } = await supabase
    .from("branding")
    .select("app_name")
    .eq("distributor_id", appUser.distributor_id)
    .maybeSingle();

  const nowIso = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("app_users")
    .update({ license_key: licenseKey, license_sent_at: nowIso, is_active: true })
    .eq("id", appUser.id);

  if (updateError) {
    console.error("[generate-license] Update error:", updateError);
    return NextResponse.json({ error: "Could not save license" }, { status: 500 });
  }

  const { subject, htmlContent } = licenseEmail(branding?.app_name || "EA NAPTUNE", licenseKey);
  const result = await sendEmail({ to: appUser.email, subject, htmlContent });

  // Check if the caller is a super admin — reveal the key to them only.
  const callerEmail = body.caller_email?.trim().toLowerCase();
  let callerIsSuperAdmin = false;
  if (callerEmail) {
    callerIsSuperAdmin = isSuperAdminEmail(callerEmail) || await isAdminEmailInTable(supabase, callerEmail);
  }

  return NextResponse.json({
    ok: true,
    emailSent: result.sent,
    emailSkipped: result.skipped ?? false,
    emailError: result.error ?? null,
    sent_at: nowIso,
    ...(callerIsSuperAdmin ? { license_key: licenseKey } : {}),
  });
}
