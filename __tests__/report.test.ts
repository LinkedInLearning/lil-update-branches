import { buildReport } from "../src/report";
import { PropagationResult } from "../src/types";

const results: PropagationResult[] = [
  { branch: "develop", status: "updated", changedFiles: ["LICENSE", "README.md"] },
  { branch: "feature/a", status: "no-change", changedFiles: [] },
  { branch: "feature/b", status: "skipped", changedFiles: [], reason: "protected branch" },
  { branch: "hotfix", status: "failed", changedFiles: [], reason: "403 Forbidden" },
  { branch: "release/1.0", status: "updated", changedFiles: [".github/workflows/ci.yml"], prUrl: "https://x/pr/2" },
];

describe("buildReport", () => {
  it("lists updated branches", () => {
    const r = buildReport(results, false);
    expect(JSON.parse(r.updatedBranches)).toEqual(["develop", "release/1.0"]);
  });

  it("lists skipped and failed branches with reasons", () => {
    const r = buildReport(results, false);
    expect(JSON.parse(r.skippedBranches)).toEqual([
      { branch: "feature/b", reason: "protected branch" },
      { branch: "hotfix", reason: "403 Forbidden" },
    ]);
  });

  it("produces a human-readable summary mentioning counts", () => {
    const r = buildReport(results, false);
    expect(r.summary).toMatch(/2 updated/);
    expect(r.summary).toMatch(/1 unchanged/);
    expect(r.summary).toMatch(/2 skipped/);
  });

  it("marks summary as dry-run when dryRun=true", () => {
    const r = buildReport(results, true);
    expect(r.summary).toMatch(/dry.run/i);
  });

  it("handles empty results", () => {
    const r = buildReport([], false);
    expect(JSON.parse(r.updatedBranches)).toEqual([]);
    expect(JSON.parse(r.skippedBranches)).toEqual([]);
    expect(r.summary).toMatch(/0 updated/);
  });
});
