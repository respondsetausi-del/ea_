import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, verificationEmail } from "@/lib/brevo";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function siteOrigin(req: NextRequest): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin).replace(/\/$/, "");
}

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/send-verification
 * Body: { email: string }
 *
 * Looks up the distributor's verification token and emails them a verify link.
 * Idempotent — can be called again to resend. Never reveals whether an email exists.
 */
export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

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

  const { data: distributor, error } = await supabase
    .from("distributors")
    .select("name, verified, verification_token")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    console.error("[send-verification] Supabase error:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  // Don't leak account existence — always return ok.
  if (!distributor) {
    return NextResponse.json({ ok: true });
  }

  // Already verified — nothing to send.
  if (distributor.verified) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  const verifyUrl = `${siteOrigin(req)}/verify?token=${distributor.verification_token}`;
  const { subject, htmlContent } = verificationEmail(distributor.name, verifyUrl);

  const result = await sendEmail({ to: email, toName: distributor.name, subject, htmlContent });

  return NextResponse.json({ ok: true, emailSent: result.sent, emailSkipped: result.skipped ?? false });
}
