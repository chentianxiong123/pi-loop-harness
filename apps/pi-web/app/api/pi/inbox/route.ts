import { NextResponse, type NextRequest } from "next/server";
import { requireCwd, resolvePiContext } from "@/lib/pi-context";
import { enqueue, listInbox } from "@/lib/pi-inbox";

export const dynamic = "force-dynamic";

// POST /api/pi/inbox  { cwd, request, entry }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { cwd?: string; request?: string; entry?: string };
    const { cwd, request: rawRequest, entry } = body;
    if (!cwd) return NextResponse.json({ error: "cwd required in body" }, { status: 400 });
    const ctx = await resolvePiContext(cwd);
    if ("overview" in ctx) return ctx.overview;
    const request = rawRequest?.trim();
    if (!request) return NextResponse.json({ error: "request required" }, { status: 400 });
    const item = await enqueue(ctx.piDir, ctx.cwd, request, entry === "bug" ? "bug" : "feature");
    return NextResponse.json({ ok: true, ...item });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// GET /api/pi/inbox?cwd=<path>
export async function GET(req: NextRequest) {
  const ctx = await resolvePiContext(requireCwd(req));
  if ("overview" in ctx) return ctx.overview;
  try {
    return NextResponse.json({ items: listInbox(ctx.piDir) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}