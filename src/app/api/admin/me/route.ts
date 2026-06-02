import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, isSuperAdminEmail, isAdminEmailInTable } from "@/lib/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/me  →  { isSuperAdmin, email }
 * Lightweight check used to gate the Admin nav item. Never errors on
 * non-admins — just returns isSuperAdmin: false.
 */
export async function GET(req: NextRequest) {
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ isSuperAdmin: false });

  const auth = req.headers.get("authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!token) return NextResponse.json({ isSuperAdmin: false });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return NextResponse.json({ isSuperAdmin: false });

  const [{ data: distributor }, byTable] = await Promise.all([
    supabase.from("distributors").select("is_super_admin").eq("id", data.user.id).maybeSingle(),
    isAdminEmailInTable(supabase, data.user.email),
  ]);

  const isSuperAdmin = isSuperAdminEmail(data.user.email) || !!distributor?.is_super_admin || byTable;
  return NextResponse.json({ isSuperAdmin, email: data.user.email ?? null });
}
