import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin, superAdminEmails } from "@/lib/admin";
import { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type Body = {
  type?: "distributor" | "app_user" | "admin";
  id?: string;
  action?: string;
  email?: string;
};

/** Add an email to the runtime allowlist and flag any matching distributor. */
async function grantAdminByEmail(supabase: SupabaseClient, email: string) {
  await supabase.from("admin_emails").upsert({ email }, { onConflict: "email" });
  await supabase.from("distributors").update({ is_super_admin: true }).ilike("email", email);
}
/** Remove an email from the allowlist and unflag any matching distributor. */
async function revokeAdminByEmail(supabase: SupabaseClient, email: string) {
  await supabase.from("admin_emails").delete().eq("email", email);
  await supabase.from("distributors").update({ is_super_admin: false }).ilike("email", email);
}

/**
 * POST /api/admin/actions   (super-admin only)
 * God-mode mutations over any distributor or app user.
 *
 * distributor: verify | suspend | activate | delete | grantAdmin | revokeAdmin
 * app_user:    activate | deactivate | delete | resendLicense
 */
export async function POST(req: NextRequest) {
  const gate = await requireSuperAdmin(req);
  if (!gate.ok || !gate.supabase || !gate.user) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const supabase = gate.supabase;
  const callerId = gate.user.id;

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { type, id, action } = body;

  // ── Admin allowlist management (add admins at will, by email) ──
  if (type === "admin") {
    const email = body.email?.trim().toLowerCase();
    if (!email || !action) {
      return NextResponse.json({ error: "email and action are required" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (action === "add") {
      await grantAdminByEmail(supabase, email);
      return NextResponse.json({ ok: true });
    }
    if (action === "remove") {
      if (superAdminEmails().includes(email)) {
        return NextResponse.json({ error: "This admin is set in server config and can't be removed here." }, { status: 400 });
      }
      if (email === (gate.user.email || "").toLowerCase()) {
        return NextResponse.json({ error: "You can't remove your own admin access." }, { status: 400 });
      }
      await revokeAdminByEmail(supabase, email);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown admin action" }, { status: 400 });
  }

  if (!type || !id || !action) {
    return NextResponse.json({ error: "type, id and action are required" }, { status: 400 });
  }

  // ── Distributor god-mode ──
  if (type === "distributor") {
    // Guard against self-lockout.
    if (id === callerId && ["suspend", "delete", "revokeAdmin"].includes(action)) {
      return NextResponse.json({ error: "You cannot perform that action on your own account." }, { status: 400 });
    }

    switch (action) {
      case "verify": {
        const { error } = await supabase.from("distributors")
          .update({ verified: true, verified_at: new Date().toISOString(), verification_token: null })
          .eq("id", id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true });
      }
      case "suspend":
      case "activate": {
        const { error } = await supabase.from("distributors")
          .update({ is_active: action === "activate" }).eq("id", id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true });
      }
      case "grantAdmin":
      case "revokeAdmin": {
        // Look up the distributor's email so we can keep the allowlist in sync.
        const { data: d } = await supabase.from("distributors").select("email").eq("id", id).maybeSingle();
        const email = d?.email?.toLowerCase();
        if (action === "revokeAdmin" && email && superAdminEmails().includes(email)) {
          return NextResponse.json({ error: "This admin is set in server config and can't be removed here." }, { status: 400 });
        }
        if (email) {
          if (action === "grantAdmin") await grantAdminByEmail(supabase, email);
          else await revokeAdminByEmail(supabase, email);
        } else {
          await supabase.from("distributors").update({ is_super_admin: action === "grantAdmin" }).eq("id", id);
        }
        return NextResponse.json({ ok: true });
      }
      case "delete": {
        // Remove the auth user too; distributor row cascades from auth.users.
        const { error: authErr } = await supabase.auth.admin.deleteUser(id);
        if (authErr) {
          // Fall back to deleting just the distributor row.
          const { error } = await supabase.from("distributors").delete().eq("id", id);
          if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: "Unknown distributor action" }, { status: 400 });
    }
  }

  // ── App user god-mode ──
  if (type === "app_user") {
    switch (action) {
      case "activate":
      case "deactivate": {
        const { error } = await supabase.from("app_users")
          .update({ is_active: action === "activate" }).eq("id", id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true });
      }
      case "delete": {
        const { error } = await supabase.from("app_users").delete().eq("id", id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true });
      }
      case "resendLicense": {
        // Reuse the existing license endpoint (generates if needed + emails).
        const res = await fetch(`${req.nextUrl.origin}/api/v1/generate-license`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ app_user_id: id }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return NextResponse.json({ error: data.error || "License send failed" }, { status: res.status });
        return NextResponse.json({ ok: true, emailSent: data.emailSent, emailSkipped: data.emailSkipped });
      }
      default:
        return NextResponse.json({ error: "Unknown app_user action" }, { status: 400 });
    }
  }

  return NextResponse.json({ error: "Unknown type" }, { status: 400 });
}
