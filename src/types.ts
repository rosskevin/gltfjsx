import { TextureCompressOptions } from '@gltf-transform/functions'

export interface CliOptions {
  bones: boolean
  console?: boolean
  debug?: boolean
  degrade: string
  degraderesolution: number
  draco?: string // unused, left as an option only for the moment if we can solve the draco loader issue in node in the future
  error: number
  exportdefault?: boolean
  format: TextureCompressOptions['targetFormat']
  instance?: boolean
  instanceall?: boolean
  keepattributes: boolean
  keepgroups?: boolean
  keepmaterials: boolean
  keepmeshes: boolean
  keepnames?: boolean
  meta?: boolean
  output?: string
  precision: number
  printwidth: number
  ratio: number
  resolution: number
  root?: string
  shadows?: boolean
  simplify: boolean
  transform?: boolean
  types?: boolean
}

export type LogFn = (args: any[]) => void

export interface Options extends CliOptions {
  log: LogFn
  timeout: number
  delay: number
}
