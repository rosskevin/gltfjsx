import fs from 'node:fs'
import path from 'node:path'

import { expect } from 'vitest'

import { JsxOptions } from '../options.js'

export const types = [
  //
  'gltf',
  'gltf-transform-meshopt',
  'gltf-transform-draco',
  'gltf-transform-draco-instanceall',
]

export const models = ['FlightHelmet']

export const resolveModelFile = (inModelName: string, type: string) => {
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

export const defaultJsxOptions = (input: Partial<JsxOptions>) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const o: JsxOptions = {
    bones: false,
    precision: 3,
    exportdefault: false,
    console: false,
    debug: false,
    ...input,
  } as any
  return o
}
