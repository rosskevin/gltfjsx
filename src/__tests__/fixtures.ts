import fs from 'node:fs'
import path from 'node:path'

import { expect } from 'vitest'

import { GenerateOptions } from '../options.js'

export const types = [
  //
  'gltf',
  'gltf-transform-meshopt',
  'gltf-transform-draco',
  'gltf-transform-draco-instanceall',
]

export const models = ['FlightHelmet']

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

export const fixtureGenerateOptions = (input: Partial<GenerateOptions>) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const o: GenerateOptions = {
    bones: false,
    precision: 3,
    exportdefault: false,
    console: false,
    debug: false,
    ...input,
  } as any
  return o
}
