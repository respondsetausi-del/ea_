import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ mentorId: string }> }
) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  const { mentorId } = await params;
  const email = req.nextUrl.searchParams.get("email");

  const { data: ea, error: eaError } = await supabase
    .from("eas")
    .select("*")
    .eq("mentor_id", mentorId)
    .eq("is_active", true)
    .single();

  if (eaError || !ea) {
    return NextResponse.json({ error: "EA not found or inactive" }, { status: 404 });
  }

  const { data: branding } = await supabase
    .from("branding")
    .select("*")
    .eq("distributor_id", ea.distributor_id)
    .single();

  let user_authorized: boolean | null = null;
  if (email) {
    const { data: appUser } = await supabase
      .from("app_users")
      .select("id, is_active")
      .eq("ea_id", ea.id)
      .eq("email", email.toLowerCase())
      .single();
    user_authorized = !!(appUser?.is_active);

    if (appUser) {
      await supabase
        .from("app_users")
        .update({ last_seen: new Date().toISOString() })
        .eq("id", appUser.id);
    }
  }

  return NextResponse.json({
    ea: {
      id: ea.id,
      name: ea.name,
      description: ea.description,
      mentor_id: ea.mentor_id,
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
    ...(email !== null && { user_authorized }),
  });
}
