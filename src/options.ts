import { TextureCompressOptions } from '@gltf-transform/functions'

interface BaseOptions {
  console: boolean
  debug: boolean
  draco?: string // unused, left as an option only for the moment if we can solve the draco loader issue in node in the future

  // shared transform and jsx
  instance?: boolean
  instanceall?: boolean
  keepgroups?: boolean
  keepnames?: boolean
}

export interface TransformOptions extends BaseOptions {
  degrade: string
  degraderesolution: number
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
    debug,
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
    debug,
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
    ratio,
    resolution,
    simplify,
  }

  return {
    transformOptions,
    createJsxOptions: {
      ...other,
      console,
      debug,
      draco,
      instance,
      instanceall,
      keepgroups,
      keepnames,
    },
  }
}

export type LogFn = (args: any[]) => void

export interface PropsOptions {
  keepnames?: boolean
  meta?: boolean
  shadows?: boolean
}

export interface PruneOptions extends PropsOptions {
  bones: boolean
  debug: boolean
  keepgroups?: boolean
}

export interface JsxOptions extends BaseOptions, PropsOptions, PruneOptions {
  componentName: string
  exportdefault?: boolean
  header?: string
  modelLoadPath: string
  log: LogFn
  precision: number
  size?: string // human readable size
  types?: boolean
}

export interface CliOptions extends TransformOptions, JsxOptions {
  // delay: number
  output?: string
  root?: string
  // timeout: number
  transform?: boolean
}

/**
 * type UserWithName = WithRequired<User, 'name'>
 *
 * @see https://stackoverflow.com/a/69328045/2363935
 */
// export type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] }
export type WithRequired<T, K extends keyof T> = T & Required<Pick<T, K>>

/**
 * type UserWithOptionalName = WithOptional<User, 'name'>
 *
 * @see https://stackoverflow.com/a/69328045/2363935
 */
export type WithOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

/**
 * Same as `keyof` but only returns strings
 *
 * @see https://stackoverflow.com/a/65420892/2363935
 */
export type StringKeyOf<T> = Extract<keyof T, string>
