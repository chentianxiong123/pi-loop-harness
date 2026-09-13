import { NextResponse } from "next/server";
import { resolveTargetProject, TARGET_ENV_VAR } from "@/lib/platform-target";

export const dynamic = "force-dynamic";

// GET /api/pi/target
// Returns the single locked target project. There is exactly one — no project
// selection exists in the UI, so clients start from this path unconditionally.
export async function GET() {
  try {
    const target = resolveTargetProject();
    return NextResponse.json({
      target,
      configuredBy: process.env[TARGET_ENV_VAR] ? "env" : "default",
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}