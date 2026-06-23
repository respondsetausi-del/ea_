"use client";

import { useEffect, useState } from "react";
import { supabase, DEV_MODE } from "@/lib/supabase";
import { Bot, Users, Palette, Activity } from "lucide-react";
import Link from "next/link";

const ACCENT = "#3DE05C";
const CARD = "#161B22";
const MUTED = "#8B949E";

export default function DashboardOverview() {
  const [stats, setStats] = useState({ eas: 0, users: 0, licenses: 0, hasBranding: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (DEV_MODE) {
        setStats({ eas: 2, users: 5, licenses: 3, hasBranding: true });
        setLoading(false);
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [easRes, usersRes, licRes, brandRes] = await Promise.all([
        supabase.from("eas").select("id", { count: "exact", head: true }).eq("distributor_id", user.id),
        supabase.from("app_users").select("id", { count: "exact", head: true }).eq("distributor_id", user.id),
        supabase.from("app_users").select("id", { count: "exact", head: true }).eq("distributor_id", user.id).not("license_sent_at", "is", null),
        supabase.from("branding").select("id").eq("distributor_id", user.id).maybeSingle(),
      ]);

      setStats({
        eas: easRes.count || 0,
        users: usersRes.count || 0,
        licenses: licRes.count || 0,
        hasBranding: !!brandRes.data,
      });
      setLoading(false);
    }
    load();
  }, []);

  const hour = new Date().getHours();
  const greeting = hour >= 5 && hour < 12 ? "Good morning" : hour >= 12 && hour < 17 ? "Good afternoon" : "Good evening";

  const cards = [
    { label: "Trading Bots", value: stats.eas, icon: Bot, href: "/dashboard/eas", gradient: "linear-gradient(135deg, rgba(61,224,92,0.15), rgba(61,224,92,0.05))" },
    { label: "App Users", value: stats.users, icon: Users, href: "/dashboard/users", gradient: "linear-gradient(135deg, rgba(56,189,248,0.15), rgba(56,189,248,0.05))" },
    { label: "Branding", value: stats.hasBranding ? "Set Up" : "Not Set", icon: Palette, href: "/dashboard/branding", gradient: "linear-gradient(135deg, rgba(168,85,247,0.15), rgba(168,85,247,0.05))" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-black tracking-wide text-white">{greeting}</h2>
        <p className="text-sm mt-1" style={{ color: MUTED }}>
          Welcome to <strong className="text-white">EA Access</strong> — manage your white-label trading app.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 rounded-full animate-spin" style={{ border: `2px solid ${ACCENT}`, borderTopColor: "transparent" }} />
        </div>
      ) : (
        <>
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
                    border: "1px solid rgba(61,224,92,0.08)",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(61,224,92,0.25)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(61,224,92,0.08)"; e.currentTarget.style.transform = "translateY(0)"; }}
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

          <div className="rounded-2xl p-6" style={{ background: CARD, border: "1px solid rgba(61,224,92,0.08)" }}>
            <h3 className="text-sm font-bold text-white mb-3">Quick Start</h3>
            <div className="space-y-3">
              <QuickStep num={1} done={stats.eas > 0} label="Create a Trading Bot" desc="Set up an EA with a mentor ID that your users will use to log in" href="/dashboard/eas" />
              <QuickStep num={2} done={stats.users > 0} label="Invite Users" desc="Add user emails so they can access your branded app" href="/dashboard/users" />
              <QuickStep num={3} done={stats.licenses > 0} label="Generate License" desc="Issue an access key to a user, it's emailed straight to them" href="/dashboard/licenses" />
              <QuickStep num={4} done={stats.hasBranding} label="Set up your branding" desc="Upload your logo, robot image, and choose your app name & colors" href="/dashboard/branding" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function QuickStep({ num, done, label, desc, href }: { num: number; done: boolean; label: string; desc: string; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-start gap-4 p-3 rounded-xl transition"
      style={{ background: "transparent" }}
      onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
        style={{
          background: done ? "rgba(61,224,92,0.12)" : "rgba(255,255,255,0.06)",
          color: done ? "#3DE05C" : "#8B949E",
        }}
      >
        {done ? "✓" : num}
      </div>
      <div>
        <p className="text-sm font-semibold" style={{ color: done ? "#3DE05C" : "#F0F6FC" }}>{label}</p>
        <p className="text-xs mt-0.5" style={{ color: "#8B949E" }}>{desc}</p>
      </div>
    </Link>
  );
}
