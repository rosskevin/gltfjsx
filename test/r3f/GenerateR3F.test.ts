import { GLTF } from 'node-three-gltf'
import { SyntaxKind } from 'ts-morph'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  AnalyzedGLTF,
  GeneratedR3F,
  GenerateOptions,
  isMesh,
  loadGLTF,
  resolveModelLoadPath,
} from '../../src/index.js'
import {
  assertFileExists,
  fixtureAnalyzeOptions,
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
            a = new AnalyzedGLTF(model, fixtureAnalyzeOptions(options))
          })

          function assertCommon(g: GeneratedR3F) {
            expect(g.project).not.toBeNull()
            expect(g.src).not.toBeNull()
            expect(g.gltfInterface).not.toBeNull()
            expect(g.propsInterface).not.toBeNull()
            expect(g.instancesFn).not.toBeNull()
            expect(g.fn).not.toBeNull()
            expect(g.groupRoot).not.toBeNull()
            expect(
              g.groupRoot.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement).length,
            ).toEqual(6)
          }

          it('should generate', async () => {
            const g = new GeneratedR3F(a, options)

            const tsx = await g.toTsx()
            console.log(tsx)
            const jsx = await g.toJsx()
            assertCommon(g)

            for (const code of [tsx, jsx]) {
              expect(code).toContain('FOO header')

              if (type.includes('instanceall')) {
                expect(code).toContain('<Merged')
                expect(code).toContain('const instances = React.useMemo(')
                expect(code.match(/<instances\..*castShadow/g)?.length).toEqual(6)
                expect(code.match(/<instances\..*receiveShadow/g)?.length).toEqual(6)
              } else {
                expect(code.match(/castShadow/g)?.length).toEqual(6)
                expect(code.match(/receiveShadow/g)?.length).toEqual(6)
              }
            }
          })

          describe('exposeProps', () => {
            it('should generate to[]', async () => {
              const mo: GenerateOptions = {
                ...options,
                exposeProps: {
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
                  expect(code).toContain('<Merged')
                  expect(code).toContain('const instances = React.useMemo(')
                  expect(code.match(/<instances/g)?.length).toEqual(6)
                  expect(code.match(/.*receiveShadow=\{shadows\}/g)?.length).toEqual(6)
                  expect(code.match(/.*castShadow=\{shadows\}/g)?.length).toEqual(6)
                } else {
                  expect(code.match(/castShadow=\{shadows\}/g)?.length).toEqual(6)
                  expect(code.match(/receiveShadow=\{shadows\}/g)?.length).toEqual(6)
                }
              }
            })

            it('should generate to (singular)', async () => {
              const mo: GenerateOptions = {
                ...options,
                exposeProps: {
                  shadows: {
                    to: 'castShadow',
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
                  expect(code).toContain('<Merged')
                  expect(code).toContain('const instances = React.useMemo(')
                  expect(code.match(/<instances\..*castShadow=\{shadows\}/g)?.length).toEqual(6)
                  expect(code.match(/<instances\..*receiveShadow /g)?.length).toEqual(6)
                } else {
                  expect(code.match(/castShadow=\{shadows\}/g)?.length).toEqual(6)
                  expect(code.match(/receiveShadow\n/g)?.length).toEqual(6)
                }
              }
            })

            describe('matcher', () => {
              it('should limit matches', async () => {
                const mo: GenerateOptions = {
                  ...options,
                  exposeProps: {
                    shadows: {
                      to: 'castShadow',
                      structure: {
                        type: 'boolean',
                        hasQuestionToken: true,
                      },
                      matcher: (o) => isMesh(o) && o.name === 'GlassPlastic_low',
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
                    expect(code).toContain('<Merged')
                    expect(code).toContain('const instances = React.useMemo(')
                    expect(code.match(/<instances\..*castShadow=\{shadows\}/g)?.length).toEqual(1)
                    expect(code.match(/<instances\..*receiveShadow /g)?.length).toEqual(6)
                  } else {
                    expect(code.match(/castShadow=\{shadows\}/g)?.length).toEqual(1)
                    expect(code.match(/receiveShadow\n/g)?.length).toEqual(6)
                  }
                }
              })
            })
          })
        })
      }
    })
  }
})
