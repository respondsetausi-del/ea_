import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";

/**
 * Engine memory for the EA NAPTUNE app server (Render).
 *
 * The app's strategy engine and session keeper keep a small record per run so a
 * restart can pick up where it left off. They used to write it into TradePort's
 * MySQL database (tp_mt5_strategies / tp_mt5_sessions), a table TradePort also
 * writes, which once handed EA NAPTUNE a TradePort strategy to trade. Now it lives
 * here, in EA NAPTUNE's own Supabase (table engine_store).
 *
 * Server-to-server only: the caller must send x-engine-key equal to
 * ENGINE_STORE_KEY (set on Vercel and on the app's Render service). Never called
 * from a browser; no CORS.
 *
 *   GET    ?kind=strategy|session          -> { rows: [{ key, data, updated_at }] }
 *   PUT    { kind, key, data }             -> upsert one record
 *   DELETE { kind, key }                   -> remove one record
 */
export const dynamic = "force-dynamic";

const KINDS = new Set(["strategy", "session"]);

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

function authorised(req: NextRequest): boolean {
  const want = process.env.ENGINE_STORE_KEY || "";
  const got = req.headers.get("x-engine-key") || "";
  if (want.length < 32 || got.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

const deny = () => NextResponse.json({ error: "unauthorised" }, { status: 401 });
const bad = (m: string) => NextResponse.json({ error: m }, { status: 400 });
const fail = (e: unknown) => {
  console.error("engine-store:", e);
  return NextResponse.json({ error: "store unavailable" }, { status: 503 });
};

export async function GET(req: NextRequest) {
  if (!authorised(req)) return deny();
  const kind = req.nextUrl.searchParams.get("kind") || "";
  if (!KINDS.has(kind)) return bad("kind must be strategy or session");
  try {
    const { data, error } = await admin()
      .from("engine_store")
      .select("key, data, updated_at")
      .eq("kind", kind);
    if (error) throw error;
    return NextResponse.json({ rows: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return fail(e);
  }
}

export async function PUT(req: NextRequest) {
  if (!authorised(req)) return deny();
  const body = await req.json().catch(() => null);
  const kind = String(body?.kind ?? "");
  const key = String(body?.key ?? "");
  if (!KINDS.has(kind) || !key || key.length > 200 || body?.data === undefined) return bad("kind, key and data are required");
  try {
    const { error } = await admin()
      .from("engine_store")
      .upsert({ kind, key, data: body.data, updated_at: new Date().toISOString() }, { onConflict: "kind,key" });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: NextRequest) {
  if (!authorised(req)) return deny();
  const body = await req.json().catch(() => null);
  const kind = String(body?.kind ?? "");
  const key = String(body?.key ?? "");
  if (!KINDS.has(kind) || !key) return bad("kind and key are required");
  try {
    const { error } = await admin().from("engine_store").delete().eq("kind", kind).eq("key", key);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
