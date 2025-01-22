/**
 * References:
 *  - https://discourse.threejs.org/t/how-to-use-gltfloader-in-nodejs/43607/8
 *  - https://github.com/Brakebein/node-three-gltf/tree/main (maintained!)
 */

// import 'global-jsdom/register' // needed for `self` to be defined aka window.self [may not need with node-three-gltf]

import path from 'node:path'

// import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
//
import { DRACOLoader, GLTF, GLTFLoader } from 'node-three-gltf'
// import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
//
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'

// import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
// import { MeshoptDecoder } from 'three-stdlib'
import { readFileToArrayBuffer } from './utils/files.js'

// global.ProgressEvent ??= ProgressEvent
// global.self ??= global

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

  //draco difficulties in loading, try meshopt instead
  // @see https://github.com/mrdoob/three.js/issues/26403#issuecomment-2101653981
  // @see https://discourse.threejs.org/t/gltf-meshopt-compression/66244/2
  // gltf-transform meshopt input.glb output.glb
  const gltfLoader = new GLTFLoader()
  // gltfLoader.setDRACOLoader(dracoLoader)  // https://github.com/mrdoob/three.js/issues/26403#issuecomment-2101653981
  gltfLoader.setKTX2Loader(ktx2Loader)
  gltfLoader.setMeshoptDecoder(MeshoptDecoder)

  //
  const modelDir = path.parse(modelFilename).dir + path.sep
  let modelGLTF: GLTF
  return new Promise((resolve, reject) => {
    gltfLoader.parse(
      modelBuffer,
      modelDir, // provide the reference path for relative resources
      async (gltf: GLTF) => {
        resolve(gltf)
      },
      (error) => {
        console.log(error)
        reject(error as Error)
      },
    )
  })
}
