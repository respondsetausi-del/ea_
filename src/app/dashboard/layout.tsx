"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { LayoutDashboard, Bot, Palette, Users, LogOut, Menu, X } from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/eas", label: "Trading Bots", icon: Bot },
  { href: "/dashboard/branding", label: "Branding", icon: Palette },
  { href: "/dashboard/users", label: "Users", icon: Users },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{ email?: string; name?: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push("/login");
        return;
      }
      setUser({ email: data.user.email, name: data.user.user_metadata?.name });
    });
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-zinc-950 border-r border-zinc-800/60 flex flex-col transition-transform lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="h-1 bg-cyan-500" />
        <div className="px-5 pt-5 pb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black tracking-widest text-cyan-400">FREE ROBOT</h2>
            <p className="text-[10px] text-zinc-600 mt-0.5">Distributor Panel</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-zinc-500">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-0.5 mt-2">
          {NAV.map(item => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${active ? "bg-cyan-500/10 text-cyan-400" : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"}`}>
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 pb-4 border-t border-zinc-800/60 pt-3 space-y-2">
          <div className="px-3 py-2">
            <p className="text-xs font-semibold text-white truncate">{user.name || "Distributor"}</p>
            <p className="text-[10px] text-zinc-500 truncate">{user.email}</p>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-500 hover:text-red-400 hover:bg-red-500/5 transition w-full">
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-zinc-800/60 flex items-center px-4 gap-4 shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-zinc-400">
            <Menu size={20} />
          </button>
          <h1 className="text-sm font-bold text-zinc-300 tracking-wide">
            {NAV.find(n => n.href === pathname)?.label || "Dashboard"}
          </h1>
        </header>
        <div className="flex-1 p-4 sm:p-6 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
