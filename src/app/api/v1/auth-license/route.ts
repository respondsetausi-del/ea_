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
 * Resolves a licence key to the robot it was issued for, and returns that EA
 * (name + image) plus the distributor's branding so the app can render it.
 *
 * `email` is optional and is not matched against anything — the key is the
 * credential. See the note in the handler.
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

  // Email is accepted but no longer required, and never has to match. A licence
  // identifies a ROBOT, not a person: it is issued against an EA and handed to
  // whoever the mentor is selling to.
  //
  // This used to reject any key whose row carried a different email, which made
  // valid keys fail constantly — the app sends the address the user signed in
  // with, while the row carries whatever the mentor typed when generating, and
  // those are routinely not the same string. Access is gated by email over in
  // /api/v1/authorize; that is the right place for it. Here the key is the
  // credential.
  const licenseKey = body.license_key?.trim();
  if (!licenseKey) {
    return corsJson({ error: "License key is required" }, { status: 400 });
  }

  const { data: appUser, error: userErr } = await supabase
    .from("app_users")
    .select("id, email, ea_id, distributor_id, is_active")
    .eq("license_key", licenseKey)
    .maybeSingle();

  if (userErr) {
    console.error("[auth-license] Supabase error:", userErr);
    return corsJson({ error: "Database error" }, { status: 500 });
  }

  if (!appUser) {
    return corsJson({ user_authorized: false, error: "That license key was not recognised" }, { status: 404 });
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
