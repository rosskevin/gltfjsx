import { GLTF } from 'node-three-gltf'
// import globalJsdom from 'global-jsdom'
import { beforeEach, describe, expect, it } from 'vitest'

import { readGLTF } from '../readGLTF.js'
import { assertFileExists, models, resolveModelFile, types } from './fixtures.js'

describe('readGLTF', () => {
  for (const modelName of models) {
    describe(modelName, () => {
      for (const type of types) {
        const modelFile = resolveModelFile(modelName, type)

        describe(type, () => {
          beforeEach(() => {
            assertFileExists(modelFile)
          })

          function assertCommon(m: GLTF) {
            expect(m.animations).not.toBeNull()
            expect(m.scenes).not.toBeNull()
            expect(m.scene).not.toBeNull()
            expect(m.scene.children).not.toBeNull()
            expect(m.scene.children.length).toBeGreaterThan(0)
            expect(m.parser).not.toBeNull()
            expect(m.parser.json).not.toBeNull()
          }

          it('should read', async () => {
            const m = await readGLTF(modelFile)
            assertCommon(m)
          })
        })
      }
    })
  }
})
