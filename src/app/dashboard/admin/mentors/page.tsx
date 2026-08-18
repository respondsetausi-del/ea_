"use client";

import { useCallback, useEffect, useState } from "react";
import { DEV_MODE } from "@/lib/supabase";
import { authHeaders, adminAction } from "@/lib/admin-fetch";
import {
  GraduationCap, Send, MessageCircle, MonitorPlay, Music2, Check, X,
  Power, PowerOff, Users, KeyRound, CreditCard, Clock, ExternalLink,
} from "lucide-react";

const ACCENT = "#0A84FF";
const CARD = "#161B22";
const BORDER = "rgba(10,132,255,0.1)";
const MUTED = "#8B949E";

type Mentor = {
  id: string;
  email: string;
  name: string;
  verified: boolean;
  isActive: boolean;
  isSuperAdmin: boolean;
  isStaffAdmin: boolean;
  createdAt: string;
  eaCount: number;
  userCount: number;
  paidUserCount: number;
  licensesSent: number;
  socials: { telegram: string | null; discord: string | null; youtube: string | null; tiktok: string | null };
};

const SOCIAL_META = [
  { key: "telegram" as const, label: "Telegram", Icon: Send },
  { key: "discord" as const, label: "Discord", Icon: MessageCircle },
  { key: "youtube" as const, label: "YouTube", Icon: MonitorPlay },
  { key: "tiktok" as const, label: "TikTok", Icon: Music2 },
];

/** Age of an application, flagged once it breaks the 24-hour review promise. */
function waitingFor(iso: string): { text: string; overdue: boolean } {
  const hours = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (hours < 1) return { text: "just now", overdue: false };
  if (hours < 24) return { text: `${hours}h ago`, overdue: false };
  const days = Math.floor(hours / 24);
  return { text: days === 1 ? "1 day ago" : `${days} days ago`, overdue: true };
}

function Stat({ icon: Icon, value, label }: { icon: any; value: number; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon size={13} style={{ color: MUTED }} />
      <span className="text-xs font-semibold text-white">{value}</span>
      <span className="text-[10px]" style={{ color: MUTED }}>{label}</span>
    </div>
  );
}

function Socials({ socials }: { socials: Mentor["socials"] }) {
  const present = SOCIAL_META.filter(s => socials[s.key]);
  if (present.length === 0) {
    return <p className="text-[10px] italic" style={{ color: "#6E7681" }}>No channels given</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {present.map(({ key, label, Icon }) => (
        <a
          key={key}
          href={socials[key] as string}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-semibold transition hover:opacity-80"
          style={{ background: "rgba(10,132,255,0.08)", color: ACCENT }}
          title={socials[key] as string}
        >
          <Icon size={11} />
          {label}
          <ExternalLink size={9} style={{ opacity: 0.6 }} />
        </a>
      ))}
    </div>
  );
}

const DEMO: Mentor[] = [
  {
    id: "d2", email: "bellion@example.com", name: "Bellion FX", verified: false, isActive: true,
    isSuperAdmin: false, isStaffAdmin: false, createdAt: new Date(Date.now() - 31 * 3_600_000).toISOString(),
    eaCount: 0, userCount: 0, paidUserCount: 0, licensesSent: 0,
    socials: { telegram: "https://t.me/bellionfx", discord: null, youtube: "https://youtube.com/@bellionfx", tiktok: null },
  },
  {
    id: "d3", email: "kaydee@example.com", name: "Kaydee Trades", verified: true, isActive: true,
    isSuperAdmin: false, isStaffAdmin: false, createdAt: new Date(Date.now() - 20 * 86_400_000).toISOString(),
    eaCount: 2, userCount: 41, paidUserCount: 29, licensesSent: 38,
    socials: { telegram: "https://t.me/kaydee", discord: "https://discord.gg/kaydee", youtube: null, tiktok: "https://tiktok.com/@kaydee" },
  },
];

export default function MentorsPage() {
  const [mentors, setMentors] = useState<Mentor[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError("");
    if (DEV_MODE) { setMentors(DEMO); return; }
    try {
      const res = await fetch("/api/admin/overview", { headers: await authHeaders(), cache: "no-store" });
      if (res.status === 403) { setError("You do not have admin access."); setMentors([]); return; }
      if (!res.ok) { setError("Failed to load mentors."); setMentors([]); return; }
      const j = await res.json();
      // Admins run the platform rather than sell on it, so they are not part of
      // the mentor roster and listing them only makes the queue noisier.
      setMentors((j.distributors || []).filter((d: Mentor) => !d.isSuperAdmin));
    } catch {
      setError("Something went wrong.");
      setMentors([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (id: string, action: string, confirmMsg?: string) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusy(id);
    const err = await adminAction({ type: "distributor", id, action });
    setBusy(null);
    if (err) alert(err); else await load();
  };

  if (mentors === null) {
    return <p className="text-sm" style={{ color: MUTED }}>Loading mentors…</p>;
  }

  const pending = mentors.filter(m => !m.verified && m.isActive);
  const active = mentors.filter(m => m.verified);
  const refused = mentors.filter(m => !m.verified && !m.isActive);
  const anyOverdue = pending.some(m => waitingFor(m.createdAt).overdue);

  const Row = ({ m, queue }: { m: Mentor; queue: boolean }) => {
    const age = waitingFor(m.createdAt);
    return (
      <div
        className="rounded-2xl p-4"
        style={{
          background: CARD,
          border: `1px solid ${queue && age.overdue ? "rgba(239,68,68,0.35)" : BORDER}`,
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-white truncate">{m.name}</p>
              {m.isStaffAdmin && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                  style={{ background: "rgba(10,132,255,0.15)", color: ACCENT }}>STAFF</span>
              )}
              {!m.isActive && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                  style={{ background: "rgba(239,68,68,0.15)", color: "#EF4444" }}>SUSPENDED</span>
              )}
            </div>
            <p className="text-[11px] truncate" style={{ color: MUTED }}>{m.email}</p>
          </div>

          {queue ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold"
                style={{ color: age.overdue ? "#EF4444" : MUTED }}>
                <Clock size={11} />
                applied {age.text}
              </span>
              <button
                onClick={() => act(m.id, "verify")}
                disabled={busy === m.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition disabled:opacity-40"
                style={{ background: "rgba(34,197,94,0.15)", color: "#22C55E" }}
              >
                <Check size={13} /> Approve
              </button>
              <button
                onClick={() => act(m.id, "suspend", `Refuse ${m.email}? They will not be able to sign in.`)}
                disabled={busy === m.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition disabled:opacity-40"
                style={{ background: "rgba(239,68,68,0.12)", color: "#EF4444" }}
              >
                <X size={13} /> Refuse
              </button>
            </div>
          ) : (
            <button
              onClick={() => act(
                m.id,
                m.isActive ? "suspend" : "activate",
                m.isActive ? `Suspend ${m.email}? They lose dashboard access immediately.` : undefined,
              )}
              disabled={busy === m.id}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition disabled:opacity-40"
              style={m.isActive
                ? { background: "rgba(239,68,68,0.12)", color: "#EF4444" }
                : { background: "rgba(34,197,94,0.15)", color: "#22C55E" }}
            >
              {m.isActive ? <><PowerOff size={13} /> Suspend</> : <><Power size={13} /> Restore</>}
            </button>
          )}
        </div>

        <div className="mt-3">
          <Socials socials={m.socials} />
        </div>

        {!queue && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 pt-3"
            style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <Stat icon={Users} value={m.userCount} label="users" />
            <Stat icon={CreditCard} value={m.paidUserCount} label="paid" />
            <Stat icon={KeyRound} value={m.licensesSent} label="licences" />
            <Stat icon={GraduationCap} value={m.eaCount} label="bots" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-black tracking-wide text-white">Mentors</h2>
        <p className="text-xs mt-1" style={{ color: MUTED }}>
          Applications are reviewed within 24 hours. Approving one lets them sign in.
        </p>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <section>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-bold text-white">Pending</h3>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
            style={{
              background: anyOverdue ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.12)",
              color: anyOverdue ? "#EF4444" : "#F59E0B",
            }}>
            {pending.length}
          </span>
        </div>
        {pending.length === 0 ? (
          <p className="text-xs" style={{ color: MUTED }}>Nothing waiting.</p>
        ) : (
          <div className="space-y-2.5">
            {pending.map(m => <Row key={m.id} m={m} queue />)}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-bold text-white">Active</h3>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
            style={{ background: "rgba(34,197,94,0.12)", color: "#22C55E" }}>{active.length}</span>
        </div>
        {active.length === 0 ? (
          <p className="text-xs" style={{ color: MUTED }}>No approved mentors yet.</p>
        ) : (
          <div className="space-y-2.5">
            {active.map(m => <Row key={m.id} m={m} queue={false} />)}
          </div>
        )}
      </section>

      {refused.length > 0 && (
        <section>
          <h3 className="text-sm font-bold text-white mb-3">Refused</h3>
          <div className="space-y-2.5">
            {refused.map(m => <Row key={m.id} m={m} queue={false} />)}
          </div>
        </section>
      )}
    </div>
  );
}
