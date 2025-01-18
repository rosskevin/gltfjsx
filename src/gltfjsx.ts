import 'jsdom-global'
import fs from 'fs'
import path from 'path'
import transform from './utils/transform.js'

// import { GLTFLoader } from './bin/GLTFLoader.js'
// import { DRACOLoader } from './bin/DRACOLoader.js'
// DRACOLoader.getDecoderModule = () => {}

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'

import { transformGltfToJsx } from './utils/transformGltfToJsx.js'
import { Options } from './types.js'
import { getFileSize } from './utils/getFileSize.js'
import { toArrayBuffer } from './utils/toArrayBuffer.js'

const gltfLoader = new GLTFLoader()
gltfLoader.setDRACOLoader(new DRACOLoader())

export default function glftsx(file: string, outputPath: string, options: Options) {
  function getRelativeFilePath(file: string) {
    const filePath = path.resolve(file)
    const rootPath = options.root ? path.resolve(options.root) : path.dirname(file)
    const relativePath = path.relative(rootPath, filePath) || ''
    if (process.platform === 'win32') return relativePath.replace(/\\/g, '/')
    return relativePath
  }

  return new Promise((resolve, reject) => {
    async function run(stream: fs.WriteStream | undefined = undefined) {
      let size = ''
      // Process GLTF
      if (outputPath && path.parse(outputPath).ext === '.tsx') options.types = true
      if (options.transform || options.instance || options.instanceall) {
        const { name } = path.parse(file)
        const outputDir = path.parse(path.resolve(outputPath ?? file)).dir
        const transformOut = path.join(outputDir, name + '-transformed.glb')
        await transform(file, transformOut, options)
        const { size: sizeOriginal, sizeKB: sizeKBOriginal } = getFileSize(file)
        const { size: sizeTransformed, sizeKB: sizeKBTransformed } = getFileSize(transformOut)
        size = `${file} [${sizeOriginal}] > ${transformOut} [${sizeTransformed}] (${Math.round(
          100 - (sizeKBTransformed / sizeKBOriginal) * 100,
        )}%)`
        file = transformOut
      }
      const filePath = getRelativeFilePath(file)
      const data = fs.readFileSync(file)
      const arrayBuffer = toArrayBuffer(data)
      gltfLoader.parse(
        arrayBuffer,
        '',
        async (gltf) => {
          const output = await transformGltfToJsx(gltf, { fileName: filePath, size, ...options })
          if (options.console) console.log(output)
          else stream?.write(output)
          stream?.end()
          resolve(void 0)
        },
        (reason) => console.log(reason),
      )
    }

    if (options.console) {
      run()
    } else {
      const stream = fs.createWriteStream(path.resolve(outputPath))
      stream.once('open', async () => {
        if (!fs.existsSync(file)) reject(file + ' does not exist.')
        else run(stream)
      })
    }
  })
}
