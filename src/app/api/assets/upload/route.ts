import { NextRequest, NextResponse } from "next/server";
import { bearer, getUserFromToken } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

const MAX_BYTES = 4 * 1024 * 1024; // a request through Vercel is capped near 4.5 MB

/**
 * Stores a mentor's image. The site holds no storage key: it hands the file to
 * the eanaptune-files gatekeeper function, which can only write Naptune's bucket.
 * The first folder of the path must be the signed-in mentor's own id.
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromToken(bearer(req));
  if (!user) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

  const url = process.env.ASSETS_FUNCTION_URL;
  const token = process.env.ASSETS_TOKEN;
  if (!url || !token) return NextResponse.json({ error: "File storage is not set up." }, { status: 503 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const path = String(form?.get("path") ?? "");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "That file is too large. Use one under 4 MB." }, { status: 413 });
  if (!/^[A-Za-z0-9._/-]{1,300}$/.test(path) || path.includes("..") || path.split("/")[0] !== user.id) {
    return NextResponse.json({ error: "Invalid file path." }, { status: 400 });
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "x-path": path, "content-type": file.type || "application/octet-stream" },
    body: Buffer.from(await file.arrayBuffer()),
  });
  if (!res.ok) {
    console.error("[assets] upload failed:", res.status);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 502 });
  }
  return NextResponse.json({ path });
}
