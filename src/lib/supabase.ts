import { QueryBuilder, type DbResult, type Plan } from "@/lib/query-plan";

/**
 * The browser's handle on sign-in, data and files. It keeps the shape the
 * dashboards already use, but holds no database or storage credentials: every
 * call goes to this site's own routes, which act for the signed-in mentor.
 */

export const DEV_MODE = false;
export const DEV_USER = { id: "", email: "", user_metadata: { name: "" } };
export const isSupabaseConfigured = () => true;

const KEY = "naptune_session";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type User = { id: string; email: string; user_metadata: Record<string, any> };

const getToken = () => (typeof window === "undefined" ? "" : window.localStorage.getItem(KEY) || "");
const setToken = (t: string | null) => {
  if (typeof window === "undefined") return;
  if (t) window.localStorage.setItem(KEY, t);
  else window.localStorage.removeItem(KEY);
};
const bearer = (): Record<string, string> => {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
};

async function post(path: string, body: unknown) {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json", ...bearer() }, body: JSON.stringify(body) });
  return { ok: res.ok, status: res.status, json: await res.json().catch(() => ({})) };
}

async function runPlan(plan: Plan): Promise<DbResult> {
  try {
    const { json } = await post("/api/client-db", plan);
    return { data: json.data ?? null, error: json.error ?? null, count: json.count ?? null };
  } catch {
    return { data: null, error: { message: "Network error" }, count: null };
  }
}

async function signInWith(path: string, body: unknown) {
  try {
    const { ok, json } = await post(path, body);
    if (!ok) return { data: { user: null as User | null, session: null }, error: { message: String(json.error || "Request failed") } };
    setToken(json.access_token);
    return { data: { user: json.user as User, session: { access_token: json.access_token as string } }, error: null };
  } catch {
    return { data: { user: null as User | null, session: null }, error: { message: "Network error. Please try again." } };
  }
}

export const supabase = {
  auth: {
    signInWithPassword: (creds: { email: string; password: string }) => signInWith("/api/auth/login", creds),
    signUp: (args: { email: string; password: string; options?: { data?: Record<string, string> } }) =>
      signInWith("/api/auth/signup", { email: args.email, password: args.password, data: args.options?.data ?? {} }),
    async signOut() {
      setToken(null);
    },
    async getSession() {
      const access_token = getToken();
      return { data: { session: access_token ? { access_token } : null }, error: null };
    },
    async getUser() {
      if (!getToken()) return { data: { user: null as User | null }, error: null };
      try {
        const res = await fetch("/api/auth/user", { headers: bearer() });
        if (res.status === 401) setToken(null);
        const json = await res.json().catch(() => ({}));
        return { data: { user: (json.user ?? null) as User | null }, error: null };
      } catch {
        return { data: { user: null as User | null }, error: { message: "Network error" } };
      }
    },
    async updateUser(args: { data: Record<string, unknown> }) {
      const { ok, json } = await post("/api/auth/update", { data: args.data });
      return { data: { user: (json.user ?? null) as User | null }, error: ok ? null : { message: String(json.error || "Request failed") } };
    },
  },

  from: (table: string) => new QueryBuilder(table, runPlan),

  storage: {
    from: (_bucket: string) => ({
      async upload(path: string, file: File, _opts?: { upsert?: boolean }) {
        const form = new FormData();
        form.set("file", file);
        form.set("path", path);
        try {
          const res = await fetch("/api/assets/upload", { method: "POST", headers: bearer(), body: form });
          const json = await res.json().catch(() => ({}));
          return res.ok
            ? { data: { path: String(json.path) }, error: null }
            : { data: { path: "" }, error: new Error(String(json.error || "Upload failed")) };
        } catch {
          return { data: { path: "" }, error: new Error("Network error") };
        }
      },
      getPublicUrl: (path: string) => ({ data: { publicUrl: `${process.env.NEXT_PUBLIC_ASSETS_BASE ?? ""}/${path}` } }),
    }),
  },
};
