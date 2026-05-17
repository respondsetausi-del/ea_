"use client";

import { useState } from "react";
import { supabase, DEV_MODE } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (DEV_MODE && email === "test@freerobot.app" && password === "king") {
      router.push("/dashboard");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(DEV_MODE ? "Use test@freerobot.app / king" : error.message);
      setLoading(false);
      return;
    }
    router.push("/dashboard");
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6 bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-full border-2 border-cyan-500 flex items-center justify-center mb-4 bg-cyan-50">
            <LogIn className="text-cyan-500" size={24} />
          </div>
          <h1 className="text-2xl font-black tracking-wider text-gray-900">SIGN IN</h1>
          <p className="text-gray-400 text-xs mt-1">Distributor Dashboard</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-[10px] font-bold tracking-widest text-gray-400 block mb-2">EMAIL</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-bold tracking-widest text-gray-400 block mb-2">PASSWORD</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition pr-12"
                placeholder="••••••••"
                required
              />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && <p className="text-red-500 text-xs text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-cyan-500 text-white font-bold text-sm tracking-wide hover:bg-cyan-600 transition disabled:opacity-50 shadow-sm"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {DEV_MODE && (
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="w-full py-3.5 rounded-xl border border-cyan-400 text-cyan-600 font-bold text-sm tracking-wide hover:bg-cyan-50 transition mt-3"
          >
            Demo Login (No Supabase)
          </button>
        )}

        <p className="text-center text-gray-400 text-xs mt-6">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-cyan-500 hover:text-cyan-600">Register</Link>
        </p>
      </div>
    </div>
  );
}
