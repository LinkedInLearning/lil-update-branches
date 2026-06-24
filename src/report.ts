import { PropagationResult } from "./types";

export interface Report {
  updatedBranches: string;
  skippedBranches: string;
  summary: string;
}

/** Aggregate per-branch results into action outputs and a human-readable summary. */
export function buildReport(results: PropagationResult[], dryRun: boolean): Report {
  const updated = results.filter((r) => r.status === "updated");
  const unchanged = results.filter((r) => r.status === "no-change");
  const skippedOrFailed = results.filter(
    (r) => r.status === "skipped" || r.status === "failed",
  );

  const updatedBranches = updated.map((r) => r.branch);
  const skippedBranches = skippedOrFailed.map((r) => ({
    branch: r.branch,
    reason: r.reason ?? "unknown",
  }));

  const lines: string[] = [];
  lines.push(`${dryRun ? "[dry-run] " : ""}Branch sync complete.`);
  lines.push(
    `${updated.length} updated, ${unchanged.length} unchanged, ${skippedOrFailed.length} skipped.`,
  );

  if (updated.length > 0) {
    lines.push("");
    lines.push("Updated:");
    for (const r of updated) {
      const detail = r.prUrl ? ` (${r.prUrl})` : ` (${r.changedFiles.length} files)`;
      lines.push(`  - ${r.branch}${detail}`);
    }
  }

  if (skippedOrFailed.length > 0) {
    lines.push("");
    lines.push("Skipped:");
    for (const r of skippedOrFailed) {
      lines.push(`  - ${r.branch}: ${r.reason ?? "unknown"}`);
    }
  }

  return {
    updatedBranches: JSON.stringify(updatedBranches),
    skippedBranches: JSON.stringify(skippedBranches),
    summary: lines.join("\n"),
  };
}
