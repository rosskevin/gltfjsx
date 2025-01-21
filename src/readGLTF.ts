import 'global-jsdom/register' // needed for `self` to be defined aka window.self

import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'
// import { GLTFLoader } from './bin/GLTFLoader.js'
// import { DRACOLoader } from './bin/DRACOLoader.js'
// DRACOLoader.getDecoderModule = () => {}
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

import { readFileToArrayBuffer } from './utils/files.js'

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

/**
 * Read a GLTF file and return the GLTF object.
 */
export async function readGLTF(modelFilename: string): Promise<GLTF> {
  const modelBuffer = readFileToArrayBuffer(modelFilename)
  let modelGLTF: GLTF
  return new Promise((resolve, reject) => {
    gltfLoader.parse(
      modelBuffer,
      '',
      async (gltf) => {
        resolve(gltf)
      },
      (reason: ErrorEvent) => {
        console.log(reason)
        reject(new Error(reason.message))
      },
    )
  })
}
