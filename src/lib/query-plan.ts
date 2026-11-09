/**
 * The query shape the site's pages and routes already use (.from().select().eq()…),
 * as a plain description. The server runs it against EA NAPTUNE's own section
 * (lib/pg.ts). The browser sends it to /api/client-db, which applies the owner rules.
 */

export type DbError = { message: string; code?: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DbResult<T = any> = { data: T; error: DbError | null; count: number | null };

export type FilterOp = "eq" | "neq" | "in" | "is" | "not.is" | "ilike" | "gte" | "gt" | "lte" | "lt";
export type Filter = [FilterOp, string, unknown];

export interface Plan {
  table: string;
  action: "select" | "insert" | "update" | "delete" | "upsert";
  columns: string;
  count: boolean;
  head: boolean;
  values?: unknown;
  onConflict?: string;
  returning?: string;
  filters: Filter[];
  order: [string, boolean][];
  limit?: number;
  one?: "single" | "maybe";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class QueryBuilder<R = any[]> implements PromiseLike<DbResult<R>> {
  private plan: Plan;

  constructor(table: string, private run: (plan: Plan) => Promise<DbResult>) {
    this.plan = { table, action: "select", columns: "*", count: false, head: false, filters: [], order: [] };
  }

  select(columns = "*", opts?: { count?: string; head?: boolean }) {
    if (this.plan.action === "select") {
      this.plan.columns = columns;
      this.plan.count = Boolean(opts?.count);
      this.plan.head = Boolean(opts?.head);
    } else {
      this.plan.returning = columns;
    }
    return this;
  }

  insert(values: unknown) { this.plan.action = "insert"; this.plan.values = values; return this; }
  update(values: unknown) { this.plan.action = "update"; this.plan.values = values; return this; }
  delete() { this.plan.action = "delete"; return this; }
  upsert(values: unknown, opts?: { onConflict?: string }) {
    this.plan.action = "upsert";
    this.plan.values = values;
    this.plan.onConflict = opts?.onConflict;
    return this;
  }

  private add(op: FilterOp, column: string, value: unknown) { this.plan.filters.push([op, column, value]); return this; }
  eq(column: string, value: unknown) { return this.add("eq", column, value); }
  neq(column: string, value: unknown) { return this.add("neq", column, value); }
  in(column: string, values: readonly unknown[]) { return this.add("in", column, values); }
  is(column: string, value: null) { return this.add("is", column, value); }
  not(column: string, operator: "is", value: null) {
    if (operator !== "is") throw new Error(`Unsupported not() operator: ${operator}`);
    return this.add("not.is", column, value);
  }
  ilike(column: string, pattern: string) { return this.add("ilike", column, pattern); }
  gte(column: string, value: unknown) { return this.add("gte", column, value); }
  gt(column: string, value: unknown) { return this.add("gt", column, value); }
  lte(column: string, value: unknown) { return this.add("lte", column, value); }
  lt(column: string, value: unknown) { return this.add("lt", column, value); }

  order(column: string, opts?: { ascending?: boolean }) { this.plan.order.push([column, opts?.ascending !== false]); return this; }
  limit(n: number) { this.plan.limit = n; return this; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  single() { this.plan.one = "single"; return this as unknown as QueryBuilder<any>; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  maybeSingle() { this.plan.one = "maybe"; return this as unknown as QueryBuilder<any>; }

  then<A = DbResult<R>, B = never>(
    onfulfilled?: ((value: DbResult<R>) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return (this.run(this.plan) as Promise<DbResult<R>>).then(onfulfilled, onrejected);
  }
}
