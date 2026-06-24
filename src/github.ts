import * as github from "@actions/github";

type Octokit = ReturnType<typeof github.getOctokit>;

export interface TreeEntry {
  path: string;
  sha: string;
}

export interface BranchHead {
  commitSha: string;
  treeSha: string;
}

export interface FileChange {
  path: string;
  /** Blob SHA to reference (reused from the source tree). */
  sha: string;
}

export interface OpenPr {
  number: number;
  url: string;
}

/** Thin wrapper around Octokit for the operations this action needs. */
export class GitHubClient {
  constructor(
    private readonly octokit: Octokit,
    private readonly owner: string,
    private readonly repo: string,
  ) {}

  async getDefaultBranch(): Promise<string> {
    const { data } = await this.octokit.rest.repos.get({
      owner: this.owner,
      repo: this.repo,
    });
    return data.default_branch;
  }

  async listBranches(): Promise<string[]> {
    const branches = await this.octokit.paginate(
      this.octokit.rest.repos.listBranches,
      { owner: this.owner, repo: this.repo, per_page: 100 },
    );
    return branches.map((b: { name: string }) => b.name);
  }

  async getBranchHead(branch: string): Promise<BranchHead> {
    const { data } = await this.octokit.rest.repos.getBranch({
      owner: this.owner,
      repo: this.repo,
      branch,
    });
    return {
      commitSha: data.commit.sha,
      treeSha: data.commit.commit.tree.sha,
    };
  }

  /** Return all blob entries (files) under a tree, recursively. */
  async getTreeFiles(treeSha: string): Promise<TreeEntry[]> {
    const { data } = await this.octokit.rest.git.getTree({
      owner: this.owner,
      repo: this.repo,
      tree_sha: treeSha,
      recursive: "true",
    });
    return (data.tree || [])
      .filter((e) => e.type === "blob" && typeof e.path === "string" && typeof e.sha === "string")
      .map((e) => ({ path: e.path as string, sha: e.sha as string }));
  }

  /** Create a new tree based on `baseTreeSha`, adding/overwriting `changes`. */
  async createTree(baseTreeSha: string, changes: FileChange[]): Promise<string> {
    const { data } = await this.octokit.rest.git.createTree({
      owner: this.owner,
      repo: this.repo,
      base_tree: baseTreeSha,
      tree: changes.map((c) => ({
        path: c.path,
        mode: "100644" as const,
        type: "blob" as const,
        sha: c.sha,
      })),
    });
    return data.sha;
  }

  async createCommit(message: string, treeSha: string, parentSha: string): Promise<string> {
    const { data } = await this.octokit.rest.git.createCommit({
      owner: this.owner,
      repo: this.repo,
      message,
      tree: treeSha,
      parents: [parentSha],
    });
    return data.sha;
  }

  /** Update (or force-update) a branch ref to point at `commitSha`. */
  async updateBranchRef(branch: string, commitSha: string, force = false): Promise<void> {
    await this.octokit.rest.git.updateRef({
      owner: this.owner,
      repo: this.repo,
      ref: `heads/${branch}`,
      sha: commitSha,
      force,
    });
  }

  /** Create a branch ref at `commitSha`. */
  async createBranchRef(branch: string, commitSha: string): Promise<void> {
    await this.octokit.rest.git.createRef({
      owner: this.owner,
      repo: this.repo,
      ref: `refs/heads/${branch}`,
      sha: commitSha,
    });
  }

  async branchExists(branch: string): Promise<boolean> {
    try {
      await this.octokit.rest.git.getRef({
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${branch}`,
      });
      return true;
    } catch (err) {
      if (isNotFound(err)) {
        return false;
      }
      throw err;
    }
  }

  async findOpenPr(head: string, base: string): Promise<OpenPr | null> {
    const { data } = await this.octokit.rest.pulls.list({
      owner: this.owner,
      repo: this.repo,
      state: "open",
      head: `${this.owner}:${head}`,
      base,
    });
    if (data.length === 0) {
      return null;
    }
    return { number: data[0].number, url: data[0].html_url };
  }

  async createPr(head: string, base: string, title: string, body: string): Promise<OpenPr> {
    const { data } = await this.octokit.rest.pulls.create({
      owner: this.owner,
      repo: this.repo,
      head,
      base,
      title,
      body,
    });
    return { number: data.number, url: data.html_url };
  }
}

function isNotFound(err: unknown): boolean {
  return typeof err === "object" && err !== null && "status" in err && (err as { status: number }).status === 404;
}
