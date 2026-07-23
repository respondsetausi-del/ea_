"use client";

import { useState } from "react";
import Link from "next/link";
import { Zap, Mail, Loader2, CheckCircle2 } from "lucide-react";

const ACCENT = "#0A84FF";
const CARD = "#161B22";
const MUTED = "#8B949E";
const INPUT_BG = "rgba(13,17,23,0.8)";
const BORDER = "rgba(10,132,255,0.1)";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/v1/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) setSent(true);
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
          {sent ? (
            <div className="text-center">
              <CheckCircle2 size={44} style={{ color: ACCENT }} className="mx-auto mb-4" />
              <h1 className="text-lg font-black text-white mb-2">Check your inbox</h1>
              <p className="text-[13px] leading-[21px]" style={{ color: MUTED }}>
                If an account exists for <span className="text-white font-semibold">{email.trim().toLowerCase()}</span>,
                we&apos;ve emailed a link to reset your password. It expires in 1 hour.
              </p>
              <Link href="/login" className="inline-block mt-6 w-full py-3.5 rounded-xl font-bold text-sm text-black" style={{ background: ACCENT }}>
                Back to Sign In
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-7">
                <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4" style={{ background: "rgba(10,132,255,0.1)" }}>
                  <Zap size={24} style={{ color: ACCENT }} />
                </div>
                <h1 className="text-xl font-black tracking-wider text-white">RESET PASSWORD</h1>
                <p className="text-xs mt-1" style={{ color: MUTED }}>We&apos;ll email you a reset link</p>
              </div>

              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold tracking-widest block mb-2" style={{ color: MUTED }}>EMAIL</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: MUTED }} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      required
                      className="w-full rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none transition"
                      style={{ background: INPUT_BG, border: `1px solid ${BORDER}` }}
                      onFocus={(e) => (e.target.style.borderColor = "rgba(10,132,255,0.4)")}
                      onBlur={(e) => (e.target.style.borderColor = BORDER)}
                    />
                  </div>
                </div>

                {error && <p className="text-red-400 text-xs text-center">{error}</p>}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm tracking-wide transition disabled:opacity-50 text-black"
                  style={{ background: ACCENT, boxShadow: "0 4px 16px rgba(10,132,255,0.3)" }}
                >
                  {busy ? <Loader2 size={16} className="animate-spin" /> : null}
                  {busy ? "Sending…" : "Send Reset Link"}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs mt-6" style={{ color: MUTED }}>
          Remembered it?{" "}
          <Link href="/login" className="font-semibold hover:opacity-80 transition" style={{ color: ACCENT }}>
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
