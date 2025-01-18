import { TextureCompressOptions } from '@gltf-transform/functions'

export interface CliOptions {
  output?: string
  types?: boolean
  keepnames?: boolean
  keepgroups?: boolean
  bones: boolean
  shadows?: boolean
  printwidth: number
  meta?: boolean
  precision: number
  draco?: string
  root?: string
  instance?: boolean
  instanceall?: boolean
  transform?: boolean
  resolution: number
  degrade: string
  degraderesolution: number
  simplify: boolean
  keepmeshes: boolean
  keepmaterials: boolean
  keepattributes: boolean
  format: TextureCompressOptions['targetFormat']
  exportdefault?: boolean
  ratio: number
  error: number
  console?: boolean
  debug?: boolean
}

export type LogFn = (args: any[]) => void

export interface Options extends CliOptions {
  log: LogFn
  timeout: number
  delay: number
}
