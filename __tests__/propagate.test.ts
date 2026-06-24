import { propagateAll, PropagateParams, SYNC_BRANCH_PREFIX } from "../src/propagate";
import { GitHubClient, TreeEntry } from "../src/github";

/* eslint-disable @typescript-eslint/no-explicit-any */
function mockClient(over: Partial<Record<keyof GitHubClient, any>> = {}): GitHubClient {
  const base: any = {
    getBranchHead: jest.fn().mockResolvedValue({ commitSha: "c1", treeSha: "t1" }),
    getTreeFiles: jest.fn().mockResolvedValue([] as TreeEntry[]),
    createTree: jest.fn().mockResolvedValue("newtree"),
    createCommit: jest.fn().mockResolvedValue("newcommit"),
    updateBranchRef: jest.fn().mockResolvedValue(undefined),
    createBranchRef: jest.fn().mockResolvedValue(undefined),
    branchExists: jest.fn().mockResolvedValue(false),
    findOpenPr: jest.fn().mockResolvedValue(null),
    createPr: jest.fn().mockResolvedValue({ number: 9, url: "https://pr/9" }),
  };
  return { ...base, ...over } as unknown as GitHubClient;
}

function params(over: Partial<PropagateParams> = {}): PropagateParams {
  return {
    sourceBranch: "main",
    sourceFiles: [{ path: "LICENSE", sha: "sA" }],
    targetBranches: ["dev"],
    mode: "push",
    dryRun: false,
    commitMessage: "sync",
    prTitle: "Sync",
    ...over,
  };
}

describe("propagateAll", () => {
  it("pushes a commit when target file differs", async () => {
    const c = mockClient({
      getTreeFiles: jest.fn().mockResolvedValue([{ path: "LICENSE", sha: "OLD" }]),
    });
    const [r] = await propagateAll(c, params());
    expect(r).toMatchObject({ branch: "dev", status: "updated", changedFiles: ["LICENSE"] });
    expect((c.createTree as jest.Mock)).toHaveBeenCalledWith("t1", [{ path: "LICENSE", sha: "sA" }]);
    expect((c.updateBranchRef as jest.Mock)).toHaveBeenCalledWith("dev", "newcommit");
  });

  it("pushes when file is missing on target", async () => {
    const c = mockClient({ getTreeFiles: jest.fn().mockResolvedValue([]) });
    const [r] = await propagateAll(c, params());
    expect(r.status).toBe("updated");
  });

  it("reports no-change when shas match", async () => {
    const c = mockClient({
      getTreeFiles: jest.fn().mockResolvedValue([{ path: "LICENSE", sha: "sA" }]),
    });
    const [r] = await propagateAll(c, params());
    expect(r.status).toBe("no-change");
    expect((c.createTree as jest.Mock)).not.toHaveBeenCalled();
  });

  it("never deletes target files (only add/overwrite)", async () => {
    const c = mockClient({
      getTreeFiles: jest
        .fn()
        .mockResolvedValue([{ path: "LICENSE", sha: "sA" }, { path: "EXTRA", sha: "x" }]),
    });
    const [r] = await propagateAll(c, params());
    expect(r.status).toBe("no-change"); // EXTRA is left alone, LICENSE matches
  });

  it("dry-run computes changes but performs no writes", async () => {
    const c = mockClient({ getTreeFiles: jest.fn().mockResolvedValue([]) });
    const [r] = await propagateAll(c, params({ dryRun: true }));
    expect(r).toMatchObject({ status: "updated", changedFiles: ["LICENSE"] });
    expect((c.createTree as jest.Mock)).not.toHaveBeenCalled();
    expect((c.updateBranchRef as jest.Mock)).not.toHaveBeenCalled();
  });

  it("skips and reports a branch when a write fails", async () => {
    const c = mockClient({
      getTreeFiles: jest.fn().mockResolvedValue([]),
      updateBranchRef: jest.fn().mockRejectedValue(new Error("protected branch")),
    });
    const [r] = await propagateAll(c, params());
    expect(r).toMatchObject({ branch: "dev", status: "skipped", reason: "protected branch" });
  });

  it("continues to other branches after one fails", async () => {
    const getBranchHead = jest
      .fn()
      .mockResolvedValueOnce({ commitSha: "c1", treeSha: "t1" })
      .mockResolvedValueOnce({ commitSha: "c2", treeSha: "t2" });
    const updateBranchRef = jest
      .fn()
      .mockRejectedValueOnce(new Error("403"))
      .mockResolvedValueOnce(undefined);
    const c = mockClient({
      getBranchHead,
      getTreeFiles: jest.fn().mockResolvedValue([]),
      updateBranchRef,
    });
    const results = await propagateAll(c, params({ targetBranches: ["dev", "stage"] }));
    expect(results.map((r) => r.status)).toEqual(["skipped", "updated"]);
  });

  describe("pr mode", () => {
    it("creates a sync branch and opens a PR when none exists", async () => {
      const c = mockClient({ getTreeFiles: jest.fn().mockResolvedValue([]) });
      const [r] = await propagateAll(c, params({ mode: "pr" }));
      expect((c.createBranchRef as jest.Mock)).toHaveBeenCalledWith(
        `${SYNC_BRANCH_PREFIX}dev`,
        "c1",
      );
      expect((c.createPr as jest.Mock)).toHaveBeenCalled();
      expect(r).toMatchObject({ status: "updated", prUrl: "https://pr/9" });
    });

    it("reuses an existing sync branch and open PR (dedup)", async () => {
      const c = mockClient({
        getTreeFiles: jest.fn().mockResolvedValue([]),
        branchExists: jest.fn().mockResolvedValue(true),
        findOpenPr: jest.fn().mockResolvedValue({ number: 1, url: "https://pr/1" }),
      });
      const [r] = await propagateAll(c, params({ mode: "pr" }));
      expect((c.createBranchRef as jest.Mock)).not.toHaveBeenCalled();
      expect((c.updateBranchRef as jest.Mock)).toHaveBeenCalledWith(
        `${SYNC_BRANCH_PREFIX}dev`,
        "c1",
        true,
      );
      expect((c.createPr as jest.Mock)).not.toHaveBeenCalled();
      expect(r.prUrl).toBe("https://pr/1");
    });
  });
});
