import { createHash, createHmac, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import type postgres from "postgres";
import { sql, timed } from "@/lib/pg";

/**
 * EA NAPTUNE's own sign-in (SERVER ONLY). Accounts live in eanaptune.auth_users
 * with the bcrypt hashes they already had, so existing passwords keep working.
 * A session is a signed token holding a fingerprint of the password hash:
 * changing a password ends every session made with the old one.
 */

const SESSION_DAYS = 7;
const MAX_FAILURES = 10;
const FAILURE_WINDOW_MIN = 15;

export type AuthUser = { id: string; email: string; user_metadata: Record<string, unknown> };
type Row = { id: string; email: string; encrypted_password: string; raw_user_meta_data: Record<string, unknown> | null };

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set");
  return s;
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const fingerprint = (hash: string) => createHash("sha256").update(hash).digest("hex").slice(0, 16);
const signature = (payload: string) => createHmac("sha256", secret()).update(payload).digest();
const toUser = (r: Row): AuthUser => ({ id: r.id, email: r.email, user_metadata: r.raw_user_meta_data ?? {} });

export function issueToken(row: Pick<Row, "id" | "encrypted_password">): string {
  const payload = b64(JSON.stringify({ sub: row.id, pv: fingerprint(row.encrypted_password), exp: Date.now() + SESSION_DAYS * 86_400_000 }));
  return `${payload}.${b64(signature(payload))}`;
}

function readToken(token: string): { sub: string; pv: string } | null {
  const [payload, sig, extra] = (token || "").split(".");
  if (!payload || !sig || extra !== undefined) return null;
  const want = signature(payload);
  const got = Buffer.from(sig, "base64url");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const p = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof p.exp === "number" && p.exp > Date.now() && typeof p.sub === "string" ? p : null;
  } catch {
    return null;
  }
}

async function rowById(id: string): Promise<Row | null> {
  const [row] = await timed(() => sql()<Row[]>`
    select id, email, encrypted_password, raw_user_meta_data from eanaptune.auth_users where id = ${id}`, { read: true });
  return row ?? null;
}

export async function getUserFromToken(token: string): Promise<AuthUser | null> {
  try {
    const t = readToken(token);
    if (!t) return null;
    const row = await rowById(t.sub);
    return row && fingerprint(row.encrypted_password) === t.pv ? toUser(row) : null;
  } catch (e) {
    console.error("[auth] session check failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

export function bearer(req: Request): string {
  const auth = req.headers.get("authorization") || "";
  return auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
}

export type SignIn = { token: string; user: AuthUser } | { error: string; status: number };

export async function signIn(rawEmail: string, password: string): Promise<SignIn> {
  const email = rawEmail.trim().toLowerCase();
  const invalid = { error: "Invalid login credentials", status: 400 };
  if (!email || !password) return invalid;

  const [{ n }] = await timed(() => sql()<{ n: number }[]>`
    select count(*) as n from eanaptune.login_failures
    where email = ${email} and at > now() - make_interval(mins => ${FAILURE_WINDOW_MIN})`, { read: true });
  if (Number(n) >= MAX_FAILURES) return { error: "Too many attempts. Please wait a few minutes and try again.", status: 429 };

  const [row] = await timed(() => sql()<(Row & { email_confirmed_at: string | null })[]>`
    select id, email, encrypted_password, raw_user_meta_data, email_confirmed_at from eanaptune.auth_users where lower(email) = ${email}`, { read: true });
  const ok = row?.encrypted_password ? await bcrypt.compare(password, row.encrypted_password) : false;
  if (!row || !ok) {
    await sql()`insert into eanaptune.login_failures (email) values (${email})`;
    return invalid;
  }
  if (!row.email_confirmed_at) return { error: "Email not confirmed", status: 400 };
  await sql()`delete from eanaptune.login_failures where email = ${email}`;
  await sql()`update eanaptune.auth_users set last_sign_in_at = now() where id = ${row.id}`;
  return { token: issueToken(row), user: toUser(row) };
}

/**
 * A new account with its mentor row and branding, all or nothing. This is what
 * the handle_new_distributor trigger did on the old login table.
 */
export async function signUp(rawEmail: string, password: string, meta: Record<string, string>): Promise<SignIn> {
  const email = rawEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Please enter a valid email address.", status: 400 };
  if (password.length < 6) return { error: "Password should be at least 6 characters.", status: 400 };

  const hash = await bcrypt.hash(password, 10);
  const clean = (key: string) => (meta[key] ?? "").trim() || null;
  const name = clean("name") ?? email.split("@")[0];

  try {
    const row = await sql().begin(async (tx) => {
      const [{ is_admin }] = await tx<{ is_admin: boolean }[]>`
        select exists (select 1 from eanaptune.admin_emails a where lower(a.email) = ${email}) as is_admin`;
      const [created] = await tx<Row[]>`
        insert into eanaptune.auth_users (email, encrypted_password, email_confirmed_at, raw_user_meta_data)
        values (${email}, ${hash}, now(), ${tx.json(meta)})
        returning id, email, encrypted_password, raw_user_meta_data`;
      await tx`
        insert into eanaptune.distributors (id, email, name, is_super_admin, verified, verified_at, telegram_url, discord_url, youtube_url, tiktok_url)
        values (${created.id}, ${email}, ${name}, ${is_admin}, ${is_admin}, ${is_admin ? new Date() : null},
                ${clean("telegram_url")}, ${clean("discord_url")}, ${clean("youtube_url")}, ${clean("tiktok_url")})`;
      await tx`insert into eanaptune.branding (distributor_id, app_name) values (${created.id}, 'EA NAPTUNE')`;
      return created;
    });
    return { token: issueToken(row as unknown as Row), user: toUser(row as unknown as Row) };
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return { error: "User already registered", status: 400 };
    console.error("[auth] sign-up failed:", e instanceof Error ? e.message : e);
    return { error: "Could not create the account. Please try again.", status: 500 };
  }
}

export async function setPassword(id: string, password: string): Promise<boolean> {
  const hash = await bcrypt.hash(password, 10);
  const rows = await sql()`update eanaptune.auth_users set encrypted_password = ${hash}, updated_at = now() where id = ${id} returning id`;
  return rows.length > 0;
}

export async function deleteAuthUser(id: string): Promise<boolean> {
  const rows = await sql()`delete from eanaptune.auth_users where id = ${id} returning id`;
  return rows.length > 0;
}

export async function updateMeta(id: string, data: Record<string, unknown>): Promise<AuthUser | null> {
  const [row] = await sql()<Row[]>`
    update eanaptune.auth_users
    set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || ${sql().json(data as postgres.JSONValue)}, updated_at = now()
    where id = ${id}
    returning id, email, encrypted_password, raw_user_meta_data`;
  return row ? toUser(row) : null;
}
