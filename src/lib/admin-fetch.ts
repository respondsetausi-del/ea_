"use client";

import { supabase } from "@/lib/supabase";

/**
 * Bearer header for the admin API.
 *
 * Lifted out of the Super Admin page so the Mentors and Members pages call the
 * same endpoints the same way, rather than each growing its own copy that
 * drifts.
 */
export async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function adminAction(body: Record<string, unknown>): Promise<string | null> {
  const res = await fetch("/api/admin/actions", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  return res.ok ? null : (j.error || "Action failed");
}
