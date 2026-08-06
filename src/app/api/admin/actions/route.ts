import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin, superAdminEmails, isOwnerEmail } from "@/lib/admin";
import { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type Body = {
  type?: "distributor" | "app_user" | "admin" | "ea" | "settings";
  id?: string;
  action?: string;
  email?: string;
  value?: boolean;
  /** extendAccess: length of the new window; defaults to app_settings.access_days. */
  days?: number;
};

/** How many days an approval grants. Configurable without a deploy. */
const DEFAULT_ACCESS_DAYS = 30;
async function accessDays(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase
    .from("app_settings").select("value").eq("key", "access_days").maybeSingle();
  const n = Number(data?.value);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_ACCESS_DAYS;
}

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
 * app_user:    approve | reject | activate | deactivate | delete | resendLicense
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
      if (isOwnerEmail(email)) {
        return NextResponse.json({ error: "The owner (super super admin) can't be removed." }, { status: 400 });
      }
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

  // ── Platform settings (no id — the key is the target) ──
  if (type === "settings") {
    if (action !== "setRequirePayment") {
      return NextResponse.json({ error: "Unknown settings action" }, { status: 400 });
    }
    const { error } = await supabase.from("app_settings").upsert({
      key: "require_payment",
      value: body.value === true,
      updated_at: new Date().toISOString(),
      updated_by: gate.user.email || null,
    }, { onConflict: "key" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, requirePayment: body.value === true });
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
        if (action === "revokeAdmin" && email && isOwnerEmail(email)) {
          return NextResponse.json({ error: "The owner (super super admin) can't be demoted." }, { status: 400 });
        }
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
      case "resetPassword": {
        // Send the distributor a password-reset email (reuses the public flow).
        const { data: d } = await supabase.from("distributors").select("email").eq("id", id).maybeSingle();
        if (!d?.email) return NextResponse.json({ error: "Distributor not found" }, { status: 404 });
        const res = await fetch(`${req.nextUrl.origin}/api/v1/request-password-reset`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: d.email }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return NextResponse.json({ error: data.error || "Could not send reset email" }, { status: res.status });
        return NextResponse.json({ ok: true, emailSent: data.emailSent, emailSkipped: data.emailSkipped });
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
      // ── Approval queue ──
      // Distinct from activate/deactivate: status tracks whether the client was
      // ever let in, is_active whether an approved client is currently allowed.
      case "approve":
      case "reject": {
        const approving = action === "approve";

        // The clock starts at PAYMENT. If the Stripe webhook already opened a
        // window, approving must not touch it — otherwise an admin approving a
        // day later would silently restart the 30 days, and approving near the
        // end would hand out a free extension.
        //
        // Approval only starts the clock for users who never paid: comped
        // clients, offline payments, promos.
        const { data: current } = await supabase
          .from("app_users").select("access_expires_at").eq("id", id).maybeSingle();

        let expiresAt: string | null | undefined;
        if (!approving) {
          expiresAt = null; // rejecting clears any window
        } else if (current?.access_expires_at) {
          expiresAt = undefined; // paid already — leave the existing deadline alone
        } else {
          expiresAt = new Date(Date.now() + (await accessDays(supabase)) * 86_400_000).toISOString();
        }

        const { error } = await supabase.from("app_users").update({
          status: approving ? "approved" : "rejected",
          is_active: approving,
          approved_at: approving ? new Date().toISOString() : null,
          approved_by: approving ? (gate.user.email || null) : null,
          // Omitted entirely when undefined, so the stored value survives.
          ...(expiresAt === undefined ? {} : { access_expires_at: expiresAt }),
        }).eq("id", id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({
          ok: true,
          accessExpiresAt: expiresAt === undefined ? current?.access_expires_at ?? null : expiresAt,
        });
      }
      // Push an existing user's deadline out by another window — a renewal
      // without having to re-approve them.
      case "extendAccess": {
        const days = Number(body?.days) > 0 ? Number(body.days) : await accessDays(supabase);
        const { data: row } = await supabase
          .from("app_users").select("access_expires_at").eq("id", id).maybeSingle();
        // Extend from whichever is later: now, or the current deadline. Renewing
        // early therefore adds time rather than throwing the remainder away.
        const base = row?.access_expires_at
          ? Math.max(Date.now(), new Date(row.access_expires_at).getTime())
          : Date.now();
        const expiresAt = new Date(base + days * 86_400_000).toISOString();
        const { error } = await supabase.from("app_users")
          .update({ access_expires_at: expiresAt, is_active: true, status: "approved" })
          .eq("id", id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true, accessExpiresAt: expiresAt });
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

  // ── EA / Instant Activation robot switch ──
  if (type === "ea") {
    switch (action) {
      case "setInstantActivation": {
        // Single-select: clear every other bot, then flag this one.
        const clear = await supabase.from("eas").update({ is_instant_activation: false }).neq("id", id);
        if (clear.error) {
          return NextResponse.json(
            { error: "Run the Instant Activation migration first (adds is_instant_activation to eas)." },
            { status: 400 },
          );
        }
        const { error } = await supabase.from("eas").update({ is_instant_activation: true }).eq("id", id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true });
      }
      case "clearInstantActivation": {
        const { error } = await supabase.from("eas").update({ is_instant_activation: false }).eq("id", id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: "Unknown ea action" }, { status: 400 });
    }
  }

  return NextResponse.json({ error: "Unknown type" }, { status: 400 });
}
