import fs from 'node:fs'
import * as path from 'node:path'
import { afterEach } from 'node:test'

// import globalJsdom from 'global-jsdom'
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

        // let cleanup: { (): void } | undefined
        describe(type, () => {
          beforeEach(() => {
            // cleanup = globalJsdom()
            expect(fs.existsSync(modelFile), `File not found: ${modelFile}`).toBe(true)
          })

          afterEach(() => {
            // cleanup?.()
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
