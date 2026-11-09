import { NextRequest, NextResponse } from "next/server";
import { bearer, getUserFromToken } from "@/lib/auth-server";
import { execute } from "@/lib/pg";
import type { Filter, Plan } from "@/lib/query-plan";

export const dynamic = "force-dynamic";

/**
 * The dashboards' way to the database. Browsers have no database login: they
 * describe a query and this route runs it for the signed-in mentor, with the
 * same owner rules the old row policies enforced, added here on every query.
 */

const OWNER: Record<string, string> = { app_users: "distributor_id", eas: "distributor_id", branding: "distributor_id", distributors: "id" };
const READ_ONLY = new Set(["distributors"]);

// Only an admin route may set these (what the enforce_app_user_access_fields trigger protected).
const PROTECTED: Record<string, string[]> = {
  app_users: ["id", "distributor_id", "status", "approved_at", "approved_by", "access_expires_at", "paid_at", "stripe_session_id", "access_via"],
  eas: ["id", "distributor_id", "is_instant_activation"],
  branding: ["id", "distributor_id"],
};
const OPS = new Set(["eq", "neq", "in", "is", "not.is", "ilike", "gte", "gt", "lte", "lt"]);

export async function POST(req: NextRequest) {
  const user = await getUserFromToken(bearer(req));
  if (!user) return NextResponse.json({ data: null, error: { message: "Invalid session" }, count: null }, { status: 401 });

  const plan = (await req.json().catch(() => null)) as Plan | null;
  const refuse = (message: string) => NextResponse.json({ data: null, error: { message }, count: null }, { status: 403 });
  if (!plan || typeof plan.table !== "string" || !Array.isArray(plan.filters) || !Array.isArray(plan.order)) return refuse("Bad request");

  const owner = OWNER[plan.table];
  if (!owner) return refuse("Not allowed");
  if (!["select", "insert", "update", "delete"].includes(plan.action)) return refuse("Not allowed");
  if (plan.action !== "select" && READ_ONLY.has(plan.table)) return refuse("Not allowed");
  if (plan.filters.some((f) => !OPS.has(f?.[0]))) return refuse("Not allowed");

  // The owner condition is added here, so no filter sent by a browser can widen it.
  const ownerFilter: Filter = ["eq", owner, user.id];
  const safe: Plan = { ...plan, onConflict: undefined, filters: [...plan.filters, ownerFilter] };

  if (plan.action === "insert" || plan.action === "update") {
    const clean = (row: Record<string, unknown>) => {
      const copy = { ...row };
      for (const key of PROTECTED[plan.table] ?? []) delete copy[key];
      return plan.action === "insert" ? { ...copy, [owner]: user.id } : copy;
    };
    safe.values = Array.isArray(plan.values) ? plan.values.map(clean) : clean(plan.values as Record<string, unknown>);
  }
  if (plan.action === "insert") safe.filters = [];

  return NextResponse.json(await execute(safe));
}
