import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

/**
 * Super-admin (god-mode) helpers — SERVER ONLY.
 *
 * A user is a super admin if their email is in SUPER_ADMIN_EMAILS, OR their
 * distributor row has is_super_admin = true. An allowlist match auto-grants
 * the DB flag (the "Both" strategy), so the two stay in sync.
 */

export function superAdminEmails(): string[] {
  return (process.env.SUPER_ADMIN_EMAILS || "respondsetausi@gmail.com")
    .split(",")
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  // The owner is always a super admin, even if the SUPER_ADMIN_EMAILS list is
  // overridden and forgets to include them.
  return superAdminEmails().includes(email.toLowerCase()) || isOwnerEmail(email);
}

/**
 * The Super Super Admin (owner) — the permanent top tier. Exactly this
 * account (or accounts) can never be removed or demoted by anyone, and is
 * always a super admin. Configurable via SUPER_SUPER_ADMIN_EMAILS; defaults
 * to the project owner.
 */
export function ownerEmails(): string[] {
  return (process.env.SUPER_SUPER_ADMIN_EMAILS || "respondsetausi@gmail.com")
    .split(",")
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ownerEmails().includes(email.toLowerCase());
}

/** Check the runtime admin_emails allowlist (service client bypasses RLS). */
export async function isAdminEmailInTable(supabase: SupabaseClient, email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const { data } = await supabase
    .from("admin_emails")
    .select("email")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  return !!data;
}

export function getServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export interface SuperAdminResult {
  ok: boolean;
  status: number;
  error?: string;
  user?: { id: string; email: string | null };
  supabase?: SupabaseClient;
}

/**
 * Validate the request's bearer token and confirm the caller is a super admin.
 * Returns a service-role client (RLS-bypassing) for god-mode reads/writes.
 */
export async function requireSuperAdmin(req: NextRequest): Promise<SuperAdminResult> {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, status: 503, error: "Server not configured" };

  const auth = req.headers.get("authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!token) return { ok: false, status: 401, error: "Missing auth token" };

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData.user) return { ok: false, status: 401, error: "Invalid session" };

  const user = userData.user;
  const email = user.email ?? null;

  // Pull the distributor row (flag) and the runtime allowlist (table).
  const [{ data: distributor }, byTable] = await Promise.all([
    supabase.from("distributors").select("id, is_super_admin").eq("id", user.id).maybeSingle(),
    isAdminEmailInTable(supabase, email),
  ]);

  const byEmail = isSuperAdminEmail(email);
  const byFlag = !!distributor?.is_super_admin;

  if (!byEmail && !byFlag && !byTable) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  // Auto-grant: env/table admin but flag not yet set → persist it.
  if ((byEmail || byTable) && distributor && !distributor.is_super_admin) {
    await supabase.from("distributors").update({ is_super_admin: true }).eq("id", user.id);
  }

  return { ok: true, status: 200, user: { id: user.id, email }, supabase };
}
