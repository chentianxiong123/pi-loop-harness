import { NextResponse, type NextRequest } from "next/server";
import { requireCwd, resolvePiContext } from "@/lib/pi-context";
import { listExtensions } from "@/lib/pi-platform";

export const dynamic = "force-dynamic";

// GET /api/pi/extensions?cwd=<path>
export async function GET(req: NextRequest) {
  const ctx = await resolvePiContext(requireCwd(req));
  if ("overview" in ctx) return ctx.overview;
  try {
    return NextResponse.json({ piDir: ctx.piDir, extensions: listExtensions(ctx.piDir) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}