import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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
 * GET /api/v1/config/{mentorId}?email=
 *
 * The Mentor ID is the DISTRIBUTOR's number (distributors.mentor_number). This
 * confirms the Mentor ID is valid and — when an email is given — whether that
 * email is an active user under that distributor. Returns the distributor's
 * branding (and a representative EA) for the app to render.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ mentorId: string }> }
) {
  const supabase = getSupabase();
  if (!supabase) {
    return corsJson({ error: "Server not configured" }, { status: 503 });
  }

  const { mentorId } = await params;
  const email = req.nextUrl.searchParams.get("email");

  // Mentor ID is a plain number.
  if (!/^\d+$/.test((mentorId || "").trim())) {
    return corsJson({ error: "Invalid Mentor ID" }, { status: 404 });
  }
  const num = parseInt(mentorId.trim(), 10);

  const { data: distributor, error: distErr } = await supabase
    .from("distributors")
    .select("id, name, is_active")
    .eq("mentor_number", num)
    .maybeSingle();

  if (distErr || !distributor || distributor.is_active === false) {
    return corsJson({ error: "Mentor ID not found" }, { status: 404 });
  }

  const { data: branding } = await supabase
    .from("branding")
    .select("*")
    .eq("distributor_id", distributor.id)
    .maybeSingle();

  // A representative EA (first active) for display.
  const { data: ea } = await supabase
    .from("eas")
    .select("id, name, description, mentor_id")
    .eq("distributor_id", distributor.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let user_authorized: boolean | null = null;
  if (email) {
    const { data: appUsers } = await supabase
      .from("app_users")
      .select("id")
      .eq("distributor_id", distributor.id)
      .eq("email", email.toLowerCase())
      .eq("is_active", true);
    const ids = (appUsers || []).map((u) => u.id);
    user_authorized = ids.length > 0;
    if (ids.length > 0) {
      await supabase
        .from("app_users")
        .update({ last_seen: new Date().toISOString() })
        .in("id", ids);
    }
  }

  return corsJson({
    mentor: { name: distributor.name },
    ea: ea
      ? { id: ea.id, name: ea.name, description: ea.description, mentor_id: ea.mentor_id }
      : null,
    branding: branding
      ? {
          app_name: branding.app_name,
          glow_color: branding.glow_color,
          logo_url: branding.logo_url,
          robot_image_url: branding.robot_image_url,
          tagline: branding.tagline,
        }
      : null,
    ...(email !== null && { user_authorized }),
  });
}
