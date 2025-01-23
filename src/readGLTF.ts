/**
 * References:
 *  - https://discourse.threejs.org/t/how-to-use-gltfloader-in-nodejs/43607/8
 *  - https://github.com/Brakebein/node-three-gltf/tree/main (maintained!)
 */
import path from 'node:path'

import { DRACOLoader, GLTF, GLTFLoader } from 'node-three-gltf'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'

import { isObject3D } from './analyze/is.js'
import { readFileToArrayBuffer } from './utils/files.js'

/**
 * Read a GLTF file and return the GLTF object.
 */
export async function readGLTF(modelFilename: string): Promise<GLTF> {
  const modelBuffer = readFileToArrayBuffer(modelFilename)
  //
  // Setup loader
  //
  const dracoLoader = new DRACOLoader()
  // dracoLoader.setDecoderPath('three/addons/jsm/libs/draco/gltf/')

  const ktx2Loader = new KTX2Loader()
  ktx2Loader.setTranscoderPath('three/addons/jsm/libs/basis/')

  const gltfLoader = new GLTFLoader()
  gltfLoader.setDRACOLoader(dracoLoader) // https://github.com/mrdoob/three.js/issues/26403#issuecomment-2101653981
  gltfLoader.setKTX2Loader(ktx2Loader)
  gltfLoader.setMeshoptDecoder(MeshoptDecoder)

  const modelDir = path.parse(modelFilename).dir + path.sep
  return new Promise((resolve, reject) => {
    gltfLoader.parse(
      modelBuffer,
      modelDir, // provide the reference path for relative resources
      async (gltf: GLTF) => {
        if (isObject3D(gltf)) {
          console.error('gltf is Object3D, in what case is this?', gltf)
          // Wrap scene in a GLTF Structure
          gltf = { scene: gltf, animations: [], parser: { json: {} } } as unknown as GLTF
        }
        resolve(gltf)
      },
      (error) => {
        console.log(error)
        reject(error as Error)
      },
    )
  })
}
