import fs from 'node:fs'
import * as path from 'node:path'

import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { beforeEach, describe, expect, it } from 'vitest'

import { readGLTF } from '../readGLTF.js'

const types = [
  'gltf',
  // 'gtlf-transform-meshopt'
  //
]

describe('readGLTF', () => {
  for (const modelName of ['FlightHelmet']) {
    describe(modelName, () => {
      for (const type of types) {
        const extension = type === 'gltf' ? 'gltf' : 'glb'

        const modelFile = path.join(
          path.dirname(new URL(import.meta.url).pathname), // this dir
          `./models/${modelName}/${type}/${modelName}.${extension}`,
        )
        describe(type, () => {
          beforeEach(() => {
            expect(fs.existsSync(modelFile), `File not found: ${modelFile}`).toBe(true)
          })

          function assertCommon(m: GLTF) {
            expect(m.scene).not.toBeNull()
            expect(m.animations).not.toBeNull()
            expect(m.parser).not.toBeNull()
            expect(m.parser.json).not.toBeNull()
          }

          it.concurrent('should read', async () => {
            const m = await readGLTF(modelFile)
            assertCommon(m)
          })
        })
      }
    })
  }
})
