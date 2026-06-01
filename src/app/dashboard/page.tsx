"use client";

import { useEffect, useState } from "react";
import { supabase, DEV_MODE } from "@/lib/supabase";
import { Bot, Users, Palette, Activity } from "lucide-react";
import Link from "next/link";

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

  const cards = [
    { label: "Trading Bots", value: stats.eas, icon: Bot, href: "/dashboard/eas", color: "cyan" },
    { label: "App Users", value: stats.users, icon: Users, href: "/dashboard/users", color: "green" },
    { label: "Branding", value: stats.hasBranding ? "Set Up" : "Not Set", icon: Palette, href: "/dashboard/branding", color: "purple" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-black tracking-wide mb-1 text-gray-900">Dashboard</h2>
        <p className="text-gray-500 text-sm">Manage your white-label trading app</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {cards.map(card => {
              const Icon = card.icon;
              return (
                <Link key={card.label} href={card.href}
                  className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-gray-900 hover:shadow-md transition group">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                      <Icon className="text-gray-900" size={20} />
                    </div>
                    <Activity className="text-gray-300 group-hover:text-gray-900 transition" size={16} />
                  </div>
                  <p className="text-2xl font-black text-gray-900">{card.value}</p>
                  <p className="text-xs text-gray-500 mt-1 font-medium">{card.label}</p>
                </Link>
              );
            })}
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-gray-900 mb-3">Quick Start</h3>
            <div className="space-y-3">
              <QuickStep num={1} done={stats.eas > 0} label="Create a Trading Bot" desc="Set up an EA with a mentor ID that your users will use to log in" href="/dashboard/eas" />
              <QuickStep num={2} done={stats.users > 0} label="Invite Users" desc="Add user emails so they can access your branded app" href="/dashboard/users" />
              <QuickStep num={3} done={stats.licenses > 0} label="Generate License" desc="Issue an access key to a user — it's emailed straight to them" href="/dashboard/licenses" />
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
    <Link href={href} className="flex items-start gap-4 p-3 rounded-xl hover:bg-gray-50 transition">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${done ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}>
        {done ? "✓" : num}
      </div>
      <div>
        <p className={`text-sm font-semibold ${done ? "text-green-600" : "text-gray-900"}`}>{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
      </div>
    </Link>
  );
}
