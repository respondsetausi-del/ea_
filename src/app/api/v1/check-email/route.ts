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
 * POST /api/v1/check-email
 * Body: { email: string }
 *
 * Checks if the email has any active EA associations in the dashboard.
 * Returns:
 *   - found: true/false  (email exists in app_users)
 *   - active: true/false (at least one active EA association)
 *   - ea_count: number   (how many active EAs the user has)
 */
export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return corsJson({ error: "Server not configured" }, { status: 503 });
  }

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return corsJson({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return corsJson({ error: "Valid email is required" }, { status: 400 });
  }

  // Look up the email across all EAs in app_users
  const { data: appUsers, error } = await supabase
    .from("app_users")
    .select("id, is_active, ea_id")
    .eq("email", email);

  if (error) {
    console.error("[check-email] Supabase error:", error);
    return corsJson({ error: "Database error" }, { status: 500 });
  }

  const found = appUsers && appUsers.length > 0;
  const activeUsers = appUsers?.filter((u) => u.is_active) ?? [];

  // Update last_seen for all matching active records
  if (activeUsers.length > 0) {
    const ids = activeUsers.map((u) => u.id);
    await supabase
      .from("app_users")
      .update({ last_seen: new Date().toISOString() })
      .in("id", ids);
  }

  return corsJson({
    found,
    active: activeUsers.length > 0,
    ea_count: activeUsers.length,
  });
}
