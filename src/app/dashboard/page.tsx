"use client";

import { useEffect, useState } from "react";
import { supabase, DEV_MODE } from "@/lib/supabase";
import { Bot, Users, KeyRound, Activity, Copy, Check } from "lucide-react";
import Link from "next/link";

const ACCENT = "#0A84FF";
const CARD = "#161B22";
const MUTED = "#8B949E";

export default function DashboardOverview() {
  const [stats, setStats] = useState({ eas: 0, users: 0, licenses: 0, hasBranding: false });
  const [me, setMe] = useState<{ name: string; mentorNumber: number | null }>({ name: "", mentorNumber: null });
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (DEV_MODE) {
        setStats({ eas: 2, users: 5, licenses: 3, hasBranding: true });
        setMe({ name: "Respond", mentorNumber: 1 });
        setLoading(false);
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [easRes, usersRes, licRes, brandRes, meRes] = await Promise.all([
        supabase.from("eas").select("id", { count: "exact", head: true }).eq("distributor_id", user.id),
        supabase.from("app_users").select("id", { count: "exact", head: true }).eq("distributor_id", user.id),
        supabase.from("app_users").select("id", { count: "exact", head: true }).eq("distributor_id", user.id).not("license_sent_at", "is", null),
        supabase.from("branding").select("id").eq("distributor_id", user.id).maybeSingle(),
        supabase.from("distributors").select("name, mentor_number").eq("id", user.id).maybeSingle(),
      ]);

      setStats({
        eas: easRes.count || 0,
        users: usersRes.count || 0,
        licenses: licRes.count || 0,
        hasBranding: !!brandRes.data,
      });
      const meData = meRes.data as { name?: string; mentor_number?: number } | null;
      setMe({ name: meData?.name || "", mentorNumber: meData?.mentor_number ?? null });
      setLoading(false);
    }
    load();
  }, []);

  const hour = new Date().getHours();
  const greeting = hour >= 5 && hour < 12 ? "Good morning" : hour >= 12 && hour < 17 ? "Good afternoon" : "Good evening";

  const cards = [
    { label: "EAs", value: stats.eas, icon: Bot, href: "/dashboard/eas", gradient: "linear-gradient(135deg, rgba(10,132,255,0.15), rgba(10,132,255,0.05))" },
    { label: "Users", value: stats.users, icon: Users, href: "/dashboard/users", gradient: "linear-gradient(135deg, rgba(56,189,248,0.15), rgba(56,189,248,0.05))" },
    { label: "Keys", value: stats.licenses, icon: KeyRound, href: "/dashboard/licenses", gradient: "linear-gradient(135deg, rgba(10,132,255,0.15), rgba(10,132,255,0.05))" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-black tracking-wide text-white">{greeting}{me.name ? `, ${me.name}` : ""}</h2>
        <p className="text-sm mt-1" style={{ color: MUTED }}>
          Welcome to <strong className="text-white">EA NAPTUNE</strong> — manage your white-label trading app.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 rounded-full animate-spin" style={{ border: `2px solid ${ACCENT}`, borderTopColor: "transparent" }} />
        </div>
      ) : (
        <>
          <div
            className="rounded-2xl p-5 flex items-center justify-between"
            style={{ background: "linear-gradient(135deg, rgba(10,132,255,0.14), rgba(22,27,34,0.9))", border: "1px solid rgba(10,132,255,0.25)" }}
          >
            <div>
              <p className="text-[10px] font-bold tracking-widest" style={{ color: ACCENT }}>YOUR MENTOR ID</p>
              <p className="text-4xl font-black text-white mt-1 leading-none">{me.mentorNumber ?? "—"}</p>
              <p className="text-xs mt-2" style={{ color: MUTED }}>Give this to your users — they enter it to log in to the app.</p>
            </div>
            <button
              onClick={() => { if (me.mentorNumber != null) { navigator.clipboard.writeText(String(me.mentorNumber)); setCopied(true); setTimeout(() => setCopied(false), 2000); } }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition"
              style={{ background: "rgba(10,132,255,0.15)", color: ACCENT, border: "1px solid rgba(10,132,255,0.3)" }}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {cards.map(card => {
              const Icon = card.icon;
              return (
                <Link
                  key={card.label}
                  href={card.href}
                  className="rounded-2xl p-5 transition-all group"
                  style={{
                    background: CARD,
                    border: "1px solid rgba(10,132,255,0.08)",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(10,132,255,0.25)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(10,132,255,0.08)"; e.currentTarget.style.transform = "translateY(0)"; }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: card.gradient }}>
                      <Icon style={{ color: ACCENT }} size={20} />
                    </div>
                    <Activity className="opacity-30 group-hover:opacity-60 transition" style={{ color: ACCENT }} size={16} />
                  </div>
                  <p className="text-2xl font-black text-white">{card.value}</p>
                  <p className="text-xs mt-1 font-medium" style={{ color: MUTED }}>{card.label}</p>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
