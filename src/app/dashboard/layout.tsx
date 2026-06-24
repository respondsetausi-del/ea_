"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase, DEV_MODE, DEV_USER } from "@/lib/supabase";
import { isSuperAdminNow } from "@/lib/admin-client";
import Link from "next/link";
import { LayoutDashboard, Bot, Palette, Users, KeyRound, Crown, LogOut, Menu, X, Zap } from "lucide-react";

const ACCENT = "#FFB800";
const BG = "#0D1117";
const CARD = "#161B22";
const MUTED = "#8B949E";

const NAV_MAIN = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/eas", label: "Trading Bots", icon: Bot },
  { href: "/dashboard/users", label: "Users", icon: Users },
];

const NAV_MANAGE = [
  { href: "/dashboard/licenses", label: "Generate License", icon: KeyRound },
  { href: "/dashboard/branding", label: "Branding", icon: Palette },
];

const ADMIN_NAV = { href: "/dashboard/admin", label: "Super Admin", icon: Crown };

const DEV_ONBOARDED_KEY = "dev_onboarded";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{ email?: string; name?: string } | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (DEV_MODE) {
      setUser({ email: DEV_USER.email, name: DEV_USER.user_metadata.name });
      setIsSuperAdmin(true);
      const onboarded = typeof window !== "undefined" && localStorage.getItem(DEV_ONBOARDED_KEY) === "true";
      if (!onboarded && pathname !== "/dashboard/start") {
        router.push("/dashboard/start");
      }
      return;
    }
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.push("/login");
        return;
      }

      const { data: distributor } = await supabase
        .from("distributors")
        .select("verified, onboarded, is_active")
        .eq("id", data.user.id)
        .maybeSingle();

      if (distributor?.is_active === false) {
        await supabase.auth.signOut();
        router.push("/login?suspended=1");
        return;
      }

      const superAdmin = await isSuperAdminNow(data.user.email);

      if (!distributor?.verified && !superAdmin) {
        await supabase.auth.signOut();
        router.push(`/pending?email=${encodeURIComponent(data.user.email || "")}`);
        return;
      }

      if (!distributor?.onboarded && pathname !== "/dashboard/start") {
        router.push("/dashboard/start");
        return;
      }

      setUser({ email: data.user.email, name: data.user.user_metadata?.name });
      setIsSuperAdmin(superAdmin);
    });
  }, [router, pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: BG }}>
        <div className="w-6 h-6 rounded-full animate-spin" style={{ border: `2px solid ${ACCENT}`, borderTopColor: "transparent" }} />
      </div>
    );
  }

  const isActive = (href: string) => pathname === href;

  const NavItem = ({ href, label, icon: Icon, isAdmin }: { href: string; label: string; icon: any; isAdmin?: boolean }) => {
    const active = isActive(href);
    return (
      <Link
        href={href}
        onClick={() => setSidebarOpen(false)}
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative"
        style={{
          background: active ? "rgba(255,184,0,0.1)" : "transparent",
          color: active ? ACCENT : isAdmin ? "#F59E0B" : MUTED,
        }}
        onMouseEnter={e => { if (!active) { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#F0F6FC"; } }}
        onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = isAdmin ? "#F59E0B" : MUTED; } }}
      >
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full" style={{ background: ACCENT }} />
        )}
        <Icon size={18} />
        {label}
      </Link>
    );
  };

  return (
    <div className="flex min-h-screen" style={{ background: BG }}>
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 flex flex-col transition-transform lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ background: CARD, borderRight: "1px solid rgba(255,184,0,0.06)" }}
      >
        <div className="px-5 pt-6 pb-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,184,0,0.12)" }}>
              <Zap size={16} style={{ color: ACCENT }} />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-widest text-white">EA <span style={{ color: ACCENT }}>ACCESS</span></h2>
              <p className="text-[9px] tracking-wider" style={{ color: MUTED }}>Distributor Panel</p>
            </div>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden" style={{ color: MUTED }}>
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-5 mt-1">
          <div>
            <p className="px-3 mb-2 text-[9px] font-bold tracking-[0.15em] uppercase" style={{ color: "rgba(139,148,158,0.5)" }}>Main</p>
            <div className="space-y-0.5">
              {NAV_MAIN.map(item => <NavItem key={item.href} {...item} />)}
            </div>
          </div>

          <div>
            <p className="px-3 mb-2 text-[9px] font-bold tracking-[0.15em] uppercase" style={{ color: "rgba(139,148,158,0.5)" }}>Management</p>
            <div className="space-y-0.5">
              {NAV_MANAGE.map(item => <NavItem key={item.href} {...item} />)}
            </div>
          </div>

          {isSuperAdmin && (
            <div>
              <p className="px-3 mb-2 text-[9px] font-bold tracking-[0.15em] uppercase" style={{ color: "rgba(139,148,158,0.5)" }}>Admin</p>
              <div className="space-y-0.5">
                <NavItem {...ADMIN_NAV} isAdmin />
              </div>
            </div>
          )}
        </nav>

        <div className="px-3 pb-4 pt-3 space-y-2" style={{ borderTop: "1px solid rgba(255,184,0,0.06)" }}>
          <div className="px-3 py-2">
            <p className="text-xs font-semibold text-white truncate">{user.name || "Distributor"}</p>
            <p className="text-[10px] truncate" style={{ color: MUTED }}>{user.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition w-full"
            style={{ color: MUTED }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; e.currentTarget.style.color = "#EF4444"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = MUTED; }}
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header
          className="h-14 flex items-center px-4 gap-4 shrink-0"
          style={{ background: "rgba(22,27,34,0.8)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,184,0,0.06)" }}
        >
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden" style={{ color: MUTED }}>
            <Menu size={20} />
          </button>
          <h1 className="text-sm font-bold tracking-wide" style={{ color: MUTED }}>
            {[...NAV_MAIN, ...NAV_MANAGE, ADMIN_NAV].find(n => n.href === pathname)?.label || "Dashboard"}
          </h1>
        </header>
        <div className="flex-1 p-4 sm:p-6 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
