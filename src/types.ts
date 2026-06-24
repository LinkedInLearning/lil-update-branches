export type PropagationStatus = "updated" | "skipped" | "no-change" | "failed";

export interface PropagationResult {
  branch: string;
  status: PropagationStatus;
  changedFiles: string[];
  reason?: string;
  prUrl?: string;
}

export type Mode = "push" | "pr";

export interface ActionInputs {
  sourceBranch: string;
  files: string[];
  includeBranches: string[];
  excludeBranches: string[];
  mode: Mode;
  dryRun: boolean;
  commitMessage: string;
  prTitle: string;
  token: string;
}

export const DEFAULT_FILES: string[] = [
  "LICENSE",
  "NOTICE",
  "README.md",
  "CONTRIBUTING.md",
  ".vscode/",
  ".devcontainer/",
  ".github/",
];
