"use client";

import { useEffect, useState } from "react";
import { supabase, DEV_MODE } from "@/lib/supabase";
import { KeyRound, Loader2, Copy, Check } from "lucide-react";
import type { EA } from "@/lib/database.types";

const ACCENT = "#0A84FF";
const CARD = "#161B22";
const MUTED = "#8B949E";
const INPUT_BG = "rgba(13,17,23,0.8)";
const BORDER = "rgba(10,132,255,0.1)";

function demoKey(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const block = () => Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `FR-${block()}-${block()}-${block()}`;
}

export default function LicensesPage() {
  const [eas, setEAs] = useState<EA[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ email: "", ea_id: "" });
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ key: string; email: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [callerEmail, setCallerEmail] = useState<string | null>(null);

  const load = async () => {
    if (DEV_MODE) {
      setEAs([
        { id: "demo-1", distributor_id: "dev-001", name: "Gold Scalper Pro", description: "", mentor_id: "EA-GX4R-8KNP", is_active: true, created_at: "", updated_at: "" },
        { id: "demo-2", distributor_id: "dev-001", name: "Forex Hunter", description: "", mentor_id: "EA-LM7W-Q2FT", is_active: false, created_at: "", updated_at: "" },
      ] as EA[]);
      setLoading(false);
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (user.email) setCallerEmail(user.email);
    const { data } = await supabase.from("eas").select("*").eq("distributor_id", user.id).order("created_at", { ascending: false });
    setEAs(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.email.trim()) { setError("Enter the client's email."); return; }
    if (!form.ea_id) { setError("Select an EA."); return; }
    setGenerating(true);
    setResult(null);

    const email = form.email.trim().toLowerCase();

    if (DEV_MODE) {
      await new Promise(r => setTimeout(r, 500));
      setResult({ key: demoKey(), email });
      setGenerating(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setGenerating(false); return; }

    // The key is tied to a client (email) + EA, so ensure that row exists first.
    let appUserId: string | null = null;
    const { data: inserted, error: insErr } = await supabase.from("app_users")
      .insert({ distributor_id: user.id, ea_id: form.ea_id, email })
      .select("id").single();
    if (inserted) {
      appUserId = inserted.id;
    } else if (insErr?.message.includes("duplicate")) {
      const { data: existing } = await supabase.from("app_users")
        .select("id").eq("distributor_id", user.id).eq("ea_id", form.ea_id).eq("email", email).maybeSingle();
      appUserId = existing?.id ?? null;
    } else if (insErr) {
      setError(insErr.message); setGenerating(false); return;
    }
    if (!appUserId) { setError("Could not create the client record."); setGenerating(false); return; }

    try {
      const res = await fetch("/api/v1/generate-license", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app_user_id: appUserId, caller_email: callerEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.license_key) {
        setResult({ key: data.license_key, email });
      } else {
        setError(data.error || "Failed to generate the license key.");
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setGenerating(false);
    }
  };

  const copy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black tracking-wide text-white">Generate License</h2>
        <p className="text-sm mt-1" style={{ color: MUTED }}>Fill in the details and generate a key — then copy it and send it to your client.</p>
      </div>

      <form onSubmit={handleGenerate} className="rounded-2xl p-5 space-y-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold tracking-widest block mb-2" style={{ color: MUTED }}>CLIENT EMAIL</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none transition"
              style={{ background: INPUT_BG, border: `1px solid ${BORDER}` }}
              onFocus={e => e.target.style.borderColor = "rgba(10,132,255,0.4)"}
              onBlur={e => e.target.style.borderColor = BORDER}
              placeholder="client@example.com" required />
          </div>
          <div>
            <label className="text-[10px] font-bold tracking-widest block mb-2" style={{ color: MUTED }}>EA</label>
            <select value={form.ea_id} onChange={e => setForm(f => ({ ...f, ea_id: e.target.value }))}
              className="w-full rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition"
              style={{ background: INPUT_BG, border: `1px solid ${BORDER}` }}
              onFocus={e => e.target.style.borderColor = "rgba(10,132,255,0.4)"}
              onBlur={e => e.target.style.borderColor = BORDER}>
              <option value="">Select EA...</option>
              {eas.map(ea => <option key={ea.id} value={ea.id}>{ea.name}</option>)}
            </select>
          </div>
        </div>
        {eas.length === 0 && !loading && (
          <p className="text-[11px]" style={{ color: "#F59E0B" }}>Create an EA first before generating a license.</p>
        )}
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <button type="submit" disabled={generating}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-50 text-black"
          style={{ background: ACCENT, boxShadow: "0 4px 16px rgba(10,132,255,0.3)" }}>
          {generating ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
          {generating ? "Generating…" : "Generate License"}
        </button>
      </form>

      {result && (
        <div className="rounded-2xl p-6" style={{ background: CARD, border: "1px solid rgba(10,132,255,0.25)", boxShadow: "0 4px 24px rgba(10,132,255,0.08)" }}>
          <p className="text-[10px] font-bold tracking-widest mb-3" style={{ color: MUTED }}>LICENSE KEY FOR {result.email.toUpperCase()}</p>
          <div className="flex items-center gap-3 flex-wrap">
            <code className="text-lg font-mono font-bold px-4 py-3 rounded-xl tracking-wider" style={{ background: "rgba(10,132,255,0.08)", color: ACCENT, border: `1px solid ${BORDER}` }}>
              {result.key}
            </code>
            <button onClick={copy}
              className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition"
              style={{ background: copied ? "rgba(34,197,94,0.15)" : "rgba(10,132,255,0.1)", color: copied ? "#22c55e" : ACCENT, border: `1px solid ${BORDER}` }}>
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="text-xs mt-4" style={{ color: MUTED }}>Copy this key and send it to your client. They&apos;ll enter their email and this key in the app to activate.</p>
        </div>
      )}
    </div>
  );
}
