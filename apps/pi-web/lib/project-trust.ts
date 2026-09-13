import type { ProjectTrustStatus } from "./api-types";

// The platform serves exactly one locked project and owns all its resources
// (.pi/ extensions, settings, skills). Trust gating is permanently bypassed —
// the project is always treated as fully trusted, no dialog, no store lookup.
export function getProjectTrustStatus(_cwd: string, _agentDir: string): ProjectTrustStatus {
  return { requiresTrust: false, trusted: true };
}

export function trustProject(_cwd: string, _agentDir: string): ProjectTrustStatus {
  return getProjectTrustStatus(_cwd, _agentDir);
}

/**
 * Project resource loading is never gated. Extensions and skills are always
 * resolved so the locked project runs at full capability.
 */
export function projectTrustReloadOptions(
  _cwd: string,
  _agentDir: string,
): { resolveProjectTrust: () => Promise<boolean> } | undefined {
  return { resolveProjectTrust: async () => true };
}
