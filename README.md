# Update Branches Action

A GitHub Action that copies a selected set of files from one **source branch** to
**all other branches** in the repository. Useful for keeping shared, repo-wide
files (license, contribution docs, editor/CI config) consistent across every
branch without manual cherry-picking.

## Default file list

Unless [otherwise specified](#file-selectors), these files and folders are copied:

```
LICENSE
NOTICE
README.md
CONTRIBUTING.md
.vscode/
.devcontainer/
.github/
```

## Usage

```yaml
name: Sync shared files

on:
  workflow_dispatch:
  # Optional: run on a schedule
  # schedule:
  #   - cron: "0 6 * * 1"   # every Monday 06:00 UTC

permissions:
  contents: write       # required for push mode
  pull-requests: write  # required for pr mode

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: LinkedInLearning/lil-update-branches@v1
        with:
          # All inputs are optional; defaults shown below.
          source-branch: ""            # default: repository default branch
          files: ""                    # default: see "Default file list"
          include-branches: "*"
          exclude-branches: ""
          mode: push                   # or "pr"
          dry-run: "false"
```

### Open pull requests instead of pushing

```yaml
      - uses: LinkedInLearning/lil-update-branches@v1
        with:
          mode: pr
```

In `pr` mode the action maintains a stable head branch
`sync-shared-files/<target-branch>` per target and reuses/updates an existing
open PR on re-runs instead of opening duplicates.

### Preview changes (dry-run)

```yaml
      - uses: LinkedInLearning/lil-update-branches@v1
        with:
          dry-run: "true"
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `source-branch` | no | repo default branch | Branch to copy files **from**. |
| `files` | no | _(default list below)_ | Newline/comma-separated paths, directory prefixes, and/or globs to copy. |
| `include-branches` | no | `*` | Glob(s) of target branches to include. |
| `exclude-branches` | no | _(none)_ | Glob(s) of target branches to exclude. The source branch is always excluded. |
| `mode` | no | `push` | `push` = commit directly to each branch. `pr` = open a pull request per branch. |
| `dry-run` | no | `false` | Compute and report planned changes without writing. |
| `commit-message` | no | `chore: sync shared files from {source-branch}` | Commit message. `{source-branch}` is substituted. |
| `pr-title` | no | `chore: sync shared files from {source-branch}` | PR title (pr mode). `{source-branch}` is substituted. |
| `token` | no | `${{ github.token }}` | Token used for API/Git operations. Override for cross-repo or elevated permissions. |

### File selectors

Each entry in `files` may be:

- an **exact path** — e.g. `LICENSE`
- a **directory prefix** — e.g. `.github/` or `src` (copies everything under it, recursively)
- a **glob** — e.g. `**/*.md`, `*.yml`

Example:

```yaml
with:
  files: |
    LICENSE
    .github/
    docs/**/*.md
```

## Outputs

| Output | Description |
|---|---|
| `updated-branches` | JSON array of branches that received changes. |
| `skipped-branches` | JSON array of `{ branch, reason }` for skipped/failed branches. |
| `summary` | Human-readable summary (also written to the job step summary). |

## Permissions

- `mode: push` requires `contents: write`.
- `mode: pr` requires `contents: write` and `pull-requests: write`.

Branch protection rules may block direct pushes; in that case the affected
branches are reported under `skipped-branches` and the run still succeeds. Use
`mode: pr` for protected branches.

## Development

```bash
npm ci          # install
npm test        # run unit tests (Jest)
npm run lint    # eslint
npm run build   # type-check + bundle dist/
npm run all     # lint + type-check + test + bundle
```

The committed `dist/` bundle is what the runtime executes — always run
`npm run all` and commit `dist/` after changing `src/`.

## License

[LinkedIn Learning Exercise Files License Agreement](LICENSE)
