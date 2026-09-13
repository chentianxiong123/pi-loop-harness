/**
 * Sanitize a run name into a safe filename component.
 * Allows Unicode letters/numbers (Chinese-style slugs), plus `._-`.
 * Strips any path separator or traversal. Returns the cleaned name.
 */
export function sanitizeRunName(name: string): string {
  const cleaned = name.replace(/[^\p{L}\p{N}._-]/gu, "");
  if (!cleaned || cleaned === "." || cleaned === "..") return "_";
  if (cleaned.includes("..")) return cleaned.replace(/\.\./g, "_");
  return cleaned;
}