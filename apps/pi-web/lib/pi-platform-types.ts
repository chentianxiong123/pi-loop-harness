export interface PiAgentMeta {
  name: string;
  description: string;
  tools: string[];
  model?: string;
  path: string;
  prompt: string;
}

export interface PiSkillMeta {
  name: string;
  description: string;
  path: string;
  dir: string;
  category: "entries" | "steps";
  disabled: boolean;
  allowedTools?: string;
}

export interface PiExtensionMeta {
  name: string;
  path: string;
  entrypoint: "builtin" | "custom";
  tools: string[];
  summary: string;
}

export interface PiRunTask {
  id: string;
  criterion: string;
  scope: string[];
  ctr: string[];
  branch?: string;
  worktree?: string;
  status: string;
}

export interface PiRunEvent {
  at: string;
  stage: string;
  msg: string;
}

export interface PiRunLedger {
  name: string;
  stage: string;
  entry: "feature" | "bug";
  created: string;
  updated: string;
  plan_path: string;
  original_request?: string;
  retry: { implement: number; retest_loop: number };
  tasks: PiRunTask[];
  events: PiRunEvent[];
}

export interface PiRunMeta {
  name: string;
  stage: string;
  entry: "feature" | "bug";
  created: string;
  updated: string;
  retry?: { implement: number; retest_loop: number };
  taskCount: number;
  taskDone: number;
  path: string;
  summary: string;
}

export type PiArtifactKind = "plan" | "spec" | "tasks" | "smoke" | "feasibility";

export interface PiArtifactMeta {
  name: string;
  kind: PiArtifactKind;
  path: string;
  title: string;
}

export interface PiPlatformOverview {
  piDir: string | null;
  agentsCount: number;
  skillsCount: number;
  extensionsCount: number;
  runsCount: number;
}