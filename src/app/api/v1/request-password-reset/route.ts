import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { sendEmail, passwordResetEmail } from "@/lib/brevo";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function siteOrigin(req: NextRequest): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin).replace(/\/$/, "");
}

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/request-password-reset
 * Body: { email }
 *
 * Issues a single-use, 1-hour reset token on the distributor row and emails a
 * reset link via Brevo. Never reveals whether an account exists.
 */
export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Server not configured" }, { status: 503 });

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  const { data: distributor } = await supabase
    .from("distributors")
    .select("id, name, email")
    .eq("email", email)
    .maybeSingle();

  // Don't leak account existence — always return ok.
  if (!distributor) return NextResponse.json({ ok: true });

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + RESET_TTL_MS).toISOString();
  const { error: updErr } = await supabase
    .from("distributors")
    .update({ reset_token: token, reset_expires_at: expiresAt })
    .eq("id", distributor.id);

  if (updErr) {
    console.error("[request-password-reset] Update error:", updErr);
    // Most likely the migration hasn't been run (missing reset_token column).
    return NextResponse.json({ error: "Password reset isn't set up yet. Contact support." }, { status: 500 });
  }

  const resetUrl = `${siteOrigin(req)}/reset-password?token=${token}`;
  const { subject, htmlContent } = passwordResetEmail(distributor.name, resetUrl);
  const result = await sendEmail({ to: distributor.email, toName: distributor.name, subject, htmlContent });

  return NextResponse.json({ ok: true, emailSent: result.sent, emailSkipped: result.skipped ?? false });
}
