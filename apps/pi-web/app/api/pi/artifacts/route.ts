import { NextResponse, type NextRequest } from "next/server";
import { requireCwd, resolvePiContext } from "@/lib/pi-context";
import { listArtifacts, readArtifact, ARTIFACT_KINDS } from "@/lib/pi-platform";
import type { PiArtifactKind } from "@/lib/pi-platform-types";

export const dynamic = "force-dynamic";

// GET /api/pi/artifacts?cwd=<path>&kind=plan|spec|tasks|smoke|feasibility
// GET /api/pi/artifacts?cwd=<path>&kind=plan&name=<name>   → markdown content
export async function GET(req: NextRequest) {
  const ctx = await resolvePiContext(requireCwd(req));
  if ("overview" in ctx) return ctx.overview;
  try {
    const { searchParams } = new URL(req.url);
    const kind = searchParams.get("kind") as PiArtifactKind | null;
    const name = searchParams.get("name");
    if (name) {
      if (!kind || !ARTIFACT_KINDS.includes(kind)) {
        return NextResponse.json({ error: "kind required and must be one of " + ARTIFACT_KINDS.join(",") }, { status: 400 });
      }
      const content = readArtifact(ctx.piDir, kind, name);
      if (content === null) return NextResponse.json({ error: `Artifact not found: ${kind}/${name}` }, { status: 404 });
      return NextResponse.json({ kind, name, content });
    }
    if (kind && !ARTIFACT_KINDS.includes(kind)) {
      return NextResponse.json({ error: "invalid kind" }, { status: 400 });
    }
    const kinds: PiArtifactKind[] = kind ? [kind] : ARTIFACT_KINDS;
    const artifacts = kinds.flatMap((k) => listArtifacts(ctx.piDir, k));
    return NextResponse.json({ artifacts });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}