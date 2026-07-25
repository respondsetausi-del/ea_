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
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const report: Record<string, unknown> = {
    hasUrl: !!url,
    urlValue: url || null, // NEXT_PUBLIC → already shipped to the browser, safe
    urlLooksValid: !!url && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url),
    hasServiceKey: !!key,
    serviceKeyType: !key
      ? "MISSING"
      : key.startsWith("sb_secret")
      ? "secret (correct)"
      : key.startsWith("sb_publishable")
      ? "PUBLISHABLE — WRONG, use the Secret key"
      : key.startsWith("eyJ")
      ? "legacy JWT (ok)"
      : "unknown format",
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
