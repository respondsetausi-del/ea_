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
 * POST /api/v1/auth-license
 * Body: { email: string, license_key: string }
 *
 * Authenticates an end-user by the per-user license key that was emailed to
 * them. On success returns the EA the distributor created (name + image) and
 * the distributor's branding so the app can render the bot.
 */
export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return corsJson({ error: "Server not configured" }, { status: 503 });
  }

  let body: { email?: string; license_key?: string };
  try {
    body = await req.json();
  } catch {
    return corsJson({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const licenseKey = body.license_key?.trim();
  if (!email || !email.includes("@")) {
    return corsJson({ error: "Valid email is required" }, { status: 400 });
  }
  if (!licenseKey) {
    return corsJson({ error: "License key is required" }, { status: 400 });
  }

  // The license key uniquely identifies one invited user (one email, one EA).
  const { data: appUser, error: userErr } = await supabase
    .from("app_users")
    .select("id, email, ea_id, distributor_id, is_active")
    .eq("license_key", licenseKey)
    .maybeSingle();

  if (userErr) {
    console.error("[auth-license] Supabase error:", userErr);
    return corsJson({ error: "Database error" }, { status: 500 });
  }

  // Invalid key, key/email mismatch, or deactivated user → not authorized.
  if (!appUser || appUser.email.toLowerCase() !== email) {
    return corsJson({ user_authorized: false, error: "Invalid email or license key" }, { status: 404 });
  }
  if (!appUser.is_active) {
    return corsJson({ user_authorized: false, error: "This license has been deactivated" }, { status: 403 });
  }

  // Pull the EA the distributor created for this user.
  const { data: ea } = await supabase
    .from("eas")
    .select("*")
    .eq("id", appUser.ea_id)
    .eq("is_active", true)
    .maybeSingle();

  if (!ea) {
    return corsJson({ user_authorized: false, error: "The bot for this license is not available" }, { status: 404 });
  }

  const { data: branding } = await supabase
    .from("branding")
    .select("*")
    .eq("distributor_id", appUser.distributor_id)
    .maybeSingle();

  // Track activity.
  await supabase
    .from("app_users")
    .update({ last_seen: new Date().toISOString() })
    .eq("id", appUser.id);

  // EA image: EAs don't carry their own image, so use the distributor's
  // robot/hero image (falling back to the logo) as the bot's picture.
  const image_url = branding?.robot_image_url || branding?.logo_url || null;

  return corsJson({
    user_authorized: true,
    ea: {
      id: ea.id,
      name: ea.name,
      description: ea.description,
      mentor_id: ea.mentor_id,
      image_url,
    },
    branding: branding
      ? {
          app_name: branding.app_name,
          glow_color: branding.glow_color,
          logo_url: branding.logo_url,
          robot_image_url: branding.robot_image_url,
          tagline: branding.tagline,
        }
      : null,
  });
}
