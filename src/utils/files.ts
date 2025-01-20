import path from 'node:path'

import { Options } from '../types.js'

export function getRelativeFilePath(file: string, options: Options) {
  const filePath = path.resolve(file)
  const rootPath = options.root ? path.resolve(options.root) : path.dirname(file)
  const relativePath = path.relative(rootPath, filePath) || ''
  if (process.platform === 'win32') return relativePath.replace(/\\/g, '/')
  return relativePath
}
