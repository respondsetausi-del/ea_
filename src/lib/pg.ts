import postgres from "postgres";
import { getUserFromToken, setPassword, deleteAuthUser } from "@/lib/auth-server";
import { QueryBuilder, type DbResult, type Plan } from "@/lib/query-plan";

/**
 * EA NAPTUNE's database (SERVER ONLY), in its own section of the shared project.
 * DATABASE_URL logs in as eanaptune_site, which can reach this section and nothing else.
 * Identifiers are checked against fixed patterns and every value is a bound parameter.
 */

const SCHEMA = "eanaptune";
const IDENT = /^[a-z_][a-z0-9_]*$/;
const TABLES = new Set([
  "admin_emails", "analytics_events", "app_settings", "app_users", "branding", "distributors",
  "eas", "engine_store", "mt5_connections", "stripe_events", "wear_products", "wear_signups", "whop_events",
]);
const JSON_COLUMNS: Record<string, Set<string>> = { app_settings: new Set(["value"]), engine_store: new Set(["data"]) };

declare global {
  // eslint-disable-next-line no-var
  var __naptuneSql: postgres.Sql | undefined;
}

export function sql(): postgres.Sql {
  if (globalThis.__naptuneSql) return globalThis.__naptuneSql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL must be set");
  globalThis.__naptuneSql = postgres(url, {
    prepare: false,
    max: 3,
    idle_timeout: 20,
    connect_timeout: 15,
    // Never keep one connection forever: a socket the pooler dropped quietly is replaced in time.
    max_lifetime: 60 * 5,
    onnotice: () => {},
    // The same shapes the pages already expect: ISO date strings and plain numbers.
    types: {
      isoDate: {
        to: 1184,
        from: [1114, 1184],
        serialize: (x: unknown) => (x instanceof Date ? x.toISOString() : String(x)),
        parse: (x: string) => new Date(x.replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00")).toISOString(),
      },
      plainNumber: { to: 1700, from: [20, 1700], serialize: (x: unknown) => String(x), parse: (x: string) => Number(x) },
    },
  });
  return globalThis.__naptuneSql;
}

/**
 * Stuck connections. On 11 Nov 2026 13:07 to 13:20 SA every route on the live site (sign-in, Members,
 * the robots' engine-store) waited the full 300 seconds; at 15:35 Members waited 60 s again while the
 * database answered the same reads from outside in 8 s. Vercel pauses an idle function with its sockets
 * open (the TimeoutNegativeWarning lines are timers waking minutes late), so a connection kept from
 * before the pause can be dead, and a query sent on it never gets an answer.
 *
 * So: after IDLE_RESET_MS with nothing running, start on fresh connections; a read that has not
 * answered in READ_FIRST_TRY_MS is retried once on fresh connections; anything still silent fails.
 * Writes are never retried, so nothing can be saved twice.
 */
const IDLE_RESET_MS = 15_000;
const READ_FIRST_TRY_MS = 15_000;
const READ_RETRY_MS = 30_000;
const WRITE_LIMIT_MS = 45_000;

let inFlight = 0;
let lastActive = 0;

class NoAnswer extends Error {}

function dropConnections() {
  const old = globalThis.__naptuneSql;
  globalThis.__naptuneSql = undefined;
  old?.end({ timeout: 0 }).catch(() => {});
}

async function withLimit<T>(work: PromiseLike<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      console.error(`[db] no answer in ${ms / 1000}s, starting fresh connections`);
      dropConnections();
      reject(new NoAnswer("The database did not answer in time. Please try again."));
    }, ms);
  });
  try {
    return await Promise.race([Promise.resolve(work), limit]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Runs one query with the limits above. `make` builds the query, so a retry can build it again on
 * fresh connections. `read: true` only for selects.
 */
export async function timed<T>(make: () => PromiseLike<T>, { read = false }: { read?: boolean } = {}): Promise<T> {
  if (inFlight === 0 && globalThis.__naptuneSql && Date.now() - lastActive > IDLE_RESET_MS) dropConnections();
  inFlight++;
  try {
    if (!read) return await withLimit(make(), WRITE_LIMIT_MS);
    try {
      return await withLimit(make(), READ_FIRST_TRY_MS);
    } catch (e) {
      if (!(e instanceof NoAnswer)) throw e;
      return await withLimit(make(), READ_RETRY_MS);
    }
  } finally {
    inFlight--;
    lastActive = Date.now();
  }
}

const ident = (name: string) => {
  if (!IDENT.test(name)) throw new Error(`Bad column name: ${name.slice(0, 40)}`);
  return `"${name}"`;
};

function tableName(table: string) {
  if (!TABLES.has(table)) throw new Error(`Unknown table: ${table.slice(0, 40)}`);
  return `${SCHEMA}."${table}"`;
}

function columnList(columns: string) {
  const text = columns.trim();
  return text === "*" ? "*" : text.split(",").map((c) => ident(c.trim())).join(", ");
}

class Params {
  values: (string | number | boolean | null)[] = [];

  add(value: unknown, asJson = false): string {
    if (asJson) {
      this.values.push(JSON.stringify(value ?? null));
      return `$${this.values.length}::text::jsonb`;
    }
    let v: unknown = value;
    if (v instanceof Date) v = v.toISOString();
    else if (v !== null && typeof v === "object") v = JSON.stringify(v);
    this.values.push((v ?? null) as string | number | boolean | null);
    return `$${this.values.length}`;
  }
}

function whereClause(plan: Plan, params: Params) {
  const parts = plan.filters.map(([op, column, value]) => {
    const c = ident(column);
    switch (op) {
      case "eq": return `${c} = ${params.add(value)}`;
      case "neq": return `${c} <> ${params.add(value)}`;
      case "gte": return `${c} >= ${params.add(value)}`;
      case "gt": return `${c} > ${params.add(value)}`;
      case "lte": return `${c} <= ${params.add(value)}`;
      case "lt": return `${c} < ${params.add(value)}`;
      case "ilike": return `${c}::text ilike ${params.add(value)}`;
      case "is": return `${c} is null`;
      case "not.is": return `${c} is not null`;
      case "in": {
        const list = value as unknown[];
        return list.length ? `${c} in (${list.map((v) => params.add(v)).join(", ")})` : "false";
      }
      default: throw new Error(`Unknown filter: ${String(op)}`);
    }
  });
  return parts.length ? ` where ${parts.join(" and ")}` : "";
}

const rowsOf = (values: unknown) =>
  (Array.isArray(values) ? values : [values]).map((row) =>
    Object.fromEntries(Object.entries(row as object).filter(([, v]) => v !== undefined)),
  ) as Record<string, unknown>[];

function shaped(rows: unknown[], one: Plan["one"], count: number | null): DbResult {
  if (!one) return { data: rows, error: null, count };
  if (rows.length > 1) return { data: null, error: { message: "More than one row returned", code: "PGRST116" }, count };
  if (rows.length === 0 && one === "single") return { data: null, error: { message: "No rows returned", code: "PGRST116" }, count };
  return { data: rows[0] ?? null, error: null, count };
}

export async function execute(plan: Plan): Promise<DbResult> {
  try {
    const table = tableName(plan.table);
    const json = JSON_COLUMNS[plan.table];
    const params = new Params();

    if (plan.action === "select") {
      let count: number | null = null;
      if (plan.count) {
        const countParams = new Params();
        const countText = `select count(*) as n from ${table}${whereClause(plan, countParams)}`;
        const [row] = await timed(() => sql().unsafe(countText, countParams.values), { read: true });
        count = Number(row.n);
        if (plan.head) return { data: null, error: null, count };
      }
      let text = `select ${columnList(plan.columns)} from ${table}${whereClause(plan, params)}`;
      if (plan.order.length) text += ` order by ${plan.order.map(([c, asc]) => `${ident(c)} ${asc ? "asc" : "desc"}`).join(", ")}`;
      if (plan.limit !== undefined) text += ` limit ${Math.max(0, Math.floor(Number(plan.limit)) || 0)}`;
      return shaped([...(await timed(() => sql().unsafe(text, params.values), { read: true }))], plan.one, count);
    }

    const returning = plan.returning !== undefined ? ` returning ${columnList(plan.returning)}` : "";
    let text: string;

    if (plan.action === "insert" || plan.action === "upsert") {
      const rows = rowsOf(plan.values);
      if (!rows.length) return { data: [], error: null, count: null };
      const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
      const tuples = rows.map((r) =>
        `(${columns.map((c) => (c in r ? params.add(r[c], json?.has(c)) : "default")).join(", ")})`,
      );
      text = `insert into ${table} (${columns.map(ident).join(", ")}) values ${tuples.join(", ")}`;
      if (plan.action === "upsert") {
        const conflict = (plan.onConflict ?? "").split(",").map((c) => c.trim()).filter(Boolean);
        if (!conflict.length) throw new Error("upsert needs onConflict");
        const update = columns.filter((c) => !conflict.includes(c));
        text += ` on conflict (${conflict.map(ident).join(", ")}) ` + (update.length
          ? `do update set ${update.map((c) => `${ident(c)} = excluded.${ident(c)}`).join(", ")}`
          : "do nothing");
      }
    } else {
      // A write with no condition would hit every row: nothing in this site means that.
      if (!plan.filters.length) throw new Error("Refused: update or delete without a condition");
      if (plan.action === "update") {
        const [row] = rowsOf(plan.values);
        const set = Object.entries(row).map(([c, v]) => `${ident(c)} = ${params.add(v, json?.has(c))}`);
        if (!set.length) return { data: null, error: null, count: null };
        text = `update ${table} set ${set.join(", ")}${whereClause(plan, params)}`;
      } else {
        text = `delete from ${table}${whereClause(plan, params)}`;
      }
    }

    const rows = await timed(() => sql().unsafe(text + returning, params.values));
    return returning ? shaped([...rows], plan.one, null) : { data: null, error: null, count: null };
  } catch (e) {
    const err = e as { message?: string; code?: string };
    console.error(`[db] ${plan.action} ${plan.table}:`, err.code ?? "", err.message ?? e);
    return { data: null, error: { message: err.message ?? "Database error", code: err.code }, count: null };
  }
}

const noError = { error: null };

/** The server's database handle, in the shape the routes already use. */
export const serverDb = {
  from: (table: string) => new QueryBuilder(table, execute),
  auth: {
    async getUser(token: string) {
      const user = await getUserFromToken(token);
      return user ? { data: { user }, ...noError } : { data: { user: null }, error: { message: "Invalid session" } };
    },
    admin: {
      async updateUserById(id: string, attrs: { password: string }) {
        return (await setPassword(id, attrs.password)) ? noError : { error: { message: "User not found" } };
      },
      async deleteUser(id: string) {
        return (await deleteAuthUser(id)) ? noError : { error: { message: "User not found" } };
      },
    },
  },
};

export type Db = typeof serverDb;

/** Keeps each route's existing "is the server configured?" check; both arguments must be set. */
export function createClient(url: string, key: string, _options?: unknown): Db {
  if (!url || !key) throw new Error("Server not configured");
  return serverDb;
}
