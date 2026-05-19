"use client";

import { useEffect, useState } from "react";
import { supabase, DEV_MODE } from "@/lib/supabase";
import { Plus, Trash2, Power, PowerOff, Copy, Check } from "lucide-react";
import type { EA } from "@/lib/database.types";

export default function EAsPage() {
  const [eas, setEAs] = useState<EA[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", mentor_id: "" });
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
      mentor_id: form.mentor_id,
    });

    if (error) {
      setError(error.message.includes("duplicate") ? "Mentor ID already exists" : error.message);
      setSaving(false);
      return;
    }

    setForm({ name: "", description: "", mentor_id: "" });
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

  const copyMentorId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black tracking-wide text-gray-900">Trading Bots</h2>
          <p className="text-gray-500 text-sm mt-1">Create and manage your EAs. Each EA has a unique Mentor ID for user access.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 transition shadow-sm">
          <Plus size={16} />
          New EA
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4 shadow-sm">
          <h3 className="text-sm font-bold text-gray-900">Create New EA</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold tracking-widest text-gray-400 block mb-2">EA NAME</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition"
                placeholder="e.g. Gold Scalper Pro" required />
            </div>
            <div>
              <label className="text-[10px] font-bold tracking-widest text-gray-400 block mb-2">MENTOR ID</label>
              <input value={form.mentor_id} onChange={e => setForm(f => ({ ...f, mentor_id: e.target.value }))}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition"
                placeholder="Unique ID users enter to login" required />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold tracking-widest text-gray-400 block mb-2">DESCRIPTION</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition resize-none h-20"
              placeholder="Optional description" />
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 transition disabled:opacity-50">
              {saving ? "Creating..." : "Create EA"}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-6 py-2.5 rounded-xl border border-gray-300 text-gray-500 text-sm font-medium hover:text-gray-700 transition">
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      ) : eas.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-400 text-sm">No trading bots yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {eas.map(ea => (
            <div key={ea.id} className="bg-white border border-gray-200 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black ${ea.is_active ? "bg-gray-100 text-gray-900" : "bg-gray-100 text-gray-400"}`}>
                {ea.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-gray-900 truncate">{ea.name}</p>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${ea.is_active ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                    {ea.is_active ? "ACTIVE" : "INACTIVE"}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-gray-400 font-mono">ID: {ea.mentor_id}</span>
                  <button onClick={() => copyMentorId(ea.mentor_id)} className="text-gray-400 hover:text-gray-900 transition">
                    {copied === ea.mentor_id ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                  </button>
                </div>
                {ea.description && <p className="text-xs text-gray-400 mt-1 truncate">{ea.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleActive(ea)}
                  className={`p-2 rounded-lg transition ${ea.is_active ? "text-green-500 hover:bg-green-50" : "text-gray-400 hover:bg-gray-100"}`}
                  title={ea.is_active ? "Deactivate" : "Activate"}>
                  {ea.is_active ? <Power size={16} /> : <PowerOff size={16} />}
                </button>
                <button onClick={() => deleteEA(ea.id)}
                  className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
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
