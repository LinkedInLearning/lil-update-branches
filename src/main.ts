import * as core from "@actions/core";
import * as github from "@actions/github";
import { resolveInputs, RawInputs } from "./inputs";
import { GitHubClient } from "./github";
import { selectFiles } from "./selector";
import { filterTargetBranches } from "./branches";
import { propagateAll } from "./propagate";
import { buildReport } from "./report";

function readRawInputs(): RawInputs {
  return {
    sourceBranch: core.getInput("source-branch"),
    files: core.getInput("files"),
    includeBranches: core.getInput("include-branches"),
    excludeBranches: core.getInput("exclude-branches"),
    mode: core.getInput("mode") || "push",
    dryRun: core.getInput("dry-run") || "false",
    commitMessage: core.getInput("commit-message"),
    prTitle: core.getInput("pr-title"),
    token: core.getInput("token"),
  };
}

export async function run(): Promise<void> {
  try {
    const inputs = resolveInputs(readRawInputs());
    const octokit = github.getOctokit(inputs.token);
    const { owner, repo } = github.context.repo;
    const client = new GitHubClient(octokit, owner, repo);

    const sourceBranch = inputs.sourceBranch || (await client.getDefaultBranch());
    core.info(`Source branch: ${sourceBranch}`);

    const sourceHead = await client.getBranchHead(sourceBranch);
    const sourceTree = await client.getTreeFiles(sourceHead.treeSha);
    const selectedPaths = selectFiles(inputs.files, sourceTree.map((f) => f.path));
    const sourceFiles = sourceTree.filter((f) => selectedPaths.includes(f.path));

    if (sourceFiles.length === 0) {
      core.warning("No files matched the selectors on the source branch; nothing to do.");
    }
    core.info(`Selected ${sourceFiles.length} file(s): ${selectedPaths.join(", ")}`);

    const allBranches = await client.listBranches();
    const targetBranches = filterTargetBranches(
      allBranches,
      sourceBranch,
      inputs.includeBranches,
      inputs.excludeBranches,
    );
    core.info(`Target branches (${targetBranches.length}): ${targetBranches.join(", ")}`);

    const commitMessage = inputs.commitMessage.replace(/\{source-branch\}/g, sourceBranch);
    const prTitle = inputs.prTitle.replace(/\{source-branch\}/g, sourceBranch);

    const results = await propagateAll(client, {
      sourceBranch,
      sourceFiles,
      targetBranches,
      mode: inputs.mode,
      dryRun: inputs.dryRun,
      commitMessage,
      prTitle,
    });

    const report = buildReport(results, inputs.dryRun);
    core.setOutput("updated-branches", report.updatedBranches);
    core.setOutput("skipped-branches", report.skippedBranches);
    core.setOutput("summary", report.summary);

    core.info(report.summary);
    await core.summary.addRaw(report.summary).write();
  } catch (err) {
    core.setFailed(err instanceof Error ? err.message : String(err));
  }
}

run();
