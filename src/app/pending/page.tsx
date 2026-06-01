"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { MailCheck } from "lucide-react";

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

  return (
    <div className="flex min-h-screen items-center justify-center px-6 bg-black">
      <div className="w-full max-w-sm text-center">
        <div className="w-16 h-16 mx-auto rounded-full border-2 border-[#3DE05C]/60 flex items-center justify-center mb-4">
          <MailCheck className="text-[#3DE05C]" size={26} />
        </div>
        <h1 className="text-2xl font-black tracking-wide text-white">Check your email</h1>
        <p className="text-zinc-400 text-sm mt-3 leading-relaxed">
          We sent a verification link{email ? <> to <span className="text-white">{email}</span></> : ""}.
          Click it to activate your distributor account. You&apos;ll get an approval email once it&apos;s done.
        </p>

        {email && (
          <button
            onClick={resend}
            disabled={resending}
            className="mt-6 w-full py-3.5 rounded-xl border border-zinc-700 text-white font-bold text-sm tracking-wide hover:bg-white hover:text-black transition disabled:opacity-50"
          >
            {resending ? "Resending…" : "Resend verification email"}
          </button>
        )}
        {resentMsg && <p className="text-[#3DE05C] text-xs mt-3">{resentMsg}</p>}

        <p className="text-center text-zinc-500 text-xs mt-6">
          Already verified?{" "}
          <Link href="/login" className="text-white hover:text-zinc-300">Sign In</Link>
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
