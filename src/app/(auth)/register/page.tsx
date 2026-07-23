"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { APPROVAL_MODE } from "@/lib/config";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus, Eye, EyeOff } from "lucide-react";

const ACCENT = "#0A84FF";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!APPROVAL_MODE) {
      try {
        await fetch("/api/v1/send-verification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalizedEmail }),
        });
      } catch {
        // Non-fatal: user can resend from the pending page.
      }
    }
    await supabase.auth.signOut();

    router.push(`/pending?email=${encodeURIComponent(normalizedEmail)}`);
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center px-6"
      style={{ background: "#0D1117" }}
    >
      <div className="w-full max-w-sm">
        {/* Back to home */}
        <div className="text-center mb-6">
          <Link
            href="/"
            className="text-[18px] font-black tracking-wide inline-block"
          >
            EA <span style={{ color: ACCENT }}>ACCESS</span>
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
            <div
              className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "rgba(10,132,255,0.1)" }}
            >
              <UserPlus size={24} style={{ color: ACCENT }} />
            </div>
            <h1 className="text-xl font-black tracking-wider text-white">
              REGISTER
            </h1>
            <p className="text-xs mt-1" style={{ color: "#8B949E" }}>
              Create your distributor account
            </p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label
                className="text-[10px] font-bold tracking-widest block mb-2"
                style={{ color: "#8B949E" }}
              >
                YOUR NAME
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
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
                placeholder="John Doe"
                required
              />
            </div>

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
                  placeholder="Min 6 characters"
                  minLength={6}
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
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: "#8B949E" }}>
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold hover:opacity-80 transition"
            style={{ color: ACCENT }}
          >
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
