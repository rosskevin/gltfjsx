// import 'jsdom-global' // FIXME unclear why we might need this, so excluding for now

import fs from 'node:fs'
import path from 'node:path'

import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'
// import { GLTFLoader } from './bin/GLTFLoader.js'
// import { DRACOLoader } from './bin/DRACOLoader.js'
// DRACOLoader.getDecoderModule = () => {}
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

import transform from './transform.js'
import { transformGltfToJsx } from './transformGltfToJsx.js'
import { Options } from './types.js'
import { getRelativeFilePath } from './utils/files.js'
import { getFileSize } from './utils/getFileSize.js'
import { toArrayBuffer } from './utils/toArrayBuffer.js'

/**
 * No IO in this file, only the main function.
 */

const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('three/addons/jsm/libs/draco/gltf/')

const ktx2Loader = new KTX2Loader()
ktx2Loader.setTranscoderPath('three/addons/jsm/libs/basis/')

//draco difficulties in loading, try meshopt instead
// @see https://github.com/mrdoob/three.js/issues/26403#issuecomment-2101653981
// @see https://discourse.threejs.org/t/gltf-meshopt-compression/66244/2
// gltf-transform meshopt input.glb output.glb
const gltfLoader = new GLTFLoader()
// gltfLoader.setDRACOLoader(dracoLoader)  // https://github.com/mrdoob/three.js/issues/26403#issuecomment-2101653981
gltfLoader.setKTX2Loader(ktx2Loader)
gltfLoader.setMeshoptDecoder(MeshoptDecoder)

export async function gltfjsx(file: string, outputPath: string, options: Options) {
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
      const filePath = getRelativeFilePath(file, options)
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
      void run()
    } else {
      const stream = fs.createWriteStream(path.resolve(outputPath))
      stream.once('open', async () => {
        if (!fs.existsSync(file)) reject(new Error(file + ' does not exist.'))
        else run(stream).catch(reject)
      })
    }
  })
}
