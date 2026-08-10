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

/**
 * Admin tiers.
 *
 *  super — god mode: suspend/delete accounts, grant admin, platform settings
 *  staff — delegated: sees mentors and paid clients, and may approve or reject
 *          them. Nothing destructive, no admin management, no settings.
 */
export type AdminRole = "super" | "staff";

export interface SuperAdminResult {
  ok: boolean;
  status: number;
  error?: string;
  user?: { id: string; email: string | null };
  supabase?: SupabaseClient;
  role?: AdminRole;
}

/**
 * The actions a staff admin is allowed to perform, as `${type}.${action}`.
 *
 * An allowlist rather than a blocklist on purpose: a new destructive action
 * added later is denied to staff by default instead of silently inheriting.
 */
const STAFF_ALLOWED = new Set([
  "distributor.verify",
  "app_user.approve",
  "app_user.reject",
]);

export function staffCanPerform(type: string, action: string): boolean {
  return STAFF_ALLOWED.has(`${type}.${action}`);
}

/** Super admin outranks staff, so the lesser flag is cleared on promotion. */
export const SUPER_ADMIN_UPDATE = { is_super_admin: true, is_staff_admin: false } as const;

export interface CallerResult {
  ok: boolean;
  status: number;
  error?: string;
  user?: { id: string; email: string | null };
  supabase?: SupabaseClient;
  /** null = a signed-in distributor with no admin tier (an ordinary mentor). */
  role?: AdminRole | null;
}

/**
 * Identify the caller without demanding they be an admin.
 *
 * requireAdmin() answers "may this person act as an admin?" and 403s a mentor.
 * This answers "who is this?", which is what an endpoint used by both mentors
 * and admins needs — the tier then decides what the write is allowed to say,
 * rather than whether it happens at all.
 */
export async function resolveCaller(req: NextRequest): Promise<CallerResult> {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, status: 503, error: "Server not configured" };

  const auth = req.headers.get("authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!token) return { ok: false, status: 401, error: "Missing auth token" };

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData.user) return { ok: false, status: 401, error: "Invalid session" };

  const user = userData.user;
  const email = user.email ?? null;

  const [{ data: distributor }, byTable] = await Promise.all([
    supabase.from("distributors").select("id, is_super_admin, is_staff_admin, is_active").eq("id", user.id).maybeSingle(),
    isAdminEmailInTable(supabase, email),
  ]);

  if (distributor && distributor.is_active === false) {
    return { ok: false, status: 403, error: "This account has been suspended" };
  }

  const isSuper = isSuperAdminEmail(email) || !!distributor?.is_super_admin || byTable;
  const isStaff = !isSuper && !!distributor?.is_staff_admin;

  return {
    ok: true,
    status: 200,
    user: { id: user.id, email },
    supabase,
    role: isSuper ? "super" : isStaff ? "staff" : null,
  };
}

/**
 * Validate the request's bearer token and resolve the caller's admin tier.
 * Returns a service-role client (RLS-bypassing) for the reads/writes allowed
 * at that tier.
 *
 * `allowStaff` defaults to false so every existing caller keeps its
 * super-admin-only behaviour unless it opts in.
 */
export async function requireAdmin(req: NextRequest, opts: { allowStaff?: boolean } = {}): Promise<SuperAdminResult> {
  const supabase = getServiceClient();
  if (!supabase) return { ok: false, status: 503, error: "Server not configured" };

  const auth = req.headers.get("authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!token) return { ok: false, status: 401, error: "Missing auth token" };

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData.user) return { ok: false, status: 401, error: "Invalid session" };

  const user = userData.user;
  const email = user.email ?? null;

  // Pull the distributor row (flags) and the runtime allowlist (table).
  const [{ data: distributor }, byTable] = await Promise.all([
    supabase.from("distributors").select("id, is_super_admin, is_staff_admin").eq("id", user.id).maybeSingle(),
    isAdminEmailInTable(supabase, email),
  ]);

  const byEmail = isSuperAdminEmail(email);
  const byFlag = !!distributor?.is_super_admin;
  const isSuper = byEmail || byFlag || byTable;
  // Super admin outranks staff, so a super admin never resolves as staff.
  const isStaff = !isSuper && !!distributor?.is_staff_admin;

  if (!isSuper && !(opts.allowStaff && isStaff)) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  // Auto-grant: env/table admin but flag not yet set → persist it.
  if ((byEmail || byTable) && distributor && !distributor.is_super_admin) {
    await supabase.from("distributors").update({ is_super_admin: true }).eq("id", user.id);
  }

  return {
    ok: true,
    status: 200,
    user: { id: user.id, email },
    supabase,
    role: isSuper ? "super" : "staff",
  };
}

/** Super-admin only. Unchanged behaviour for every existing caller. */
export async function requireSuperAdmin(req: NextRequest): Promise<SuperAdminResult> {
  return requireAdmin(req);
}
