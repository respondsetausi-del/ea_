"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
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
          <h2 className="text-xl font-black tracking-wide">Trading Bots</h2>
          <p className="text-zinc-500 text-sm mt-1">Create and manage your EAs. Each EA has a unique Mentor ID for user access.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500 text-black text-sm font-bold hover:bg-cyan-400 transition"
          style={{ boxShadow: '0 0 10px rgba(0,191,255,0.4)' }}>
          <Plus size={16} />
          New EA
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-zinc-950 border border-zinc-800/60 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white">Create New EA</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold tracking-widest text-zinc-500 block mb-2">EA NAME</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500/50 transition"
                placeholder="e.g. Gold Scalper Pro" required />
            </div>
            <div>
              <label className="text-[10px] font-bold tracking-widest text-zinc-500 block mb-2">MENTOR ID</label>
              <input value={form.mentor_id} onChange={e => setForm(f => ({ ...f, mentor_id: e.target.value }))}
                className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500/50 transition"
                placeholder="Unique ID users enter to login" required />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold tracking-widest text-zinc-500 block mb-2">DESCRIPTION</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500/50 transition resize-none h-20"
              placeholder="Optional description" />
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-cyan-500 text-black text-sm font-bold hover:bg-cyan-400 transition disabled:opacity-50">
              {saving ? "Creating..." : "Create EA"}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-6 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 text-sm font-medium hover:text-white transition">
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : eas.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-zinc-600 text-sm">No trading bots yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {eas.map(ea => (
            <div key={ea.id} className="bg-zinc-950 border border-zinc-800/60 rounded-2xl p-5 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black ${ea.is_active ? "bg-cyan-500/10 text-cyan-400" : "bg-zinc-800 text-zinc-600"}`}>
                {ea.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-white truncate">{ea.name}</p>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${ea.is_active ? "bg-green-500/10 text-green-400" : "bg-zinc-800 text-zinc-500"}`}>
                    {ea.is_active ? "ACTIVE" : "INACTIVE"}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-zinc-500 font-mono">ID: {ea.mentor_id}</span>
                  <button onClick={() => copyMentorId(ea.mentor_id)} className="text-zinc-600 hover:text-cyan-400 transition">
                    {copied === ea.mentor_id ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                  </button>
                </div>
                {ea.description && <p className="text-xs text-zinc-600 mt-1 truncate">{ea.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleActive(ea)}
                  className={`p-2 rounded-lg transition ${ea.is_active ? "text-green-400 hover:bg-green-500/10" : "text-zinc-600 hover:bg-zinc-800"}`}
                  title={ea.is_active ? "Deactivate" : "Activate"}>
                  {ea.is_active ? <Power size={16} /> : <PowerOff size={16} />}
                </button>
                <button onClick={() => deleteEA(ea.id)}
                  className="p-2 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition"
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
