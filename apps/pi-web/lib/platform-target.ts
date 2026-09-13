import { existsSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

// ============================================================================
// Single-project lock: the platform serves exactly one target project (the Go
// template under <platform-root>/framework by default), and never any other.
//
// The lock is configuration-driven on purpose — the platform may be shipped
// without git, so the git-based project resolution used elsewhere would not
// find a root. Resolution order (first match wins):
//
//   1. PI_TARGET_DIR env var (absolute, or relative to the server cwd)
//   2. <platform-root>/framework  (dev / bundled-template layout)
//
// The platform root is derived from this file's location (apps/pi-web/lib).
// ============================================================================

export const TARGET_ENV_VAR = "PI_TARGET_DIR";

const HERE = dirname(fileURLToPath(import.meta.url));

/** The repo root that bundles the platform and the template. */
function platformRoot(): string {
  // apps/pi-web/lib → up three levels → platform root
  return join(HERE, "..", "..", "..");
}

export interface TargetProject {
  /** Absolute path of the locked target project. */
  root: string;
  /** Display name — the directory name. */
  name: string;
  /** Absolute path of the target project's .pi dir, when present. */
  piDir: string | null;
}

export function resolveTargetRoot(): string {
  const fromEnv = process.env[TARGET_ENV_VAR]?.trim();
  if (fromEnv) {
    return resolve(fromEnv);
  }
  return join(platformRoot(), "framework");
}

export function resolveTargetProject(): TargetProject {
  const root = resolveTargetRoot();
  const piDir = join(root, ".pi");
  return {
    root,
    name: root.split("/").filter(Boolean).pop() ?? root,
    piDir: existsSync(piDir) ? piDir : null,
  };
}