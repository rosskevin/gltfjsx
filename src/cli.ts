#!/usr/bin/env node
import path, { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import meow from 'meow'
import { readPackageUpSync } from 'read-pkg-up'

import { gltfjsx } from './gltfjsx.js'
import { TransformGltfToJsxOptions } from './transformGltfToJsx.js'
import { CliOptions, LogFn } from './types.js'

/**
 * Separate the CLI from the main function to allow for testing.  CLI is responsible for IO.
 */

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const cli = meow(
  `
	Usage
	  $ npx gltfjsx [Model.glb] [options]

	Options
    --output, -o        Output file name/path
    --types, -t         Add Typescript definitions
    --keepnames, -k     Keep original names
    --keepgroups, -K    Keep (empty) groups, disable pruning
    --bones, -b         Lay out bones declaratively (default: false)
    --meta, -m          Include metadata (as userData)
    --shadows, s        Let meshes cast and receive shadows
    --printwidth, w     Prettier printWidth (default: 120)
    --precision, -p     Number of fractional digits (default: 3)
    --draco, -d         Draco binary path
    --root, -r          Sets directory from which .gltf file is served
    --instance, -i      Instance re-occuring geometry
    --instanceall, -I   Instance every geometry (for cheaper re-use)
    --exportdefault, -E Use default export
    --transform, -T     Transform the asset for the web (draco, prune, resize)
      --resolution, -R  Resolution for texture resizing (default: 1024)
      --keepmeshes, -j  Do not join compatible meshes
      --keepmaterials, -M Do not palette join materials
      --keepattributes, Whether to keep unused vertex attributes, such as UVs without an assigned texture
      --format, -f      Texture format jpeg | png | webp | avif (default: "webp")
      --simplify, -S    Mesh simplification (default: false)
        --ratio         Simplifier ratio (default: 0)
        --error         Simplifier error threshold (default: 0.0001)
    --console, -c       Log JSX to console, won't produce a file
    --debug, -D         Debug output
`,
  {
    importMeta: import.meta,
    flags: {
      output: { type: 'string', shortFlag: 'o' },
      types: { type: 'boolean', shortFlag: 't' },
      keepnames: { type: 'boolean', shortFlag: 'k' },
      keepgroups: { type: 'boolean', shortFlag: 'K' },
      bones: { type: 'boolean', shortFlag: 'b', default: false },
      shadows: { type: 'boolean', shortFlag: 's' },
      printwidth: { type: 'number', shortFlag: 'p', default: 1000 },
      meta: { type: 'boolean', shortFlag: 'm' },
      precision: { type: 'number', shortFlag: 'p', default: 3 },
      // draco: { type: 'string', shortFlag: 'd' },
      root: { type: 'string', shortFlag: 'r' },
      instance: { type: 'boolean', shortFlag: 'i' },
      instanceall: { type: 'boolean', shortFlag: 'I' },
      transform: { type: 'boolean', shortFlag: 'T' },
      resolution: { type: 'number', shortFlag: 'R', default: 1024 },
      degrade: { type: 'string', shortFlag: 'q', default: '' },
      degraderesolution: { type: 'number', shortFlag: 'Q', default: 512 },
      simplify: { type: 'boolean', shortFlag: 'S', default: false },
      keepmeshes: { type: 'boolean', shortFlag: 'j', default: false },
      keepmaterials: { type: 'boolean', shortFlag: 'M', default: false },
      keepattributes: { type: 'boolean', default: false },
      format: {
        type: 'string',
        choices: ['jpeg', 'png', 'webp', 'avif'],
        isMultiple: false,
        shortFlag: 'f',
        default: 'webp',
      },
      exportdefault: { type: 'boolean', shortFlag: 'E' },
      ratio: { type: 'number', default: 0.75 },
      error: { type: 'number', default: 0.001 },
      console: { type: 'boolean', shortFlag: 'c' },
      debug: { type: 'boolean', shortFlag: 'D' },
    },
  },
)

const packageResult = readPackageUpSync({ cwd: __dirname, normalize: false })
if (!packageResult) {
  throw new Error(`No package.json found at or above ${__dirname}`)
}
const packageJson = packageResult.packageJson

if (cli.input.length === 0) {
  console.log(cli.help)
} else {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const cliOptions: CliOptions = cli.flags as any satisfies CliOptions

  const file = cli.input[0]
  const extension = path.extname(file)
  const name = path.basename(file, extension) // extension.split('.').slice(0, -1).join('.')
  const log: LogFn = (args: any[]) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    console.info('log:', ...args)
  }

  const config: TransformGltfToJsxOptions = {
    ...cliOptions,
    header: `Auto-generated by: https://github.com/pmndrs/gltfjsx
Command: FIXME FIXME npx gltfjsx@${packageJson.version} ${process.argv.slice(2).join(' ')}`,
    log,
    timeout: 0,
    delay: 1,
  }

  const outputPath =
    config.output ?? name.charAt(0).toUpperCase() + name.slice(1) + (config.types ? '.tsx' : '.jsx')

  try {
    const response = await gltfjsx(file, outputPath, { ...config, log, timeout: 0, delay: 1 })
  } catch (e) {
    console.error(e)
  }
}
