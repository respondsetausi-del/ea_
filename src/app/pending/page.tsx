"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { APPROVAL_MODE } from "@/lib/config";
import Link from "next/link";
import { MailCheck, ShieldCheck } from "lucide-react";

const ACCENT = "#0A84FF";

function PendingInner() {
  const params = useSearchParams();
  const email = params.get("email") || "";
  const [resending, setResending] = useState(false);
  const [resentMsg, setResentMsg] = useState("");

  const resend = async () => {
    if (!email) return;
    setResending(true);
    setResentMsg("");
    try {
      await fetch("/api/v1/send-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setResentMsg("Verification email sent again. Check your inbox.");
    } catch {
      setResentMsg("Couldn't resend right now. Try again shortly.");
    } finally {
      setResending(false);
    }
  };

  const Icon = APPROVAL_MODE ? ShieldCheck : MailCheck;

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
          className="rounded-2xl border p-8 text-center"
          style={{
            background: "#161B22",
            borderColor: "rgba(10,132,255,0.1)",
            boxShadow: "0 4px 40px rgba(0,0,0,0.4)",
          }}
        >
          <div
            className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4"
            style={{ background: "rgba(10,132,255,0.1)" }}
          >
            <Icon size={26} style={{ color: ACCENT }} />
          </div>

          {APPROVAL_MODE ? (
            <>
              <h1 className="text-xl font-black tracking-wide text-white">
                Pending Approval
              </h1>
              <p
                className="text-sm mt-3 leading-relaxed"
                style={{ color: "#8B949E" }}
              >
                Your account
                {email ? (
                  <>
                    {" "}
                    for <span className="text-white">{email}</span>
                  </>
                ) : (
                  ""
                )}{" "}
                has been created and is awaiting administrator approval.
                You&apos;ll be able to sign in once an admin approves it.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-black tracking-wide text-white">
                Check Your Email
              </h1>
              <p
                className="text-sm mt-3 leading-relaxed"
                style={{ color: "#8B949E" }}
              >
                We sent a verification link
                {email ? (
                  <>
                    {" "}
                    to <span className="text-white">{email}</span>
                  </>
                ) : (
                  ""
                )}
                . Click it to activate your distributor account.
              </p>

              {email && (
                <button
                  onClick={resend}
                  disabled={resending}
                  className="mt-6 w-full py-3.5 rounded-xl font-bold text-sm tracking-wide transition disabled:opacity-50 border"
                  style={{
                    color: ACCENT,
                    borderColor: "rgba(10,132,255,0.25)",
                    background: "rgba(10,132,255,0.06)",
                  }}
                >
                  {resending ? "Resending..." : "Resend Verification Email"}
                </button>
              )}
              {resentMsg && (
                <p className="text-xs mt-3" style={{ color: ACCENT }}>
                  {resentMsg}
                </p>
              )}
            </>
          )}
        </div>

        <p className="text-center text-xs mt-6" style={{ color: "#8B949E" }}>
          {APPROVAL_MODE ? "Already approved? " : "Already verified? "}
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

export default function PendingPage() {
  return (
    <Suspense fallback={null}>
      <PendingInner />
    </Suspense>
  );
}
