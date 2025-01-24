import { GLTF } from 'node-three-gltf'
import { beforeEach, describe, expect, it } from 'vitest'

import { Log } from '../../Log.js'
import { createR3FComponent } from '../../r3f/createR3FComponent.js'
import { readGLTF } from '../../readGLTF.js'
import { resolveModelLoadPath } from '../../utils/files.js'
import {
  assertFileExists,
  defaultJsxOptions,
  models,
  resolveModelFile,
  types,
} from '../fixtures.js'

const log = new Log({ silent: false, debug: false })

describe('createR3FComponent', () => {
  for (const modelName of models) {
    describe(modelName, () => {
      for (const type of types) {
        const modelFile = resolveModelFile(modelName, type)

        describe(type, () => {
          beforeEach(() => {
            assertFileExists(modelFile)
          })

          function assertCommon(m: GLTF) {
            // FIXME
            expect(m.animations).not.toBeNull()
            expect(m.scenes).not.toBeNull()
            expect(m.scene).not.toBeNull()
            expect(m.scene.children).not.toBeNull()
            expect(m.scene.children.length).toBeGreaterThan(0)
            expect(m.parser).not.toBeNull()
            expect(m.parser.json).not.toBeNull()
          }

          it('should createR3FComponent', async () => {
            const m = await readGLTF(modelFile)
            const options = defaultJsxOptions({
              log,
              componentName: modelName,
              header: 'FOO header',
              modelLoadPath: resolveModelLoadPath(modelFile, '/public/models'),
              types: true,
              keepnames: true,
              shadows: true,
            })
            const jsx = await createR3FComponent(m, options)
            console.log(jsx)
            assertCommon(m)
          })
        })
      }
    })
  }
})
