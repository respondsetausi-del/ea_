import { NextRequest, NextResponse } from "next/server";

/**
 * Service suspension switch.
 *
 * Set SERVICE_SUSPENDED=1 in the environment and every request returns a plain
 * "Service Suspended" page. Unset it (or set anything else) and the site is
 * back — no code change, no rebuild of the page itself, just a redeploy so the
 * new value is picked up.
 *
 * Two things are deliberately still served while suspended:
 *
 *   the payment webhooks — a provider retries for a while and then gives up.
 *     Blocking one would mean a payment that cleared is never recorded, and the
 *     customer is owed access nobody can see. Suspension should stop people
 *     using the service, not lose their money.
 *
 *     This list is the thing to remember when a payment provider is added.
 *     Whop became the live gateway six weeks after this file was written and
 *     was not added here, so a suspension would have taken money and recorded
 *     nothing — the exact failure the Stripe line above exists to prevent.
 *
 *   /_next/* and favicons — so the page itself renders rather than 404ing on
 *     its own assets.
 */
function suspended(): boolean {
  const v = (process.env.SERVICE_SUSPENDED || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

const ALWAYS_ALLOWED = [
  "/api/v1/stripe-webhook",
  "/api/v1/whop-webhook",
];

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Service Suspended</title>
<style>
  html, body {
    height: 100%;
    margin: 0;
    background: #ffffff;
    color: #111111;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  main {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  h1 {
    margin: 0;
    font-size: clamp(1.25rem, 4vw, 1.75rem);
    font-weight: 600;
    letter-spacing: -0.01em;
    text-align: center;
  }
</style>
</head>
<body><main><h1>Service Suspended</h1></main></body>
</html>`;

export function proxy(request: NextRequest) {
  if (!suspended()) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (ALWAYS_ALLOWED.some((p) => pathname.startsWith(p))) return NextResponse.next();

  // 503 with Retry-After, so search engines treat this as temporary and do not
  // drop the site from their index the way a 200 or a 404 would.
  return new NextResponse(PAGE, {
    status: 503,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Retry-After": "3600",
      "Cache-Control": "no-store",
    },
  });
}

export const config = {
  // Everything except Next's own assets and the favicon, which the page needs
  // in order to render.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
