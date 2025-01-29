import fs from 'node:fs'
import path from 'node:path'

import { expect } from 'vitest'

import { Log } from '../Log.js'
import { AnalyzedGLTFOptions, GenerateOptions } from '../options.js'
import { WithRequired } from '../utils/types.js'

export const types = [
  //
  'gltf',
  'gltf-transform-meshopt',
  'gltf-transform-draco',
  'gltf-transform-draco-instanceall',
]

export const models = ['FlightHelmet']

const log = new Log({ silent: false, debug: false })

export const resolveFixtureModelFile = (inModelName: string, type: string) => {
  let modelName
  const extension = type === 'gltf' ? 'gltf' : 'glb'
  switch (type) {
    case 'gltf':
    case 'gltf-transform-meshopt':
    case 'gltf-transform-draco':
      // case 'gltf-transform-draco-instanceall':
      modelName = inModelName
      break
    case 'gltf-transform-draco-instanceall':
      modelName = inModelName + '-transformed'
      break
    default:
      throw new Error(`Unknown type: ${type}`)
  }
  return path.join(
    path.dirname(new URL(import.meta.url).pathname), // this dir
    `./models/${inModelName}/${type}/${modelName}.${extension}`,
  )
}

export const assertFileExists = (path: string) => {
  expect(fs.existsSync(path), `File not found: ${path}`).toBe(true)
}

export const fixtureAnalyzeOptions = (
  input: Partial<AnalyzedGLTFOptions> = {},
): AnalyzedGLTFOptions => {
  const o: AnalyzedGLTFOptions = {
    bones: false,
    precision: 3,
    log,
    ...input,
  }
  return o
}

export const fixtureGenerateOptions = (
  input: WithRequired<Partial<GenerateOptions>, 'componentName' | 'modelLoadPath' | 'draco'>,
): GenerateOptions => {
  const o: GenerateOptions = {
    ...fixtureAnalyzeOptions({ log: input.log }),
    exportdefault: false,
    ...input,
  }
  return o
}
