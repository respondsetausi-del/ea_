"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Zap, Loader2, CheckCircle2, Eye, EyeOff } from "lucide-react";

const ACCENT = "#0A84FF";
const CARD = "#161B22";
const MUTED = "#8B949E";
const INPUT_BG = "rgba(13,17,23,0.8)";
const BORDER = "rgba(10,132,255,0.1)";

function ResetInner() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!token) {
      setError("This reset link is missing its token. Request a new one.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/v1/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) setDone(true);
      else setError(data.error || "Something went wrong. Please try again.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6" style={{ background: "#0D1117" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <Link href="/" className="text-[18px] font-black tracking-wide inline-block">
            EA <span style={{ color: ACCENT }}>ACCESS</span>
          </Link>
        </div>

        <div className="rounded-2xl border p-8" style={{ background: CARD, borderColor: BORDER, boxShadow: "0 4px 40px rgba(0,0,0,0.4)" }}>
          {done ? (
            <div className="text-center">
              <CheckCircle2 size={44} style={{ color: ACCENT }} className="mx-auto mb-4" />
              <h1 className="text-lg font-black text-white mb-2">Password updated</h1>
              <p className="text-[13px] leading-[21px]" style={{ color: MUTED }}>
                Your password has been changed. You can now sign in with your new password.
              </p>
              <Link href="/login" className="inline-block mt-6 w-full py-3.5 rounded-xl font-bold text-sm text-black" style={{ background: ACCENT }}>
                Sign In
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-7">
                <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4" style={{ background: "rgba(10,132,255,0.1)" }}>
                  <Zap size={24} style={{ color: ACCENT }} />
                </div>
                <h1 className="text-xl font-black tracking-wider text-white">NEW PASSWORD</h1>
                <p className="text-xs mt-1" style={{ color: MUTED }}>Choose a new password for your account</p>
              </div>

              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold tracking-widest block mb-2" style={{ color: MUTED }}>NEW PASSWORD</label>
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                      required
                      className="w-full rounded-xl px-4 py-3 pr-12 text-sm text-white placeholder-zinc-600 focus:outline-none transition"
                      style={{ background: INPUT_BG, border: `1px solid ${BORDER}` }}
                      onFocus={(e) => (e.target.style.borderColor = "rgba(10,132,255,0.4)")}
                      onBlur={(e) => (e.target.style.borderColor = BORDER)}
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: MUTED }}>
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold tracking-widest block mb-2" style={{ color: MUTED }}>CONFIRM PASSWORD</label>
                  <input
                    type={showPw ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Re-enter password"
                    autoComplete="new-password"
                    required
                    className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none transition"
                    style={{ background: INPUT_BG, border: `1px solid ${BORDER}` }}
                    onFocus={(e) => (e.target.style.borderColor = "rgba(10,132,255,0.4)")}
                    onBlur={(e) => (e.target.style.borderColor = BORDER)}
                  />
                </div>

                {error && <p className="text-red-400 text-xs text-center">{error}</p>}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm tracking-wide transition disabled:opacity-50 text-black"
                  style={{ background: ACCENT, boxShadow: "0 4px 16px rgba(10,132,255,0.3)" }}
                >
                  {busy ? <Loader2 size={16} className="animate-spin" /> : null}
                  {busy ? "Updating…" : "Update Password"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetInner />
    </Suspense>
  );
}
