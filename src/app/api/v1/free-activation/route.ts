import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, licenseEmail } from "@/lib/brevo";
import { generateUniqueKey } from "@/lib/license";
import { resolveFreeActivationEA } from "@/lib/free-activation";

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Don't resend to the same address more than once per this window — a light
// guard against someone hammering the public form to email-bomb a victim.
const RESEND_COOLDOWN_MS = 30_000;

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * POST /api/v1/free-activation
 * Body: { email }
 *
 * Public, mentor-less activation for the flagship "EA NAPTUNE SCALPER" bot.
 * Issues (or re-sends) a license key and emails it. Idempotent: an email that
 * already has a key gets the SAME key resent, never a fresh one, so a legit
 * user's working key is never invalidated by re-submitting. The key is never
 * returned in the response — it only reaches the user's inbox.
 */
export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) return corsJson({ error: "Service unavailable." }, { status: 503 });

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return corsJson({ error: "Invalid request." }, { status: 400 });
  }

  const email = (body.email || "").trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return corsJson({ error: "Enter a valid email address." }, { status: 400 });
  }

  const ea = await resolveFreeActivationEA(supabase);
  if (!ea) return corsJson({ error: "Free activation isn't available right now." }, { status: 503 });
  if (!ea.is_active) return corsJson({ error: "Free activation is temporarily paused." }, { status: 503 });

  const { data: branding } = await supabase
    .from("branding")
    .select("app_name")
    .eq("distributor_id", ea.distributor_id)
    .maybeSingle();
  const appName = branding?.app_name || ea.name || "EA NAPTUNE SCALPER";

  const { data: existing } = await supabase
    .from("app_users")
    .select("id, license_key, license_sent_at")
    .eq("ea_id", ea.id)
    .eq("email", email)
    .maybeSingle();

  // Cooldown: if we just emailed this address, treat as success without resending.
  if (existing?.license_sent_at) {
    const age = Date.now() - new Date(existing.license_sent_at).getTime();
    if (age < RESEND_COOLDOWN_MS) {
      return corsJson({ ok: true, emailSent: true, throttled: true, reactivated: true });
    }
  }

  const nowIso = new Date().toISOString();
  let licenseKey: string;

  if (existing) {
    // Reuse the existing key (idempotent) — only mint one if they never had one.
    licenseKey = existing.license_key || (await generateUniqueKey(supabase));
    const { error: updErr } = await supabase
      .from("app_users")
      .update({ license_key: licenseKey, license_sent_at: nowIso, is_active: true })
      .eq("id", existing.id);
    if (updErr) return corsJson({ error: "Could not activate. Please try again." }, { status: 500 });
  } else {
    licenseKey = await generateUniqueKey(supabase);
    const { data: inserted, error: insErr } = await supabase
      .from("app_users")
      .insert({ distributor_id: ea.distributor_id, ea_id: ea.id, email })
      .select("id")
      .single();
    if (insErr || !inserted) return corsJson({ error: "Could not activate. Please try again." }, { status: 500 });
    const { error: updErr } = await supabase
      .from("app_users")
      .update({ license_key: licenseKey, license_sent_at: nowIso, is_active: true })
      .eq("id", inserted.id);
    if (updErr) return corsJson({ error: "Could not activate. Please try again." }, { status: 500 });
  }

  const { subject, htmlContent } = licenseEmail(appName, licenseKey);
  const result = await sendEmail({ to: email, subject, htmlContent });

  return corsJson({
    ok: true,
    emailSent: result.sent,
    emailSkipped: result.skipped ?? false,
    emailError: result.error ?? null,
    reactivated: !!existing,
  });
}
