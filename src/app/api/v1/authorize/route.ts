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
  first_login_at: string | null;
  /** NULL = never expires (users who predate the 30-day window). */
  access_expires_at: string | null;
};

/** A row is only usable if it's approved, active, and still inside its window. */
function isLive(r: AppUserRow): boolean {
  if (r.status !== "approved" || !r.is_active) return false;
  if (!r.access_expires_at) return true;
  return Date.now() < new Date(r.access_expires_at).getTime();
}

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
    .select("id, email, status, is_active, paid_at, license_key, first_login_at, access_expires_at")
    .ilike("email", email);

  if (error) {
    console.error("[authorize] lookup error:", error);
    return corsJson({ error: "Lookup failed" }, { status: 500 });
  }

  // Super-admin switch: when payment is off, the app never shows Stripe and
  // approval alone decides access. Defaults to true if the settings table or
  // row is missing, so a missing migration can't accidentally make it free.
  let requirePayment = true;
  const settingRes = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "require_payment")
    .maybeSingle();
  if (!settingRes.error && settingRes.data) {
    requirePayment = settingRes.data.value !== false;
  }

  const rows = (data || []) as AppUserRow[];
  if (rows.length === 0) {
    // Nobody has added this client yet → the app sends them to checkout.
    return corsJson({ found: false, status: "unknown", authorized: false, paid: false, requirePayment });
  }

  // Live rows first. An approved-but-expired row must not satisfy the gate,
  // but it's still the row we describe back to the app so it can say
  // "your access ended on X" instead of the useless "no access yet".
  const approved = rows.find(isLive);
  const expiredRow = !approved
    ? rows.find(r => r.status === "approved" && r.is_active && !!r.access_expires_at)
    : undefined;
  const chosen = approved || expiredRow || rows.find(r => r.status === "pending") || rows[0];
  const paid = rows.some(r => !!r.paid_at);

  const expiresAt = (approved || expiredRow)?.access_expires_at ?? null;
  const expired = !approved && !!expiredRow;
  const daysRemaining = approved && expiresAt
    ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000))
    : null;

  // last_seen doubles as "has this client ever actually logged in?" — the
  // dashboard shows "Never logged in" while it is null. Only stamped for an
  // authorized client so a rejected/pending attempt doesn't look like a login.
  if (approved) {
    await supabase
      .from("app_users")
      .update({
        last_seen: new Date().toISOString(),
        ...(approved.first_login_at ? {} : { first_login_at: new Date().toISOString() }),
      })
      .eq("id", approved.id);
  }

  return corsJson({
    found: true,
    // "expired" is reported as its own status so the app can tell an ended
    // subscription apart from an account that was never approved.
    status: approved ? "approved" : expired ? "expired" : chosen.status,
    authorized: !!approved,
    expired,
    expiresAt,
    daysRemaining,
    paid,
    requirePayment,
    hasLicense: !!chosen.license_key,
  });
}
