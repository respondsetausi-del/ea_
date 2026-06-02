"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, DEV_MODE } from "@/lib/supabase";
import {
  ShieldCheck, Users, Bot, KeyRound, Activity, Radio, Trash2,
  BadgeCheck, Ban, Power, Send, Crown, RefreshCw, AlertTriangle, UserPlus, Lock, Clock,
} from "lucide-react";

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
  distributorId: string | null; isActive: boolean | null; locked: boolean;
};
type Overview = {
  stats: Record<string, number>;
  distributors: Distributor[];
  appUsers: AppUser[];
  admins: Admin[];
  mqtt: any;
};

const DEMO: Overview = {
  stats: { distributors: 3, verifiedDistributors: 2, suspendedDistributors: 1, eas: 4, appUsers: 5, licensesIssued: 3 },
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
    { email: "respondsetausi@gmail.com", registered: true, name: "Super Admin", distributorId: "d1", isActive: true, locked: true },
    { email: "newadmin@example.com", registered: false, name: null, distributorId: null, isActive: null, locked: false },
  ],
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

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (error) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <AlertTriangle className="mx-auto text-amber-500 mb-3" size={28} />
        <p className="text-sm font-semibold text-gray-900">{error}</p>
      </div>
    );
  }
  if (!data) return null;

  const m = data.mqtt?.mqtt;
  const isBusy = (id: string, action: string) => busy === `${id}:${action}`;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <Crown className="text-amber-500" size={22} />
        <div>
          <h2 className="text-xl font-black tracking-wide text-gray-900">Super Admin</h2>
          <p className="text-gray-500 text-sm">Platform-wide control over every distributor, user, and the live signal system.</p>
        </div>
        <button onClick={load} className="ml-auto flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-gray-900">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat icon={Users} label="Distributors" value={data.stats.distributors} />
        <Stat icon={BadgeCheck} label="Verified" value={data.stats.verifiedDistributors} />
        <Stat icon={Ban} label="Suspended" value={data.stats.suspendedDistributors} />
        <Stat icon={Bot} label="Trading Bots" value={data.stats.eas} />
        <Stat icon={Users} label="App Users" value={data.stats.appUsers} />
        <Stat icon={KeyRound} label="Licenses" value={data.stats.licensesIssued} />
      </div>

      {/* Admins */}
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
            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-900"
          />
          <button
            type="submit"
            disabled={addingAdmin || !newAdmin.trim()}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 transition disabled:opacity-50"
          >
            {addingAdmin ? <RefreshCw size={15} className="animate-spin" /> : <UserPlus size={15} />}
            Add Admin
          </button>
        </form>
        <p className="text-[11px] text-gray-400 mb-3">
          Adding an email grants super-admin immediately if they&apos;re registered, or the moment they sign up.
        </p>
        <div className="space-y-2">
          {data.admins.map(a => (
            <div key={a.email} className="border border-gray-200 rounded-xl p-3 flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${a.registered ? "bg-amber-100 text-amber-600" : "bg-gray-100 text-gray-400"}`}>
                {a.registered ? <Crown size={15} /> : <Clock size={15} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900 truncate">{a.email}</p>
                  {a.locked && <Tag color="gray">CONFIG</Tag>}
                  {a.registered ? <Tag color="green">ACTIVE</Tag> : <Tag color="amber">PENDING SIGNUP</Tag>}
                </div>
                {a.name && <p className="text-[11px] text-gray-400 truncate">{a.name}</p>}
              </div>
              {a.locked ? (
                <span title="Set in server config (SUPER_ADMIN_EMAILS)" className="text-gray-300"><Lock size={15} /></span>
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

      {/* MQTT monitor */}
      <Section title="MQTT Signal System" icon={Radio}>
        {!data.mqtt?.configured ? (
          <p className="text-xs text-gray-400">App server not configured (set APP_SERVER_URL + ADMIN_API_KEY).</p>
        ) : data.mqtt?.error ? (
          <p className="text-xs text-amber-600">Monitor unavailable: {data.mqtt.error}</p>
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
                <p className="text-[10px] font-bold tracking-widest text-gray-400 mb-2">RECENT SIGNALS</p>
                <div className="flex flex-wrap gap-2">
                  {data.mqtt.signals.recent.slice(0, 12).map((s: any, i: number) => (
                    <span key={i} className="text-[11px] font-mono px-2 py-1 rounded-md bg-gray-100 text-gray-700">
                      {s.symbol}{s.direction ? `/${s.direction}` : ""}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* Distributors */}
      <Section title="Distributors" icon={Users}>
        <div className="space-y-2">
          {data.distributors.map(d => (
            <div key={d.id} className="border border-gray-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-gray-900 truncate">{d.name}</p>
                  {d.isSuperAdmin && <Tag color="amber">ADMIN</Tag>}
                  {d.verified ? <Tag color="green">VERIFIED</Tag> : <Tag color="gray">UNVERIFIED</Tag>}
                  {!d.isActive && <Tag color="red">SUSPENDED</Tag>}
                </div>
                <p className="text-[11px] text-gray-400 truncate">{d.email} · {d.eaCount} bots · {d.userCount} users · {d.licensesSent} licenses</p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {!d.verified && <ActionBtn busy={isBusy(d.id, "verify")} onClick={() => act("distributor", d.id, "verify")} icon={BadgeCheck} title="Force-verify" />}
                {d.isActive
                  ? <ActionBtn busy={isBusy(d.id, "suspend")} onClick={() => act("distributor", d.id, "suspend", `Suspend ${d.name}? They won't be able to log in.`)} icon={Ban} title="Suspend" danger />
                  : <ActionBtn busy={isBusy(d.id, "activate")} onClick={() => act("distributor", d.id, "activate")} icon={Power} title="Reactivate" />}
                {d.isSuperAdmin
                  ? <ActionBtn busy={isBusy(d.id, "revokeAdmin")} onClick={() => act("distributor", d.id, "revokeAdmin", `Revoke admin from ${d.name}?`)} icon={Crown} title="Revoke admin" danger />
                  : <ActionBtn busy={isBusy(d.id, "grantAdmin")} onClick={() => act("distributor", d.id, "grantAdmin", `Grant super-admin to ${d.name}?`)} icon={Crown} title="Grant admin" />}
                <ActionBtn busy={isBusy(d.id, "delete")} onClick={() => act("distributor", d.id, "delete", `DELETE ${d.name} and ALL their data? This cannot be undone.`)} icon={Trash2} title="Delete" danger />
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* App users */}
      <Section title="App Users" icon={Activity}>
        <div className="space-y-2">
          {data.appUsers.length === 0 && <p className="text-xs text-gray-400">No app users yet.</p>}
          {data.appUsers.map(u => (
            <div key={u.id} className="border border-gray-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900 truncate">{u.email}</p>
                  {u.hasLicense ? <Tag color="green">LICENSED</Tag> : <Tag color="gray">NO KEY</Tag>}
                  {!u.isActive && <Tag color="red">DISABLED</Tag>}
                </div>
                <p className="text-[11px] text-gray-400 truncate">{u.distributorName} · {u.eaName}</p>
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
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <Icon className="text-gray-400 mb-2" size={16} />
      <p className="text-xl font-black text-gray-900">{value ?? 0}</p>
      <p className="text-[10px] text-gray-500 font-medium">{label}</p>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={16} className="text-gray-700" />
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Tag({ color, children }: { color: "green" | "red" | "amber" | "gray"; children: React.ReactNode }) {
  const map = {
    green: "bg-green-100 text-green-600", red: "bg-red-100 text-red-600",
    amber: "bg-amber-100 text-amber-600", gray: "bg-gray-100 text-gray-400",
  };
  return <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${map[color]}`}>{children}</span>;
}

function Pill({ label, value }: { label: string; value: any }) {
  return (
    <div className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-200">
      <p className="text-[10px] text-gray-400">{label}</p>
      <p className="text-sm font-bold text-gray-900">{value ?? "—"}</p>
    </div>
  );
}

function Health({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`px-3 py-2 rounded-lg border flex items-center gap-2 ${ok ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
      <ShieldCheck size={16} className={ok ? "text-green-600" : "text-red-500"} />
      <span className={`text-sm font-bold ${ok ? "text-green-700" : "text-red-600"}`}>{label}</span>
    </div>
  );
}

function ActionBtn({ icon: Icon, title, onClick, busy, danger }: { icon: any; title: string; onClick: () => void; busy?: boolean; danger?: boolean }) {
  return (
    <button onClick={onClick} disabled={busy} title={title}
      className={`p-2 rounded-lg border transition disabled:opacity-40 ${danger ? "border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-300" : "border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-900"}`}>
      {busy ? <RefreshCw size={15} className="animate-spin" /> : <Icon size={15} />}
    </button>
  );
}
