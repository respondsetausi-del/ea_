"use client";

import { useEffect, useState } from "react";
import { supabase, DEV_MODE } from "@/lib/supabase";
import { KeyRound, MailCheck, Send, Loader2, UserPlus, Copy, Check, Eye } from "lucide-react";
import type { AppUser, EA } from "@/lib/database.types";
import { isSuperAdminEmailClient } from "@/lib/admin-client";

const ACCENT = "#FFB800";
const CARD = "#161B22";
const MUTED = "#8B949E";
const INPUT_BG = "rgba(13,17,23,0.8)";
const BORDER = "rgba(255,184,0,0.1)";

type Row = AppUser & { ea_name?: string };

type LicenseResponse = { emailSent?: boolean; emailSkipped?: boolean; emailError?: string | null };

// Build a truthful notice about the email result. Runs the same whether or not
// the key was revealed to the caller — a revealed key must NOT hide a failed send.
function emailNotice(data: LicenseResponse, email: string): { msg: string; ok: boolean } {
  if (data.emailSkipped) {
    return { msg: "License generated, but email was NOT sent — Brevo isn't configured (missing BREVO_API_KEY or BREVO_SENDER_EMAIL).", ok: false };
  }
  if (data.emailSent === false) {
    return { msg: `License generated, but the email FAILED to send${data.emailError ? `: ${data.emailError}` : ""}. Check that your Brevo sender address is verified.`, ok: false };
  }
  return { msg: `License generated and emailed to ${email}.`, ok: true };
}

export default function LicensesPage() {
  const [users, setUsers] = useState<Row[]>([]);
  const [eas, setEAs] = useState<EA[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ id: string; msg: string; ok: boolean } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ email: "", ea_id: "" });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [callerEmail, setCallerEmail] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [revealedKeys, setRevealedKeys] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const load = async () => {
    if (!callerEmail) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setCallerEmail(user.email);
        setIsSuperAdmin(isSuperAdminEmailClient(user.email));
      }
    }
    if (DEV_MODE) {
      setEAs([
        { id: "demo-1", distributor_id: "dev-001", name: "Gold Scalper Pro", description: "", mentor_id: "EA-GX4R-8KNP", is_active: true, created_at: "", updated_at: "" },
      ] as EA[]);
      setUsers([
        { id: "u1", distributor_id: "dev-001", ea_id: "demo-1", email: "trader1@example.com", is_active: true, license_key: "FR-AB3CD-EF7GH-JK9LM", license_sent_at: "2025-04-02T00:00:00Z", created_at: "2025-03-01T00:00:00Z", last_seen: null, ea_name: "Gold Scalper Pro" },
        { id: "u2", distributor_id: "dev-001", ea_id: "demo-1", email: "trader2@example.com", is_active: true, license_key: null, license_sent_at: null, created_at: "2025-03-10T00:00:00Z", last_seen: null, ea_name: "Gold Scalper Pro" },
      ]);
      setLoading(false);
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [usersRes, easRes] = await Promise.all([
      supabase.from("app_users").select("*").eq("distributor_id", user.id).order("created_at", { ascending: false }),
      supabase.from("eas").select("*").eq("distributor_id", user.id),
    ]);
    const easData: EA[] = easRes.data || [];
    setEAs(easData);
    setUsers((usersRes.data || []).map(u => ({ ...u, ea_name: easData.find(e => e.id === u.ea_id)?.name })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addAndGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError("");
    if (!addForm.ea_id) { setAddError("Select a trading bot"); return; }
    setAdding(true);

    if (DEV_MODE) {
      await new Promise(r => setTimeout(r, 600));
      const newId = `u${Date.now()}`;
      const eaName = eas.find(ea => ea.id === addForm.ea_id)?.name || "Unknown";
      setUsers(prev => [
        { id: newId, distributor_id: "dev-001", ea_id: addForm.ea_id, email: addForm.email, is_active: true, license_key: "FR-XXXXX-XXXXX-XXXXX", license_sent_at: new Date().toISOString(), created_at: new Date().toISOString(), last_seen: null, ea_name: eaName },
        ...prev,
      ]);
      setNotice({ id: newId, msg: `User added & license emailed to ${addForm.email} (demo)`, ok: true });
      setAddForm({ email: "", ea_id: addForm.ea_id });
      setShowAdd(false);
      setAdding(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: newUser, error: insertErr } = await supabase.from("app_users").insert({
      distributor_id: user.id,
      ea_id: addForm.ea_id,
      email: addForm.email,
    }).select("id").single();

    if (insertErr) {
      setAddError(insertErr.message.includes("duplicate") ? "This user already exists for this EA" : insertErr.message);
      setAdding(false);
      return;
    }

    // Fire-and-forget welcome email (doc item 1) — never blocks the license flow.
    fetch("/api/v1/welcome-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_user_id: newUser.id }),
    }).catch(() => {});

    try {
      const res = await fetch("/api/v1/generate-license", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app_user_id: newUser.id, caller_email: callerEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (data.license_key) {
          setRevealedKeys(prev => ({ ...prev, [newUser.id]: data.license_key }));
        }
        const status = emailNotice(data, addForm.email);
        setNotice({ id: newUser.id, msg: `User added. ${status.msg}`, ok: status.ok });
      } else {
        setNotice({ id: newUser.id, msg: `User added but license failed: ${data.error || "unknown error"}`, ok: false });
      }
    } catch {
      setNotice({ id: newUser.id, msg: "User added but license email failed. You can resend below.", ok: false });
    }

    setAddForm({ email: "", ea_id: addForm.ea_id });
    setShowAdd(false);
    setAdding(false);
    await load();
  };

  const generate = async (u: Row) => {
    // Resending replaces the existing key — the old one stops working immediately.
    // Use an in-UI two-click confirm (NOT window.confirm, which browsers can
    // silently suppress, making the button appear dead). First click on an
    // already-issued user arms the confirm; second click proceeds.
    if (u.license_sent_at && confirmingId !== u.id) {
      setConfirmingId(u.id);
      setNotice({ id: u.id, msg: "Click again to confirm — this replaces their current key and signs them out of the old one.", ok: false });
      setTimeout(() => setConfirmingId(prev => (prev === u.id ? null : prev)), 5000);
      return;
    }
    setConfirmingId(null);

    setSendingId(u.id);
    setNotice(null);

    if (DEV_MODE) {
      await new Promise(r => setTimeout(r, 600));
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, license_key: "FR-XXXXX-XXXXX-XXXXX", license_sent_at: new Date().toISOString(), is_active: true } : x));
      setNotice({ id: u.id, msg: `License emailed to ${u.email} (demo)`, ok: true });
      setSendingId(null);
      return;
    }

    try {
      const res = await fetch("/api/v1/generate-license", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app_user_id: u.id, caller_email: callerEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (data.license_key) {
          setRevealedKeys(prev => ({ ...prev, [u.id]: data.license_key }));
        }
        setNotice({ id: u.id, ...emailNotice(data, u.email) });
        await load();
      } else {
        setNotice({ id: u.id, msg: data.error || "Failed to generate license.", ok: false });
      }
    } catch {
      setNotice({ id: u.id, msg: "Something went wrong. Try again.", ok: false });
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black tracking-wide text-white">Generate License</h2>
          <p className="text-sm mt-1" style={{ color: MUTED }}>Add a user and issue their access key in one step.</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition text-black"
          style={{ background: ACCENT, boxShadow: "0 4px 16px rgba(255,184,0,0.3)" }}
        >
          <UserPlus size={16} />
          Add User & License
        </button>
      </div>

      {showAdd && (
        <form onSubmit={addAndGenerate} className="rounded-2xl p-5 space-y-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <h3 className="text-sm font-bold text-white">Add User & Generate License</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold tracking-widest block mb-2" style={{ color: MUTED }}>USER EMAIL</label>
              <input type="email" value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
                className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none transition"
                style={{ background: INPUT_BG, border: `1px solid ${BORDER}` }}
                onFocus={e => e.target.style.borderColor = "rgba(255,184,0,0.4)"}
                onBlur={e => e.target.style.borderColor = BORDER}
                placeholder="user@example.com" required />
            </div>
            <div>
              <label className="text-[10px] font-bold tracking-widest block mb-2" style={{ color: MUTED }}>TRADING BOT</label>
              <select value={addForm.ea_id} onChange={e => setAddForm(f => ({ ...f, ea_id: e.target.value }))}
                className="w-full rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition"
                style={{ background: INPUT_BG, border: `1px solid ${BORDER}` }}
                onFocus={e => e.target.style.borderColor = "rgba(255,184,0,0.4)"}
                onBlur={e => e.target.style.borderColor = BORDER}>
                <option value="">Select EA...</option>
                {eas.map(ea => <option key={ea.id} value={ea.id}>{ea.name} ({ea.mentor_id})</option>)}
              </select>
            </div>
          </div>
          <p className="text-[10px]" style={{ color: MUTED }}>This will create the user, generate a license key, and email it to them.</p>
          {addError && <p className="text-red-400 text-xs">{addError}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={adding}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-50 text-black"
              style={{ background: ACCENT }}>
              {adding ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              {adding ? "Processing..." : "Add & Send License"}
            </button>
            <button type="button" onClick={() => setShowAdd(false)}
              className="px-6 py-2.5 rounded-xl text-sm font-medium transition"
              style={{ border: `1px solid ${BORDER}`, color: MUTED }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {notice && !users.find(u => u.id === notice.id) && (
        <div className="rounded-xl p-3 text-xs" style={{ background: notice.ok ? "rgba(255,184,0,0.08)" : "rgba(245,158,11,0.08)", color: notice.ok ? ACCENT : "#F59E0B" }}>
          {notice.msg}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 rounded-full animate-spin" style={{ border: `2px solid ${ACCENT}`, borderTopColor: "transparent" }} />
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-sm" style={{ color: MUTED }}>No users yet. Use the button above to add a user and generate their license.</p>
        </div>
      ) : (
        <>
          <p className="text-[10px] font-bold tracking-widest" style={{ color: MUTED }}>EXISTING USERS ({users.length})</p>
          <div className="space-y-2">
            {users.map(u => {
              const sent = !!u.license_sent_at;
              const busy = sendingId === u.id;
              return (
                <div key={u.id} className="rounded-xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                  <div className="flex items-center gap-4">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: sent ? "rgba(255,184,0,0.12)" : "rgba(255,255,255,0.05)", color: sent ? ACCENT : MUTED }}
                    >
                      {sent ? <MailCheck size={16} /> : <KeyRound size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{u.email}</p>
                      <p className="text-[10px]" style={{ color: MUTED }}>
                        {u.ea_name || "Unknown bot"}
                        {sent && <> · Key sent {new Date(u.license_sent_at as string).toLocaleDateString()}</>}
                      </p>
                      {notice?.id === u.id && (
                        <p className={`text-[11px] mt-1 ${notice.ok ? "" : "text-amber-400"}`} style={notice.ok ? { color: ACCENT } : {}}>{notice.msg}</p>
                      )}
                      {revealedKeys[u.id] && (
                        <div className="flex items-center gap-2 mt-1.5">
                          <code className="text-xs font-mono px-2 py-1 rounded-lg" style={{ background: "rgba(255,184,0,0.08)", color: ACCENT, border: `1px solid ${BORDER}` }}>
                            {revealedKeys[u.id]}
                          </code>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(revealedKeys[u.id]);
                              setCopiedId(u.id);
                              setTimeout(() => setCopiedId(null), 2000);
                            }}
                            className="p-1 rounded-md transition"
                            style={{ color: copiedId === u.id ? "#22c55e" : MUTED }}
                          >
                            {copiedId === u.id ? <Check size={13} /> : <Copy size={13} />}
                          </button>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => generate(u)}
                      disabled={busy}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition shrink-0 disabled:opacity-50"
                      style={confirmingId === u.id
                        ? { background: "#F59E0B", color: "#000" }
                        : sent
                          ? { border: `1px solid ${BORDER}`, color: MUTED }
                          : { background: ACCENT, color: "#000" }
                      }
                    >
                      {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                      {busy ? "Sending…" : confirmingId === u.id ? "Confirm resend?" : sent ? "Resend Key" : "Generate & Email"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
