"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DEV_MODE } from "@/lib/supabase";
import { authHeaders, adminAction } from "@/lib/admin-fetch";
import {
  Search, Bot, GraduationCap, Activity, KeyRound, Power, PowerOff, Check,
} from "lucide-react";

const ACCENT = "#0A84FF";
const CARD = "#161B22";
const BORDER = "rgba(10,132,255,0.1)";
const MUTED = "#8B949E";

type Member = {
  id: string;
  email: string | null;
  isActive: boolean;
  distributorName: string;
  eaName: string;
  hasLicense: boolean;
  status: string;
  paidAt: string | null;
  running: boolean;
  lastSeen: string | null;
  createdAt: string;
};

type Filter = "all" | "running" | "paid" | "unpaid" | "pending" | "nolicence";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "running", label: "Running" },
  { key: "paid", label: "Paid" },
  { key: "unpaid", label: "Not paid" },
  { key: "pending", label: "Pending" },
  { key: "nolicence", label: "No licence" },
];

function Tag({ children, tone }: { children: React.ReactNode; tone: "green" | "amber" | "red" | "blue" | "gray" }) {
  const tones = {
    green: { background: "rgba(34,197,94,0.12)", color: "#22C55E" },
    amber: { background: "rgba(245,158,11,0.12)", color: "#F59E0B" },
    red: { background: "rgba(239,68,68,0.12)", color: "#EF4444" },
    blue: { background: "rgba(10,132,255,0.12)", color: ACCENT },
    gray: { background: "rgba(255,255,255,0.05)", color: MUTED },
  } as const;
  return (
    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide whitespace-nowrap" style={tones[tone]}>
      {children}
    </span>
  );
}

const DEMO: Member[] = [
  {
    id: "u1", email: "trader@example.com", isActive: true, distributorName: "Kaydee Trades",
    eaName: "EA ACCESS SCALPER", hasLicense: true, status: "approved",
    paidAt: new Date(Date.now() - 3 * 86_400_000).toISOString(), running: true,
    lastSeen: new Date().toISOString(), createdAt: new Date(Date.now() - 5 * 86_400_000).toISOString(),
  },
  {
    id: "u2", email: "newbie@example.com", isActive: true, distributorName: "Bellion FX",
    eaName: "—", hasLicense: false, status: "pending", paidAt: null, running: false,
    lastSeen: null, createdAt: new Date(Date.now() - 86_400_000).toISOString(),
  },
];

export default function MembersPage() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError("");
    if (DEV_MODE) { setMembers(DEMO); return; }
    try {
      const res = await fetch("/api/admin/overview", { headers: await authHeaders(), cache: "no-store" });
      if (res.status === 403) { setError("You do not have admin access."); setMembers([]); return; }
      if (!res.ok) { setError("Failed to load members."); setMembers([]); return; }
      const j = await res.json();
      setMembers(j.appUsers || []);
    } catch {
      setError("Something went wrong.");
      setMembers([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (id: string, action: string, confirmMsg?: string) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusy(id);
    const err = await adminAction({ type: "app_user", id, action });
    setBusy(null);
    if (err) alert(err); else await load();
  };

  const shown = useMemo(() => {
    const list = members || [];
    const q = query.trim().toLowerCase();
    return list.filter(m => {
      if (q && !(
        (m.email || "").toLowerCase().includes(q)
        || m.distributorName.toLowerCase().includes(q)
        || m.eaName.toLowerCase().includes(q)
      )) return false;
      switch (filter) {
        case "running": return m.running;
        case "paid": return !!m.paidAt;
        case "unpaid": return !m.paidAt;
        case "pending": return m.status === "pending";
        case "nolicence": return !m.hasLicense;
        default: return true;
      }
    });
  }, [members, query, filter]);

  if (members === null) {
    return <p className="text-sm" style={{ color: MUTED }}>Loading members…</p>;
  }

  const runningCount = members.filter(m => m.running).length;
  const paidCount = members.filter(m => m.paidAt).length;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-black tracking-wide text-white">Members</h2>
        <p className="text-xs mt-1" style={{ color: MUTED }}>
          {members.length} total · {paidCount} paid · {runningCount} trading right now
        </p>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: MUTED }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search email, mentor or bot…"
            className="w-full rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none"
            style={{ background: "rgba(13,17,23,0.8)", border: `1px solid ${BORDER}` }}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition"
              style={filter === f.key
                ? { background: "rgba(10,132,255,0.15)", color: ACCENT }
                : { background: "rgba(255,255,255,0.04)", color: MUTED }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="text-xs" style={{ color: MUTED }}>Nobody matches that.</p>
      ) : (
        <div className="space-y-2">
          {shown.map(m => (
            <div key={m.id} className="rounded-2xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-white truncate">
                      {m.email || <span style={{ color: MUTED }}>unassigned licence</span>}
                    </p>
                    {m.running && <Tag tone="green">TRADING</Tag>}
                    {m.paidAt ? <Tag tone="blue">PAID</Tag> : <Tag tone="amber">NOT PAID</Tag>}
                    {m.status === "pending" && <Tag tone="amber">PENDING</Tag>}
                    {!m.hasLicense && <Tag tone="gray">NO LICENCE</Tag>}
                    {!m.isActive && <Tag tone="red">OFF</Tag>}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                    <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: MUTED }}>
                      <GraduationCap size={11} /> {m.distributorName}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: MUTED }}>
                      <Bot size={11} /> {m.eaName}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: MUTED }}>
                      <Activity size={11} />
                      {m.lastSeen ? `seen ${new Date(m.lastSeen).toLocaleDateString()}` : "never signed in"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {m.status === "pending" && (
                    <button
                      onClick={() => act(m.id, "approve")}
                      disabled={busy === m.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition disabled:opacity-40"
                      style={{ background: "rgba(34,197,94,0.15)", color: "#22C55E" }}
                    >
                      <Check size={12} /> Approve
                    </button>
                  )}
                  <button
                    onClick={() => act(m.id, "resendLicense")}
                    disabled={busy === m.id}
                    title="Issue or resend their licence key"
                    className="p-2 rounded-lg transition disabled:opacity-40"
                    style={{ color: m.hasLicense ? MUTED : ACCENT }}
                  >
                    <KeyRound size={15} />
                  </button>
                  <button
                    onClick={() => act(
                      m.id,
                      m.isActive ? "deactivate" : "activate",
                      m.isActive ? `Switch off access for ${m.email || "this licence"}?` : undefined,
                    )}
                    disabled={busy === m.id}
                    title={m.isActive ? "Switch off access" : "Restore access"}
                    className="p-2 rounded-lg transition disabled:opacity-40"
                    style={{ color: m.isActive ? "#EF4444" : "#22C55E" }}
                  >
                    {m.isActive ? <PowerOff size={15} /> : <Power size={15} />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
