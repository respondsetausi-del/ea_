import { NextRequest, NextResponse } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { resolveCaller } from "@/lib/admin";

/**
 * POST /api/users/create
 * Body: { email: string, ea_id?: string | null }
 *
 * Adds an app user. Who is calling decides whether they get in:
 *
 *   super / staff admin -> approved immediately
 *   mentor              -> pending; no access until an admin approves
 *
 * The dashboard used to insert straight from the browser, which meant the
 * "pending" default was enforced only by the UI — RLS grants a distributor
 * `for all` on their own rows, so a crafted request could set
 * status = 'approved' and self-grant access. Creation now goes through here,
 * where the tier is checked server-side, and a database trigger strips the
 * access columns from any write that isn't the service role.
 *
 * ea_id is optional: an admin can let an email in and assign a bot later. Such
 * a user signs in and waits on the app's licence screen until a key is issued.
 */

const DEFAULT_ACCESS_DAYS = 30;

async function accessDays(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase
    .from("app_settings").select("value").eq("key", "access_days").maybeSingle();
  const n = Number(data?.value);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_ACCESS_DAYS;
}

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const caller = await resolveCaller(req);
  if (!caller.ok || !caller.supabase || !caller.user) {
    return NextResponse.json({ error: caller.error }, { status: caller.status });
  }
  const supabase = caller.supabase;
  const isAdmin = caller.role === "super" || caller.role === "staff";

  let body: { email?: string; ea_id?: string | null; expires?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  // Only an admin may add someone without a bot. A mentor's client must be
  // attached to one of that mentor's EAs.
  const eaId = body.ea_id?.trim() || null;
  if (!eaId && !isAdmin) {
    return NextResponse.json({ error: "Select a trading bot" }, { status: 400 });
  }

  // The row belongs to whoever owns the EA; with no EA it belongs to the admin
  // adding it, so it still appears under an account rather than orphaned.
  let distributorId = caller.user.id;
  if (eaId) {
    const { data: ea } = await supabase
      .from("eas").select("id, distributor_id").eq("id", eaId).maybeSingle();
    if (!ea) return NextResponse.json({ error: "That bot no longer exists" }, { status: 404 });
    // A mentor may only add users to their own bots.
    if (!isAdmin && ea.distributor_id !== caller.user.id) {
      return NextResponse.json({ error: "That bot isn't yours" }, { status: 403 });
    }
    distributorId = ea.distributor_id;
  }

  const now = new Date().toISOString();
  const approved = isAdmin;

  // `expires: false` lets an admin grant permanent comped access; otherwise an
  // admin-added user gets the standard window, same as a paying one.
  const expiresAt = approved && body.expires !== false
    ? new Date(Date.now() + (await accessDays(supabase)) * 86_400_000).toISOString()
    : null;

  const row = {
    distributor_id: distributorId,
    ea_id: eaId,
    email,
    is_active: true,
    status: approved ? "approved" : "pending",
    approved_at: approved ? now : null,
    approved_by: approved ? (caller.user.email || "admin") : null,
    access_expires_at: expiresAt,
  };

  const { data: created, error } = await supabase
    .from("app_users").insert(row).select("id, email, status, ea_id, access_expires_at").single();

  if (error) {
    // 23505 = unique violation: this email already exists for that bot, or
    // already has a bot-less row.
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "That email is already added" }, { status: 409 });
    }
    console.error("[users/create] insert failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, user: created, approvedImmediately: approved });
}
