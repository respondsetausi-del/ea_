"use client";

import { useEffect, useState } from "react";
import { supabase, DEV_MODE } from "@/lib/supabase";
import { KeyRound, MailCheck, Send, Loader2, Copy, Check } from "lucide-react";
import type { AppUser, EA } from "@/lib/database.types";

const ACCENT = "#FFB800";
const CARD = "#161B22";
const MUTED = "#8B949E";
const BORDER = "rgba(255,184,0,0.1)";

type Row = AppUser & { ea_name?: string };

export default function LicensesPage() {
  const [users, setUsers] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ id: string; msg: string; ok: boolean } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = async () => {
    if (DEV_MODE) {
      setUsers([
        { id: "u1", distributor_id: "dev-001", ea_id: "demo-1", email: "trader1@example.com", is_active: true, license_key: "FR-AB3CD-EF7GH-JK9LM", license_sent_at: "2025-04-02T00:00:00Z", created_at: "2025-03-01T00:00:00Z", last_seen: null, ea_name: "Gold Scalper Pro" },
        { id: "u2", distributor_id: "dev-001", ea_id: "demo-1", email: "trader2@example.com", is_active: true, license_key: null, license_sent_at: null, created_at: "2025-03-10T00:00:00Z", last_seen: null, ea_name: "Gold Scalper Pro" },
        { id: "u3", distributor_id: "dev-001", ea_id: "demo-1", email: "newuser@example.com", is_active: false, license_key: null, license_sent_at: null, created_at: "2025-04-01T00:00:00Z", last_seen: null, ea_name: "Gold Scalper Pro" },
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
    setUsers((usersRes.data || []).map(u => ({ ...u, ea_name: easData.find(e => e.id === u.ea_id)?.name })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const copyKey = async (id: string, key: string) => {
    await navigator.clipboard.writeText(key);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const generate = async (u: Row) => {
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
        body: JSON.stringify({ app_user_id: u.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setNotice({
          id: u.id,
          msg: data.emailSkipped
            ? "License saved, but email is not configured yet (no Brevo key)."
            : `License emailed to ${u.email}.`,
          ok: !data.emailSkipped,
        });
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
      <div>
        <h2 className="text-xl font-black tracking-wide text-white">Generate License</h2>
        <p className="text-sm mt-1" style={{ color: MUTED }}>
          Issue an access key to an invited user. You can copy the key below or email it directly.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 rounded-full animate-spin" style={{ border: `2px solid ${ACCENT}`, borderTopColor: "transparent" }} />
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-sm" style={{ color: MUTED }}>No invited users yet. Add users first, then issue them a license.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map(u => {
            const sent = !!u.license_sent_at;
            const hasKey = !!u.license_key;
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
                  </div>
                  <button
                    onClick={() => generate(u)}
                    disabled={busy}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition shrink-0 disabled:opacity-50"
                    style={sent
                      ? { border: `1px solid ${BORDER}`, color: MUTED }
                      : { background: ACCENT, color: "#000" }
                    }
                  >
                    {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                    {busy ? "Sending…" : sent ? "Resend Key" : "Generate & Email"}
                  </button>
                </div>
                {hasKey && (
                  <div className="mt-3 ml-13 flex items-center gap-2">
                    <code
                      className="flex-1 rounded-lg px-3 py-2 text-xs font-mono tracking-wide select-all"
                      style={{ background: "rgba(13,17,23,0.8)", border: `1px solid ${BORDER}`, color: ACCENT }}
                    >
                      {u.license_key}
                    </code>
                    <button
                      onClick={() => copyKey(u.id, u.license_key!)}
                      className="shrink-0 p-2 rounded-lg transition"
                      style={{ border: `1px solid ${BORDER}`, color: MUTED }}
                      title="Copy key"
                    >
                      {copiedId === u.id ? <Check size={14} style={{ color: ACCENT }} /> : <Copy size={14} />}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
