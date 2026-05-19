"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase, DEV_MODE, DEV_USER } from "@/lib/supabase";
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
    if (DEV_MODE) {
      setUser({ email: DEV_USER.email, name: DEV_USER.user_metadata.name });
      return;
    }
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
        <div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/20 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col transition-transform lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="h-1 bg-white" />
        <div className="px-5 pt-5 pb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black tracking-widest text-gray-900">FREE ROBOT</h2>
            <p className="text-[10px] text-gray-400 mt-0.5">Distributor Panel</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-400">
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
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${active ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"}`}>
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 pb-4 border-t border-gray-200 pt-3 space-y-2">
          <div className="px-3 py-2">
            <p className="text-xs font-semibold text-gray-900 truncate">{user.name || "Distributor"}</p>
            <p className="text-[10px] text-gray-400 truncate">{user.email}</p>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-red-500 hover:bg-red-50 transition w-full">
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-4 shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-gray-500">
            <Menu size={20} />
          </button>
          <h1 className="text-sm font-bold text-gray-700 tracking-wide">
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
