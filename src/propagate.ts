import { GitHubClient, TreeEntry } from "./github";
import { Mode, PropagationResult } from "./types";

export interface PropagateParams {
  sourceBranch: string;
  /** Selected source files (path + blob sha) to propagate. */
  sourceFiles: TreeEntry[];
  targetBranches: string[];
  mode: Mode;
  dryRun: boolean;
  commitMessage: string;
  prTitle: string;
}

export const SYNC_BRANCH_PREFIX = "sync-shared-files/";

/** Propagate the selected source files to every target branch. */
export async function propagateAll(
  client: GitHubClient,
  params: PropagateParams,
): Promise<PropagationResult[]> {
  const results: PropagationResult[] = [];
  for (const branch of params.targetBranches) {
    results.push(await propagateOne(client, params, branch));
  }
  return results;
}

async function propagateOne(
  client: GitHubClient,
  params: PropagateParams,
  branch: string,
): Promise<PropagationResult> {
  try {
    const head = await client.getBranchHead(branch);
    const targetFiles = await client.getTreeFiles(head.treeSha);
    const targetShaByPath = new Map(targetFiles.map((f) => [f.path, f.sha]));

    // Source wins; copy/overwrite only (never delete). Changed = missing or differing sha.
    const changes = params.sourceFiles.filter((f) => targetShaByPath.get(f.path) !== f.sha);
    const changedFiles = changes.map((c) => c.path);

    if (changes.length === 0) {
      return { branch, status: "no-change", changedFiles: [] };
    }

    if (params.dryRun) {
      return { branch, status: "updated", changedFiles };
    }

    if (params.mode === "push") {
      const treeSha = await client.createTree(head.treeSha, changes);
      const commitSha = await client.createCommit(params.commitMessage, treeSha, head.commitSha);
      await client.updateBranchRef(branch, commitSha);
      return { branch, status: "updated", changedFiles };
    }

    // mode === "pr"
    const syncBranch = `${SYNC_BRANCH_PREFIX}${branch}`;
    if (await client.branchExists(syncBranch)) {
      await client.updateBranchRef(syncBranch, head.commitSha, true);
    } else {
      await client.createBranchRef(syncBranch, head.commitSha);
    }
    const treeSha = await client.createTree(head.treeSha, changes);
    const commitSha = await client.createCommit(params.commitMessage, treeSha, head.commitSha);
    await client.updateBranchRef(syncBranch, commitSha, true);

    const existing = await client.findOpenPr(syncBranch, branch);
    if (existing) {
      return { branch, status: "updated", changedFiles, prUrl: existing.url };
    }
    const body = buildPrBody(params.sourceBranch, changedFiles);
    const pr = await client.createPr(syncBranch, branch, params.prTitle, body);
    return { branch, status: "updated", changedFiles, prUrl: pr.url };
  } catch (err) {
    return { branch, status: "skipped", changedFiles: [], reason: errorMessage(err) };
  }
}

function buildPrBody(sourceBranch: string, files: string[]): string {
  const list = files.map((f) => `- \`${f}\``).join("\n");
  return `Sync shared files from \`${sourceBranch}\`.\n\nUpdated files:\n${list}`;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}
