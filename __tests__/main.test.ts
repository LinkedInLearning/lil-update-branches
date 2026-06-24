/* eslint-disable @typescript-eslint/no-explicit-any */
const inputs: Record<string, string> = {
  "source-branch": "",
  files: "LICENSE",
  "include-branches": "*",
  "exclude-branches": "",
  mode: "push",
  "dry-run": "false",
  "commit-message": "sync from {source-branch}",
  "pr-title": "sync from {source-branch}",
  token: "tok",
};

const setOutput = jest.fn();
const setFailed = jest.fn();
const summaryWrite = jest.fn().mockResolvedValue(undefined);
const addRaw = jest.fn().mockReturnValue({ write: summaryWrite });

jest.mock("@actions/core", () => ({
  getInput: (name: string) => inputs[name] ?? "",
  info: jest.fn(),
  warning: jest.fn(),
  setOutput,
  setFailed,
  summary: { addRaw },
}));

const octokitMock = {
  rest: {
    repos: {
      get: jest.fn().mockResolvedValue({ data: { default_branch: "main" } }),
      getBranch: jest.fn().mockImplementation(({ branch }: { branch: string }) =>
        Promise.resolve({
          data: {
            commit: { sha: `c-${branch}`, commit: { tree: { sha: `t-${branch}` } } },
          },
        }),
      ),
    },
    git: {
      getTree: jest.fn().mockImplementation(({ tree_sha }: { tree_sha: string }) =>
        Promise.resolve({
          data: {
            tree:
              tree_sha === "t-main"
                ? [{ path: "LICENSE", type: "blob", sha: "sA" }]
                : [],
          },
        }),
      ),
      createTree: jest.fn().mockResolvedValue({ data: { sha: "nt" } }),
      createCommit: jest.fn().mockResolvedValue({ data: { sha: "nc" } }),
      updateRef: jest.fn().mockResolvedValue({}),
    },
  },
  paginate: jest.fn().mockResolvedValue([{ name: "main" }, { name: "dev" }]),
};

jest.mock("@actions/github", () => ({
  getOctokit: () => octokitMock,
  context: { repo: { owner: "octo", repo: "repo" } },
}));

describe("main run", () => {
  it("wires inputs through to outputs and pushes to non-source branches", async () => {
    const mod = await import("../src/main");
    await mod.run();

    expect(setFailed).not.toHaveBeenCalled();
    const updated = setOutput.mock.calls.find((c) => c[0] === "updated-branches");
    expect(updated).toBeDefined();
    expect(JSON.parse(updated![1])).toEqual(["dev"]);
    // dev got LICENSE pushed (it had no LICENSE -> change)
    expect(octokitMock.rest.git.updateRef).toHaveBeenCalledWith(
      expect.objectContaining({ ref: "heads/dev", sha: "nc" }),
    );
  });
});
