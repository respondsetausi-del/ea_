"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, DEV_MODE } from "@/lib/supabase";
import { Bot, Users, KeyRound, Palette, Check, Lock, ArrowRight, PartyPopper } from "lucide-react";

const DEV_ONBOARDED_KEY = "dev_onboarded";

type Counts = { eas: number; users: number; licenses: number; branding: boolean };

const STEPS = [
  { key: "eas", label: "Create a Trading Bot", desc: "Set up an EA with an ID your users log in with.", href: "/dashboard/eas", icon: Bot },
  { key: "users", label: "Invite Users", desc: "Add the emails allowed to access your app.", href: "/dashboard/users", icon: Users },
  { key: "licenses", label: "Generate License", desc: "Issue an access key — it's emailed to the user.", href: "/dashboard/licenses", icon: KeyRound },
  { key: "branding", label: "Set Up Branding", desc: "Logo, robot image, app name & colors.", href: "/dashboard/branding", icon: Palette },
] as const;

export default function OnboardingWizard() {
  const router = useRouter();
  const [counts, setCounts] = useState<Counts | null>(null);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    async function load() {
      if (DEV_MODE) {
        // Fresh start locally so the guided sequence is visible end-to-end.
        setCounts({ eas: 0, users: 0, licenses: 0, branding: false });
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const [easRes, usersRes, licRes, brandRes] = await Promise.all([
        supabase.from("eas").select("id", { count: "exact", head: true }).eq("distributor_id", user.id),
        supabase.from("app_users").select("id", { count: "exact", head: true }).eq("distributor_id", user.id),
        supabase.from("app_users").select("id", { count: "exact", head: true }).eq("distributor_id", user.id).not("license_sent_at", "is", null),
        supabase.from("branding").select("id").eq("distributor_id", user.id).maybeSingle(),
      ]);
      setCounts({
        eas: easRes.count || 0,
        users: usersRes.count || 0,
        licenses: licRes.count || 0,
        branding: !!brandRes.data,
      });
    }
    load();
  }, [router]);

  const done = (key: string): boolean => {
    if (!counts) return false;
    if (key === "branding") return counts.branding;
    return (counts[key as "eas" | "users" | "licenses"] || 0) > 0;
  };

  // First step that isn't complete = the active step. Earlier steps gate later ones.
  const currentIndex = STEPS.findIndex(s => !done(s.key));
  const allDone = currentIndex === -1;

  const finish = async () => {
    setFinishing(true);
    if (DEV_MODE) {
      if (typeof window !== "undefined") localStorage.setItem(DEV_ONBOARDED_KEY, "true");
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await supabase.from("distributors").update({ onboarded: true }).eq("id", user.id);
    }
    router.push("/dashboard");
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-black tracking-wide text-gray-900">Welcome — let&apos;s get you set up</h2>
        <p className="text-gray-500 text-sm mt-1">Follow these steps in order to launch your white-label app.</p>
      </div>

      {!counts ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              const isDone = done(step.key);
              const isCurrent = i === currentIndex;
              const isLocked = !isDone && !isCurrent;

              return (
                <div
                  key={step.key}
                  className={`rounded-2xl border p-5 flex items-center gap-4 transition ${
                    isCurrent ? "border-gray-900 bg-white shadow-md"
                    : isDone ? "border-green-200 bg-green-50/40"
                    : "border-gray-200 bg-gray-50 opacity-60"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isDone ? "bg-green-100 text-green-600" : isCurrent ? "bg-gray-900 text-white" : "bg-gray-200 text-gray-400"
                  }`}>
                    {isDone ? <Check size={20} /> : isLocked ? <Lock size={16} /> : <Icon size={20} />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold tracking-widest text-gray-400">STEP {i + 1}</span>
                      {isDone && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-600">DONE</span>}
                    </div>
                    <p className="text-sm font-bold text-gray-900">{step.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{step.desc}</p>
                  </div>

                  {isCurrent && (
                    <button
                      onClick={() => router.push(step.href)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 transition shrink-0"
                    >
                      Start <ArrowRight size={15} />
                    </button>
                  )}
                  {isDone && (
                    <button
                      onClick={() => router.push(step.href)}
                      className="text-xs font-semibold text-gray-500 hover:text-gray-900 transition shrink-0"
                    >
                      Edit
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {allDone && (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-center">
              <PartyPopper className="mx-auto text-green-600 mb-2" size={28} />
              <p className="text-sm font-bold text-gray-900">You&apos;re all set!</p>
              <p className="text-xs text-gray-500 mt-1">Your app is ready to go.</p>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button onClick={finish} disabled={finishing} className="text-xs font-semibold text-gray-400 hover:text-gray-700 transition disabled:opacity-50">
              {allDone ? "" : "Skip for now"}
            </button>
            <button
              onClick={finish}
              disabled={finishing}
              className={`px-6 py-3 rounded-xl text-sm font-bold transition disabled:opacity-50 ${
                allDone ? "bg-[#3DE05C] text-black hover:brightness-110" : "border border-gray-300 text-gray-600 hover:border-gray-900"
              }`}
            >
              {finishing ? "Finishing…" : allDone ? "Go to Dashboard" : "Continue to Dashboard"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
