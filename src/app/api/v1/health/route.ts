import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/health
 * Diagnostic: reports why the Supabase-backed API might be failing, without
 * leaking secrets. Safe to expose the URL (it is NEXT_PUBLIC) and only the
 * TYPE of the service key (never its value).
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const classify = (v?: string) =>
    !v
      ? "MISSING"
      : v.startsWith("https://") && v.includes(".supabase.co")
      ? "URL (belongs in NEXT_PUBLIC_SUPABASE_URL)"
      : v.startsWith("sb_publishable")
      ? "publishable key (belongs in ANON_KEY)"
      : v.startsWith("sb_secret")
      ? "secret key (belongs in SERVICE_ROLE_KEY)"
      : v.startsWith("eyJ")
      ? "legacy JWT"
      : "unknown format";

  const report: Record<string, unknown> = {
    NEXT_PUBLIC_SUPABASE_URL_value: url || null, // public var, safe to echo
    NEXT_PUBLIC_SUPABASE_URL_looksValid: !!url && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url),
    NEXT_PUBLIC_SUPABASE_ANON_KEY_type: classify(anon),
    SUPABASE_SERVICE_ROLE_KEY_type: classify(key),
  };

  if (!url || !key) {
    return NextResponse.json({ ok: false, stage: "env-missing", ...report });
  }

  let supabase;
  try {
    supabase = createClient(url, key);
  } catch (e) {
    return NextResponse.json({
      ok: false,
      stage: "createClient-threw",
      error: e instanceof Error ? e.message : String(e),
      ...report,
    });
  }

  try {
    const { error, count } = await supabase
      .from("distributors")
      .select("id", { count: "exact", head: true });
    if (error) {
      return NextResponse.json({
        ok: false,
        stage: "query-error",
        error: error.message,
        code: (error as { code?: string }).code ?? null,
        hint: "relation-not-exist → run setup.sql; auth/JWT error → wrong service key",
        ...report,
      });
    }
    return NextResponse.json({ ok: true, stage: "connected", distributorsCount: count, ...report });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      stage: "query-threw",
      error: e instanceof Error ? e.message : String(e),
      ...report,
    });
  }
}
