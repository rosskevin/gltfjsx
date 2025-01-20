import * as THREE from 'three'
import draco, { Decoder, DecoderBuffer, DecoderModule } from 'draco3dgltf'

const decoder = draco.createDecoderModule()
const DRACOLoader = function (t) {
  ;(this.timeLoaded = 0),
    (this.manager = t || THREE.DefaultLoadingManager),
    (this.materials = null),
    (this.verbosity = 0),
    (this.attributeOptions = {}),
    (this.drawMode = THREE.TrianglesDrawMode),
    (this.nativeAttributeMap = {
      position: 'POSITION',
      normal: 'NORMAL',
      color: 'COLOR',
      uv: 'TEX_COORD',
    })
}

DRACOLoader.prototype = {
  constructor: DRACOLoader,
  load: function (t, e, r, o) {
    var i = this,
      n = new THREE.FileLoader(i.manager)
    n.setPath(this.path),
      n.setResponseType('arraybuffer'),
      n.load(
        t,
        function (t) {
          i.decodeDracoFile(t, e)
        },
        r,
        o,
      )
  },
  setPath: function (t) {
    return (this.path = t), this
  },
  setVerbosity: function (t) {
    return (this.verbosity = t), this
  },
  setDrawMode: function (t) {
    return (this.drawMode = t), this
  },
  setSkipDequantization: function (t, e) {
    var r = !0
    return void 0 !== e && (r = e), (this.getAttributeOptions(t).skipDequantization = r), this
  },
  decodeDracoFile: function (t, e, r, o) {
    decoder.then((decoder) => this.decodeDracoFileInternal(t, decoder, e, r, o))
  },
  decodeDracoFileInternal: function (t, e, r, o, i) {
    var n = new e.DecoderBuffer()
    n.Init(new Int8Array(t), t.byteLength)
    var a = new e.Decoder(),
      s = a.GetEncodedGeometryType(n)
    if (s == e.TRIANGULAR_MESH) this.verbosity > 0 && console.log('Loaded a mesh.')
    else {
      if (s != e.POINT_CLOUD) {
        var u = 'THREE.DRACOLoader: Unknown geometry type.'
        //throw (console.error(u), new Error(u))
      }
      this.verbosity > 0 && console.log('Loaded a point cloud.')
    }
    r(this.convertDracoGeometryTo3JS(e, a, s, n, o, i))
  },
  addAttributeToGeometry: function (t, e, r, o, i, n, a, s) {
    if (0 === n.ptr) {
      var u = 'THREE.DRACOLoader: No attribute ' + o
      throw (console.error(u), new Error(u))
    }
    var d,
      A,
      c = n.num_components(),
      l = r.num_points() * c
    switch (i) {
      case Float32Array:
        ;(d = new t.DracoFloat32Array()),
          e.GetAttributeFloatForAllPoints(r, n, d),
          (s[o] = new Float32Array(l)),
          (A = THREE.Float32BufferAttribute)
        break
      case Int8Array:
        ;(d = new t.DracoInt8Array()),
          e.GetAttributeInt8ForAllPoints(r, n, d),
          (s[o] = new Int8Array(l)),
          (A = THREE.Int8BufferAttribute)
        break
      case Int16Array:
        ;(d = new t.DracoInt16Array()),
          e.GetAttributeInt16ForAllPoints(r, n, d),
          (s[o] = new Int16Array(l)),
          (A = THREE.Int16BufferAttribute)
        break
      case Int32Array:
        ;(d = new t.DracoInt32Array()),
          e.GetAttributeInt32ForAllPoints(r, n, d),
          (s[o] = new Int32Array(l)),
          (A = THREE.Int32BufferAttribute)
        break
      case Uint8Array:
        ;(d = new t.DracoUInt8Array()),
          e.GetAttributeUInt8ForAllPoints(r, n, d),
          (s[o] = new Uint8Array(l)),
          (A = THREE.Uint8BufferAttribute)
        break
      case Uint16Array:
        ;(d = new t.DracoUInt16Array()),
          e.GetAttributeUInt16ForAllPoints(r, n, d),
          (s[o] = new Uint16Array(l)),
          (A = THREE.Uint16BufferAttribute)
        break
      case Uint32Array:
        ;(d = new t.DracoUInt32Array()),
          e.GetAttributeUInt32ForAllPoints(r, n, d),
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
  convertDracoGeometryTo3JS: function (
    decoderModule: DecoderModule,
    decoder: Decoder,
    geometryType: number,
    buffer: DecoderBuffer,
    attributeUniqueIdMap?: Record<string, number>,
    attributeTypeMap?: Record<string, string>,
  ) {
    var a, s, u
    if (
      (!0 === this.getAttributeOptions('position').skipDequantization &&
        decoder.SkipAttributeTransform(
          decoderModule.POSITION,
        ) /* real but perhaps deprecated and now missing */,
      geometryType === decoderModule.TRIANGULAR_MESH
        ? ((a = new decoderModule.Mesh()), (s = decoder.DecodeBufferToMesh(buffer, a)))
        : ((a = new decoderModule.PointCloud()), (s = decoder.DecodeBufferToPointCloud(buffer, a))),
      !s.ok() || 0 == a.ptr)
    ) {
      return new THREE.BufferGeometry()
      var d = 'THREE.DRACOLoader: Decoding failed: '
      throw (
        ((d += s.error_msg()),
        console.error(d),
        decoderModule.destroy(decoder),
        decoderModule.destroy(a),
        new Error(d))
      )
    }
    decoderModule.destroy(buffer),
      geometryType == decoderModule.TRIANGULAR_MESH
        ? ((u = a.num_faces()),
          this.verbosity > 0 && console.log('Number of faces loaded: ' + u.toString()))
        : (u = 0)
    var A = a.num_points(),
      c = a.num_attributes()
    this.verbosity > 0 &&
      (console.log('Number of points loaded: ' + A.toString()),
      console.log('Number of attributes loaded: ' + c.toString()))
    var l = decoder.GetAttributeId(a, decoderModule.POSITION)
    if (-1 == l) {
      d = 'THREE.DRACOLoader: No position attribute found.'
      throw (
        (console.error(d), decoderModule.destroy(decoder), decoderModule.destroy(a), new Error(d))
      )
    }
    var b = decoder.GetAttribute(a, l),
      f = {},
      y = new THREE.BufferGeometry()
    if (attributeUniqueIdMap)
      for (var E in attributeUniqueIdMap) {
        var h = attributeTypeMap[E],
          w = attributeUniqueIdMap[E],
          p = decoder.GetAttributeByUniqueId(a, w)
        //this.addAttributeToGeometry(t, e, a, E, h, p, y, f)
      }
    else
      for (var E in this.nativeAttributeMap) {
        var T = decoder.GetAttributeId(a, decoderModule[this.nativeAttributeMap[E]])
        if (-1 !== T) {
          this.verbosity > 0 && console.log('Loaded ' + E + ' attribute.')
          p = decoder.GetAttribute(a, T)
          //this.addAttributeToGeometry(t, e, a, E, Float32Array, p, y, f)
        }
      }
    if (geometryType == decoderModule.TRIANGULAR_MESH)
      if (this.drawMode === THREE.TriangleStripDrawMode) {
        var R = new decoderModule.DracoInt32Array()
        decoder.GetTriangleStripsFromMesh(a, R)
        f.indices = new Uint32Array(R.size())
        for (var I = 0; I < R.size(); ++I) f.indices[I] = R.GetValue(I)
        decoderModule.destroy(R)
      } else {
        var v = 3 * u
        f.indices = new Uint32Array(v)
        var D = new decoderModule.DracoInt32Array()
        for (I = 0; I < u; ++I) {
          decoder.GetFaceFromMesh(a, I, D)
          var m = 3 * I
          ;(f.indices[m] = D.GetValue(0)),
            (f.indices[m + 1] = D.GetValue(1)),
            (f.indices[m + 2] = D.GetValue(2))
        }
        decoderModule.destroy(D)
      }
    ;(y.drawMode = this.drawMode),
      geometryType == decoderModule.TRIANGULAR_MESH &&
        y.setIndex(
          new (f.indices.length > 65535
            ? THREE.Uint32BufferAttribute
            : THREE.Uint16BufferAttribute)(f.indices, 1),
        )
    var G = new decoderModule.AttributeQuantizationTransform()
    if (G.InitFromAttribute(b)) {
      ;(y.attributes.position.isQuantized = !0),
        (y.attributes.position.maxRange = G.range()),
        (y.attributes.position.numQuantizationBits = G.quantization_bits()),
        (y.attributes.position.minValues = new Float32Array(3))
      for (I = 0; I < 3; ++I) y.attributes.position.minValues[I] = G.min_value(I)
    }
    return decoderModule.destroy(G), decoderModule.destroy(decoder), decoderModule.destroy(a), y
  },
  isVersionSupported: function (t, e) {
    e(decoder.isVersionSupported(t))
  },
  getAttributeOptions: function (t) {
    return (
      void 0 === this.attributeOptions[t] && (this.attributeOptions[t] = {}),
      this.attributeOptions[t]
    )
  },
}

export { DRACOLoader }
