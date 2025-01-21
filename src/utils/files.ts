import fs from 'node:fs'

export function getFileSize(file: string) {
  function roundOff(value: number) {
    return Math.round(value * 100) / 100
  }

  const stats = fs.statSync(file)
  const fileSize = stats.size
  const fileSizeKB = roundOff(fileSize * 0.001)
  const fileSizeMB = roundOff(fileSizeKB * 0.001)
  return {
    size: fileSizeKB > 1000 ? `${fileSizeMB}MB` : `${fileSizeKB}KB`,
    sizeKB: fileSizeKB,
  }
}

export function compareFileSizes(original: string, transformed: string) {
  const { size: sizeOriginal, sizeKB: sizeKBOriginal } = getFileSize(original)
  const { size: sizeTransformed, sizeKB: sizeKBTransformed } = getFileSize(transformed)
  return `${original} [${sizeOriginal}] > ${transformed} [${sizeTransformed}] (${Math.round(
    100 - (sizeKBTransformed / sizeKBOriginal) * 100,
  )}%)`
}

// export function getRelativeFilePath(file: string, options: Options) {
//   const filePath = path.resolve(file)
//   const rootPath = options.root ? path.resolve(options.root) : path.dirname(file)
//   const relativePath = path.relative(rootPath, filePath) || ''
//   if (process.platform === 'win32') return relativePath.replace(/\\/g, '/')
//   return relativePath
// }

export function readFileToArrayBuffer(filename: string) {
  function toArrayBuffer(buf: Buffer) {
    const ab = new ArrayBuffer(buf.length)
    const view = new Uint8Array(ab)
    for (let i = 0; i < buf.length; ++i) view[i] = buf[i]
    return ab
  }
  const modelFileData = fs.readFileSync(filename)
  const arrayBuffer = toArrayBuffer(modelFileData)
  return arrayBuffer
}

export function writeFile(
  filePath: PathOrFileDescriptor,
  data: string | NodeJS.ArrayBufferView,
  options?: WriteFileOptions,
) {
  fs.writeFileSync(filePath, data, options)
}
