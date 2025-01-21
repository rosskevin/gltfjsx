import { TextureCompressOptions } from '@gltf-transform/functions'

interface BaseOptions {
  console?: boolean
}

export interface TransformOptions extends BaseOptions {
  degrade: string
  degraderesolution: number
  error: number
  format: TextureCompressOptions['targetFormat']
  instance?: boolean
  instanceall?: boolean
  keepattributes: boolean
  keepgroups?: boolean
  keepmaterials: boolean
  keepmeshes: boolean
  keepnames?: boolean
  ratio: number
  resolution: number
  simplify: boolean
}

export interface CliOptions extends TransformOptions {
  bones: boolean
  debug?: boolean
  draco?: string // unused, left as an option only for the moment if we can solve the draco loader issue in node in the future
  exportdefault?: boolean
  meta?: boolean
  outputSrc?: string
  // outputModel?: string
  precision: number
  printwidth: number
  root?: string
  shadows?: boolean
  transform?: boolean
  types?: boolean
}

export type LogFn = (args: any[]) => void

export interface Options extends CliOptions {
  componentName: string
  delay: number
  header?: string
  log: LogFn
  timeout: number
}

export interface TransformGltfToJsxOptions extends Options {
  size?: string // human readable size
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
