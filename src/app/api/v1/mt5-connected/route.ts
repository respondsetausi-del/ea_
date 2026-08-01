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
 * POST /api/v1/mt5-connected
 * Body: { email: string, login: string, server: string }
 *
 * Records a successful MT5 account connection from the app so super admins
 * can see who has linked their account. Stores the MT5 login NUMBER and
 * broker server only — passwords are never accepted or stored.
 */
export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return corsJson({ error: "Server not configured" }, { status: 503 });
  }

  let body: { email?: string; login?: string; server?: string; app?: string; event?: string };
  try {
    body = await req.json();
  } catch {
    return corsJson({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const login = body.login?.toString().trim();
  const server = body.server?.trim();
  // Which app the connection came from (clean per-app separation). Defaults to
  // "ea-naptune" for back-compat with older clients that don't send it.
  const app = (body.app?.toString().trim() || "ea-naptune").toLowerCase();
  // Connection lifecycle event. "connect" (default) records/refreshes the link;
  // "heartbeat" keeps it live; "disconnect" marks it offline immediately.
  const rawEvent = (body.event?.toString().trim() || "connect").toLowerCase();
  const event = (["connect", "heartbeat", "disconnect"].includes(rawEvent) ? rawEvent : "connect") as
    "connect" | "heartbeat" | "disconnect";

  if (!email || !email.includes("@")) {
    return corsJson({ error: "Valid email is required" }, { status: 400 });
  }
  if (!login || !server) {
    return corsJson({ error: "Login and server are required" }, { status: 400 });
  }

  const now = new Date().toISOString();

  const { data: existing, error: selectError } = await supabase
    .from("mt5_connections")
    .select("id, connect_count")
    .eq("email", email)
    .eq("login", login)
    .eq("server", server)
    .eq("app", app)
    .maybeSingle();

  if (selectError) {
    console.error("[mt5-connected] Supabase select error:", selectError);
    return corsJson({ error: "Database error" }, { status: 500 });
  }

  if (existing) {
    // Build the update per event: disconnect flips status offline; connect
    // refreshes the link + bumps the count; heartbeat just keeps it live.
    const update: Record<string, unknown> =
      event === "disconnect"
        ? { status: "disconnected", last_heartbeat_at: now }
        : event === "heartbeat"
          ? { status: "connected", last_heartbeat_at: now }
          : { status: "connected", last_heartbeat_at: now, last_connected_at: now, connect_count: (existing.connect_count ?? 0) + 1 };

    const { error } = await supabase.from("mt5_connections").update(update).eq("id", existing.id);
    if (error) {
      console.error("[mt5-connected] Supabase update error:", error);
      return corsJson({ error: "Database error" }, { status: 500 });
    }
  } else if (event === "disconnect") {
    // Nothing to disconnect — no-op (don't create a row for a disconnect).
    return corsJson({ recorded: true });
  } else {
    // First time we hear about this account (connect or heartbeat) → create it.
    const { error } = await supabase
      .from("mt5_connections")
      .insert({ email, login, server, app, status: "connected", last_heartbeat_at: now });
    if (error) {
      console.error("[mt5-connected] Supabase insert error:", error);
      return corsJson({ error: "Database error" }, { status: 500 });
    }
  }

  return corsJson({ recorded: true });
}
