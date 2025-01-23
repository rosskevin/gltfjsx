import { GLTF } from 'node-three-gltf'
import { beforeEach, describe, expect, it } from 'vitest'

import { LogFn } from '../options.js'
import { createR3FComponent } from '../r3f/createR3FComponent.js'
import { readGLTF } from '../readGLTF.js'
import { resolveModelLoadPath } from '../utils/files.js'
import { assertFileExists, defaultJsxOptions, models, resolveModelFile, types } from './fixtures.js'

const log: LogFn = (args: any[]) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  console.info('log:', ...args)
}

describe('createJsx', () => {
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

          it('should createJsx', async () => {
            const m = await readGLTF(modelFile)
            const options = defaultJsxOptions({
              log,
              componentName: modelName,
              header: 'FOO header',
              modelLoadPath: resolveModelLoadPath(modelFile, '/public/models'),
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
