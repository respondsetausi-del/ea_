import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, accessGrantedEmail } from "@/lib/brevo";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function siteOrigin(req: NextRequest): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin).replace(/\/$/, "");
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/verify
 * Body: { token: string }
 *
 * Marks the distributor matching the token as verified, clears the token,
 * and emails them an "access granted" confirmation with a login link.
 */
export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const token = body.token?.trim();
  if (!token || !UUID_RE.test(token)) {
    return NextResponse.json({ error: "Invalid verification link" }, { status: 400 });
  }

  const { data: distributor, error } = await supabase
    .from("distributors")
    .select("id, email, name, verified")
    .eq("verification_token", token)
    .maybeSingle();

  if (error) {
    console.error("[verify] Supabase error:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  if (!distributor) {
    return NextResponse.json({ error: "This verification link is invalid or has already been used." }, { status: 404 });
  }

  // Already verified — treat as success (idempotent).
  if (distributor.verified) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  const { error: updateError } = await supabase
    .from("distributors")
    .update({ verified: true, verified_at: new Date().toISOString(), verification_token: null })
    .eq("id", distributor.id);

  if (updateError) {
    console.error("[verify] Update error:", updateError);
    return NextResponse.json({ error: "Could not verify account" }, { status: 500 });
  }

  const loginUrl = `${siteOrigin(req)}/login`;
  const { subject, htmlContent } = accessGrantedEmail(distributor.name, loginUrl);
  await sendEmail({ to: distributor.email, toName: distributor.name, subject, htmlContent });

  return NextResponse.json({ ok: true });
}
