"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, DEV_MODE } from "@/lib/supabase";
import {
  ShieldCheck, Users, Bot, KeyRound, Activity, Radio, Trash2,
  BadgeCheck, Ban, Power, PowerOff, Send, Crown, RefreshCw, AlertTriangle, UserPlus, Lock, Clock, Link2, BarChart3,
} from "lucide-react";

const ACCENT = "#FFB800";
const CARD = "#161B22";
const MUTED = "#8B949E";
const INPUT_BG = "rgba(13,17,23,0.8)";
const BORDER = "rgba(255,184,0,0.1)";

// Friendly display names for the app that reported a connected account. The raw
// tag comes from each app's reportMT5Connection() call; "free-app" is the
// EA Access product. Unknown tags fall back to the raw value.
const APP_LABELS: Record<string, string> = {
  "free-app": "EA Access (iOS)",
  "ea-access-android": "EA Access (Android)",
  "ea-converter": "EA Converter (iOS)",
  "ea-converter-android": "EA Converter (Android)",
  "tradeport": "Tradeport (iOS)",
  "tradeport-android": "Tradeport (Android)",
  "emc": "EA Mobile Connect (iOS)",
  "emc-android": "EA Mobile Connect (Android)",
};
const appLabel = (app: string) => APP_LABELS[app] || app;

type Distributor = {
  id: string; email: string; name: string; verified: boolean; onboarded: boolean;
  isSuperAdmin: boolean; isActive: boolean; createdAt: string;
  eaCount: number; userCount: number; licensesSent: number;
};
type AppUser = {
  id: string; email: string; isActive: boolean; distributorName: string;
  eaName: string; hasLicense: boolean; licenseSentAt: string | null; createdAt: string;
};
type Admin = {
  email: string; registered: boolean; name: string | null;
  distributorId: string | null; isActive: boolean | null; locked: boolean; isOwner: boolean;
};
type ConnectedAccount = {
  email: string; login: string; server: string; app: string;
  status: string; online: boolean; lastHeartbeatAt: string | null;
  connectCount: number; firstConnectedAt: string | null; lastConnectedAt: string | null;
};
type Analytics = {
  mentors: { total: number; active: number; verified: number; newToday: number; newWeek: number; newMonth: number };
  users: { total: number; active: number; newToday: number; newWeek: number; newMonth: number; seen24h: number; seen7d: number; seen30d: number };
  licenses: { total: number; sentToday: number; sentWeek: number; sentMonth: number };
  bots: { total: number; active: number };
  connections: { total: number; online: number; offline: number; active24h: number; active7d: number; active30d: number };
  traffic: { visitsToday: number; visitsWeek: number; visitsMonth: number; uniqueToday: number; uniqueWeek: number; uniqueMonth: number; returningMonth: number; loginsToday: number; loginsWeek: number; loginsMonth: number };
};
type FreeActivation = {
  configured: boolean;
  switchable?: boolean;
  eaId?: string;
  eaName?: string;
  mentorId?: string;
  active?: boolean;
  distributorName?: string;
  activations?: number;
  expectedName?: string;
};
type EARow = {
  id: string; name: string; mentorId: string; isActive: boolean;
  distributorName: string; isFreeActivation: boolean;
};
type Overview = {
  stats: Record<string, number>;
  analytics?: Analytics;
  distributors: Distributor[];
  appUsers: AppUser[];
  admins: Admin[];
  eas?: EARow[];
  mt5Connections: ConnectedAccount[];
  freeActivation?: FreeActivation;
  mqtt: any;
};

const DEMO: Overview = {
  stats: { distributors: 3, verifiedDistributors: 2, suspendedDistributors: 1, eas: 4, appUsers: 5, licensesIssued: 3, connectedAccounts: 2, onlineAccounts: 1 },
  analytics: {
    mentors: { total: 3, active: 2, verified: 2, newToday: 0, newWeek: 1, newMonth: 2 },
    users: { total: 5, active: 4, newToday: 1, newWeek: 2, newMonth: 4, seen24h: 2, seen7d: 3, seen30d: 4 },
    licenses: { total: 3, sentToday: 0, sentWeek: 1, sentMonth: 2 },
    bots: { total: 4, active: 3 },
    connections: { total: 2, online: 1, offline: 1, active24h: 1, active7d: 2, active30d: 2 },
    traffic: { visitsToday: 42, visitsWeek: 310, visitsMonth: 1180, uniqueToday: 30, uniqueWeek: 190, uniqueMonth: 640, returningMonth: 145, loginsToday: 8, loginsWeek: 44, loginsMonth: 160 },
  },
  distributors: [
    { id: "d1", email: "respondsetausi@gmail.com", name: "Super Admin", verified: true, onboarded: true, isSuperAdmin: true, isActive: true, createdAt: "2025-01-01T00:00:00Z", eaCount: 2, userCount: 3, licensesSent: 2 },
    { id: "d2", email: "bellion@example.com", name: "Bellion FX", verified: true, onboarded: true, isSuperAdmin: false, isActive: true, createdAt: "2025-02-10T00:00:00Z", eaCount: 1, userCount: 2, licensesSent: 1 },
    { id: "d3", email: "pending@example.com", name: "New Distributor", verified: false, onboarded: false, isSuperAdmin: false, isActive: false, createdAt: "2025-05-01T00:00:00Z", eaCount: 1, userCount: 0, licensesSent: 0 },
  ],
  appUsers: [
    { id: "u1", email: "trader1@example.com", isActive: true, distributorName: "Bellion FX", eaName: "Gold Scalper", hasLicense: true, licenseSentAt: "2025-04-02T00:00:00Z", createdAt: "2025-03-01T00:00:00Z" },
    { id: "u2", email: "trader2@example.com", isActive: false, distributorName: "Bellion FX", eaName: "Gold Scalper", hasLicense: false, licenseSentAt: null, createdAt: "2025-03-10T00:00:00Z" },
  ],
  admins: [
    { email: "respondsetausi@gmail.com", registered: true, name: "Super Admin", distributorId: "d1", isActive: true, locked: true, isOwner: true },
    { email: "mentor@example.com", registered: true, name: "Bellion FX", distributorId: "d2", isActive: true, locked: false, isOwner: false },
    { email: "newadmin@example.com", registered: false, name: null, distributorId: null, isActive: null, locked: false, isOwner: false },
  ],
  mt5Connections: [
    { email: "trader1@example.com", login: "4078302", server: "RazorMarkets-Live", app: "free-app", status: "connected", online: true, lastHeartbeatAt: "2026-06-20T00:00:00Z", connectCount: 3, firstConnectedAt: "2026-06-01T00:00:00Z", lastConnectedAt: "2026-06-20T00:00:00Z" },
    { email: "trader2@example.com", login: "5091188", server: "RazorMarkets-Live", app: "ea-converter", status: "disconnected", online: false, lastHeartbeatAt: "2026-06-18T00:00:00Z", connectCount: 1, firstConnectedAt: "2026-06-18T00:00:00Z", lastConnectedAt: "2026-06-18T00:00:00Z" },
  ],
  eas: [
    { id: "demo-1", name: "EA ACCESS SCALPER", mentorId: "EA-SCLP-2K9X", isActive: true, distributorName: "Super Admin", isFreeActivation: true },
    { id: "demo-2", name: "Gold Scalper Pro", mentorId: "EA-GX4R-8KNP", isActive: true, distributorName: "Bellion FX", isFreeActivation: false },
    { id: "demo-3", name: "Forex Hunter", mentorId: "EA-LM7W-Q2FT", isActive: false, distributorName: "Bellion FX", isFreeActivation: false },
  ],
  freeActivation: { configured: true, switchable: true, eaId: "demo-1", eaName: "EA ACCESS SCALPER", mentorId: "EA-SCLP-2K9X", active: true, distributorName: "Super Admin", activations: 12 },
  mqtt: { configured: true, mqtt: { healthy: true, live: true, brokerConnectionsOpen: 2, connectedAccounts: 2, totalSignals: 128, lastSignalAt: "2026-06-01T20:56:03Z", secondsSinceLastSignal: 14 },
    accounts: { count: 2, symbols: ["EURUSD", "XAUUSD"], list: [
      { id: "acct-abc", ip: "102.89.x.x", symbols: ["EURUSD", "XAUUSD"], signalsReceived: 64, connectedForSeconds: 3600 },
    ] },
    signals: { total: 128, bySymbol: { EURUSD: 80, XAUUSD: 48 }, recent: [
      { symbol: "EURUSD", direction: "BUY", receivedAt: "2026-06-01T20:56:03Z" },
      { symbol: "XAUUSD", direction: "SELL", receivedAt: "2026-06-01T20:55:40Z" },
    ] } },
};

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function AdminPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [newAdmin, setNewAdmin] = useState("");
  const [addingAdmin, setAddingAdmin] = useState(false);

  const load = useCallback(async () => {
    setError("");
    if (DEV_MODE) { setData(DEMO); setLoading(false); return; }
    try {
      const res = await fetch("/api/admin/overview", { headers: await authHeaders(), cache: "no-store" });
      if (res.status === 403) { setError("You don't have super-admin access."); setLoading(false); return; }
      if (!res.ok) { setError("Failed to load admin data."); setLoading(false); return; }
      setData(await res.json());
    } catch {
      setError("Something went wrong.");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Live refresh — keeps the MT5 online/offline status current without a manual
  // reload (the app heartbeats every ~45s; we re-poll every 15s).
  useEffect(() => {
    const t = setInterval(() => { load(); }, 15000);
    return () => clearInterval(t);
  }, [load]);

  const act = async (type: "distributor" | "app_user", id: string, action: string, confirmMsg?: string) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusy(`${id}:${action}`);
    if (DEV_MODE) {
      await new Promise(r => setTimeout(r, 400));
      setBusy(null);
      alert(`(demo) ${action} on ${type} ${id}`);
      return;
    }
    try {
      const res = await fetch("/api/admin/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ type, id, action }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) alert(j.error || "Action failed");
      else await load();
    } catch {
      alert("Action failed");
    }
    setBusy(null);
  };

  const adminAct = async (action: "add" | "remove", email: string, confirmMsg?: string) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    const key = action === "add" ? "add-admin" : `admin:${email}`;
    if (action === "add") setAddingAdmin(true); else setBusy(key);
    if (DEV_MODE) {
      await new Promise(r => setTimeout(r, 400));
      if (action === "add") { setNewAdmin(""); alert(`(demo) ${email} added as admin`); }
      else alert(`(demo) ${email} removed`);
      setAddingAdmin(false); setBusy(null);
      return;
    }
    try {
      const res = await fetch("/api/admin/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ type: "admin", action, email }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) alert(j.error || "Action failed");
      else { setNewAdmin(""); await load(); }
    } catch {
      alert("Action failed");
    }
    setAddingAdmin(false); setBusy(null);
  };

  const eaAct = async (id: string, action: "setFreeActivation" | "clearFreeActivation") => {
    setBusy(`ea:${id}:${action}`);
    if (DEV_MODE) {
      await new Promise(r => setTimeout(r, 400));
      setData(prev => prev ? {
        ...prev,
        eas: (prev.eas || []).map(e => ({ ...e, isFreeActivation: action === "setFreeActivation" && e.id === id })),
        freeActivation: (() => {
          const target = (prev.eas || []).find(e => e.id === id);
          if (action === "clearFreeActivation" || !target) return { configured: false, switchable: true, expectedName: "EA ACCESS SCALPER" };
          return { configured: true, switchable: true, eaId: target.id, eaName: target.name, mentorId: target.mentorId, active: target.isActive, distributorName: target.distributorName, activations: prev.freeActivation?.activations ?? 0 };
        })(),
      } : prev);
      setBusy(null);
      return;
    }
    try {
      const res = await fetch("/api/admin/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ type: "ea", id, action }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) alert(j.error || "Action failed");
      else await load();
    } catch {
      alert("Action failed");
    }
    setBusy(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 rounded-full animate-spin" style={{ border: `2px solid ${ACCENT}`, borderTopColor: "transparent" }} />
      </div>
    );
  }
  if (error) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <AlertTriangle className="mx-auto mb-3" style={{ color: "#F59E0B" }} size={28} />
        <p className="text-sm font-semibold text-white">{error}</p>
      </div>
    );
  }
  if (!data) return null;

  const m = data.mqtt?.mqtt;
  const isBusy = (id: string, action: string) => busy === `${id}:${action}`;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <Crown style={{ color: "#F59E0B" }} size={22} />
        <div>
          <h2 className="text-xl font-black tracking-wide text-white">Super Admin</h2>
          <p className="text-sm" style={{ color: MUTED }}>Platform-wide control over every distributor, user, and the live signal system.</p>
        </div>
        <button onClick={load} className="ml-auto flex items-center gap-2 text-xs font-semibold transition" style={{ color: MUTED }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat icon={Users} label="Distributors" value={data.stats.distributors} />
        <Stat icon={BadgeCheck} label="Verified" value={data.stats.verifiedDistributors} />
        <Stat icon={Ban} label="Suspended" value={data.stats.suspendedDistributors} />
        <Stat icon={Bot} label="Trading Bots" value={data.stats.eas} />
        <Stat icon={Users} label="App Users" value={data.stats.appUsers} />
        <Stat icon={KeyRound} label="Licenses" value={data.stats.licensesIssued} />
        <Stat icon={Link2} label="Connected" value={data.stats.connectedAccounts ?? 0} />
        <Stat icon={Radio} label="Online now" value={data.stats.onlineAccounts ?? 0} />
      </div>

      {data.freeActivation && (
        <Section title="Free Activation Robot" icon={Bot}>
          {data.freeActivation.configured ? (
            <div className="rounded-xl p-3 mb-4" style={{ background: "rgba(255,184,0,0.06)", border: `1px solid ${BORDER}` }}>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold text-white truncate">{data.freeActivation.eaName}</p>
                {data.freeActivation.active
                  ? <Tag color="green">LIVE</Tag>
                  : <Tag color="red">INACTIVE — bot is turned off</Tag>}
              </div>
              <p className="text-[11px] mt-1" style={{ color: MUTED }}>
                EA ID <span className="font-mono">{data.freeActivation.mentorId}</span>
                {" · "}owned by {data.freeActivation.distributorName}
                {" · "}{data.freeActivation.activations ?? 0} activations sent
                {" · "}powers <a href="/activate" target="_blank" rel="noopener noreferrer" className="font-semibold" style={{ color: ACCENT }}>/activate</a>
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-2 mb-4">
              <AlertTriangle size={16} style={{ color: "#F59E0B" }} className="mt-0.5 shrink-0" />
              <p className="text-xs" style={{ color: MUTED }}>
                No Free Activation robot selected yet. Flip the switch on a bot below to power the{" "}
                <a href="/activate" className="font-semibold" style={{ color: ACCENT }}>/activate</a> page.
              </p>
            </div>
          )}

          {data.freeActivation.switchable === false && (
            <div className="flex items-start gap-2 mb-4 rounded-xl p-3" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
              <AlertTriangle size={15} style={{ color: "#F59E0B" }} className="mt-0.5 shrink-0" />
              <p className="text-[11px]" style={{ color: "#F59E0B" }}>
                The switch needs a one-time DB migration. Run{" "}
                <span className="font-mono">supabase-free-activation-migration.sql</span> in your Supabase SQL editor to enable per-bot selection. Until then it falls back to a bot named{" "}
                <span className="font-bold">&ldquo;EA ACCESS SCALPER&rdquo;</span> or the <span className="font-mono">FREE_ACTIVATION_MENTOR_ID</span> env var.
              </p>
            </div>
          )}

          <p className="text-[10px] font-bold tracking-widest mb-2" style={{ color: MUTED }}>PICK THE ROBOT</p>
          <div className="space-y-2">
            {(data.eas || []).length === 0 && <p className="text-xs" style={{ color: MUTED }}>No trading bots exist yet. Create one in Trading Bots.</p>}
            {(data.eas || []).map(ea => (
              <div key={ea.id} className="rounded-xl p-3 flex items-center gap-3" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${ea.isFreeActivation ? "rgba(255,184,0,0.4)" : BORDER}` }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-white truncate">{ea.name}</p>
                    {ea.isFreeActivation && <Tag color="green">FREE ACTIVATION</Tag>}
                    {!ea.isActive && <Tag color="gray">OFF</Tag>}
                  </div>
                  <p className="text-[11px] truncate" style={{ color: MUTED }}>
                    <span className="font-mono">{ea.mentorId}</span> · {ea.distributorName}
                  </p>
                </div>
                {ea.isFreeActivation ? (
                  <button
                    onClick={() => eaAct(ea.id, "clearFreeActivation")}
                    disabled={busy === `ea:${ea.id}:clearFreeActivation` || data.freeActivation?.switchable === false}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-40"
                    style={{ border: `1px solid ${BORDER}`, color: MUTED }}
                    title="Turn off Free Activation for this bot"
                  >
                    {busy === `ea:${ea.id}:clearFreeActivation` ? <RefreshCw size={13} className="animate-spin" /> : <PowerOff size={13} />}
                    Turn off
                  </button>
                ) : (
                  <button
                    onClick={() => eaAct(ea.id, "setFreeActivation")}
                    disabled={busy === `ea:${ea.id}:setFreeActivation` || data.freeActivation?.switchable === false}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-40 text-black"
                    style={{ background: ACCENT }}
                    title="Make this the Free Activation robot"
                  >
                    {busy === `ea:${ea.id}:setFreeActivation` ? <RefreshCw size={13} className="animate-spin" /> : <Power size={13} />}
                    Set as robot
                  </button>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {data.analytics && (
        <Section title="Analytics" icon={BarChart3}>
          <AnalyticsGroup title="App Users" items={[
            ["Total", data.analytics.users.total],
            ["Active", data.analytics.users.active],
            ["New today", data.analytics.users.newToday],
            ["New this week", data.analytics.users.newWeek],
            ["New this month", data.analytics.users.newMonth],
            ["Seen 24h", data.analytics.users.seen24h],
            ["Seen 7d", data.analytics.users.seen7d],
            ["Seen 30d", data.analytics.users.seen30d],
          ]} />
          <AnalyticsGroup title="Mentors (Distributors)" items={[
            ["Total", data.analytics.mentors.total],
            ["Active", data.analytics.mentors.active],
            ["Verified", data.analytics.mentors.verified],
            ["New today", data.analytics.mentors.newToday],
            ["New this week", data.analytics.mentors.newWeek],
            ["New this month", data.analytics.mentors.newMonth],
          ]} />
          <AnalyticsGroup title="Licenses" items={[
            ["Issued (total)", data.analytics.licenses.total],
            ["Sent today", data.analytics.licenses.sentToday],
            ["Sent this week", data.analytics.licenses.sentWeek],
            ["Sent this month", data.analytics.licenses.sentMonth],
          ]} />
          <AnalyticsGroup title="Bots & Connections" items={[
            ["Hosted bots", data.analytics.bots.total],
            ["Active bots", data.analytics.bots.active],
            ["Connected accts", data.analytics.connections.total],
            ["Online now", data.analytics.connections.online],
            ["Offline", data.analytics.connections.offline],
            ["Connected 24h", data.analytics.connections.active24h],
            ["Connected 7d", data.analytics.connections.active7d],
            ["Connected 30d", data.analytics.connections.active30d],
          ]} />
          <AnalyticsGroup title="Site Traffic" items={[
            ["Visits today", data.analytics.traffic.visitsToday],
            ["Visits 7d", data.analytics.traffic.visitsWeek],
            ["Visits 30d", data.analytics.traffic.visitsMonth],
            ["Unique today", data.analytics.traffic.uniqueToday],
            ["Unique 7d", data.analytics.traffic.uniqueWeek],
            ["Unique 30d", data.analytics.traffic.uniqueMonth],
            ["Returning 30d", data.analytics.traffic.returningMonth],
            ["Sign-ups 30d", data.analytics.mentors.newMonth],
            ["Logins today", data.analytics.traffic.loginsToday],
            ["Logins 7d", data.analytics.traffic.loginsWeek],
            ["Logins 30d", data.analytics.traffic.loginsMonth],
          ]} />
          <p className="text-[11px] mt-1" style={{ color: MUTED }}>
            App downloads aren&apos;t tracked yet — that needs a download event on the APK link. Visits, unique/returning visitors and logins are live.
          </p>
        </Section>
      )}

      <Section title="Admins" icon={Crown}>
        <form
          onSubmit={(e) => { e.preventDefault(); const v = newAdmin.trim(); if (v) adminAct("add", v); }}
          className="flex flex-col sm:flex-row gap-2 mb-4"
        >
          <input
            type="email"
            value={newAdmin}
            onChange={(e) => setNewAdmin(e.target.value)}
            placeholder="new-admin@email.com"
            className="flex-1 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none transition"
            style={{ background: INPUT_BG, border: `1px solid ${BORDER}` }}
            onFocus={e => e.target.style.borderColor = "rgba(255,184,0,0.4)"}
            onBlur={e => e.target.style.borderColor = BORDER}
          />
          <button
            type="submit"
            disabled={addingAdmin || !newAdmin.trim()}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-50 text-black"
            style={{ background: ACCENT }}
          >
            {addingAdmin ? <RefreshCw size={15} className="animate-spin" /> : <UserPlus size={15} />}
            Add Admin
          </button>
        </form>
        <p className="text-[11px] mb-3" style={{ color: MUTED }}>
          Adding an email grants super-admin immediately if they&apos;re registered, or the moment they sign up.
        </p>
        <div className="space-y-2">
          {data.admins.map(a => (
            <div key={a.email} className="rounded-xl p-3 flex items-center gap-3" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }}>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: a.isOwner ? "rgba(255,184,0,0.2)" : a.registered ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.05)", color: a.isOwner ? ACCENT : a.registered ? "#F59E0B" : MUTED }}
              >
                {a.registered ? <Crown size={15} /> : <Clock size={15} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-white truncate">{a.email}</p>
                  {a.isOwner
                    ? <Tag color="amber">SUPER SUPER ADMIN</Tag>
                    : a.registered
                      ? <Tag color="green">SUPER ADMIN</Tag>
                      : null}
                  {!a.isOwner && a.locked && <Tag color="gray">CONFIG</Tag>}
                  {!a.registered && <Tag color="amber">PENDING SIGNUP</Tag>}
                </div>
                {a.name && <p className="text-[11px] truncate" style={{ color: MUTED }}>{a.name}</p>}
              </div>
              {a.locked ? (
                <span title={a.isOwner ? "Owner (super super admin) — permanent, can't be removed" : "Set in server config (SUPER_ADMIN_EMAILS)"} style={{ color: a.isOwner ? "rgba(255,184,0,0.4)" : "rgba(255,255,255,0.15)" }}><Lock size={15} /></span>
              ) : (
                <ActionBtn
                  busy={busy === `admin:${a.email}`}
                  onClick={() => adminAct("remove", a.email, `Remove admin access for ${a.email}?`)}
                  icon={Trash2}
                  title="Remove admin"
                  danger
                />
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section title="MQTT Signal System" icon={Radio}>
        {!data.mqtt?.configured ? (
          <p className="text-xs" style={{ color: MUTED }}>App server not configured (set APP_SERVER_URL + ADMIN_API_KEY).</p>
        ) : data.mqtt?.error ? (
          <p className="text-xs text-amber-400">Monitor unavailable: {data.mqtt.error}</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Health ok={!!m?.healthy} label={m?.healthy ? "Healthy" : "Unhealthy"} />
              <Pill label="Broker links" value={m?.brokerConnectionsOpen} />
              <Pill label="Accounts" value={m?.connectedAccounts} />
              <Pill label="Total signals" value={m?.totalSignals} />
              <Pill label="Last signal" value={m?.secondsSinceLastSignal != null ? `${m.secondsSinceLastSignal}s ago` : "—"} />
            </div>
            {data.mqtt?.signals?.recent?.length > 0 && (
              <div>
                <p className="text-[10px] font-bold tracking-widest mb-2" style={{ color: MUTED }}>RECENT SIGNALS</p>
                <div className="flex flex-wrap gap-2">
                  {data.mqtt.signals.recent.slice(0, 12).map((s: any, i: number) => (
                    <span key={i} className="text-[11px] font-mono px-2 py-1 rounded-md" style={{ background: "rgba(255,184,0,0.08)", color: ACCENT }}>
                      {s.symbol}{s.direction ? `/${s.direction}` : ""}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Section>

      <Section title="Distributors" icon={Users}>
        <div className="space-y-2">
          {data.distributors.map(d => (
            <div key={d.id} className="rounded-xl p-4 flex flex-wrap items-center gap-3" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-white truncate">{d.name}</p>
                  {d.isSuperAdmin && <Tag color="amber">ADMIN</Tag>}
                  {d.verified ? <Tag color="green">APPROVED</Tag> : <Tag color="amber">PENDING</Tag>}
                  {!d.isActive && <Tag color="red">SUSPENDED</Tag>}
                </div>
                <p className="text-[11px] truncate" style={{ color: MUTED }}>{d.email} · {d.eaCount} bots · {d.userCount} users · {d.licensesSent} licenses</p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {!d.verified && <ActionBtn busy={isBusy(d.id, "verify")} onClick={() => act("distributor", d.id, "verify")} icon={BadgeCheck} title="Approve account" />}
                {d.isActive
                  ? <ActionBtn busy={isBusy(d.id, "suspend")} onClick={() => act("distributor", d.id, "suspend", `Suspend ${d.name}? They won't be able to log in.`)} icon={Ban} title="Suspend" danger />
                  : <ActionBtn busy={isBusy(d.id, "activate")} onClick={() => act("distributor", d.id, "activate")} icon={Power} title="Reactivate" />}
                {d.isSuperAdmin
                  ? <ActionBtn busy={isBusy(d.id, "revokeAdmin")} onClick={() => act("distributor", d.id, "revokeAdmin", `Revoke admin from ${d.name}?`)} icon={Crown} title="Revoke admin" danger />
                  : <ActionBtn busy={isBusy(d.id, "grantAdmin")} onClick={() => act("distributor", d.id, "grantAdmin", `Grant super-admin to ${d.name}?`)} icon={Crown} title="Grant admin" />}
                <ActionBtn busy={isBusy(d.id, "resetPassword")} onClick={() => act("distributor", d.id, "resetPassword", `Email a password-reset link to ${d.name} (${d.email})?`)} icon={KeyRound} title="Send password reset" />
                <ActionBtn busy={isBusy(d.id, "delete")} onClick={() => act("distributor", d.id, "delete", `DELETE ${d.name} and ALL their data? This cannot be undone.`)} icon={Trash2} title="Delete" danger />
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="App Users" icon={Activity}>
        <div className="space-y-2">
          {data.appUsers.length === 0 && <p className="text-xs" style={{ color: MUTED }}>No app users yet.</p>}
          {data.appUsers.map(u => (
            <div key={u.id} className="rounded-xl p-4 flex flex-wrap items-center gap-3" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-white truncate">{u.email}</p>
                  {u.hasLicense ? <Tag color="green">LICENSED</Tag> : <Tag color="gray">NO KEY</Tag>}
                  {!u.isActive && <Tag color="red">DISABLED</Tag>}
                </div>
                <p className="text-[11px] truncate" style={{ color: MUTED }}>{u.distributorName} · {u.eaName}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <ActionBtn busy={isBusy(u.id, "resendLicense")} onClick={() => act("app_user", u.id, "resendLicense")} icon={Send} title={u.hasLicense ? "Resend license" : "Issue license"} />
                {u.isActive
                  ? <ActionBtn busy={isBusy(u.id, "deactivate")} onClick={() => act("app_user", u.id, "deactivate")} icon={Ban} title="Disable" danger />
                  : <ActionBtn busy={isBusy(u.id, "activate")} onClick={() => act("app_user", u.id, "activate")} icon={Power} title="Enable" />}
                <ActionBtn busy={isBusy(u.id, "delete")} onClick={() => act("app_user", u.id, "delete", `Remove ${u.email}'s access?`)} icon={Trash2} title="Delete" danger />
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Connected Accounts" icon={Link2}>
        {data.mt5Connections.length === 0 && <p className="text-xs" style={{ color: MUTED }}>No connected accounts yet.</p>}
        {Object.entries(
          data.mt5Connections.reduce((acc, c) => { (acc[c.app || "free-app"] ||= []).push(c); return acc; }, {} as Record<string, ConnectedAccount[]>)
        ).sort((a, b) => a[0].localeCompare(b[0])).map(([app, list]) => (
          <div key={app} className="mb-4 last:mb-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded" style={{ background: "rgba(255,184,0,0.12)", color: ACCENT }}>{appLabel(app)}</span>
              <span className="text-[11px]" style={{ color: MUTED }}>{list.length} account{list.length === 1 ? "" : "s"}</span>
            </div>
            <div className="space-y-2">
              {list.map((c, i) => (
                <div key={`${c.email}-${c.login}-${i}`} className="rounded-xl p-4 flex flex-wrap items-center gap-3" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-white truncate" style={{ fontFamily: "monospace" }}>{c.login}</p>
                      <StatusBadge online={c.online} />
                      {c.connectCount > 1 && <Tag color="gray">×{c.connectCount}</Tag>}
                    </div>
                    <p className="text-[11px] truncate" style={{ color: MUTED }}>{c.email} · {c.server}</p>
                  </div>
                  {c.lastConnectedAt && (
                    <p className="text-[11px]" style={{ color: MUTED }}>{new Date(c.lastConnectedAt).toLocaleDateString()}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </Section>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="rounded-xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <Icon style={{ color: ACCENT }} className="mb-2" size={16} />
      <p className="text-xl font-black text-white">{value ?? 0}</p>
      <p className="text-[10px] font-medium" style={{ color: MUTED }}>{label}</p>
    </div>
  );
}

function StatusBadge({ online }: { online: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded"
      style={{
        background: online ? "rgba(34,197,94,0.14)" : "rgba(148,163,184,0.12)",
        color: online ? "#22C55E" : "#94A3B8",
      }}
    >
      <span
        className={online ? "animate-pulse" : ""}
        style={{ width: 6, height: 6, borderRadius: 9999, background: online ? "#22C55E" : "#94A3B8", boxShadow: online ? "0 0 6px #22C55E" : "none", display: "inline-block" }}
      />
      {online ? "Online" : "Offline"}
    </span>
  );
}

function AnalyticsGroup({ title, items }: { title: string; items: [string, number][] }) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: ACCENT }}>{title}</p>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-lg px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }}>
            <p className="text-lg font-black text-white leading-none">{value}</p>
            <p className="text-[10px] font-medium mt-1" style={{ color: MUTED }}>{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="flex items-center gap-2 mb-4">
        <Icon size={16} style={{ color: ACCENT }} />
        <h3 className="text-sm font-bold text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Tag({ color, children }: { color: "green" | "red" | "amber" | "gray"; children: React.ReactNode }) {
  const map: Record<string, { bg: string; fg: string }> = {
    green: { bg: "rgba(255,184,0,0.12)", fg: ACCENT },
    red: { bg: "rgba(239,68,68,0.12)", fg: "#EF4444" },
    amber: { bg: "rgba(245,158,11,0.12)", fg: "#F59E0B" },
    gray: { bg: "rgba(255,255,255,0.06)", fg: MUTED },
  };
  const c = map[color];
  return (
    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: c.bg, color: c.fg }}>
      {children}
    </span>
  );
}

function Pill({ label, value }: { label: string; value: any }) {
  return (
    <div className="px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}` }}>
      <p className="text-[10px]" style={{ color: MUTED }}>{label}</p>
      <p className="text-sm font-bold text-white">{value ?? "—"}</p>
    </div>
  );
}

function Health({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="px-3 py-2 rounded-lg flex items-center gap-2"
      style={{
        background: ok ? "rgba(255,184,0,0.08)" : "rgba(239,68,68,0.08)",
        border: `1px solid ${ok ? "rgba(255,184,0,0.2)" : "rgba(239,68,68,0.2)"}`,
      }}
    >
      <ShieldCheck size={16} style={{ color: ok ? ACCENT : "#EF4444" }} />
      <span className="text-sm font-bold" style={{ color: ok ? ACCENT : "#EF4444" }}>{label}</span>
    </div>
  );
}

function ActionBtn({ icon: Icon, title, onClick, busy, danger }: { icon: any; title: string; onClick: () => void; busy?: boolean; danger?: boolean }) {
  return (
    <button onClick={onClick} disabled={busy} title={title}
      className="p-2 rounded-lg transition disabled:opacity-40"
      style={{
        border: `1px solid ${BORDER}`,
        color: danger ? MUTED : MUTED,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.color = danger ? "#EF4444" : "#F0F6FC";
        e.currentTarget.style.borderColor = danger ? "rgba(239,68,68,0.4)" : "rgba(255,184,0,0.3)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.color = MUTED;
        e.currentTarget.style.borderColor = BORDER;
      }}
    >
      {busy ? <RefreshCw size={15} className="animate-spin" /> : <Icon size={15} />}
    </button>
  );
}
