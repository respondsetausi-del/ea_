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

// Same alphabet + length as the server's makeLicenseKey (no 0/O/1/I).
function makeKey(): string {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(15);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < 15; i++) out += A[bytes[i] % A.length];
  return out;
}

export default function LicensesPage() {
  const [eas, setEAs] = useState<EA[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ email: "", ea_id: "" });
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ key: string; email: string } | null>(null);
  const [copied, setCopied] = useState(false);

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
    const { data } = await supabase.from("eas").select("*").eq("distributor_id", user.id).order("created_at", { ascending: false });
    setEAs(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.email.trim()) { setError("Enter the user's email."); return; }
    if (!form.ea_id) { setError("Select an EA."); return; }
    setGenerating(true);
    setResult(null);

    const email = form.email.trim().toLowerCase();

    if (DEV_MODE) {
      await new Promise(r => setTimeout(r, 400));
      setResult({ key: makeKey(), email });
      setGenerating(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setGenerating(false); return; }

    // Save the user (so they show in the Users tab) with the key stored on the row.
    // If they already exist for this EA, we regenerate their key in place.
    const { data: existing } = await supabase.from("app_users")
      .select("id").eq("distributor_id", user.id).eq("ea_id", form.ea_id).eq("email", email).maybeSingle();

    let key = "";
    let lastErr: string | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      key = makeKey();
      const payload = { license_key: key, license_sent_at: new Date().toISOString(), is_active: true };
      const { error: saveErr } = existing?.id
        ? await supabase.from("app_users").update(payload).eq("id", existing.id)
        : await supabase.from("app_users").insert({ distributor_id: user.id, ea_id: form.ea_id, email, ...payload });
      if (!saveErr) { lastErr = null; break; }
      lastErr = saveErr.message;
      // Only a license_key collision is worth retrying; anything else is terminal.
      if (!/duplicate/i.test(saveErr.message) || !/license_key/i.test(saveErr.message)) break;
    }

    setGenerating(false);
    if (lastErr) {
      setError(/duplicate/i.test(lastErr) ? "That user already has a key for this EA." : lastErr);
      return;
    }
    setResult({ key, email });
  };

  const cancel = () => {
    setForm({ email: "", ea_id: "" });
    setResult(null);
    setError("");
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
        <p className="text-sm mt-1" style={{ color: MUTED }}>Generate a license key, then copy it and send it to your user.</p>
      </div>

      <form onSubmit={handleGenerate} className="rounded-2xl p-5 space-y-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold tracking-widest block mb-2" style={{ color: MUTED }}>USER EMAIL</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none transition"
              style={{ background: INPUT_BG, border: `1px solid ${BORDER}` }}
              onFocus={e => e.target.style.borderColor = "rgba(10,132,255,0.4)"}
              onBlur={e => e.target.style.borderColor = BORDER}
              placeholder="user@example.com" required />
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
        <div className="flex gap-3">
          <button type="submit" disabled={generating}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-50 text-black"
            style={{ background: ACCENT, boxShadow: "0 4px 16px rgba(10,132,255,0.3)" }}>
            {generating ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
            {generating ? "Generating…" : "Generate"}
          </button>
          <button type="button" onClick={cancel}
            className="px-6 py-2.5 rounded-xl text-sm font-medium transition"
            style={{ border: `1px solid ${BORDER}`, color: MUTED }}>
            Cancel
          </button>
        </div>
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
          <p className="text-xs mt-4" style={{ color: MUTED }}>Copy this key and send it to your user — it&apos;s saved and they now appear under Users. They&apos;ll enter their email and this key in the app to activate.</p>
        </div>
      )}
    </div>
  );
}
