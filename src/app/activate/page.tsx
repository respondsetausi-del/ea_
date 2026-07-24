"use client";

import { useState } from "react";
import Link from "next/link";
import { Zap, Mail, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import Logo from "@/components/Logo";

const ACCENT = "#0A84FF";
const CARD = "#161B22";
const MUTED = "#8B949E";
const INPUT_BG = "rgba(13,17,23,0.8)";
const BORDER = "rgba(10,132,255,0.1)";

export default function ActivatePage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

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
      const res = await fetch("/api/v1/free-activation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        if (data.emailSkipped) {
          setError("Activated, but email delivery isn't set up yet. Please contact support.");
        } else if (data.emailSent === false) {
          setError("We generated your key but couldn't email it. Please try again shortly.");
        } else {
          setDone(true);
        }
      } else {
        setError(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16 text-white" style={{ background: "#0D1117" }}>
      <Link
        href="/"
        className="flex items-center gap-2 text-[13px] font-semibold mb-8 transition-colors hover:text-white"
        style={{ color: MUTED }}
      >
        <ArrowLeft size={15} /> Back to home
      </Link>

      <div
        className="w-full max-w-[440px] rounded-3xl p-8 sm:p-10 border"
        style={{
          background: CARD,
          borderColor: "rgba(10,132,255,0.15)",
          boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
        }}
      >
        <div className="flex flex-col items-center text-center mb-7">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: "rgba(10,132,255,0.10)" }}
          >
            <Logo size={40} />
          </div>
          <div
            className="px-3 py-1 rounded-full text-[10px] font-extrabold tracking-[2px] mb-3 border"
            style={{ color: ACCENT, background: "rgba(10,132,255,0.1)", borderColor: "rgba(10,132,255,0.25)" }}
          >
            FREE ACTIVATION
          </div>
          <h1 className="text-[26px] font-black leading-tight mb-2">
            Activate <span style={{ color: ACCENT }}>EA NAPTUNE SCALPER</span>
          </h1>
          <p className="text-[14px] leading-[22px]" style={{ color: MUTED }}>
            No mentor or hoster needed. Enter your email and we&apos;ll send your
            access key straight to your inbox — free.
          </p>
        </div>

        {done ? (
          <div className="flex flex-col items-center text-center py-4">
            <CheckCircle2 size={44} style={{ color: ACCENT }} className="mb-4" />
            <h2 className="text-lg font-black mb-2">Check your inbox 📬</h2>
            <p className="text-[14px] leading-[22px]" style={{ color: MUTED }}>
              We&apos;ve emailed your EA NAPTUNE SCALPER access key to{" "}
              <span className="font-semibold text-white">{email.trim().toLowerCase()}</span>.
              Open the app, enter your email and this key to log in.
            </p>
            <p className="text-[12px] mt-4" style={{ color: MUTED }}>
              Didn&apos;t get it? Check your spam folder, or{" "}
              <button
                onClick={() => { setDone(false); }}
                className="font-semibold underline"
                style={{ color: ACCENT }}
              >
                try again
              </button>
              .
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-[10px] font-bold tracking-widest block mb-2" style={{ color: MUTED }}>
                YOUR EMAIL
              </label>
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

            {error && <p className="text-[13px] text-amber-400">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-[15px] font-extrabold text-black transition disabled:opacity-60"
              style={{ background: ACCENT, boxShadow: "0 4px 20px rgba(10,132,255,0.35)" }}
            >
              {busy ? <Loader2 size={17} className="animate-spin" /> : <Zap size={17} />}
              {busy ? "Activating…" : "Get My Free Key"}
            </button>

            <p className="text-[11px] text-center leading-[18px]" style={{ color: MUTED }}>
              Your key is tied to your email and grants access to the EA NAPTUNE
              SCALPER bot. We&apos;ll never share your address.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
