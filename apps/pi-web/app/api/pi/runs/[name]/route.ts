import { NextResponse, type NextRequest } from "next/server";
import { requireCwd, resolvePiContext } from "@/lib/pi-context";
import { readRun } from "@/lib/pi-platform";

export const dynamic = "force-dynamic";

// GET /api/pi/runs/[name]?cwd=<path>
export async function GET(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const ctx = await resolvePiContext(requireCwd(req));
  if ("overview" in ctx) return ctx.overview;
  const { name } = await params;
  const ledger = readRun(ctx.piDir, name);
  if (!ledger) {
    return NextResponse.json({ error: `Run not found: ${name}` }, { status: 404 });
  }
  return NextResponse.json({ run: ledger });
}