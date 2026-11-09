import { NextRequest, NextResponse } from "next/server";
import { bearer, getUserFromToken, signIn, signUp, updateMeta, type SignIn } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

const reply = (r: SignIn) =>
  "error" in r
    ? NextResponse.json({ error: r.error }, { status: r.status })
    : NextResponse.json({ access_token: r.token, user: r.user });

/** POST /api/auth/login, /api/auth/signup, /api/auth/update */
export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const email = String(body?.email ?? "");
  const password = String(body?.password ?? "");

  try {
    if (action === "login") return reply(await signIn(email, password));

    if (action === "signup") {
      const raw = (body?.data ?? {}) as Record<string, unknown>;
      const meta = Object.fromEntries(
        ["name", "telegram_url", "discord_url", "youtube_url", "tiktok_url"].map((k) => [k, String(raw[k] ?? "").slice(0, 300)]),
      );
      return reply(await signUp(email, password, meta));
    }

    if (action === "update") {
      const user = await getUserFromToken(bearer(req));
      if (!user) return NextResponse.json({ error: "Invalid session" }, { status: 401 });
      const name = String(body?.data?.name ?? "").trim().slice(0, 200);
      const updated = name ? await updateMeta(user.id, { name }) : user;
      return NextResponse.json({ user: updated });
    }
  } catch (e) {
    console.error(`[auth] ${action} failed:`, e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Sign-in is unavailable right now. Please try again." }, { status: 503 });
  }
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

/** GET /api/auth/user: who this session belongs to. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  if (action !== "user") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const user = await getUserFromToken(bearer(req));
  return user ? NextResponse.json({ user }) : NextResponse.json({ error: "Invalid session" }, { status: 401 });
}
