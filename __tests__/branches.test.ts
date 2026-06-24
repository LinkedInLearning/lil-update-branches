import { filterTargetBranches } from "../src/branches";

const ALL = ["main", "develop", "feature/a", "feature/b", "release/1.0", "hotfix"];

describe("filterTargetBranches", () => {
  it("excludes the source branch", () => {
    const result = filterTargetBranches(ALL, "main", ["*"], []);
    expect(result).not.toContain("main");
  });

  it("returns all non-source branches when include is '*' and no excludes", () => {
    expect(filterTargetBranches(ALL, "main", ["*"], [])).toEqual([
      "develop",
      "feature/a",
      "feature/b",
      "release/1.0",
      "hotfix",
    ]);
  });

  it("applies include globs", () => {
    expect(filterTargetBranches(ALL, "main", ["feature/*"], [])).toEqual([
      "feature/a",
      "feature/b",
    ]);
  });

  it("applies exclude globs after includes", () => {
    expect(
      filterTargetBranches(ALL, "main", ["*"], ["feature/*", "hotfix"]),
    ).toEqual(["develop", "release/1.0"]);
  });

  it("always excludes the source even if include matches it", () => {
    expect(filterTargetBranches(ALL, "develop", ["develop", "feature/*"], [])).toEqual([
      "feature/a",
      "feature/b",
    ]);
  });

  it("supports multiple include globs", () => {
    expect(
      filterTargetBranches(ALL, "main", ["feature/*", "release/*"], []),
    ).toEqual(["feature/a", "feature/b", "release/1.0"]);
  });

  it("returns empty when nothing matches include", () => {
    expect(filterTargetBranches(ALL, "main", ["nope/*"], [])).toEqual([]);
  });

  it("treats empty include list as match-all", () => {
    expect(filterTargetBranches(ALL, "main", [], [])).toEqual([
      "develop",
      "feature/a",
      "feature/b",
      "release/1.0",
      "hotfix",
    ]);
  });
});
