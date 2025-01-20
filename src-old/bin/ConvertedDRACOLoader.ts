import * as THREE from 'three'
import draco, { Decoder, DecoderBuffer, DecoderModule } from 'draco3dgltf'

// interface DracoDecoderModule {
//   DecoderBuffer: any
//   Decoder: any
//   TRIANGULAR_MESH: number
//   POINT_CLOUD: number
// }

interface DracoAttribute {
  ptr: number
  itemSize: number
  type: number
  array: TypedArray
  minValues?: number[]
  maxValues?: number[]
  numComponents?: number
}

interface TypedArray extends ArrayBuffer {
  BYTES_PER_ELEMENT: number
  length: number
}

const decoder: Promise<DecoderModule> = draco.createDecoderModule()

class DRACOLoader {
  timeLoaded: number
  manager: THREE.LoadingManager
  materials: any | null
  verbosity: number
  attributeOptions: Record<string, any>
  drawMode: number /*THREE.TrianglesDrawMode*/
  nativeAttributeMap: Record<string, string>
  path?: string

  constructor(manager: THREE.LoadingManager = THREE.DefaultLoadingManager) {
    this.timeLoaded = 0
    this.manager = manager
    this.materials = null
    this.verbosity = 0
    this.attributeOptions = {}
    this.drawMode = THREE.TrianglesDrawMode
    this.nativeAttributeMap = {
      position: 'POSITION',
      normal: 'NORMAL',
      color: 'COLOR',
      uv: 'TEX_COORD',
    }
  }

  load(
    url: string,
    onLoad: (geometry: THREE.BufferGeometry) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (event: unknown) => void,
  ): void {
    const loader = new THREE.FileLoader(this.manager)
    loader.setPath(this.path)
    loader.setResponseType('arraybuffer')
    loader.load(
      url,
      (data) => {
        this.decodeDracoFile(data as ArrayBuffer, onLoad)
      },
      onProgress,
      onError,
    )
  }

  setPath(path: string): this {
    this.path = path
    return this
  }

  setVerbosity(level: number): this {
    this.verbosity = level
    return this
  }

  setDrawMode(mode: number /*THREE.TrianglesDrawMode*/): this {
    this.drawMode = mode
    return this
  }

  setSkipDequantization(attributeName: string, skip = true): this {
    this.getAttributeOptions(attributeName).skipDequantization = skip
    return this
  }

  decodeDracoFile(
    buffer: ArrayBuffer,
    callback: (geometry: THREE.BufferGeometry) => void,
    attributeUniqueIdMap?: Record<string, number>,
    attributeTypeMap?: Record<string, string>,
  ): void {
    decoder.then((decoderModule) =>
      this.decodeDracoFileInternal(
        buffer,
        decoderModule,
        callback,
        attributeUniqueIdMap,
        attributeTypeMap,
      ),
    )
  }

  private decodeDracoFileInternal(
    buffer: ArrayBuffer,
    decoderModule: DecoderModule,
    callback: (geometry: THREE.BufferGeometry) => void,
    attributeUniqueIdMap?: Record<string, number>,
    attributeTypeMap?: Record<string, string>,
  ): void {
    const decoderBuffer = new decoderModule.DecoderBuffer()
    decoderBuffer.Init(new Int8Array(buffer), buffer.byteLength)

    const dracoDecoder = new decoderModule.Decoder()
    const geometryType = dracoDecoder.GetEncodedGeometryType(decoderBuffer)

    if (geometryType === decoderModule.TRIANGULAR_MESH) {
      if (this.verbosity > 0) console.log('Loaded a mesh.')
    } else {
      if (geometryType != decoderModule.POINT_CLOUD) {
        var u = 'THREE.DRACOLoader: Unknown geometry type.'
        //throw (console.error(u), new Error(u))
      }
      this.verbosity > 0 && console.log('Loaded a point cloud.')
    }

    callback(
      this.convertDracoGeometryTo3JS(
        decoderModule,
        dracoDecoder,
        geometryType,
        decoderBuffer,
        attributeUniqueIdMap,
        attributeTypeMap,
      ),
    )
  }

  private getAttributeOptions(attributeName: string): Record<string, any> {
    if (!this.attributeOptions[attributeName]) {
      this.attributeOptions[attributeName] = {}
    }
    return this.attributeOptions[attributeName]
  }

  /* unused
  addAttributeToGeometry: function (t, e, r, o, i, attribute: DracoAttribute, a, s) {
    if (0 === attribute.ptr) {
      var u = 'THREE.DRACOLoader: No attribute ' + o
      throw (console.error(u), new Error(u))
    }
    var d,
      A,
      c = attribute.num_components(),
      l = r.num_points() * c
    switch (i) {
      case Float32Array:
        ;(d = new t.DracoFloat32Array()),
          e.GetAttributeFloatForAllPoints(r, attribute, d),
          (s[o] = new Float32Array(l)),
          (A = THREE.Float32BufferAttribute)
        break
      case Int8Array:
        ;(d = new t.DracoInt8Array()),
          e.GetAttributeInt8ForAllPoints(r, attribute, d),
          (s[o] = new Int8Array(l)),
          (A = THREE.Int8BufferAttribute)
        break
      case Int16Array:
        ;(d = new t.DracoInt16Array()),
          e.GetAttributeInt16ForAllPoints(r, attribute, d),
          (s[o] = new Int16Array(l)),
          (A = THREE.Int16BufferAttribute)
        break
      case Int32Array:
        ;(d = new t.DracoInt32Array()),
          e.GetAttributeInt32ForAllPoints(r, attribute, d),
          (s[o] = new Int32Array(l)),
          (A = THREE.Int32BufferAttribute)
        break
      case Uint8Array:
        ;(d = new t.DracoUInt8Array()),
          e.GetAttributeUInt8ForAllPoints(r, attribute, d),
          (s[o] = new Uint8Array(l)),
          (A = THREE.Uint8BufferAttribute)
        break
      case Uint16Array:
        ;(d = new t.DracoUInt16Array()),
          e.GetAttributeUInt16ForAllPoints(r, attribute, d),
          (s[o] = new Uint16Array(l)),
          (A = THREE.Uint16BufferAttribute)
        break
      case Uint32Array:
        ;(d = new t.DracoUInt32Array()),
          e.GetAttributeUInt32ForAllPoints(r, attribute, d),
          (s[o] = new Uint32Array(l)),
          (A = THREE.Uint32BufferAttribute)
        break
      default:
        u = 'THREE.DRACOLoader: Unexpected attribute type.'
        throw (console.error(u), new Error(u))
    }
    for (var b = 0; b < l; b++) s[o][b] = d.GetValue(b)
    a.setAttribute(o, new A(s[o], c)), t.destroy(d)
  },
  */

  convertDracoGeometryTo3JS(
    decoderModule: DecoderModule,
    decoder: Decoder,
    geometryType: number,
    buffer: DecoderBuffer,
    attributeUniqueIdMap?: Record<string, number>,
    attributeTypeMap?: Record<string, string>,
  ): THREE.BufferGeometry {
    const dracoGeometry = new decoderModule.Mesh()
    const status = decoder.DecodeBufferToMesh(buffer, dracoGeometry)

    if (!status.ok() || dracoGeometry.ptr === 0) {
      throw new Error('THREE.DRACOLoader: Decoding failed.')
    }

    const geometry = new THREE.BufferGeometry()

    // Convert Draco attributes to THREE.BufferAttributes
    for (const attributeName in this.nativeAttributeMap) {
      const attributeId = decoder.GetAttributeId(
        dracoGeometry,
        decoderModule[this.nativeAttributeMap[attributeName]],
      )

      if (attributeId !== -1) {
        const attribute = decoder.GetAttribute(dracoGeometry, attributeId)
        this.addAttributeToGeometry(
          geometry,
          decoderModule,
          dracoGeometry,
          attributeName,
          attributeId,
          attribute,
          geometryType,
        )
      }
    }

    // Add custom attributes
    if (attributeUniqueIdMap) {
      for (const attributeName in attributeUniqueIdMap) {
        const attributeId = attributeUniqueIdMap[attributeName]
        const attribute = decoder.GetAttribute(dracoGeometry, attributeId)
        this.addAttributeToGeometry(
          geometry,
          decoderModule,
          dracoGeometry,
          attributeName,
          attributeId,
          attribute,
          geometryType,
        )
      }
    }

    // Add indices for mesh
    if (geometryType === decoderModule.TRIANGULAR_MESH) {
      const numFaces = dracoGeometry.num_faces()
      const numIndices = numFaces * 3
      const index = new Uint32Array(numIndices)
      const indexArray = new decoderModule.DracoInt32Array()

      for (let i = 0; i < numFaces; ++i) {
        decoder.GetFaceFromMesh(dracoGeometry, i, indexArray)
        for (let j = 0; j < 3; ++j) {
          index[i * 3 + j] = indexArray.GetValue(j)
        }
      }

      geometry.setIndex(new THREE.BufferAttribute(index, 1))
    }

    return geometry
  }
}

export default DRACOLoader
