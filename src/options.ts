import { TextureCompressOptions } from '@gltf-transform/functions'

export interface LogOptions {
  silent: boolean
  debug: boolean
}

export type LogFn = (...args: any[]) => void

export interface Logger {
  debug: LogFn
  error: LogFn
  info: LogFn

  isDebug: () => boolean
}

interface BaseOptions {
  log: Logger
  instance?: boolean
  instanceall?: boolean
  keepgroups?: boolean
  keepnames?: boolean
}

export interface TransformOptions extends BaseOptions {
  console: boolean
  degrade: string
  degraderesolution: number
  draco?: string
  error: number
  format: TextureCompressOptions['targetFormat']

  keepattributes: boolean
  keepmaterials: boolean
  keepmeshes: boolean

  ratio: number
  resolution: number
  simplify: boolean
}

export function pickOptions(options: CliOptions): {
  transformOptions: TransformOptions
  createJsxOptions: JsxOptions
} {
  const {
    console,
    degrade,
    degraderesolution,
    draco,
    error,
    format,
    instance,
    instanceall,
    keepattributes,
    keepgroups,
    keepmaterials,
    keepmeshes,
    keepnames,
    log,
    ratio,
    resolution,
    simplify,
    // cliOnly
    output,
    transform,
    // rest are createJsxOptions
    ...other
  } = options

  const transformOptions: TransformOptions = {
    console,
    degrade,
    degraderesolution,
    error,
    format,
    instance,
    instanceall,
    keepattributes,
    keepgroups,
    keepmaterials,
    keepmeshes,
    keepnames,
    log,
    ratio,
    resolution,
    simplify,
  }

  return {
    transformOptions,
    createJsxOptions: {
      ...other,
      // console,
      // debug,
      log,
      // draco,
      instance,
      instanceall,
      keepgroups,
      keepnames,
    },
  }
}

export interface PropsOptions extends BaseOptions {
  // log: Logger
  // keepnames?: boolean
  bones?: boolean
  meta?: boolean
  shadows?: boolean
}

export interface JsxOptions extends BaseOptions, PropsOptions {
  componentName: string
  draco?: string
  exportdefault?: boolean
  header?: string
  modelLoadPath: string
  precision: number
  size?: string // human readable size
  types?: boolean
}

export interface CliOptions extends TransformOptions, JsxOptions {
  console: boolean
  debug: boolean
  draco?: string
  // delay: number
  output?: string
  root?: string
  // timeout: number
  transform?: boolean
}
