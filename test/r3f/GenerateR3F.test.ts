import { GLTF } from 'node-three-gltf'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  AnalyzedGLTF,
  GeneratedR3F,
  GenerateOptions,
  loadGLTF,
  resolveModelLoadPath,
} from '../../src/index.js'
import {
  assertFileExists,
  fixtureGenerateOptions,
  models,
  resolveFixtureModelFile,
  types,
} from '../fixtures.js'

describe('GenerateR3F', () => {
  for (const modelName of models) {
    describe(modelName, () => {
      for (const type of types) {
        const modelFile = resolveFixtureModelFile(modelName, type)

        describe(type, () => {
          let model: GLTF
          let options: GenerateOptions
          let a: AnalyzedGLTF

          beforeEach(async () => {
            assertFileExists(modelFile)
            model = await loadGLTF(modelFile)
            options = fixtureGenerateOptions({
              componentName: modelName,
              draco: type.includes('draco'),
              header: 'FOO header',
              modelLoadPath: resolveModelLoadPath(modelFile, '/public/models'),
              // types: true,
              keepnames: true,
              shadows: true,
              instanceall: type.includes('instanceall'),
            })
            a = new AnalyzedGLTF(model, options)
          })

          function assertCommon(g: GeneratedR3F) {
            expect(g.project).not.toBeNull()
            expect(g.src).not.toBeNull()
            expect(g.gltfInterface).not.toBeNull()
            expect(g.propsInterface).not.toBeNull()
            expect(g.instancesFn).not.toBeNull()
            expect(g.fn).not.toBeNull()
            expect(g.groupRoot).not.toBeNull()
          }

          it('should generate', async () => {
            const g = new GeneratedR3F(a, options)

            assertCommon(g)
            const tsx = await g.toTsx()
            console.log(tsx)
            const jsx = await g.toJsx()

            for (const code of [tsx, jsx]) {
              expect(tsx).toContain('FOO header')

              if (type.includes('instanceall')) {
                expect(tsx).toContain('<Merged')
                expect(tsx).toContain('const instances = React.useMemo(')
                expect(tsx).toMatch(/<instances\..*castShadow/)
                expect(tsx).toMatch(/<instances\..*receiveShadow/)
              } else {
                expect(tsx).toMatch(/castShadow/)
                expect(tsx).toMatch(/receiveShadow/)
              }
            }
          })

          it('should generate mapped prop for Object3D to[]', async () => {
            const mo: GenerateOptions = {
              ...options,
              mapComponentProps: {
                shadows: {
                  to: ['castShadow', 'receiveShadow'],
                  structure: {
                    type: 'boolean',
                    hasQuestionToken: true,
                  },
                },
              },
            }
            const g = new GeneratedR3F(a, mo)
            assertCommon(g)
            const tsx = await g.toTsx()
            console.log(tsx)
            const jsx = await g.toJsx()

            for (const code of [tsx, jsx]) {
              if (type.includes('instanceall')) {
                expect(tsx).toContain('<Merged')
                expect(tsx).toContain('const instances = React.useMemo(')
                expect(tsx).toMatch(/<instances\..*castShadow=\{shadows\}/)
                expect(tsx).toMatch(/<instances\..*receiveShadow=\{shadows\}/)
              } else {
                expect(tsx).toMatch(/castShadow=\{shadows\}/)
                expect(tsx).toMatch(/receiveShadow=\{shadows\}/)
              }
            }
          })
        })
      }
    })
  }
})
