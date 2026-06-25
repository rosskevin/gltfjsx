# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`@rosskevin/gltfjsx` — a CLI + library that converts GLTF/GLB 3D models into React Three Fiber (R3F) component source (`.tsx`/`.jsx`). Published to npm as an ESM-only package; the `bin` is `dist/cli.mjs`. It is a (intended-to-be-temporary) fork of [`pmndrs/gltfjsx`](https://github.com/pmndrs/gltfjsx) — see `README.md`. PRs are expected to include tests.

## Commands

- `pnpm build` — bundle with tsdown → `dist/*.mjs` + `.d.mts` (the CLI shebang and executable bit are handled automatically).
- `pnpm check` — the full gate, runs in parallel: `check-types` (`tsc --noEmit`), `check-biome` (`biome check --write`), `check-circular` (madge), `check-markdown`, and `test`. Run this before considering work done.
- `pnpm test` — Vitest (single run, non-watch).
  - Single file: `pnpm exec vitest run test/generate/r3f/exposeProps.test.ts`
  - By name: `pnpm exec vitest run -t "should generate to (singular)"`
  - Watch: `pnpm exec vitest`
- `pnpm check-biome` — **auto-fixes/reformats on every run** (`--write`). Re-read any file after running it; only hand-fix what survives.
- `pnpm release` — `auto shipit` (CI only).

Package manager is **pnpm 11** (pinned via `packageManager`; pnpm 10 self-upgrades to it). Installs enforce a 7-day supply-chain cooldown (`pnpm-workspace.yaml` `minimumReleaseAge`); `.ncurc.cjs` mirrors it so `ncu` never suggests an update the install would refuse. Native build scripts are allow-listed in `pnpm-workspace.yaml` `allowBuilds`.

## Architecture

`cli.ts` `main(modelFile, cliOptions)` orchestrates a four-stage pipeline. `main()` is the **programmatic entry point** — it is deliberately separated from CLI argument parsing (meow) and exported so tests and external consumers can drive the pipeline directly:

1. **transform** (optional; `-T/-i/-I`) — `transform/gltfTransform.ts` runs `@gltf-transform/*` to optimize the model (draco/meshopt, texture compression, instancing, mesh/material joining, simplification), writing `<name>-transformed.glb`.
2. **load** — `load/loadGLTF.ts` parses the (possibly transformed) model into a three.js `GLTF` via `node-three-gltf`, with an optional `DRACOLoader`.
3. **analyze** — `analyze/AnalyzedGLTF.ts` dedupes materials/geometries and prunes the scene graph. **This stage is deliberately framework-agnostic** — it knows nothing about R3F. Pruning is strategy-based (`analyze/pruneStrategies.ts`); type guards live in `analyze/is.ts`.
4. **generate** — `generate/r3f/GenerateR3F.ts` consumes the `AnalyzedGLTF` and emits the R3F component via `toTsx()`/`toJsx()`.

The analyze/generate split is the key architectural seam: analysis is reusable, output is target-specific (only R3F exists today, under `generate/r3f/`).

### Generation (ts-morph + Biome)

`GenerateR3F extends AbstractGenerate` (`generate/AbstractGenerate.ts`). Generation is a **hybrid**: a string template (`getTemplate()`) seeds a ts-morph `SourceFile`, then protected/overridable methods manipulate the AST. Both subclassing and external manipulation of the ts-morph `SourceFile` are supported customization points. Use <https://ts-ast-viewer.com> to understand the AST.

Generated code is formatted at runtime by **Biome's WASM API** (`@biomejs/js-api/nodejs` + `@biomejs/wasm-nodejs`), via a module-level singleton in `AbstractGenerate.ts`. The formatter config is applied **inline** (`applyConfiguration`) so it is isolated from any `biome.json` in the user's working directory — do not assume cwd config affects output. (This replaced a prior runtime dependency on prettier; there is no prettier dependency anymore.)

### Options model

Options are layered interfaces in `options.ts`: `BaseOptions` → `TransformOptions` / `PropsOptions` → `AnalyzedGLTFOptions` / `GenerateOptions`, unified into `CliOptions`. The pipeline classes are generic over their options type (`AnalyzedGLTF<O extends AnalyzedGLTFOptions>`, `GenerateR3F<O extends GenerateOptions>`) to allow typed extension. `exposeProps` is a notable feature: it exposes a component-level prop and propagates it to matching `Object3D` props (e.g. `shadows` → `castShadow`/`receiveShadow`) using `Matcher` functions.

## Conventions

- **ESM-only**; relative imports use the `.ts` extension, not `.js` (`allowImportingTsExtensions` is enabled via `@alienfast/tsconfig`). Match the surrounding files.
- Biome (config: `biome.jsonc`, extends `@alienfast/biome-config/base`) is the linter/formatter — no ESLint/Prettier. A few rules are intentionally disabled with documented reasons (e.g. `noStaticOnlyClass` for the `NodeUtils`/`PropertyUtils` curry-driven static utilities).
- `check-circular` uses `.madgerc` with `skipTypeImports: true` — it flags only real runtime cycles; type-only import cycles are ignored.

## Testing

Tests exercise the **real pipeline** against the `FlightHelmet` fixture under `test/models/`, across model variants (`gltf`, `gltf-transform-draco`, `gltf-transform-meshopt`, `gltf-transform-draco-instanceall`) resolved via `test/fixtures.ts`. Assertions are largely regex / `toContain` checks against the generated TSX/JSX **string**, so they are sensitive to output formatting — when changing the generator or formatter, verify the generated component is still correct rather than assuming a failed match means a regression.
