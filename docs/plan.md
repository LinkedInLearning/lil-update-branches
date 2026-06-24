# Implementation Plan: `lil-update-branches`

Derived from `docs/spec.md`. Built test-first, in dependency order. Each phase
ends with a verification checkpoint.

## Components & Dependencies

```
inputs.ts ─┐
selector.ts┤── main.ts ── report.ts
branches.ts┘        │
github.ts ──────────┘ (network boundary, mocked in tests)
propagate.ts ── uses github.ts + selector diff
```

- **Pure logic (no network, unit-tested first):** `inputs.ts`, `selector.ts`,
  `branches.ts`, `report.ts`.
- **Network boundary (mocked):** `github.ts`.
- **Orchestration:** `propagate.ts`, `main.ts`.

## Implementation Order

### Phase 0 — Scaffolding
Project setup so tests can run. Files: `package.json`, `tsconfig.json`,
`jest.config.js`, `.eslintrc`, `action.yml` (skeleton), `.gitignore`.
- **Verify:** `npm ci`, `npm test` (no tests yet → passes/empty), `npm run build`.

### Phase 1 — Pure logic (parallelizable, TDD)
Can be built in parallel; no interdependencies.
- `inputs.ts` — parse/validate inputs, apply defaults (incl. default file list).
- `selector.ts` — `selectFiles(selectors, paths)`: exact/dir-prefix/glob, recursive dirs.
- `branches.ts` — target filtering: exclude source, apply include/exclude globs.
- `report.ts` — aggregate `PropagationResult[]` → outputs + summary.
- **Verify:** `npm test -- --coverage`, ≥90% on these modules.

### Phase 2 — GitHub boundary
- `github.ts` — Octokit wrapper: get default branch, list branches, read tree/blobs
  for source files, get target file content, create commit & update ref (push),
  create/update sync branch + open/update PR.
- **Verify:** Unit tests with a mocked Octokit assert correct API call shapes.

### Phase 3 — Propagation orchestration
- `propagate.ts` — per branch: read source files, diff vs target (source wins,
  no deletes), then push or PR; catch per-branch errors → `failed`/`skipped`.
  Honor `dry-run`.
- **Verify:** Tests with mocked `github.ts` cover updated / no-change / skipped /
  failed / dry-run paths and PR dedup (`sync-shared-files/<target>`).

### Phase 4 — Entry point & metadata
- `main.ts` — wire inputs → orchestration → outputs + job summary.
- `action.yml` — finalize inputs/outputs/`runs: node24 dist/index.js`.
- **Verify:** `npm run package`; `main.ts` smoke test with everything mocked.

### Phase 5 — Packaging & docs
- Bundle `dist/` via ncc; write `README.md` (usage, inputs/outputs table, example
  `workflow_dispatch`/`schedule` workflow).
- **Verify:** `npm run all` green; `dist/` committed and in sync with `src/`.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Branch protection blocks pushes | Per-branch try/catch → skip + report; never fail run. |
| Large repos / many branches (API rate limits) | Read source tree/blobs once; reuse across targets; only write changed files. |
| `dist/` drifts from `src/` | `npm run all` rebuilds; document in Boundaries; (optional CI check later). |
| Binary files (e.g. in `.vscode/`) | Use blob SHA comparison + base64 content via Contents/Git Data API, not text diff. |
| Directory selector recursion correctness | Dedicated unit tests for dir-prefix expansion. |

## Parallelization

- Phase 1 modules can be implemented in parallel.
- Phases 2→3→4 are sequential (each depends on the prior).

## Verification Checkpoints

- After Phase 1: logic coverage ≥90%, all unit tests green.
- After Phase 3: full orchestration paths covered with mocked network.
- After Phase 5: `npm run all` green, `dist/` built, README complete, all
  spec Success Criteria checked.
