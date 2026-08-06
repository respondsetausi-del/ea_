import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "crypto";
import { resolveInstantActivationEA } from "@/lib/instant-activation";

/**
 * POST /api/v1/stripe-webhook
 *
 * Records a completed Stripe payment and starts the access clock from it.
 *
 * Before this existed nothing ever wrote `paid_at` — the column was read as a
 * boolean by /api/v1/authorize and by the admin overview, but no code path set
 * it. Payment was effectively invisible to the backend; access was granted
 * purely by an admin approving someone.
 *
 * Point your Stripe endpoint at this URL and subscribe to:
 *   checkout.session.completed
 *   checkout.session.async_payment_succeeded   (delayed methods)
 *
 * The signature is verified against STRIPE_WEBHOOK_SECRET using the documented
 * scheme rather than the Stripe SDK, so this adds no dependency.
 */

const TOLERANCE_SECONDS = 300;
const DEFAULT_ACCESS_DAYS = 30;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * Verify a Stripe-Signature header.
 *
 * `signed_payload` is `${timestamp}.${rawBody}`, HMAC-SHA256'd with the
 * endpoint secret. The raw body matters — re-serialising the parsed JSON
 * changes the bytes and the signature will never match.
 */
function verifySignature(rawBody: string, header: string | null, secret: string): { ok: boolean; reason?: string } {
  if (!header) return { ok: false, reason: "missing signature header" };

  let timestamp = "";
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [k, v] = part.split("=", 2);
    if (k?.trim() === "t") timestamp = v?.trim() ?? "";
    if (k?.trim() === "v1" && v) signatures.push(v.trim());
  }
  if (!timestamp || signatures.length === 0) return { ok: false, reason: "malformed signature header" };

  // Replay guard: an attacker who captures a valid body+signature can't reuse
  // it indefinitely.
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) return { ok: false, reason: "timestamp outside tolerance" };

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const match = signatures.some((sig) => {
    const sigBuf = Buffer.from(sig, "utf8");
    return sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf);
  });

  return match ? { ok: true } : { ok: false, reason: "signature mismatch" };
}

/**
 * Last-resort email lookup: re-read the session from Stripe's API.
 *
 * Webhook payloads are serialised to whatever API version the endpoint is
 * pinned to. On versions older than 2020-08-27 the session has no
 * `customer_details` object at all, and `customer_email` is usually null for
 * Payment Links — so the payload can arrive with no usable email and the
 * payment would be recorded nowhere.
 *
 * Fetching the session directly returns it in the account's current API
 * version, where `customer_details.email` is populated. Requires
 * STRIPE_SECRET_KEY; without it we simply can't recover.
 */
async function fetchSessionEmail(sessionId: string): Promise<string> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !sessionId) return "";
  try {
    const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      console.error("[stripe-webhook] session refetch failed:", res.status);
      return "";
    }
    const s: any = await res.json();
    return (s?.customer_details?.email || s?.customer_email || "").toString().trim().toLowerCase();
  } catch (e: any) {
    console.error("[stripe-webhook] session refetch error:", e?.message || e);
    return "";
  }
}

async function accessDays(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase
    .from("app_settings").select("value").eq("key", "access_days").maybeSingle();
  const n = Number(data?.value);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_ACCESS_DAYS;
}

/** Optional switch: let a successful payment approve the client outright. */
async function autoApproveOnPayment(supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase
    .from("app_settings").select("value").eq("key", "auto_approve_on_payment").maybeSingle();
  return data?.value === true;
}

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  // Raw text, not req.json() — the signature covers the exact bytes Stripe sent.
  const rawBody = await req.text();
  const verdict = verifySignature(rawBody, req.headers.get("stripe-signature"), secret);
  if (!verdict.ok) {
    console.error("[stripe-webhook] rejected:", verdict.reason);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: { type?: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const type = event.type ?? "";
  if (type !== "checkout.session.completed" && type !== "checkout.session.async_payment_succeeded") {
    // Acknowledge everything else so Stripe stops retrying events we ignore.
    return NextResponse.json({ received: true, ignored: type });
  }

  const session = (event.data?.object ?? {}) as Record<string, any>;

  // Only count money that actually cleared. `completed` also fires for
  // async methods that are still pending.
  if (session.payment_status && session.payment_status !== "paid") {
    return NextResponse.json({ received: true, ignored: `payment_status=${session.payment_status}` });
  }

  const sessionId: string = session.id ?? "";
  let email: string = (
    session.customer_details?.email ||
    session.customer_email ||
    session.client_reference_id ||
    ""
  ).toString().trim().toLowerCase();

  // Older pinned API versions omit customer_details entirely — go ask Stripe.
  if (!email || !email.includes("@")) {
    email = await fetchSessionEmail(sessionId);
    if (email) console.log("[stripe-webhook] email recovered via session refetch:", sessionId);
  }

  if (!email || !email.includes("@")) {
    console.error(
      "[stripe-webhook] no usable email on session", sessionId,
      "— set STRIPE_SECRET_KEY, or repin the endpoint to a recent API version",
    );
    // 200 so Stripe doesn't retry forever on an event we can never match.
    return NextResponse.json({ received: true, error: "no email on session" });
  }

  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Server not configured" }, { status: 503 });

  // Idempotency: Stripe redelivers. The unique index on stripe_session_id
  // makes a repeat a no-op rather than a second 30-day grant.
  if (sessionId) {
    const { data: seen } = await supabase
      .from("app_users").select("id").eq("stripe_session_id", sessionId).maybeSingle();
    if (seen) return NextResponse.json({ received: true, duplicate: true });
  }

  const now = new Date();
  const days = await accessDays(supabase);
  // The clock starts at payment.
  const expiresAt = new Date(now.getTime() + days * 86_400_000).toISOString();

  const { data: existing } = await supabase
    .from("app_users")
    .select("id, access_expires_at, status")
    .ilike("email", email)
    .order("created_at", { ascending: true });

  const approve = await autoApproveOnPayment(supabase);

  if (existing && existing.length > 0) {
    // Extend from whichever is later, so paying before the current window ends
    // adds time instead of throwing the remainder away.
    const row = existing[0];
    const base = row.access_expires_at
      ? Math.max(now.getTime(), new Date(row.access_expires_at).getTime())
      : now.getTime();

    const update: Record<string, unknown> = {
      paid_at: now.toISOString(),
      stripe_session_id: sessionId || null,
      access_expires_at: new Date(base + days * 86_400_000).toISOString(),
    };
    if (approve) {
      update.status = "approved";
      update.is_active = true;
      update.approved_at = now.toISOString();
      update.approved_by = "stripe:auto";
    }

    const { error } = await supabase.from("app_users").update(update).eq("id", row.id);
    if (error) {
      console.error("[stripe-webhook] update failed:", error);
      // 500 → Stripe retries, which is what we want for a transient DB fault.
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }
    return NextResponse.json({ received: true, updated: true, email, accessExpiresAt: update.access_expires_at });
  }

  // Nobody added this payer yet. Creating the row here means the payment is
  // never silently lost — without it, someone who pays before a mentor adds
  // them has money taken and no record anywhere.
  const ea = await resolveInstantActivationEA(supabase);
  if (!ea) {
    console.error("[stripe-webhook] paid but no EA to attach:", email, sessionId);
    return NextResponse.json({ received: true, error: "no instant-activation EA configured" });
  }

  const { error: insErr } = await supabase.from("app_users").insert({
    distributor_id: ea.distributor_id,
    ea_id: ea.id,
    email,
    paid_at: now.toISOString(),
    stripe_session_id: sessionId || null,
    access_expires_at: expiresAt,
    access_via: "stripe",
    ...(approve
      ? { status: "approved", is_active: true, approved_at: now.toISOString(), approved_by: "stripe:auto" }
      : {}),
  });
  if (insErr) {
    console.error("[stripe-webhook] insert failed:", insErr);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  return NextResponse.json({ received: true, created: true, email, accessExpiresAt: expiresAt });
}
