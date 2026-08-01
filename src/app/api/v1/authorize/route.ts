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

type AppUserRow = {
  id: string;
  email: string;
  status: string;
  is_active: boolean;
  paid_at: string | null;
  license_key: string | null;
};

/**
 * POST /api/v1/authorize
 * Body: { email: string }
 *
 * Email-only gate for the app. Replaces /api/v1/config/{mentorId}: the app no
 * longer collects a Mentor ID, so a client is resolved by email across every
 * distributor. This reads the same app_users table the mentor dashboard writes
 * to, which is what makes "mentor adds client → client can log in" work.
 *
 * Returns the decision plus enough context for the app to show the right
 * screen — approved, awaiting approval, or needs to pay.
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

  // A client could in principle be added by more than one mentor. Prefer an
  // approved row so a second mentor's pending entry can't lock them out.
  const { data, error } = await supabase
    .from("app_users")
    .select("id, email, status, is_active, paid_at, license_key")
    .ilike("email", email);

  if (error) {
    console.error("[authorize] lookup error:", error);
    return corsJson({ error: "Lookup failed" }, { status: 500 });
  }

  const rows = (data || []) as AppUserRow[];
  if (rows.length === 0) {
    // Nobody has added this client yet → the app sends them to checkout.
    return corsJson({ found: false, status: "unknown", authorized: false, paid: false });
  }

  const approved = rows.find(r => r.status === "approved" && r.is_active);
  const chosen = approved || rows.find(r => r.status === "pending") || rows[0];
  const paid = rows.some(r => !!r.paid_at);

  if (approved) {
    await supabase
      .from("app_users")
      .update({ last_seen: new Date().toISOString() })
      .eq("id", approved.id);
  }

  return corsJson({
    found: true,
    status: approved ? "approved" : chosen.status,
    authorized: !!approved,
    paid,
    hasLicense: !!chosen.license_key,
  });
}
