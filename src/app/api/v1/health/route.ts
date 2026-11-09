import { NextResponse } from "next/server";
import { serverDb } from "@/lib/pg";

export const dynamic = "force-dynamic";

/** GET /api/v1/health: can the site reach its database? Reports no settings or addresses. */
export async function GET() {
  if (!process.env.DATABASE_URL || !process.env.AUTH_SECRET) {
    return NextResponse.json({ ok: false, stage: "env-missing" });
  }
  const { error, count } = await serverDb.from("distributors").select("id", { count: "exact", head: true });
  if (error) return NextResponse.json({ ok: false, stage: "query-error", code: error.code ?? null });
  return NextResponse.json({ ok: true, stage: "connected", distributorsCount: count });
}
