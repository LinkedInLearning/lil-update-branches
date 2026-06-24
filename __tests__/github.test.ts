import { GitHubClient } from "../src/github";

/* eslint-disable @typescript-eslint/no-explicit-any */
function makeOctokit(overrides: any = {}) {
  const rest = {
    repos: {
      get: jest.fn().mockResolvedValue({ data: { default_branch: "main" } }),
      listBranches: jest.fn(),
      getBranch: jest.fn().mockResolvedValue({
        data: { commit: { sha: "c1", commit: { tree: { sha: "t1" } } } },
      }),
    },
    git: {
      getTree: jest.fn().mockResolvedValue({
        data: {
          tree: [
            { path: "LICENSE", type: "blob", sha: "bl1" },
            { path: "dir", type: "tree", sha: "tr1" },
            { path: "dir/a.txt", type: "blob", sha: "bl2" },
          ],
        },
      }),
      createTree: jest.fn().mockResolvedValue({ data: { sha: "newtree" } }),
      createCommit: jest.fn().mockResolvedValue({ data: { sha: "newcommit" } }),
      updateRef: jest.fn().mockResolvedValue({}),
      createRef: jest.fn().mockResolvedValue({}),
      getRef: jest.fn().mockResolvedValue({}),
    },
    pulls: {
      list: jest.fn().mockResolvedValue({ data: [] }),
      create: jest.fn().mockResolvedValue({ data: { number: 7, html_url: "https://pr/7" } }),
    },
    ...overrides,
  };
  const paginate = jest.fn().mockResolvedValue([{ name: "main" }, { name: "dev" }]);
  return { rest, paginate } as any;
}

function client(octokit: any) {
  return new GitHubClient(octokit, "octo", "repo");
}

describe("GitHubClient", () => {
  it("getDefaultBranch returns repo default", async () => {
    const o = makeOctokit();
    expect(await client(o).getDefaultBranch()).toBe("main");
  });

  it("listBranches paginates and maps names", async () => {
    const o = makeOctokit();
    expect(await client(o).listBranches()).toEqual(["main", "dev"]);
    expect(o.paginate).toHaveBeenCalled();
  });

  it("getBranchHead returns commit and tree shas", async () => {
    const o = makeOctokit();
    expect(await client(o).getBranchHead("main")).toEqual({ commitSha: "c1", treeSha: "t1" });
  });

  it("getTreeFiles returns only blob entries", async () => {
    const o = makeOctokit();
    const files = await client(o).getTreeFiles("t1");
    expect(files).toEqual([
      { path: "LICENSE", sha: "bl1" },
      { path: "dir/a.txt", sha: "bl2" },
    ]);
    expect(o.rest.git.getTree).toHaveBeenCalledWith(
      expect.objectContaining({ tree_sha: "t1", recursive: "true" }),
    );
  });

  it("createTree references blob shas with base_tree", async () => {
    const o = makeOctokit();
    const sha = await client(o).createTree("base", [{ path: "LICENSE", sha: "bl1" }]);
    expect(sha).toBe("newtree");
    expect(o.rest.git.createTree).toHaveBeenCalledWith(
      expect.objectContaining({
        base_tree: "base",
        tree: [{ path: "LICENSE", mode: "100644", type: "blob", sha: "bl1" }],
      }),
    );
  });

  it("createCommit sets parent", async () => {
    const o = makeOctokit();
    const sha = await client(o).createCommit("msg", "tree", "parent");
    expect(sha).toBe("newcommit");
    expect(o.rest.git.createCommit).toHaveBeenCalledWith(
      expect.objectContaining({ message: "msg", tree: "tree", parents: ["parent"] }),
    );
  });

  it("updateBranchRef updates heads/<branch>", async () => {
    const o = makeOctokit();
    await client(o).updateBranchRef("dev", "sha", true);
    expect(o.rest.git.updateRef).toHaveBeenCalledWith(
      expect.objectContaining({ ref: "heads/dev", sha: "sha", force: true }),
    );
  });

  it("createBranchRef creates refs/heads/<branch>", async () => {
    const o = makeOctokit();
    await client(o).createBranchRef("sync/dev", "sha");
    expect(o.rest.git.createRef).toHaveBeenCalledWith(
      expect.objectContaining({ ref: "refs/heads/sync/dev", sha: "sha" }),
    );
  });

  it("branchExists returns true when ref found", async () => {
    const o = makeOctokit();
    expect(await client(o).branchExists("dev")).toBe(true);
  });

  it("branchExists returns false on 404", async () => {
    const o = makeOctokit();
    o.rest.git.getRef = jest.fn().mockRejectedValue({ status: 404 });
    expect(await client(o).branchExists("nope")).toBe(false);
  });

  it("branchExists rethrows non-404 errors", async () => {
    const o = makeOctokit();
    o.rest.git.getRef = jest.fn().mockRejectedValue({ status: 500 });
    await expect(client(o).branchExists("x")).rejects.toEqual({ status: 500 });
  });

  it("findOpenPr returns null when none", async () => {
    const o = makeOctokit();
    expect(await client(o).findOpenPr("head", "base")).toBeNull();
  });

  it("findOpenPr returns first match", async () => {
    const o = makeOctokit();
    o.rest.pulls.list = jest
      .fn()
      .mockResolvedValue({ data: [{ number: 3, html_url: "https://pr/3" }] });
    expect(await client(o).findOpenPr("head", "base")).toEqual({ number: 3, url: "https://pr/3" });
  });

  it("createPr returns number and url", async () => {
    const o = makeOctokit();
    expect(await client(o).createPr("head", "base", "t", "b")).toEqual({
      number: 7,
      url: "https://pr/7",
    });
  });
});
