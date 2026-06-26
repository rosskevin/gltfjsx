/**
 * Regression tests for fiber v9 / drei v10 / React 19 compatibility in generated output.
 *
 * fiber v9 removed the per-element prop type aliases (GroupProps, MeshProps, etc.) as named exports.
 * They are now accessed via ThreeElements['group'] / ThreeElements['mesh'].
 * Additionally, useGLTF's return type in drei v10 is GLTF & ObjectMap, so casting to a narrower type
 * requires `as unknown as XxxGLTF` (double cast) rather than a direct `as XxxGLTF`.
 *
 * The FlightHelmet fixture is a plain mesh model (no bones/lights/animations), so the primitives/skeleton
 * and animations template branches are not produced by the standard fixtures. Those branches are forced
 * here (subclass override for primitives; an injected AnimationClip for animations) so their cast sites and
 * three imports are exercised, not just grep-verified.
 */

import { DRACOLoader, type GLTF } from 'node-three-gltf'
import { AnimationClip } from 'three'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  AnalyzedGLTF,
  type GenerateOptions,
  GenerateR3F,
  loadGLTF,
  resolveModelLoadPath,
} from '../../../src/index.ts'
import {
  assertFileExists,
  fixtureAnalyzeOptions,
  fixtureGenerateOptions,
  resolveFixtureModelFile,
} from '../../fixtures.ts'

const modelName = 'FlightHelmet'

// A single `as <Name>GLTF` cast that is NOT preceded by `as unknown` — i.e. the too-strict drei-v10 form.
// Matches `) as FooGLTF` but not `) as unknown as FooGLTF`, so it flags a regression at any cast site
// (useGLTF or useGraph), not only the ones a given fixture happens to emit.
const singleGltfCast = /\)\s+as\s+(?!unknown\b)\w+GLTF/

describe('fiber v9 compatibility', () => {
  describe(modelName, () => {
    const type = 'gltf'
    const modelFile = resolveFixtureModelFile(modelName, type)

    let model: GLTF
    let options: GenerateOptions
    let a: AnalyzedGLTF
    let dracoLoader: DRACOLoader

    beforeAll(async () => {
      dracoLoader = new DRACOLoader()
      assertFileExists(modelFile)
      model = await loadGLTF(modelFile, dracoLoader)
      options = fixtureGenerateOptions({
        componentName: modelName,
        draco: false,
        keepnames: true,
        modelLoadPath: resolveModelLoadPath(modelFile, '/public/models'),
      })
      a = new AnalyzedGLTF(model, fixtureAnalyzeOptions(options))
    })

    afterAll(() => {
      dracoLoader.dispose()
    })

    describe('Breakage A — removed fiber type exports', () => {
      // fiber v9 removed GroupProps, MeshProps (and the whole element-prop alias family) as named exports.
      // The generator must import `type { ThreeElements }` instead and use ThreeElements['group'] /
      // ThreeElements['mesh'] in the generated component.
      it.concurrent('should not import GroupProps or MeshProps from @react-three/fiber', async () => {
        const g = new GenerateR3F(a, options)
        const tsx = await g.toTsx()

        expect(tsx).not.toMatch(/import[^;]*GroupProps[^;]*from\s+['"]@react-three\/fiber['"]/)
        expect(tsx).not.toMatch(/import[^;]*MeshProps[^;]*from\s+['"]@react-three\/fiber['"]/)
      })

      it.concurrent('should use ThreeElements to derive element prop types', async () => {
        const g = new GenerateR3F(a, options)
        const tsx = await g.toTsx()

        expect(tsx).toContain('ThreeElements')
        expect(tsx).toMatch(/ThreeElements\[['"]group['"]\]/)
      })

      it.concurrent('should use ThreeElements for ContextType in instanceall variant', async () => {
        const instanceAllFile = resolveFixtureModelFile(
          modelName,
          'gltf-transform-draco-instanceall',
        )
        assertFileExists(instanceAllFile)
        const instanceModel = await loadGLTF(instanceAllFile, dracoLoader)
        const instanceOptions = fixtureGenerateOptions({
          componentName: modelName,
          draco: true,
          instanceall: true,
          keepnames: true,
          modelLoadPath: resolveModelLoadPath(instanceAllFile, '/public/models'),
        })
        const ia = new AnalyzedGLTF(instanceModel, fixtureAnalyzeOptions(instanceOptions))
        const g = new GenerateR3F(ia, instanceOptions)
        const tsx = await g.toTsx()

        expect(tsx).not.toMatch(/import[^;]*MeshProps[^;]*from\s+['"]@react-three\/fiber['"]/)
        // ContextType record should use ThreeElements['mesh'] not MeshProps
        expect(tsx).toMatch(/ThreeElements\[['"]mesh['"]\]/)
      })
    })

    describe('Breakage B — useGLTF cast too strict', () => {
      // drei v10 useGLTF returns GLTF & ObjectMap whose nodes/materials are index signatures of the
      // base types (Object3D / Material). A direct `as XxxGLTF` cast fails TS2352 because neither
      // type sufficiently overlaps with the other. The fix is `as unknown as XxxGLTF`.
      it.concurrent('should cast useGLTF result with double cast (as unknown as)', async () => {
        const g = new GenerateR3F(a, options)
        const tsx = await g.toTsx()

        expect(tsx).toMatch(/useGLTF\([^)]+\)\s+as\s+unknown\s+as\s+\w+GLTF/)
        expect(tsx).not.toMatch(singleGltfCast)
      })
    })

    describe('Primitives/skeleton path — useGraph + useGLTF casts', () => {
      // FlightHelmet has no bones/lights, so the primitives branch (which adds the SkeletonUtils.clone +
      // useGraph path) is never produced by the fixtures. Force it so both of its cast sites are exercised:
      // a regression to a single cast at either useGLTF or useGraph would otherwise pass undetected.
      class ForcedPrimitivesGenerateR3F extends GenerateR3F {
        protected override hasPrimitives() {
          return true
        }
      }

      it.concurrent('should double-cast both useGLTF and useGraph', async () => {
        const g = new ForcedPrimitivesGenerateR3F(a, options)
        const tsx = await g.toTsx()

        expect(tsx).toMatch(/useGLTF\([^)]+\)\s+as\s+unknown\s+as\s+\w+GLTF/)
        expect(tsx).toMatch(/useGraph\([^)]+\)\s+as\s+unknown\s+as\s+\w+GLTF/)
        expect(tsx).not.toMatch(singleGltfCast)
      })

      it.concurrent('should handle primitives + animations together', async () => {
        const animModel = await loadGLTF(modelFile, dracoLoader)
        animModel.animations.push(new AnimationClip('Idle', 1, []))
        const animOptions = fixtureGenerateOptions({
          componentName: modelName,
          draco: false,
          keepnames: true,
          modelLoadPath: resolveModelLoadPath(modelFile, '/public/models'),
        })
        const animA = new AnalyzedGLTF(animModel, fixtureAnalyzeOptions(animOptions))
        const g = new ForcedPrimitivesGenerateR3F(animA, animOptions)
        const tsx = await g.toTsx()

        // primitives branch destructures `animations, scene` from the single useGLTF, then useGraph for the rest
        expect(tsx).toMatch(
          /const\s*\{\s*animations,\s*scene\s*\}\s*=\s*useGLTF\([^)]+\)\s+as\s+unknown\s+as\s+\w+GLTF/,
        )
        expect(tsx).toMatch(/useGraph\([^)]+\)\s+as\s+unknown\s+as\s+\w+GLTF/)
        expect(tsx).toMatch(/useAnimations\(animations,/)
        expect(tsx).toMatch(/useRef<Group>\(null\)/)
        expect(tsx).not.toMatch(singleGltfCast)
      })
    })

    describe('Animations path — Group import + React 19 useRef', () => {
      // The animations branch references Group and React.useRef<Group>(). Under named three imports Group
      // must be imported (else TS2304), and React 19 removed the zero-arg useRef overload (else TS2554).
      // FlightHelmet has no animations, so inject a clip to produce the branch.
      it.concurrent('should import Group and call useRef<Group>(null)', async () => {
        const animModel = await loadGLTF(modelFile, dracoLoader)
        animModel.animations.push(new AnimationClip('Idle', 1, []))
        const animOptions = fixtureGenerateOptions({
          componentName: modelName,
          draco: false,
          keepnames: true,
          modelLoadPath: resolveModelLoadPath(modelFile, '/public/models'),
        })
        const animA = new AnalyzedGLTF(animModel, fixtureAnalyzeOptions(animOptions))
        const g = new GenerateR3F(animA, animOptions)
        const tsx = await g.toTsx()

        expect(tsx).toMatch(/import\s*\{[^}]*\bGroup\b[^}]*\}\s*from\s*['"]three['"]/)
        expect(tsx).toMatch(/useRef<Group>\(null\)/)
        // animations path still goes through the standard useGLTF cast site
        expect(tsx).not.toMatch(singleGltfCast)
      })
    })

    describe('Instanceall + animations path — animations must be declared', () => {
      // The instances branch sources geometry from React.useContext(context), not useGLTF, so it does not
      // destructure `animations`. With animations present, useAnimations(animations, ...) would reference an
      // undeclared name (TS2304). The clips must come from the (suspense-cached) useGLTF in the same scope.
      it.concurrent('should destructure animations from useGLTF in the instances branch', async () => {
        const instanceAllFile = resolveFixtureModelFile(
          modelName,
          'gltf-transform-draco-instanceall',
        )
        assertFileExists(instanceAllFile)
        const instanceModel = await loadGLTF(instanceAllFile, dracoLoader)
        instanceModel.animations.push(new AnimationClip('Idle', 1, []))
        const instanceOptions = fixtureGenerateOptions({
          componentName: modelName,
          draco: true,
          instanceall: true,
          keepnames: true,
          modelLoadPath: resolveModelLoadPath(instanceAllFile, '/public/models'),
        })
        const ia = new AnalyzedGLTF(instanceModel, fixtureAnalyzeOptions(instanceOptions))
        const g = new GenerateR3F(ia, instanceOptions)
        const tsx = await g.toTsx()

        expect(tsx).toMatch(
          /const\s*\{\s*animations\s*\}\s*=\s*useGLTF\([^)]+\)\s+as\s+unknown\s+as\s+\w+GLTF/,
        )
        expect(tsx).toMatch(/useAnimations\(animations,/)
        expect(tsx).not.toMatch(singleGltfCast)
      })
    })
  })
})
