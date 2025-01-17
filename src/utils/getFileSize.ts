import fs from 'fs'
export function getFileSize(file: string) {
  function roundOff(value: number) {
    return Math.round(value * 100) / 100
  }

  const stats = fs.statSync(file)
  let fileSize = stats.size
  let fileSizeKB = roundOff(fileSize * 0.001)
  let fileSizeMB = roundOff(fileSizeKB * 0.001)
  return {
    size: fileSizeKB > 1000 ? `${fileSizeMB}MB` : `${fileSizeKB}KB`,
    sizeKB: fileSizeKB,
  }
}
