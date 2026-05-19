import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const isAuth = req.cookies.has("sb-access-token") || req.cookies.getAll().some(c => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"));

  if (req.nextUrl.pathname.startsWith("/dashboard") && !isAuth) {
    const devMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (devMode) return NextResponse.next();
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
