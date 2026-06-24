# Spec: Branch File Propagation Action (`lil-update-branches`)

## Objective

Provide a **reusable GitHub Action** that copies a selected set of files from a
single source branch to all other branches in the repository. The primary use
case is keeping shared, repo-wide files (license, contribution docs, editor and
CI configuration) consistent across every branch without manual cherry-picking.

**Users:** Repo maintainers who run the action from the GitHub **Actions** tab
(`workflow_dispatch`) or on a schedule/push. The action is referenced by other
repos/workflows via `uses: <owner>/lil-update-branches@<ref>`.

**Success looks like:** With one run, the configured files from the source
branch appear (added or overwritten) on every target branch. Branches that
cannot be updated (e.g. protected) are skipped and clearly reported, and the run
still succeeds.

## Tech Stack

- **TypeScript** GitHub Action (Node 24 runtime, `node24`).
- `@actions/core` (inputs/outputs/logging), `@actions/github` + `@octokit` (REST
  API for reading/writing branch contents and opening PRs).
- `@vercel/ncc` to bundle `dist/` for distribution.
- `minimatch` for glob matching of file selectors and branch include/exclude.
- **Jest** + `ts-jest` for unit tests.

> All operations go through the GitHub REST API (Git Data / Contents API) using a
> token, so the action does not require a checked-out working tree of every
> branch. This keeps it usable directly from the Actions tab.

## Commands

```
Install:  npm ci
Build:    npm run build      # tsc type-check + ncc bundle into dist/
Test:     npm test           # jest
Test+cov: npm test -- --coverage
Lint:     npm run lint       # eslint
Lint fix: npm run lint -- --fix
Package:  npm run package    # ncc build src/main.ts -o dist
All:      npm run all        # lint + build + test + package
```

## Project Structure

```
action.yml            → Action metadata: inputs, outputs, runs (node24, dist/index.js)
src/                  → TypeScript source
  main.ts             → Entry point: read inputs, orchestrate, set outputs
  inputs.ts           → Parse & validate inputs (defaults, glob lists)
  selector.ts         → Resolve file selectors (default list, paths, globs) -> file set
  branches.ts         → List target branches, apply include/exclude filters
  propagate.ts        → Per-branch: read source files, diff, push commit or open PR
  github.ts           → Thin Octokit wrapper (get tree/blob, create commit, push ref, open PR)
  report.ts           → Aggregate per-branch results, build summary + outputs
dist/                 → ncc-bundled output (committed, what the runtime executes)
__tests__/            → Jest unit tests mirroring src/
docs/spec.md          → This spec
README.md             → Usage + inputs/outputs reference
```

## Code Style

- Strict TypeScript (`strict: true`), no implicit `any`.
- Pure functions for logic (selection, filtering, diffing) so they unit-test
  without network; isolate Octokit calls behind `github.ts`.
- `camelCase` variables/functions, `PascalCase` types, `SCREAMING_SNAKE` consts.
- Throw typed errors for fatal config problems; collect per-branch failures into
  the report rather than throwing.

```typescript
export interface PropagationResult {
  branch: string;
  status: "updated" | "skipped" | "no-change" | "failed";
  changedFiles: string[];
  reason?: string; // populated when skipped/failed
}

export function selectFiles(
  selectors: string[],
  allSourcePaths: string[],
): string[] {
  // selectors may be exact paths, directory prefixes, or globs.
  return allSourcePaths.filter((p) =>
    selectors.some((s) => p === s || p.startsWith(`${s.replace(/\/$/, "")}/`) || minimatch(p, s)),
  );
}
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `source-branch` | no | repo default branch | Branch to copy files **from**. |
| `files` | no | see **Default file list** | Newline/comma-separated paths, directory prefixes, and/or globs to copy. When omitted, the default list is used. |
| `include-branches` | no | `*` (all) | Glob(s) of target branches to include. |
| `exclude-branches` | no | (none) | Glob(s) of target branches to exclude. Source branch is always excluded. |
| `mode` | no | `push` | `push` = commit directly to each target branch. `pr` = open a pull request per target branch. |
| `dry-run` | no | `false` | Compute and report planned changes; make no commits/pushes/PRs. |
| `commit-message` | no | `chore: sync shared files from {source-branch}` | Commit message (push mode and PR commits). |
| `pr-title` | no | `chore: sync shared files from {source-branch}` | PR title (pr mode). |
| `token` | no | `${{ github.token }}` | Token used for API/Git operations. Override for cross-repo or elevated perms. |

**Default file list** (used when `files` is empty):
`LICENSE`, `NOTICE`, `README.md`, `CONTRIBUTING.md`, `.vscode/`, `.devcontainer/`, `.github/`

## Outputs

| Output | Description |
|---|---|
| `updated-branches` | JSON array of branches that received changes. |
| `skipped-branches` | JSON array of `{branch, reason}` for skipped/failed branches. |
| `summary` | Human-readable summary (also written to the job step summary). |

## Behavior / Semantics

1. **Source resolution:** Use `source-branch`, else the repo's default branch.
   Read the file set from the source branch tip.
2. **File selection:** Expand selectors against the source tree. An entry ending
   in `/` (or naming a directory) copies all files **recursively** under it.
   Exact paths and globs supported. Selected files that don't exist on the source
   are ignored (with a notice).
3. **Target branches:** All branches except the source, then apply
   `include-branches` then `exclude-branches`.
4. **Per target branch:** Compare each selected source file to the target's
   version. If missing or different, stage it as add/overwrite (**source wins**).
   - **Copy/overwrite only** — never delete files on the target, even for
     directory selectors (no mirror/delete).
   - If nothing differs → `no-change`.
5. **Landing changes:**
   - `mode=push` (default): create one commit per target branch with all changed
     files and push to the branch.
   - `mode=pr`: create/update a branch and open a PR per target branch.
6. **Failure handling:** If a push/PR to a branch fails (e.g. branch protection),
   **skip that branch, record the reason, and continue.** The action does **not**
   fail the run for per-branch errors. It fails only on fatal config/auth errors.
7. **dry-run:** Perform read + diff, populate outputs/summary, perform no writes.

## Testing Strategy

- **Framework:** Jest + ts-jest. Tests in `__tests__/` mirroring `src/`.
- **Unit (primary):** Pure logic — `selectFiles`, branch include/exclude
  filtering, diff/change detection, report aggregation, input parsing/defaults.
  Octokit is mocked.
- **Integration (light):** `propagate.ts` against a mocked Octokit verifying the
  correct create-commit / push-ref / open-PR calls per branch and that failures
  are caught and reported.
- **Coverage:** Target ≥ 90% on logic modules (`selector`, `branches`,
  `inputs`, `report`).
- TDD: write the failing test before each logic module; for any bug, add a
  failing test first (Prove-It), then fix.

## Boundaries

- **Always:** Run `npm test` + `npm run build` before commit; validate inputs;
  exclude the source branch from targets; keep `dist/` in sync with `src/`.
- **Ask first:** Adding dependencies beyond those listed; changing default file
  list; changing default `mode`; adding delete/mirror behavior; CI config changes.
- **Never:** Commit secrets/tokens; delete files on target branches; fail the
  whole run because one branch is protected; remove failing tests to go green.

## Success Criteria

- [ ] `npm run all` passes (lint, type-check, build, tests) and produces `dist/`.
- [ ] Running with no inputs copies the default file list from the default branch
      to every other branch via direct push.
- [ ] `files` accepts exact paths, directory prefixes, and globs; directory
      entries copy recursively.
- [ ] `include-branches` / `exclude-branches` correctly filter targets; the
      source branch is never a target.
- [ ] Existing differing files on a target are overwritten with the source
      version; no target files are deleted.
- [ ] `mode=pr` opens one PR per target branch; `mode=push` (default) pushes
      directly.
- [ ] A protected/unwritable target branch is skipped and listed in
      `skipped-branches`; the run still succeeds.
- [ ] `dry-run=true` produces the same report with zero writes.
- [ ] Outputs `updated-branches`, `skipped-branches`, `summary` are populated and
      a job-summary is written.

## Resolved Decisions (formerly open questions)

1. **PR mode dedup:** Reuse/update an existing open PR using a stable head-branch
   name `sync-shared-files/<target>`. Re-runs update that branch and the existing
   PR rather than opening duplicates.
2. **Commit identity:** Default author is `github-actions[bot]`
   (`github-actions[bot]@users.noreply.github.com`). Author-name/email inputs may
   be added later if needed.
3. **Scheduled/triggered runs:** `README.md` includes an example workflow using
   `workflow_dispatch` (and an optional `schedule`).
