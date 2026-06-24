import { selectFiles } from "../src/selector";

const SOURCE_PATHS = [
  "LICENSE",
  "README.md",
  "src/index.ts",
  "src/util/helper.ts",
  ".github/workflows/ci.yml",
  ".github/copilot-instructions.md",
  ".vscode/settings.json",
  "docs/guide.md",
  "docs/images/logo.png",
];

describe("selectFiles", () => {
  it("matches exact file paths", () => {
    expect(selectFiles(["LICENSE", "README.md"], SOURCE_PATHS)).toEqual([
      "LICENSE",
      "README.md",
    ]);
  });

  it("expands a directory prefix (with trailing slash) recursively", () => {
    expect(selectFiles([".github/"], SOURCE_PATHS)).toEqual([
      ".github/workflows/ci.yml",
      ".github/copilot-instructions.md",
    ]);
  });

  it("expands a directory prefix without trailing slash recursively", () => {
    expect(selectFiles(["src"], SOURCE_PATHS)).toEqual([
      "src/index.ts",
      "src/util/helper.ts",
    ]);
  });

  it("matches glob patterns", () => {
    expect(selectFiles(["**/*.png"], SOURCE_PATHS)).toEqual([
      "docs/images/logo.png",
    ]);
  });

  it("matches a single-segment glob", () => {
    expect(selectFiles(["*.md"], SOURCE_PATHS)).toEqual(["README.md"]);
  });

  it("dedupes when multiple selectors match the same file", () => {
    expect(selectFiles(["LICENSE", "LICENSE", "*.md"], SOURCE_PATHS)).toEqual([
      "LICENSE",
      "README.md",
    ]);
  });

  it("returns empty when nothing matches", () => {
    expect(selectFiles(["nonexistent.txt"], SOURCE_PATHS)).toEqual([]);
  });

  it("does not match a directory name as a substring prefix", () => {
    // "src" must not match "srcfoo/..."
    const paths = ["srcfoo/a.ts", "src/b.ts"];
    expect(selectFiles(["src"], paths)).toEqual(["src/b.ts"]);
  });

  it("preserves source order", () => {
    expect(selectFiles([".github/", "LICENSE"], SOURCE_PATHS)).toEqual([
      "LICENSE",
      ".github/workflows/ci.yml",
      ".github/copilot-instructions.md",
    ]);
  });
});
