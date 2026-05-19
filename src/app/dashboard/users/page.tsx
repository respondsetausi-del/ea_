"use client";

import { useEffect, useState } from "react";
import { supabase, DEV_MODE } from "@/lib/supabase";
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
    if (DEV_MODE) {
      const demoEAs: EA[] = [
        { id: 'demo-1', distributor_id: 'dev-001', name: 'Gold Scalper Pro', description: '', mentor_id: 'GOLD-2024', is_active: true, created_at: '2025-01-15T00:00:00Z', updated_at: '2025-01-15T00:00:00Z' },
      ];
      setEAs(demoEAs);
      setUsers([
        { id: 'u1', distributor_id: 'dev-001', ea_id: 'demo-1', email: 'trader1@example.com', is_active: true, created_at: '2025-03-01T00:00:00Z', ea_name: 'Gold Scalper Pro' },
        { id: 'u2', distributor_id: 'dev-001', ea_id: 'demo-1', email: 'trader2@example.com', is_active: true, created_at: '2025-03-10T00:00:00Z', ea_name: 'Gold Scalper Pro' },
        { id: 'u3', distributor_id: 'dev-001', ea_id: 'demo-1', email: 'newuser@example.com', is_active: false, created_at: '2025-04-01T00:00:00Z', ea_name: 'Gold Scalper Pro' },
      ] as any);
      setLoading(false);
      return;
    }
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
          <h2 className="text-xl font-black tracking-wide text-gray-900">App Users</h2>
          <p className="text-gray-500 text-sm mt-1">Manage who can access your branded app</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 transition shadow-sm">
          <Plus size={16} />
          Add User
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4 shadow-sm">
          <h3 className="text-sm font-bold text-gray-900">Add User Access</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold tracking-widest text-gray-400 block mb-2">EMAIL</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition"
                placeholder="user@example.com" required />
            </div>
            <div>
              <label className="text-[10px] font-bold tracking-widest text-gray-400 block mb-2">TRADING BOT</label>
              <select value={form.ea_id} onChange={e => setForm(f => ({ ...f, ea_id: e.target.value }))}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition">
                <option value="">Select EA...</option>
                {eas.map(ea => <option key={ea.id} value={ea.id}>{ea.name} ({ea.mentor_id})</option>)}
              </select>
            </div>
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 transition disabled:opacity-50">
              {saving ? "Adding..." : "Add User"}
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
          <div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-400 text-sm">No users yet. Add users to give them access to your app.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4 shadow-sm">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${u.is_active ? "bg-gray-100 text-gray-900" : "bg-gray-100 text-gray-400"}`}>
                {u.email.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{u.email}</p>
                <p className="text-[10px] text-gray-400">{u.ea_name || "Unknown EA"} · Joined {new Date(u.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => toggleUser(u)}
                  className={`p-2 rounded-lg transition ${u.is_active ? "text-green-500 hover:bg-green-50" : "text-gray-400 hover:bg-gray-100"}`}>
                  {u.is_active ? <UserCheck size={15} /> : <UserX size={15} />}
                </button>
                <button onClick={() => deleteUser(u.id)}
                  className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition">
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
