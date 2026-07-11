import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin, superAdminEmails } from "@/lib/admin";

export const dynamic = "force-dynamic";

/** Pull the live MQTT monitor from the app server (best-effort). */
async function fetchMqtt(): Promise<unknown> {
  const base = (process.env.APP_SERVER_URL || "").replace(/\/$/, "");
  if (!base) return { configured: false, error: "APP_SERVER_URL not set" };
  try {
    const headers: Record<string, string> = {};
    if (process.env.ADMIN_API_KEY) headers["x-admin-key"] = process.env.ADMIN_API_KEY;
    const res = await fetch(`${base}/api/admin/overview`, { headers, cache: "no-store" });
    if (!res.ok) return { configured: true, error: `App server returned ${res.status}` };
    return { configured: true, ...(await res.json()) };
  } catch (e) {
    return { configured: true, error: e instanceof Error ? e.message : "Unreachable" };
  }
}

/**
 * GET /api/admin/overview
 * God-mode snapshot: every distributor (with counts), every app user (with
 * license status), and the live MQTT monitor from the app server.
 */
export async function GET(req: NextRequest) {
  const gate = await requireSuperAdmin(req);
  if (!gate.ok || !gate.supabase) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const supabase = gate.supabase;

  const [{ data: distributors }, { data: eas }, { data: appUsers }, { data: adminEmails }, { data: mt5Conns }] = await Promise.all([
    supabase.from("distributors")
      .select("id, email, name, verified, onboarded, is_super_admin, is_active, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("eas").select("id, distributor_id, name, mentor_id, is_active"),
    supabase.from("app_users")
      .select("id, distributor_id, ea_id, email, is_active, license_key, license_sent_at, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("admin_emails").select("email, created_at").order("created_at", { ascending: true }),
    // Connected MT5 accounts — login NUMBER + server only, never the password.
    supabase.from("mt5_connections")
      .select("email, login, server, app, connect_count, first_connected_at, last_connected_at")
      .order("last_connected_at", { ascending: false }),
  ]);

  const easList = eas || [];
  const usersList = appUsers || [];
  const easById = new Map(easList.map(e => [e.id, e]));
  const distById = new Map((distributors || []).map(d => [d.id, d]));

  const distributorRows = (distributors || []).map(d => ({
    id: d.id,
    email: d.email,
    name: d.name,
    verified: d.verified,
    onboarded: d.onboarded,
    isSuperAdmin: d.is_super_admin,
    isActive: d.is_active,
    createdAt: d.created_at,
    eaCount: easList.filter(e => e.distributor_id === d.id).length,
    userCount: usersList.filter(u => u.distributor_id === d.id).length,
    licensesSent: usersList.filter(u => u.distributor_id === d.id && u.license_sent_at).length,
  }));

  const appUserRows = usersList.map(u => ({
    id: u.id,
    email: u.email,
    isActive: u.is_active,
    distributorId: u.distributor_id,
    distributorName: distById.get(u.distributor_id)?.name || "—",
    eaName: easById.get(u.ea_id)?.name || "—",
    hasLicense: !!u.license_key,
    licenseSentAt: u.license_sent_at,
    createdAt: u.created_at,
  }));

  // Connected MT5 accounts — the login NUMBER + server the app reported on a
  // successful connect. Passwords are never stored, so none are exposed here.
  const mt5Connections = (mt5Conns || []).map(c => ({
    email: c.email,
    login: c.login,
    server: c.server,
    app: c.app || "free-app",
    connectCount: c.connect_count,
    firstConnectedAt: c.first_connected_at,
    lastConnectedAt: c.last_connected_at,
  }));

  const stats = {
    distributors: distributorRows.length,
    verifiedDistributors: distributorRows.filter(d => d.verified).length,
    suspendedDistributors: distributorRows.filter(d => !d.isActive).length,
    eas: easList.length,
    appUsers: appUserRows.length,
    licensesIssued: appUserRows.filter(u => u.hasLicense).length,
    connectedAccounts: mt5Connections.length,
  };

  // ── Admins: registered (flagged distributors) + pending (allowlisted but not yet signed up) ──
  const envLocked = new Set(superAdminEmails());
  const distByEmail = new Map((distributors || []).map(d => [d.email.toLowerCase(), d]));
  const listEmails = (adminEmails || []).map(a => a.email.toLowerCase());
  // Union of allowlist emails and any flagged distributor emails.
  const flaggedEmails = (distributors || []).filter(d => d.is_super_admin).map(d => d.email.toLowerCase());
  const allAdminEmails = Array.from(new Set([...listEmails, ...flaggedEmails]));

  const admins = allAdminEmails.map(email => {
    const d = distByEmail.get(email);
    return {
      email,
      registered: !!d,
      name: d?.name ?? null,
      distributorId: d?.id ?? null,
      isActive: d ? d.is_active : null,
      locked: envLocked.has(email), // env-listed admins can't be removed from the UI
    };
  }).sort((a, b) => Number(b.registered) - Number(a.registered) || a.email.localeCompare(b.email));

  const mqtt = await fetchMqtt();

  return NextResponse.json({ stats, distributors: distributorRows, appUsers: appUserRows, admins, mt5Connections, mqtt });
}
