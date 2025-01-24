import { GLTF } from 'node-three-gltf'
import { beforeEach, describe, expect, it } from 'vitest'

import { AnalyzedGLTF } from '../../analyze/AnalyzedGLTF.js'
import { pruneAnalyzedGLTF } from '../../analyze/prune.js'
import { LogFn } from '../../options.js'
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

const log: LogFn = (args: any[]) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  console.info('log:', ...args)
}

describe('prune', () => {
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

          it('should prune', async () => {
            const m = await readGLTF(modelFile)

            const a = new AnalyzedGLTF(m, {
              instance: false,
              instanceall: false,
            })

            pruneAnalyzedGLTF(a, { bones: false, debug: true })

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
