"use client";

import { useEffect, useState } from "react";
import { supabase, DEV_MODE } from "@/lib/supabase";
import { Plus, Trash2, Power, PowerOff, Copy, Check } from "lucide-react";
import type { EA } from "@/lib/database.types";

const ACCENT = "#FFB800";
const CARD = "#161B22";
const MUTED = "#8B949E";
const INPUT_BG = "rgba(13,17,23,0.8)";
const BORDER = "rgba(255,184,0,0.1)";

export default function EAsPage() {
  const [eas, setEAs] = useState<EA[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", license_key: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const load = async () => {
    if (DEV_MODE) {
      setEAs([
        { id: 'demo-1', distributor_id: 'dev-001', name: 'Gold Scalper Pro', description: 'Automated gold scalping strategy', mentor_id: 'GOLD-2024', is_active: true, created_at: '2025-01-15T00:00:00Z', updated_at: '2025-01-15T00:00:00Z' },
        { id: 'demo-2', distributor_id: 'dev-001', name: 'Forex Hunter', description: 'Multi-pair swing trading bot', mentor_id: 'FX-HUNT-01', is_active: false, created_at: '2025-02-01T00:00:00Z', updated_at: '2025-02-01T00:00:00Z' },
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("eas").insert({
      distributor_id: user.id,
      name: form.name,
      description: form.description || null,
      mentor_id: form.license_key,
    });

    if (error) {
      setError(error.message.includes("duplicate") ? "EA ID already exists" : error.message);
      setSaving(false);
      return;
    }

    setForm({ name: "", description: "", license_key: "" });
    setShowForm(false);
    setSaving(false);
    load();
  };

  const toggleActive = async (ea: EA) => {
    await supabase.from("eas").update({ is_active: !ea.is_active, updated_at: new Date().toISOString() }).eq("id", ea.id);
    load();
  };

  const deleteEA = async (id: string) => {
    if (!confirm("Delete this EA? Users linked to it will lose access.")) return;
    await supabase.from("eas").delete().eq("id", id);
    load();
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black tracking-wide text-white">Trading Bots</h2>
          <p className="text-sm mt-1" style={{ color: MUTED }}>Create and manage your EAs. Each EA has a unique EA ID for user access.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition text-black"
          style={{ background: ACCENT, boxShadow: "0 4px 16px rgba(255,184,0,0.3)" }}
        >
          <Plus size={16} />
          New EA
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-2xl p-5 space-y-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <h3 className="text-sm font-bold text-white">Create New EA</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold tracking-widest block mb-2" style={{ color: MUTED }}>EA NAME</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none transition"
                style={{ background: INPUT_BG, border: `1px solid ${BORDER}` }}
                onFocus={e => e.target.style.borderColor = "rgba(255,184,0,0.4)"}
                onBlur={e => e.target.style.borderColor = BORDER}
                placeholder="e.g. Gold Scalper Pro" required />
            </div>
            <div>
              <label className="text-[10px] font-bold tracking-widest block mb-2" style={{ color: MUTED }}>EA ID</label>
              <input value={form.license_key} onChange={e => setForm(f => ({ ...f, license_key: e.target.value }))}
                className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none transition"
                style={{ background: INPUT_BG, border: `1px solid ${BORDER}` }}
                onFocus={e => e.target.style.borderColor = "rgba(255,184,0,0.4)"}
                onBlur={e => e.target.style.borderColor = BORDER}
                placeholder="Unique ID users enter to login" required />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold tracking-widest block mb-2" style={{ color: MUTED }}>DESCRIPTION</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none transition resize-none h-20"
              style={{ background: INPUT_BG, border: `1px solid ${BORDER}` }}
              onFocus={e => e.target.style.borderColor = "rgba(255,184,0,0.4)"}
              onBlur={e => e.target.style.borderColor = BORDER}
              placeholder="Optional description" />
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="px-6 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-50 text-black"
              style={{ background: ACCENT }}>
              {saving ? "Creating..." : "Create EA"}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-6 py-2.5 rounded-xl text-sm font-medium transition"
              style={{ border: `1px solid ${BORDER}`, color: MUTED }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 rounded-full animate-spin" style={{ border: `2px solid ${ACCENT}`, borderTopColor: "transparent" }} />
        </div>
      ) : eas.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-sm" style={{ color: MUTED }}>No trading bots yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {eas.map(ea => (
            <div key={ea.id} className="rounded-2xl p-5 flex items-center gap-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black"
                style={{ background: ea.is_active ? "rgba(255,184,0,0.1)" : "rgba(255,255,255,0.05)", color: ea.is_active ? ACCENT : MUTED }}
              >
                {ea.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-white truncate">{ea.name}</p>
                  <span
                    className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: ea.is_active ? "rgba(255,184,0,0.12)" : "rgba(255,255,255,0.06)",
                      color: ea.is_active ? ACCENT : MUTED,
                    }}
                  >
                    {ea.is_active ? "ACTIVE" : "INACTIVE"}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-mono" style={{ color: MUTED }}>EA ID: {ea.mentor_id}</span>
                  <button onClick={() => copyKey(ea.mentor_id)} className="transition" style={{ color: MUTED }}>
                    {copied === ea.mentor_id ? <Check size={12} style={{ color: ACCENT }} /> : <Copy size={12} />}
                  </button>
                </div>
                {ea.description && <p className="text-xs mt-1 truncate" style={{ color: MUTED }}>{ea.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleActive(ea)}
                  className="p-2 rounded-lg transition"
                  style={{ color: ea.is_active ? ACCENT : MUTED }}
                  title={ea.is_active ? "Deactivate" : "Activate"}>
                  {ea.is_active ? <Power size={16} /> : <PowerOff size={16} />}
                </button>
                <button onClick={() => deleteEA(ea.id)}
                  className="p-2 rounded-lg transition hover:text-red-400"
                  style={{ color: MUTED }}
                  title="Delete">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
