import { GLTF } from 'node-three-gltf'
import { beforeEach, describe, expect, it } from 'vitest'

import { AnalyzedGLTF } from '../../analyze/AnalyzedGLTF.js'
import { isGroup } from '../../analyze/is.js'
import { Log } from '../../Log.js'
import { readGLTF } from '../../readGLTF.js'
import { assertFileExists, models, resolveFixtureModelFile, types } from '../fixtures.js'

const log = new Log({ silent: false, debug: true })

describe('AnalyzedGLTF', () => {
  for (const modelName of models) {
    describe(modelName, () => {
      for (const type of types) {
        const modelFile = resolveFixtureModelFile(modelName, type)

        describe(type, () => {
          let m: GLTF
          let a: AnalyzedGLTF

          beforeEach(async () => {
            assertFileExists(modelFile)
            m = await readGLTF(modelFile)
            a = new AnalyzedGLTF(m, {
              log,
            })
          })

          it('should construct', async () => {
            expect(m.animations).not.toBeNull()
            expect(m.scenes).not.toBeNull()
            expect(m.scene).not.toBeNull()
            expect(m.scene.children).not.toBeNull()
            expect(m.scene.children.length).toBeGreaterThan(0)
            expect(m.parser).not.toBeNull()
            expect(m.parser.json).not.toBeNull()
          })

          describe('includes', () => {
            it('should work', async () => {
              expect(a.includes(isGroup)).toBe(false)
            })
          })
        })
      }
    })
  }
})
