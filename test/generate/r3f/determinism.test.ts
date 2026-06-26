import { DRACOLoader } from 'node-three-gltf'
import type { Object3D } from 'three'
import { describe, expect, it } from 'vitest'

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
  types,
} from '../../fixtures.ts'

const modelName = 'FlightHelmet'

/**
 * The three.js GLTFLoader builds the scene hierarchy asynchronously and appends each child to its
 * parent in promise-resolution order, not glTF child-index order. For complex models (draco/texture
 * decode) siblings resolve out of order, so `scene.children` arrays come back in a different order on
 * every load. Both the generated GLTF interface and the JSX tree derive from that order, so the output
 * shuffled run-to-run. These tests pin the generator to be invariant to sibling order.
 */
async function generateTsx(modelFile: string, type: string, mutate?: (scene: Object3D) => void) {
  const dracoLoader = new DRACOLoader()
  try {
    const model = await loadGLTF(modelFile, dracoLoader)
    mutate?.(model.scene)
    const options: GenerateOptions = fixtureGenerateOptions({
      componentName: modelName,
      draco: type.includes('draco'),
      instanceall: type.includes('instanceall'),
      keepnames: true,
      modelLoadPath: resolveModelLoadPath(modelFile, '/public/models'),
      shadows: true,
    })
    const a = new AnalyzedGLTF(model, fixtureAnalyzeOptions(options))
    return await new GenerateR3F(a, options).toTsx()
  } finally {
    dracoLoader.dispose()
  }
}

function reverseChildrenDeep(o: Object3D) {
  o.children.reverse()
  o.children.forEach(reverseChildrenDeep)
}

describe('determinism', () => {
  for (const type of types) {
    const modelFile = resolveFixtureModelFile(modelName, type)

    // The loader's sibling order is arbitrary, so reversing it must not change the output. Loading twice
    // (normal + reversed) and asserting byte-identity deterministically reproduces the bug regardless of
    // load timing — a stronger, cheaper check than repeating identical loads and hoping the order diverges.
    it(`is invariant to scene-graph sibling order [${type}]`, async () => {
      assertFileExists(modelFile)
      const normal = await generateTsx(modelFile, type)
      const reversed = await generateTsx(modelFile, type, reverseChildrenDeep)
      expect(reversed).toEqual(normal)
    })
  }
})
