"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

type Status = "loading" | "success" | "error";

function VerifyInner() {
  const params = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No verification token found in this link.");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v1/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok) {
          setStatus("success");
          setMessage(
            data.alreadyVerified
              ? "Your account is already verified. You can sign in."
              : "Your email is verified and your account is approved!"
          );
        } else {
          setStatus("error");
          setMessage(data.error || "Verification failed. Please try again.");
        }
      } catch {
        if (!cancelled) {
          setStatus("error");
          setMessage("Something went wrong. Please try again.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center px-6 bg-black">
      <div className="w-full max-w-sm text-center">
        {status === "loading" && (
          <>
            <Loader2 className="mx-auto mb-4 animate-spin text-[#0A84FF]" size={40} />
            <h1 className="text-xl font-black tracking-wide text-white">Verifying…</h1>
            <p className="text-zinc-500 text-xs mt-2">Confirming your account.</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle2 className="mx-auto mb-4 text-[#0A84FF]" size={48} />
            <h1 className="text-2xl font-black tracking-wide text-white">Verified!</h1>
            <p className="text-zinc-400 text-sm mt-2">{message}</p>
            <Link
              href="/login"
              className="inline-block mt-6 w-full py-3.5 rounded-xl bg-[#0A84FF] text-black font-bold text-sm tracking-wide hover:brightness-110 transition"
            >
              Sign In
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="mx-auto mb-4 text-red-400" size={48} />
            <h1 className="text-2xl font-black tracking-wide text-white">Verification failed</h1>
            <p className="text-zinc-400 text-sm mt-2">{message}</p>
            <Link
              href="/login"
              className="inline-block mt-6 w-full py-3.5 rounded-xl border border-zinc-700 text-white font-bold text-sm tracking-wide hover:bg-white hover:text-black transition"
            >
              Back to Sign In
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyInner />
    </Suspense>
  );
}
