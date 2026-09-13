import { NextResponse, type NextRequest } from "next/server";
import { requireCwd, resolvePiContext } from "@/lib/pi-context";
import { readActionLines } from "@/lib/pi-platform";

export const dynamic = "force-dynamic";

// GET /api/pi/actions?cwd=<path>&name=<run>&offset=<line>
export async function GET(req: NextRequest) {
  const ctx = await resolvePiContext(requireCwd(req));
  if ("overview" in ctx) return ctx.overview;
  const name = req.nextUrl.searchParams.get("name") ?? "";
  const offset = Number(req.nextUrl.searchParams.get("offset") ?? "0");
  const start = Number.isFinite(offset) && offset > 0 ? offset : 0;
  const { events, count } = readActionLines(ctx.piDir, name);
  return NextResponse.json({ name, events: events.slice(start), nextOffset: count, total: count });
}