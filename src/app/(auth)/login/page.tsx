"use client";

import { useState } from "react";
import { supabase, DEV_MODE } from "@/lib/supabase";
import { isSuperAdminNow } from "@/lib/admin-client";
import { track } from "@/lib/track";
import { APPROVAL_MODE } from "@/lib/config";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import Logo from "@/components/Logo";

const ACCENT = "#0A84FF";

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

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(DEV_MODE ? "Use test@freerobot.app / king" : error.message);
      setLoading(false);
      return;
    }

    const { data: distributor } = await supabase
      .from("distributors")
      .select("verified, is_active")
      .eq("id", data.user?.id)
      .maybeSingle();

    if (distributor?.is_active === false) {
      await supabase.auth.signOut();
      setError("This account has been suspended. Contact an administrator.");
      setLoading(false);
      return;
    }

    if (!distributor?.verified && !(await isSuperAdminNow(data.user?.email))) {
      await supabase.auth.signOut();
      setError(APPROVAL_MODE
        ? "Your account is awaiting administrator approval. You'll be able to sign in once it's approved."
        : "Please verify your email before signing in. Check your inbox for the verification link.");
      setLoading(false);
      return;
    }

    // Log the successful login for site-traffic analytics (best-effort).
    track("login", { email: data.user?.email || email });
    router.push("/dashboard");
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center px-6"
      style={{ background: "#0D1117" }}
    >
      <div className="w-full max-w-sm">
        {/* Back to home */}
        <div className="flex justify-center mb-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-[18px] font-black tracking-wide"
          >
            <Logo size={24} />
            EA <span style={{ color: ACCENT }}>NAPTUNE</span>
          </Link>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl border p-8"
          style={{
            background: "#161B22",
            borderColor: "rgba(10,132,255,0.1)",
            boxShadow: "0 4px 40px rgba(0,0,0,0.4)",
          }}
        >
          <div className="text-center mb-7">
            <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4" style={{ background: "rgba(10,132,255,0.08)" }}>
              <Logo size={38} />
            </div>
            <h1 className="text-xl font-black tracking-wider text-white">
              SIGN IN
            </h1>
            <p className="text-xs mt-1" style={{ color: "#8B949E" }}>
              Distributor Dashboard
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                className="text-[10px] font-bold tracking-widest block mb-2"
                style={{ color: "#8B949E" }}
              >
                EMAIL
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none transition"
                style={{
                  background: "rgba(13,17,23,0.8)",
                  border: "1px solid rgba(10,132,255,0.1)",
                }}
                onFocus={(e) =>
                  (e.target.style.borderColor = "rgba(10,132,255,0.4)")
                }
                onBlur={(e) =>
                  (e.target.style.borderColor = "rgba(10,132,255,0.1)")
                }
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label
                className="text-[10px] font-bold tracking-widest block mb-2"
                style={{ color: "#8B949E" }}
              >
                PASSWORD
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none transition pr-12"
                  style={{
                    background: "rgba(13,17,23,0.8)",
                    border: "1px solid rgba(10,132,255,0.1)",
                  }}
                  onFocus={(e) =>
                    (e.target.style.borderColor = "rgba(10,132,255,0.4)")
                  }
                  onBlur={(e) =>
                    (e.target.style.borderColor = "rgba(10,132,255,0.1)")
                  }
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "#8B949E" }}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="text-right">
              <Link
                href="/forgot-password"
                className="text-[11px] font-semibold hover:opacity-80 transition"
                style={{ color: ACCENT }}
              >
                Forgot password?
              </Link>
            </div>

            {error && (
              <p className="text-red-400 text-xs text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-bold text-sm tracking-wide transition disabled:opacity-50 text-black"
              style={{
                background: ACCENT,
                boxShadow: "0 4px 16px rgba(10,132,255,0.3)",
              }}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          {DEV_MODE && (
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="w-full py-3.5 rounded-xl font-bold text-sm tracking-wide transition mt-3 border"
              style={{
                color: ACCENT,
                borderColor: "rgba(10,132,255,0.25)",
                background: "rgba(10,132,255,0.06)",
              }}
            >
              Demo Login (No Supabase)
            </button>
          )}
        </div>

        <p className="text-center text-xs mt-6" style={{ color: "#8B949E" }}>
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-semibold hover:opacity-80 transition"
            style={{ color: ACCENT }}
          >
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
