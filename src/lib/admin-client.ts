import { supabase } from "@/lib/supabase";

/**
 * Client-side super-admin helpers (safe to expose — emails are not secret).
 * NEXT_PUBLIC_SUPER_ADMIN_EMAILS lets the main admin bypass the verification
 * gate even if the server-side service key isn't configured yet.
 */
export function superAdminEmailsClient(): string[] {
  return (process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS || "respondsetausi@gmail.com")
    .split(",")
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isSuperAdminEmailClient(email?: string | null): boolean {
  if (!email) return false;
  return superAdminEmailsClient().includes(email.toLowerCase());
}

/**
 * True if the current user should bypass the email-verification gate:
 * their email is in the public allowlist, OR the server confirms super-admin
 * (covers admins added at runtime via the panel).
 */
export async function isSuperAdminNow(email?: string | null): Promise<boolean> {
  if (isSuperAdminEmailClient(email)) return true;
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return false;
    const res = await fetch("/api/admin/me", { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return false;
    return !!(await res.json()).isSuperAdmin;
  } catch {
    return false;
  }
}
