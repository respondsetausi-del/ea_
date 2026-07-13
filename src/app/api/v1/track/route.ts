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

const ALLOWED = new Set(["visit", "login"]);

/**
 * POST /api/v1/track
 * Body: { event_type: 'visit' | 'login', visitor_id?, email?, path? }
 *
 * Best-effort site-traffic logging (doc item 3). Fire-and-forget from the
 * client. Only whitelisted event types are accepted; anything else is ignored
 * with a 200 so a bad caller never sees an error. No PII beyond an email on a
 * login (which we already store elsewhere).
 */
export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) return corsJson({ ok: false, skipped: true });

  let body: { event_type?: string; visitor_id?: string; email?: string; path?: string };
  try {
    body = await req.json();
  } catch {
    return corsJson({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = body.event_type?.toString().trim().toLowerCase();
  if (!eventType || !ALLOWED.has(eventType)) {
    // Silently ignore unknown events so noise never surfaces as an error.
    return corsJson({ ok: true, ignored: true });
  }

  const row = {
    event_type: eventType,
    visitor_id: body.visitor_id?.toString().slice(0, 64) || null,
    email: body.email?.toString().trim().toLowerCase().slice(0, 200) || null,
    path: body.path?.toString().slice(0, 200) || null,
  };

  const { error } = await supabase.from("analytics_events").insert(row);
  if (error) {
    console.error("[track] insert error:", error.message);
    return corsJson({ ok: false, error: "Database error" }, { status: 500 });
  }
  return corsJson({ ok: true });
}
