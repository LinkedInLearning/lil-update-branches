import { minimatch } from "minimatch";

function dirPrefix(selector: string): string {
  return selector.replace(/\/+$/, "");
}

function isGlob(selector: string): boolean {
  return /[*?[\]{}!]/.test(selector);
}

/**
 * Resolve file selectors against the list of source file paths.
 * A selector may be:
 *  - an exact path (e.g. "LICENSE")
 *  - a directory prefix (e.g. ".github/" or "src") -> all files recursively under it
 *  - a glob (e.g. "**\/*.png", "*.md")
 *
 * Results preserve the order of `allSourcePaths` and are de-duplicated.
 */
export function selectFiles(selectors: string[], allSourcePaths: string[]): string[] {
  const matched: string[] = [];

  for (const path of allSourcePaths) {
    const isMatch = selectors.some((selector) => {
      if (isGlob(selector)) {
        return minimatch(path, selector, { dot: true });
      }
      if (path === selector) {
        return true;
      }
      const prefix = dirPrefix(selector);
      return prefix.length > 0 && path.startsWith(`${prefix}/`);
    });

    if (isMatch) {
      matched.push(path);
    }
  }

  return matched;
}
