import { NextResponse, type NextRequest } from "next/server";
import { getAllowedFileRoots, isExistingFilePathAllowed } from "./file-access";
import { findPiDir } from "./pi-platform";

/**
 * Shared gate for all /api/pi/* routes: validates `cwd` query param against
 * the allowed roots, resolves the nearest `.pi/` dir, and returns an error
 * response when something is wrong.
 */
export async function resolvePiContext(cwd: string | null): Promise<
  | { overview: NextResponse }
  | { piDir: string; cwd: string }
> {
  if (!cwd) {
    return { overview: NextResponse.json({ error: "cwd required" }, { status: 400 }) };
  }
  const allowedRoots = await getAllowedFileRoots();
  if (!isExistingFilePathAllowed(cwd, allowedRoots)) {
    return { overview: NextResponse.json({ error: "Access denied" }, { status: 403 }) };
  }
  const piDir = findPiDir(cwd);
  if (!piDir) {
    return { overview: NextResponse.json({ error: "No .pi/ directory found from cwd" }, { status: 404 }) };
  }
  return { piDir, cwd };
}

export function requireCwd(req: NextRequest | Request): string | null {
  return new URL(req.url).searchParams.get("cwd");
}