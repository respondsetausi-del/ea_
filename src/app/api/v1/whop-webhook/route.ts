import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "crypto";
import { resolveInstantActivationEA, INSTANT_ACTIVATION_EA_NAME } from "@/lib/instant-activation";

/**
 * POST /api/v1/whop-webhook
 *
 * Grants and withdraws access in response to Whop memberships.
 *
 * Point a Whop webhook (Dashboard > Developer > Webhooks) at this URL and
 * subscribe to:
 *   membership.activated      -> start or extend the access window
 *   membership.deactivated    -> end a window THIS endpoint granted
 *
 * Those are the names the dashboard actually offers on API version v1. The
 * docs and the older guides talk about membership.went_valid and
 * .went_invalid, which are not in the event list at all -- subscribing to the
 * documented names is impossible, and matching only on them would have meant
 * every delivery was ignored in silence. Both spellings are accepted below so
 * a future rename cannot quietly switch granting off.
 *
 * Deliberately mirrors the Stripe webhook next door rather than inventing a
 * second way of granting access, including the part where it issues no licence
 * key: the key carries the bot a user ends up on, and a payment cannot know
 * which mentor that is, because one checkout link serves all of them. The
 * mentor issues the key from the dashboard, and that is what binds a user to
 * their EA.
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
 * Verify a Whop webhook (Standard Webhooks).
 *
 * The signed string is `${webhook-id}.${webhook-timestamp}.${rawBody}`,
 * HMAC-SHA256 under the `ws_...` secret, base64, carried as `v1,<sig>` in
 * `webhook-signature` (which may hold several space-separated values while a
 * secret is being rotated).
 *
 * The raw body matters. Re-serialising parsed JSON changes the bytes and the
 * signature can then never match.
 *
 * The key derivation is tried both ways on purpose. Whop's docs say to pass
 * the `ws_` value exactly as issued, the Standard Webhooks convention is to
 * base64-decode the part after the prefix, and Whop's own sandbox examples
 * have shown the other form. Accepting either is not laxness: every candidate
 * is derived from the same secret, so an attacker who lacks it gains nothing,
 * and the alternative is silently granting nobody access over a detail that
 * cannot be confirmed without a live delivery.
 */
function verifySignature(
  rawBody: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  secrets: string[],
): { ok: boolean; reason?: string } {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) {
    return { ok: false, reason: "missing webhook-id/timestamp/signature header" };
  }

  // Replay guard: a captured body and signature cannot be reused indefinitely.
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) {
    return { ok: false, reason: "timestamp outside tolerance" };
  }

  const signed = `${id}.${timestamp}.${rawBody}`;
  const keys: Buffer[] = [];
  for (const secret of secrets) {
    keys.push(Buffer.from(secret, "utf8"));
    const bare = secret.replace(/^ws_/, "");
    if (bare !== secret) {
      keys.push(Buffer.from(bare, "utf8"));
      try {
        const decoded = Buffer.from(bare, "base64");
        if (decoded.length > 0) keys.push(decoded);
      } catch {
        /* not base64 - the utf8 candidates stand */
      }
    }
  }

  const presented = signature
    .split(/[\s,]+/)
    .map((v) => v.trim())
    .filter((v) => v && v !== "v1");

  for (const key of keys) {
    const expected = Buffer.from(createHmac("sha256", key).update(signed).digest("base64"), "utf8");
    for (const sig of presented) {
      const sigBuf = Buffer.from(sig, "utf8");
      if (sigBuf.length === expected.length && timingSafeEqual(sigBuf, expected)) return { ok: true };
    }
  }
  return { ok: false, reason: "signature mismatch" };
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

/**
 * The Whop plans that buy THIS product, from WHOP_PLAN_IDS (comma-separated).
 *
 * There is no default, and an empty list grants nothing. A webhook endpoint
 * receives every event on the whole Whop account, not just this product's -
 * exactly as the Stripe one did, where a missing product filter handed 30-day
 * EA NAPTUNE windows to roughly 150 people who had bought something else
 * entirely. Failing closed costs a configuration step. Failing open costs the
 * product.
 */
function ourPlanIds(): string[] {
  return (process.env.WHOP_PLAN_IDS || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

/** First non-empty string found at any of these dotted paths. */
function pick(obj: unknown, paths: string[]): string {
  for (const path of paths) {
    let cur: unknown = obj;
    for (const part of path.split(".")) {
      if (cur && typeof cur === "object" && part in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[part];
      } else {
        cur = undefined;
        break;
      }
    }
    if (typeof cur === "string" && cur.trim()) return cur.trim();
  }
  return "";
}

/**
 * Give the delivery id back so a retry can be acted on.
 *
 * The claim is staked before the grant, which is what stops two concurrent
 * deliveries both granting. The cost is that a grant which then FAILS leaves
 * the id claimed, so Whop's retry matches the duplicate check and returns
 * "already handled" without ever granting -- the payment is lost for good, and
 * the louder the original failure the more certain the loss. Releasing the
 * claim on every failure path is what makes a retry mean anything.
 */
async function releaseClaim(supabase: SupabaseClient, eventId: string): Promise<void> {
  if (!eventId) return;
  const { error } = await supabase.from("whop_events").delete().eq("event_id", eventId);
  if (error) console.error("[whop-webhook] could not release claim", eventId, error);
}

export async function POST(request: NextRequest) {
  // Comma-separated, so two businesses can be live at once. Moving a product
  // to a new Whop business means a second webhook with its own ws_ secret, and
  // for the days either side of the switch BOTH must verify: the old one still
  // has in-flight sales and retries, the new one is taking the next ones. A
  // single-value secret would have forced a cutover with a hole in it, and the
  // deliveries that fell in the hole are payments.
  const secrets = (process.env.WHOP_WEBHOOK_SECRET || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  if (secrets.length === 0) {
    // Dormant until configured, and never falling through to a grant: a check
    // that cannot run is a check that did not pass.
    console.error("[whop-webhook] WHOP_WEBHOOK_SECRET not set - refusing");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const verified = verifySignature(rawBody, {
    id: request.headers.get("webhook-id"),
    timestamp: request.headers.get("webhook-timestamp"),
    signature: request.headers.get("webhook-signature"),
  }, secrets);
  if (!verified.ok) {
    console.error("[whop-webhook] rejected:", verified.reason);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // `type` on current pins, `action` on older ones.
  const type = (pick(event, ["type", "action"]) || "").toLowerCase();
  const data = (event.data ?? event) as Record<string, unknown>;

  const grantEvent = /^membership[._](activated|went[._]valid)$/.test(type);
  const revokeEvent = /^membership[._](deactivated|went[._]invalid)$/.test(type);
  if (!grantEvent && !revokeEvent) {
    return NextResponse.json({ received: true, ignored: type || "unknown" });
  }

  const planId = pick(data, ["plan_id", "plan.id", "plan"]);
  const allowed = ourPlanIds();
  if (allowed.length === 0) {
    console.error("[whop-webhook] WHOP_PLAN_IDS not set - refusing to act on", type, "plan", planId || "(none)");
    return NextResponse.json({ error: "No plan allow-list configured" }, { status: 503 });
  }
  if (!planId || !allowed.includes(planId)) {
    // Someone else's product on the same account. Not an error.
    return NextResponse.json({ received: true, ignored: "plan not ours", planId: planId || null });
  }

  const email = pick(data, [
    "user.email", "user_email", "email", "member.email", "customer.email",
  ]).toLowerCase();
  const membershipId = pick(data, ["id", "membership_id", "membership.id"]);

  if (!email || !email.includes("@")) {
    // Worth shouting about: the payload shape varies by API version pin, and a
    // payment that matches nobody is money taken with no record of it.
    console.error(
      "[whop-webhook] no usable email on", type, membershipId || "(no id)",
      "- payload keys:", Object.keys(data).slice(0, 12).join(","),
    );
    return NextResponse.json({ received: true, error: "no email on membership" });
  }

  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Server not configured" }, { status: 503 });

  // Idempotency, keyed on the delivery id and claimed BEFORE anything is
  // granted, so two concurrent deliveries cannot both pass. Whop delivers at
  // least once by design, so duplicates are expected rather than exceptional.
  const eventId = request.headers.get("webhook-id") || pick(event, ["id"]);
  if (eventId) {
    const { error: claimErr } = await supabase.from("whop_events").insert({
      event_id: eventId,
      event_type: type,
      membership_id: membershipId || null,
      plan_id: planId,
      email,
    });
    if (claimErr) {
      if ((claimErr as { code?: string }).code === "23505") {
        return NextResponse.json({ received: true, duplicate: true });
      }
      // A missing table or a database fault is not proof of a duplicate. Fail
      // loudly so Whop retries, rather than risk granting twice.
      console.error("[whop-webhook] could not claim event:", claimErr);
      return NextResponse.json({ error: "Could not record event" }, { status: 500 });
    }
  }

  const now = new Date();

  // -- Membership ended --
  if (revokeEvent) {
    // Only ever withdraw what this endpoint granted. Access that came from a
    // mentor, or from Stripe, is not ours to switch off, and one person can
    // hold both. Ending the window rather than deactivating the account also
    // leaves them able to sign in and see what happened.
    const { data: rows } = await supabase
      .from("app_users")
      .select("id, access_via, access_expires_at")
      .ilike("email", email)
      .order("created_at", { ascending: true });

    const mine = (rows || []).filter((r) => r.access_via === "whop");
    if (mine.length === 0) {
      return NextResponse.json({ received: true, skipped: "no whop-granted access for this email" });
    }
    const { error } = await supabase
      .from("app_users")
      .update({ access_expires_at: now.toISOString() })
      .in("id", mine.map((r) => r.id));
    if (error) {
      console.error("[whop-webhook] revoke failed:", error);
      await releaseClaim(supabase, eventId);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }
    console.log("[whop-webhook] access ended for", email, membershipId);
    return NextResponse.json({ received: true, revoked: mine.length, email });
  }

  // -- Membership became valid --
  const days = await accessDays(supabase);
  const expiresAt = new Date(now.getTime() + days * 86_400_000).toISOString();
  const approve = await autoApproveOnPayment(supabase);

  const { data: existing } = await supabase
    .from("app_users")
    .select("id, access_expires_at, status")
    .ilike("email", email)
    .order("created_at", { ascending: true });

  if (existing && existing.length > 0) {
    const row = existing[0];
    // Extend from whichever is later, so renewing early adds time instead of
    // throwing the remainder away.
    const base = row.access_expires_at
      ? Math.max(now.getTime(), new Date(row.access_expires_at).getTime())
      : now.getTime();

    const update: Record<string, unknown> = {
      paid_at: now.toISOString(),
      access_via: "whop",
      whop_membership_id: membershipId || null,
      access_expires_at: new Date(base + days * 86_400_000).toISOString(),
      // Whatever else is true, taking payment must not leave the account
      // switched off. Mentor-added rows are inserted inactive, so without this
      // someone added by a mentor who then paid could not sign in.
      is_active: true,
    };
    if (approve) {
      update.status = "approved";
      update.approved_at = now.toISOString();
      update.approved_by = "whop:auto";
    }

    const { error } = await supabase.from("app_users").update(update).eq("id", row.id);
    if (error) {
      console.error("[whop-webhook] update failed:", error);
      await releaseClaim(supabase, eventId);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }
    console.log("[whop-webhook] extended", email, "to", update.access_expires_at);
    return NextResponse.json({ received: true, updated: true, email, accessExpiresAt: update.access_expires_at });
  }

  // Nobody added this payer yet. Creating the row means the payment is never
  // silently lost: without it, paying before a mentor adds you is money taken
  // with no record anywhere.
  const ea = await resolveInstantActivationEA(supabase);
  if (!ea) {
    // This returned 200 with an error string in the body, which told Whop the
    // delivery was handled. Four people paid, the delivery was recorded, no
    // account was ever created, nothing retried, and the only trace was a log
    // line nobody reads. They sat locked out until someone complained.
    //
    // 500 now, with the claim released, so Whop keeps retrying and the moment
    // an EA is configured the backlog lands by itself. A payment we cannot act
    // on must stay visibly unfinished, not be marked done.
    console.error(
      "[whop-webhook] PAID BUT NO ACCESS GRANTED:", email, membershipId,
      "- no EA has is_instant_activation = true, none is named",
      `"${INSTANT_ACTIVATION_EA_NAME}", and INSTANT_ACTIVATION_MENTOR_ID is unset.`,
    );
    await releaseClaim(supabase, eventId);
    return NextResponse.json(
      { error: "No instant-activation EA configured - cannot grant access" },
      { status: 500 },
    );
  }

  const { error: insErr } = await supabase.from("app_users").insert({
    distributor_id: ea.distributor_id,
    ea_id: ea.id,
    email,
    paid_at: now.toISOString(),
    whop_membership_id: membershipId || null,
    access_expires_at: expiresAt,
    access_via: "whop",
    ...(approve
      ? { status: "approved", is_active: true, approved_at: now.toISOString(), approved_by: "whop:auto" }
      : {}),
  });
  if (insErr) {
    console.error("[whop-webhook] insert failed:", insErr);
    await releaseClaim(supabase, eventId);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  console.log("[whop-webhook] created", email, "until", expiresAt);
  return NextResponse.json({ received: true, created: true, email, accessExpiresAt: expiresAt });
}
