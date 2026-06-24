import { ActionInputs, DEFAULT_FILES, Mode } from "./types";

export interface RawInputs {
  sourceBranch: string;
  files: string;
  includeBranches: string;
  excludeBranches: string;
  mode: string;
  dryRun: string;
  commitMessage: string;
  prTitle: string;
  token: string;
}

/** Split a string on commas/newlines, trim items, and drop empties. */
export function parseList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function parseBool(value: string): boolean {
  return value.trim().toLowerCase() === "true";
}

export function resolveInputs(raw: RawInputs): ActionInputs {
  const mode = raw.mode.trim() as Mode;
  if (mode !== "push" && mode !== "pr") {
    throw new Error(`Invalid mode "${raw.mode}". Expected "push" or "pr".`);
  }

  const token = raw.token.trim();
  if (token.length === 0) {
    throw new Error("A token is required (set the 'token' input or github.token).");
  }

  const files = parseList(raw.files);

  return {
    sourceBranch: raw.sourceBranch.trim(),
    files: files.length > 0 ? files : [...DEFAULT_FILES],
    includeBranches: parseList(raw.includeBranches),
    excludeBranches: parseList(raw.excludeBranches),
    mode,
    dryRun: parseBool(raw.dryRun),
    commitMessage: raw.commitMessage,
    prTitle: raw.prTitle,
    token,
  };
}
