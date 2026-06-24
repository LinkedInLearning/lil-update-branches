import { parseList, resolveInputs, RawInputs } from "../src/inputs";
import { DEFAULT_FILES } from "../src/types";

function raw(overrides: Partial<RawInputs> = {}): RawInputs {
  return {
    sourceBranch: "",
    files: "",
    includeBranches: "*",
    excludeBranches: "",
    mode: "push",
    dryRun: "false",
    commitMessage: "chore: sync shared files from {source-branch}",
    prTitle: "chore: sync shared files from {source-branch}",
    token: "tok",
    ...overrides,
  };
}

describe("parseList", () => {
  it("splits on newlines and commas, trims, drops empties", () => {
    expect(parseList("a, b\nc,\n  d  ")).toEqual(["a", "b", "c", "d"]);
  });

  it("returns empty array for empty/whitespace input", () => {
    expect(parseList("")).toEqual([]);
    expect(parseList("  \n ")).toEqual([]);
  });
});

describe("resolveInputs", () => {
  it("defaults files to DEFAULT_FILES when empty", () => {
    expect(resolveInputs(raw()).files).toEqual(DEFAULT_FILES);
  });

  it("parses explicit files list", () => {
    expect(resolveInputs(raw({ files: "a.txt, b/" })).files).toEqual(["a.txt", "b/"]);
  });

  it("parses include and exclude branch globs", () => {
    const i = resolveInputs(raw({ includeBranches: "feature/*, release/*", excludeBranches: "x" }));
    expect(i.includeBranches).toEqual(["feature/*", "release/*"]);
    expect(i.excludeBranches).toEqual(["x"]);
  });

  it("parses dry-run as boolean (case-insensitive)", () => {
    expect(resolveInputs(raw({ dryRun: "true" })).dryRun).toBe(true);
    expect(resolveInputs(raw({ dryRun: "TRUE" })).dryRun).toBe(true);
    expect(resolveInputs(raw({ dryRun: "false" })).dryRun).toBe(false);
    expect(resolveInputs(raw({ dryRun: "" })).dryRun).toBe(false);
  });

  it("accepts valid modes", () => {
    expect(resolveInputs(raw({ mode: "push" })).mode).toBe("push");
    expect(resolveInputs(raw({ mode: "pr" })).mode).toBe("pr");
  });

  it("throws on invalid mode", () => {
    expect(() => resolveInputs(raw({ mode: "merge" }))).toThrow(/mode/i);
  });

  it("throws when token is missing", () => {
    expect(() => resolveInputs(raw({ token: "" }))).toThrow(/token/i);
  });

  it("passes sourceBranch through (empty means default-branch later)", () => {
    expect(resolveInputs(raw({ sourceBranch: "develop" })).sourceBranch).toBe("develop");
    expect(resolveInputs(raw()).sourceBranch).toBe("");
  });

  it("passes commit message and pr title through", () => {
    const i = resolveInputs(raw({ commitMessage: "msg", prTitle: "title" }));
    expect(i.commitMessage).toBe("msg");
    expect(i.prTitle).toBe("title");
  });
});
