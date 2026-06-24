/**
 * Convert a branch glob to a RegExp where `*` and `?` cross path separators.
 * Branch names (e.g. "feature/a") are treated as plain strings, so "*" matches
 * everything and "feature/*" matches "feature/a".
 */
function branchGlobToRegExp(glob: string): RegExp {
  let out = "^";
  for (const ch of glob) {
    if (ch === "*") {
      out += ".*";
    } else if (ch === "?") {
      out += ".";
    } else {
      out += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  out += "$";
  return new RegExp(out);
}

function matchesAny(branch: string, globs: string[]): boolean {
  return globs.some((g) => branchGlobToRegExp(g).test(branch));
}

/**
 * Determine the set of target branches to propagate to.
 * - Always excludes the source branch.
 * - Applies include globs (empty list or "*" means match-all).
 * - Then applies exclude globs.
 * Order of `allBranches` is preserved.
 */
export function filterTargetBranches(
  allBranches: string[],
  sourceBranch: string,
  includeGlobs: string[],
  excludeGlobs: string[],
): string[] {
  const includes = includeGlobs.length === 0 ? ["*"] : includeGlobs;

  return allBranches.filter((branch) => {
    if (branch === sourceBranch) {
      return false;
    }
    if (!matchesAny(branch, includes)) {
      return false;
    }
    return !matchesAny(branch, excludeGlobs);
  });
}
