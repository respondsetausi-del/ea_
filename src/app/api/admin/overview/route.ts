import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, superAdminEmails, ownerEmails, isOwnerEmail } from "@/lib/admin";
import { resolveInstantActivationEA, INSTANT_ACTIVATION_EA_NAME } from "@/lib/instant-activation";
import { isBrevoConfigured } from "@/lib/brevo";

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

/** Aggregate site-traffic events into visit / unique / returning / login buckets. */
function buildTraffic(
  events: Array<{ event_type: string; visitor_id: string | null; occurred_at: string }>,
  startOfToday: number,
  weekAgo: number,
  monthAgo: number,
) {
  const ms = (s: string) => new Date(s).getTime();
  const visits = events.filter(e => e.event_type === "visit");
  const logins = events.filter(e => e.event_type === "login");
  const since = (arr: typeof events, from: number) => arr.filter(e => ms(e.occurred_at) >= from);
  const uniq = (arr: typeof events) => new Set(arr.map(e => e.visitor_id).filter(Boolean)).size;

  // Returning (month): visitor ids that show up 2+ times in the month window.
  const monthVisits = since(visits, monthAgo);
  const counts = new Map<string, number>();
  for (const e of monthVisits) {
    if (e.visitor_id) counts.set(e.visitor_id, (counts.get(e.visitor_id) ?? 0) + 1);
  }
  const returningMonth = Array.from(counts.values()).filter(n => n >= 2).length;

  return {
    visitsToday: since(visits, startOfToday).length,
    visitsWeek: since(visits, weekAgo).length,
    visitsMonth: monthVisits.length,
    uniqueToday: uniq(since(visits, startOfToday)),
    uniqueWeek: uniq(since(visits, weekAgo)),
    uniqueMonth: uniq(monthVisits),
    returningMonth,
    loginsToday: since(logins, startOfToday).length,
    loginsWeek: since(logins, weekAgo).length,
    loginsMonth: since(logins, monthAgo).length,
  };
}

/**
 * GET /api/admin/overview
 * God-mode snapshot: every distributor (with counts), every app user (with
 * license status), and the live MQTT monitor from the app server.
 */
export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req, { allowStaff: true });
  if (!gate.ok || !gate.supabase) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const supabase = gate.supabase;

  const eventsSince = new Date(Date.now() - 31 * 86_400_000).toISOString();
  const [{ data: distributors }, { data: eas }, { data: appUsers }, { data: adminEmails }, { data: mt5Conns }, { data: events }] = await Promise.all([
    supabase.from("distributors")
      .select("id, email, name, verified, onboarded, is_super_admin, is_staff_admin, is_active, created_at, telegram_url, discord_url, youtube_url, tiktok_url")
      .order("created_at", { ascending: false }),
    supabase.from("eas").select("id, distributor_id, name, mentor_id, is_active"),
    supabase.from("app_users")
      .select("id, distributor_id, ea_id, email, is_active, license_key, license_sent_at, created_at, last_seen")
      .order("created_at", { ascending: false }),
    supabase.from("admin_emails").select("email, created_at").order("created_at", { ascending: true }),
    // Connected MT5 accounts — login NUMBER + server only, never the password.
    supabase.from("mt5_connections")
      .select("email, login, server, app, status, connect_count, first_connected_at, last_connected_at, last_heartbeat_at")
      .order("last_connected_at", { ascending: false }),
    // Site-traffic events (last 31 days) — visits + logins for the traffic tiles.
    supabase.from("analytics_events")
      .select("event_type, visitor_id, occurred_at")
      .gte("occurred_at", eventsSince),
  ]);

  const easList = eas || [];
  const usersList = appUsers || [];
  const easById = new Map(easList.map(e => [e.id, e]));
  const distById = new Map((distributors || []).map(d => [d.id, d]));

  // How each user got access: 'payment' (came through Stripe → register) vs
  // 'manual' (added by a mentor, no payment). The column may not exist before
  // the migration runs, so query defensively and default to 'manual'.
  const accessRes = await supabase.from("app_users").select("id, access_via");
  const accessById = new Map<string, string>();
  if (!accessRes.error && accessRes.data) {
    for (const r of accessRes.data as Array<{ id: string; access_via?: string }>) {
      accessById.set(r.id, r.access_via || "manual");
    }
  }
  const accessVia = (id: string) => accessById.get(id) || "manual";

  // Approval state ships in supabase-user-approval-migration.sql. Query it
  // separately (and tolerate failure) so the dashboard still renders on a
  // database where that migration has not been run yet.
  type ApprovalRow = {
    id: string;
    status?: string;
    paid_at?: string | null;
    approved_at?: string | null;
    approved_by?: string | null;
    first_login_at?: string | null;
  };
  const approvalRes = await supabase
    .from("app_users")
    .select("id, status, paid_at, approved_at, approved_by, first_login_at");
  const approvalById = new Map<string, ApprovalRow>();
  if (!approvalRes.error && approvalRes.data) {
    for (const r of approvalRes.data as ApprovalRow[]) approvalById.set(r.id, r);
  }

  const distributorRows = (distributors || []).map(d => ({
    id: d.id,
    email: d.email,
    name: d.name,
    verified: d.verified,
    onboarded: d.onboarded,
    isSuperAdmin: d.is_super_admin,
    isStaffAdmin: !!d.is_staff_admin,
    isActive: d.is_active,
    createdAt: d.created_at,
    eaCount: easList.filter(e => e.distributor_id === d.id).length,
    userCount: usersList.filter(u => u.distributor_id === d.id).length,
    licensesSent: usersList.filter(u => u.distributor_id === d.id && u.license_sent_at).length,
    // Paying clients under this mentor — the number that actually says whether
    // approving them was worth it.
    paidUserCount: usersList.filter(u => u.distributor_id === d.id && approvalById.get(u.id)?.paid_at).length,
    // Where their audience is. Collected at signup; this is what the super
    // admin reviews the application on.
    socials: {
      telegram: d.telegram_url || null,
      discord: d.discord_url || null,
      youtube: d.youtube_url || null,
      tiktok: d.tiktok_url || null,
    },
  }));

  // MT5 sessions seen in the last 10 minutes. The heartbeat runs every few
  // minutes, so anything older is a session that has stopped rather than one
  // that is quiet.
  const LIVE_WINDOW_MS = 10 * 60_000;
  const liveEmails = new Set(
    (mt5Conns || [])
      .filter(c => c.status === "connected"
        && c.last_heartbeat_at
        && Date.now() - new Date(c.last_heartbeat_at as string).getTime() < LIVE_WINDOW_MS)
      .map(c => (c.email || "").toLowerCase())
      .filter(Boolean),
  );

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
    accessVia: accessVia(u.id),
    // Missing status → treat as already-approved, so a pre-migration database
    // doesn't show every existing client as a pending request.
    status: approvalById.get(u.id)?.status || "approved",
    paidAt: approvalById.get(u.id)?.paid_at || null,
    approvedAt: approvalById.get(u.id)?.approved_at || null,
    approvedBy: approvalById.get(u.id)?.approved_by || null,
    // last_seen is stamped by /api/v1/authorize on every successful app login,
    // so a null firstLoginAt means the client has never actually got in.
    firstLoginAt: approvalById.get(u.id)?.first_login_at || null,
    lastSeen: (u.last_seen as string) || null,
    // Is their robot actually trading right now? A licence being issued says
    // nothing about that — this is the MT5 session the app server reports,
    // matched on the address the client connected with.
    running: liveEmails.has((u.email || "").toLowerCase()),
  }));

  /** When this user actually paid, or null. The honest signal for revenue. */
  const paidAtOf = (id: string): string | null => approvalById.get(id)?.paid_at || null;

  // Requests awaiting a decision, newest first — the super admin's inbox.
  const pendingRequests = appUserRows
    .filter(u => u.status === "pending")
    .sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime());

  // Mentors awaiting approval. `verified` is the gate the login and dashboard
  // both read, so an unverified distributor is one who has signed up and
  // cannot get in yet. Previously nothing surfaced these as a queue — they
  // were only visible by scanning the full distributor list for a flag.
  const pendingDistributors = distributorRows
    .filter(d => !d.verified && d.isActive)
    .sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime());

  // Live status: an account is "online" only if it's marked connected AND its
  // last heartbeat is fresh (the app pings while its MT5 session is alive), so
  // a force-killed app naturally drops offline once its heartbeats lapse.
  const ONLINE_WINDOW_MS = 120_000; // 2 minutes (heartbeat is ~45s)
  const nowForStatus = Date.now();
  const isOnline = (c: Record<string, unknown>) =>
    (c.status ?? "connected") === "connected" &&
    !!c.last_heartbeat_at &&
    nowForStatus - new Date(c.last_heartbeat_at as string).getTime() < ONLINE_WINDOW_MS;

  // Connected MT5 accounts — the login NUMBER + server the app reported on a
  // successful connect. Passwords are never stored, so none are exposed here.
  const mt5Connections = (mt5Conns || []).map(c => ({
    email: c.email,
    login: c.login,
    server: c.server,
    app: c.app || "ea-naptune",
    status: c.status || "connected",
    online: isOnline(c),
    connectCount: c.connect_count,
    firstConnectedAt: c.first_connected_at,
    lastConnectedAt: c.last_connected_at,
    lastHeartbeatAt: c.last_heartbeat_at,
  }));

  // ── Time-bucketed analytics (doc item 3) ──────────────────────────
  // Everything here is derivable from existing tables — no event capture
  // needed. App downloads, website visitors and logins-over-time require
  // instrumentation (a separate analytics_events table) and are not here yet.
  const nowMs = Date.now();
  const DAY = 86_400_000;
  const startOfToday = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
  const weekAgo = nowMs - 7 * DAY;
  const monthAgo = nowMs - 30 * DAY;
  const countSince = (
    rows: Array<Record<string, unknown>>,
    get: (r: Record<string, unknown>) => string | null | undefined,
    from: number,
    to = Infinity,
  ) => rows.filter(r => {
    const v = get(r);
    if (!v) return false;
    const t = new Date(v).getTime();
    return t >= from && t < to;
  }).length;

  const analytics = {
    mentors: {
      total: distributorRows.length,
      active: distributorRows.filter(d => d.isActive).length,
      verified: distributorRows.filter(d => d.verified).length,
      newToday: countSince(distributorRows, d => d.createdAt as string, startOfToday),
      newWeek: countSince(distributorRows, d => d.createdAt as string, weekAgo),
      newMonth: countSince(distributorRows, d => d.createdAt as string, monthAgo),
    },
    users: {
      total: usersList.length,
      active: usersList.filter(u => u.is_active).length,
      newToday: countSince(usersList, u => u.created_at as string, startOfToday),
      newWeek: countSince(usersList, u => u.created_at as string, weekAgo),
      newMonth: countSince(usersList, u => u.created_at as string, monthAgo),
      seen24h: countSince(usersList, u => u.last_seen as string, nowMs - DAY),
      seen7d: countSince(usersList, u => u.last_seen as string, weekAgo),
      seen30d: countSince(usersList, u => u.last_seen as string, monthAgo),
    },
    licenses: {
      total: usersList.filter(u => u.license_key).length,
      sentToday: countSince(usersList, u => u.license_sent_at as string, startOfToday),
      sentWeek: countSince(usersList, u => u.license_sent_at as string, weekAgo),
      sentMonth: countSince(usersList, u => u.license_sent_at as string, monthAgo),
    },
    bots: {
      total: easList.length,
      active: easList.filter(e => e.is_active).length,
    },
    connections: {
      total: (mt5Conns || []).length,
      online: (mt5Conns || []).filter(isOnline).length,
      offline: (mt5Conns || []).length - (mt5Conns || []).filter(isOnline).length,
      active24h: countSince(mt5Conns || [], c => c.last_connected_at as string, nowMs - DAY),
      active7d: countSince(mt5Conns || [], c => c.last_connected_at as string, weekAgo),
      active30d: countSince(mt5Conns || [], c => c.last_connected_at as string, monthAgo),
    },
    traffic: buildTraffic(events || [], startOfToday, weekAgo, monthAgo),
    // Counted on paid_at, which the Stripe webhook stamps when money clears.
    //
    // These compared access_via to the string "payment", but the webhook writes
    // "stripe" — only the older register route ever wrote "payment". So every
    // Stripe customer was counted as non-paying and the paid tiles read zero
    // while real money was arriving. Dating them from paid_at rather than
    // created_at also means "paid this week" describes the payment, not when
    // the row happened to be created.
    payments: {
      paid: usersList.filter(u => paidAtOf(u.id)).length,
      nonPaying: usersList.filter(u => !paidAtOf(u.id)).length,
      paidToday: countSince(usersList, u => paidAtOf(String(u.id)) as string, startOfToday),
      paidWeek: countSince(usersList, u => paidAtOf(String(u.id)) as string, weekAgo),
      paidMonth: countSince(usersList, u => paidAtOf(String(u.id)) as string, monthAgo),
    },
  };

  const stats = {
    distributors: distributorRows.length,
    verifiedDistributors: distributorRows.filter(d => d.verified).length,
    suspendedDistributors: distributorRows.filter(d => !d.isActive).length,
    eas: easList.length,
    appUsers: appUserRows.length,
    paidUsers: appUserRows.filter(u => u.accessVia === "payment").length,
    nonPayingUsers: appUserRows.filter(u => u.accessVia !== "payment").length,
    licensesIssued: appUserRows.filter(u => u.hasLicense).length,
    pendingRequests: appUserRows.filter(u => u.status === "pending").length,
    pendingPaid: appUserRows.filter(u => u.status === "pending" && u.paidAt).length,
    pendingDistributors: pendingDistributors.length,
    connectedAccounts: mt5Connections.length,
    onlineAccounts: mt5Connections.filter(c => c.online).length,
  };

  // ── Admins: registered (flagged distributors) + pending (allowlisted but not yet signed up) ──
  const envLocked = new Set(superAdminEmails());
  const distByEmail = new Map((distributors || []).map(d => [d.email.toLowerCase(), d]));
  const listEmails = (adminEmails || []).map(a => a.email.toLowerCase());
  // Union of allowlist emails and any flagged distributor emails.
  const flaggedEmails = (distributors || []).filter(d => d.is_super_admin).map(d => d.email.toLowerCase());
  // Always include the owner(s) so the super super admin is visible even if not
  // yet registered/flagged.
  const allAdminEmails = Array.from(new Set([...listEmails, ...flaggedEmails, ...ownerEmails()]));

  const admins = allAdminEmails.map(email => {
    const d = distByEmail.get(email);
    const owner = isOwnerEmail(email);
    return {
      email,
      registered: !!d,
      name: d?.name ?? null,
      distributorId: d?.id ?? null,
      isActive: d ? d.is_active : null,
      isOwner: owner, // super super admin — permanent, can't be removed/demoted
      locked: owner || envLocked.has(email), // owner + env-listed admins can't be removed from the UI
    };
  }).sort((a, b) => Number(b.isOwner) - Number(a.isOwner) || Number(b.registered) - Number(a.registered) || a.email.localeCompare(b.email));

  // ── Instant Activation robot: the public mentor-less licensing flow ──
  // Read the toggle flags defensively — the column may not exist pre-migration,
  // in which case the switch UI is disabled and name/env resolution still works.
  const faFlagRes = await supabase.from("eas").select("id, is_instant_activation");
  const faSwitchable = !faFlagRes.error;
  const faFlags = new Map<string, boolean>(
    (faSwitchable && faFlagRes.data ? faFlagRes.data : []).map((r: { id: string; is_instant_activation?: boolean }) => [r.id, !!r.is_instant_activation]),
  );
  const easRows = easList.map(e => ({
    id: e.id,
    name: e.name,
    mentorId: e.mentor_id,
    isActive: e.is_active,
    distributorName: distById.get(e.distributor_id)?.name || "—",
    isInstantActivation: faFlags.get(e.id) ?? false,
  }));

  const faEA = await resolveInstantActivationEA(supabase);
  const instantActivation = faEA
    ? {
        configured: true,
        switchable: faSwitchable,
        eaId: faEA.id,
        eaName: faEA.name,
        mentorId: faEA.mentor_id,
        active: faEA.is_active,
        distributorName: distById.get(faEA.distributor_id)?.name || "—",
        activations: usersList.filter(u => u.ea_id === faEA.id && u.license_sent_at).length,
      }
    : { configured: false, switchable: faSwitchable, expectedName: INSTANT_ACTIVATION_EA_NAME };

  const mqtt = await fetchMqtt();

  // Platform settings. Defaults to require-payment when the table or row is
  // missing, matching /api/v1/authorize.
  let requirePayment = true;
  const settingRes = await supabase
    .from("app_settings").select("value").eq("key", "require_payment").maybeSingle();
  if (!settingRes.error && settingRes.data) requirePayment = settingRes.data.value !== false;

  // Whether outbound email will actually send. Approval notifications fail
  // silently by design (a mail outage must not block an approval), so without
  // this the panel would look identical whether Brevo is wired up or not.
  const email = {
    configured: isBrevoConfigured(),
    sender: process.env.BREVO_SENDER_EMAIL || null,
    senderName: process.env.BREVO_SENDER_NAME || "EA NAPTUNE",
    signupMode: (process.env.NEXT_PUBLIC_SIGNUP_MODE || "open").toLowerCase(),
  };

  // Payment records stay with the owner (super super admin) — not staff, and
  // not other super admins. A row exists only if a request arrived carrying a
  // signature that verified against STRIPE_WEBHOOK_SECRET, so the list is
  // itself the evidence that the money came through Stripe.
  const viewerIsOwner = isOwnerEmail(gate.user!.email);
  let stripeEvents: unknown[] | null = null;
  if (viewerIsOwner) {
    const { data: evs } = await supabase
      .from("stripe_events")
      .select("event_id, event_type, session_id, email, amount_total, currency, livemode, payment_status, payment_intent, processed_at")
      .order("processed_at", { ascending: false })
      .limit(100);
    stripeEvents = evs ?? [];
  }

  // Staff admins get mentors and paid clients plus the queues they can act on
  // — and nothing else. Withheld here rather than hidden in the UI, so the data
  // never reaches the browser in the first place.
  if (gate.role === "staff") {
    const paidClients = appUserRows.filter(u => u.paidAt || u.accessVia === "payment");
    return NextResponse.json({
      role: "staff",
      stats: {
        distributors: distributorRows.length,
        pendingDistributors: pendingDistributors.length,
        paidUsers: paidClients.length,
        pendingRequests: pendingRequests.length,
      },
      distributors: distributorRows,
      appUsers: paidClients,
      pendingRequests,
      pendingDistributors,
      admins: [],
      mt5Connections: [],
      mqtt: { configured: false },
      email,
    });
  }

  return NextResponse.json({ role: "super", stats, analytics, distributors: distributorRows, appUsers: appUserRows, pendingRequests, pendingDistributors, admins, eas: easRows, mt5Connections, instantActivation, mqtt, email, stripeEvents, viewerIsOwner, settings: { requirePayment } });
}
