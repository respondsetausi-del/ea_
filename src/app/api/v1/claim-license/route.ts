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
 * POST /api/v1/claim-license
 * Body: { session_id: string }   (Stripe Checkout Session id)
 *
 * Returns the licence key for the person who completed that checkout, so the
 * app can activate them on the spot instead of asking them to type a key they
 * were never given.
 *
 * Why the session id is the gate, and why email is not:
 * the key is the only secret in the activation pair — /api/v1/auth-license
 * takes (email, key), and emails are guessable. An endpoint that returned a
 * key for an email would hand anyone else's licence to anyone who asked.
 * A Checkout Session id is unguessable and only reaches the person Stripe
 * redirected, and `stripe_session_id` is written solely by the webhook, which
 * runs only after a signature verifies against STRIPE_WEBHOOK_SECRET. So
 * holding one is proof of having completed that specific payment.
 *
 * `pending` is a real answer, not an error: Stripe redirects the browser and
 * delivers the webhook independently, so the buyer can arrive before the
 * payment is recorded. The app polls rather than declaring failure.
 */
export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return corsJson({ error: "Server not configured" }, { status: 503 });
  }

  let body: { session_id?: string };
  try {
    body = await req.json();
  } catch {
    return corsJson({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sessionId = body.session_id?.trim();
  // Stripe session ids are `cs_` + live/test marker + random. Reject anything
  // else outright so this can't be used to probe the table.
  if (!sessionId || !/^cs_[A-Za-z0-9_]{10,}$/.test(sessionId)) {
    return corsJson({ claimed: false, error: "Invalid session" }, { status: 400 });
  }

  const { data: row, error } = await supabase
    .from("app_users")
    .select("id, email, license_key, paid_at, is_active")
    .eq("stripe_session_id", sessionId)
    .maybeSingle();

  if (error) {
    console.error("[claim-license] lookup error:", error);
    return corsJson({ claimed: false, error: "Lookup failed" }, { status: 500 });
  }

  // The webhook has not landed yet (or never will). Either way the app should
  // wait and retry, then fall back to asking for a key by hand.
  if (!row || !row.paid_at) {
    return corsJson({ claimed: false, pending: true });
  }

  if (!row.license_key) {
    // Payment recorded but no key — only reachable for rows written before the
    // webhook started issuing keys. Nothing to hand over; a mentor must issue
    // one from the dashboard.
    return corsJson({ claimed: false, email: row.email, needsKey: true });
  }

  if (!row.is_active) {
    return corsJson({ claimed: false, email: row.email, error: "This licence has been deactivated" }, { status: 403 });
  }

  return corsJson({ claimed: true, email: row.email, license_key: row.license_key });
}
