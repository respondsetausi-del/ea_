"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Trash2, UserCheck, UserX } from "lucide-react";
import type { AppUser, EA } from "@/lib/database.types";

export default function UsersPage() {
  const [users, setUsers] = useState<(AppUser & { ea_name?: string })[]>([]);
  const [eas, setEAs] = useState<EA[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: "", ea_id: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [usersRes, easRes] = await Promise.all([
      supabase.from("app_users").select("*").eq("distributor_id", user.id).order("created_at", { ascending: false }),
      supabase.from("eas").select("*").eq("distributor_id", user.id),
    ]);

    const easData = easRes.data || [];
    setEAs(easData);

    const usersData = (usersRes.data || []).map(u => ({
      ...u,
      ea_name: easData.find(e => e.id === u.ea_id)?.name,
    }));
    setUsers(usersData);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.ea_id) { setError("Select a trading bot"); return; }
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("app_users").insert({
      distributor_id: user.id,
      ea_id: form.ea_id,
      email: form.email,
    });

    if (error) {
      setError(error.message.includes("duplicate") ? "User already exists for this EA" : error.message);
      setSaving(false);
      return;
    }

    setForm({ email: "", ea_id: form.ea_id });
    setSaving(false);
    load();
  };

  const toggleUser = async (u: AppUser) => {
    await supabase.from("app_users").update({ is_active: !u.is_active }).eq("id", u.id);
    load();
  };

  const deleteUser = async (id: string) => {
    if (!confirm("Remove this user's access?")) return;
    await supabase.from("app_users").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black tracking-wide">App Users</h2>
          <p className="text-zinc-500 text-sm mt-1">Manage who can access your branded app</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500 text-black text-sm font-bold hover:bg-cyan-400 transition"
          style={{ boxShadow: '0 0 10px rgba(0,191,255,0.4)' }}>
          <Plus size={16} />
          Add User
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-zinc-950 border border-zinc-800/60 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white">Add User Access</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold tracking-widest text-zinc-500 block mb-2">EMAIL</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500/50 transition"
                placeholder="user@example.com" required />
            </div>
            <div>
              <label className="text-[10px] font-bold tracking-widest text-zinc-500 block mb-2">TRADING BOT</label>
              <select value={form.ea_id} onChange={e => setForm(f => ({ ...f, ea_id: e.target.value }))}
                className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition">
                <option value="">Select EA...</option>
                {eas.map(ea => <option key={ea.id} value={ea.id}>{ea.name} ({ea.mentor_id})</option>)}
              </select>
            </div>
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-cyan-500 text-black text-sm font-bold hover:bg-cyan-400 transition disabled:opacity-50">
              {saving ? "Adding..." : "Add User"}
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
      ) : users.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-zinc-600 text-sm">No users yet. Add users to give them access to your app.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className="bg-zinc-950 border border-zinc-800/60 rounded-xl p-4 flex items-center gap-4">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${u.is_active ? "bg-cyan-500/10 text-cyan-400" : "bg-zinc-800 text-zinc-600"}`}>
                {u.email.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{u.email}</p>
                <p className="text-[10px] text-zinc-600">{u.ea_name || "Unknown EA"} · Joined {new Date(u.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => toggleUser(u)}
                  className={`p-2 rounded-lg transition ${u.is_active ? "text-green-400 hover:bg-green-500/10" : "text-zinc-600 hover:bg-zinc-800"}`}>
                  {u.is_active ? <UserCheck size={15} /> : <UserX size={15} />}
                </button>
                <button onClick={() => deleteUser(u.id)}
                  className="p-2 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
