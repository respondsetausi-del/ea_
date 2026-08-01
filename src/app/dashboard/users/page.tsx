"use client";

import { useEffect, useState } from "react";
import { supabase, DEV_MODE } from "@/lib/supabase";
import { Plus, Trash2, UserCheck, UserX } from "lucide-react";
import type { AppUser, EA } from "@/lib/database.types";

const ACCENT = "#0A84FF";
const CARD = "#161B22";
const MUTED = "#8B949E";
const INPUT_BG = "rgba(13,17,23,0.8)";
const BORDER = "rgba(10,132,255,0.1)";

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

    // Explicitly pending: a new client is a request for the super admin to
    // approve (after confirming payment), not immediate access.
    // is_active is forced false as well — it defaults to true, and any consumer
    // that only checks is_active (e.g. /api/v1/config) would otherwise let an
    // unapproved client straight in.
    const { data: newUser, error } = await supabase.from("app_users").insert({
      distributor_id: user.id,
      ea_id: form.ea_id,
      email: form.email,
      status: "pending",
      is_active: false,
    }).select("id").single();

    if (error) {
      setError(error.message.includes("duplicate") ? "User already exists for this EA" : error.message);
      setSaving(false);
      return;
    }

    // Fire-and-forget welcome email (doc item 1).
    if (newUser?.id) {
      fetch("/api/v1/welcome-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app_user_id: newUser.id }),
      }).catch(() => {});
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
          <h2 className="text-xl font-black tracking-wide text-white">App Users</h2>
          <p className="text-sm mt-1" style={{ color: MUTED }}>Manage who can access your branded app</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition text-black"
          style={{ background: ACCENT, boxShadow: "0 4px 16px rgba(10,132,255,0.3)" }}
        >
          <Plus size={16} />
          Add User
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="rounded-2xl p-5 space-y-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <h3 className="text-sm font-bold text-white">Add User Access</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold tracking-widest block mb-2" style={{ color: MUTED }}>EMAIL</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none transition"
                style={{ background: INPUT_BG, border: `1px solid ${BORDER}` }}
                onFocus={e => e.target.style.borderColor = "rgba(10,132,255,0.4)"}
                onBlur={e => e.target.style.borderColor = BORDER}
                placeholder="user@example.com" required />
            </div>
            <div>
              <label className="text-[10px] font-bold tracking-widest block mb-2" style={{ color: MUTED }}>TRADING BOT</label>
              <select value={form.ea_id} onChange={e => setForm(f => ({ ...f, ea_id: e.target.value }))}
                className="w-full rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition"
                style={{ background: INPUT_BG, border: `1px solid ${BORDER}` }}
                onFocus={e => e.target.style.borderColor = "rgba(10,132,255,0.4)"}
                onBlur={e => e.target.style.borderColor = BORDER}>
                <option value="">Select EA...</option>
                {eas.map(ea => <option key={ea.id} value={ea.id}>{ea.name} ({ea.mentor_id})</option>)}
              </select>
            </div>
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="px-6 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-50 text-black"
              style={{ background: ACCENT }}>
              {saving ? "Adding..." : "Add User"}
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
      ) : users.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-sm" style={{ color: MUTED }}>No users yet. Add users to give them access to your app.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className="rounded-xl p-4 flex items-center gap-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: u.is_active ? "rgba(10,132,255,0.1)" : "rgba(255,255,255,0.05)", color: u.is_active ? ACCENT : MUTED }}
              >
                {u.email.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{u.email}</p>
                <p className="text-[10px]" style={{ color: MUTED }}>{u.ea_name || "Unknown EA"} · Joined {new Date(u.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => toggleUser(u)}
                  className="p-2 rounded-lg transition"
                  style={{ color: u.is_active ? ACCENT : MUTED }}>
                  {u.is_active ? <UserCheck size={15} /> : <UserX size={15} />}
                </button>
                <button onClick={() => deleteUser(u.id)}
                  className="p-2 rounded-lg transition hover:text-red-400"
                  style={{ color: MUTED }}>
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
