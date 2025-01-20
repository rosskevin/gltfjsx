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
