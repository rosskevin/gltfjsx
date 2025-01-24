import { Object3D, Vector3 } from 'three'

import { PropsOptions } from '../options.js'
import { AnalyzedGLTF } from './AnalyzedGLTF.js'
import {
  isColored,
  isDecayed,
  isDistanced,
  isInstancedMesh,
  isLight,
  isMesh,
  isOrthographicCamera,
  isPerspectiveCamera,
  isPoints,
  isSkinnedMesh,
  isSpotLight,
} from './is.js'
import { materialKey, sanitizeName } from './utils.js'

export type Props = Record<string, any>

export function calculateProps<O extends PropsOptions>(
  obj: Object3D,
  a: AnalyzedGLTF,
  options: Readonly<O>,
): Props {
  const props: Props = {}
  const { animated, node, instanced } = a.getInfo(obj)

  // Include names when output is uncompressed or morphTargetDictionaries are present
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (obj.name.length && (options.keepnames || (obj as any).morphTargetDictionary || animated)) {
    props['name'] = obj.name
  }

  // Handle cameras
  if (isPerspectiveCamera(obj) || isOrthographicCamera(obj)) {
    props['makeDefault'] = false
    if (obj.zoom !== 1) props['zoom'] = a.rNbr(obj.zoom)
    if (obj.far !== 2000) props['far'] = a.rNbr(obj.far)
    if (obj.near !== 0.1) props['near'] = a.rNbr(obj.near)
  }
  if (isPerspectiveCamera(obj)) {
    if (obj.fov !== 50) props['fov'] = a.rNbr(obj.fov)
  }

  if (!instanced) {
    // Shadows
    if (isMesh(obj) && options.shadows) {
      props['castShadow'] = true
      props['receiveShadow'] = true
    }

    if (isMesh(obj) && !isInstancedMesh(obj)) {
      // Write out geometry first
      props['geometry'] = `${node}.geometry`

      // Write out materials
      const materialName = materialKey(obj.material)
      if (materialName) props['material'] = `materials${sanitizeName(materialName)}`
      else props['material'] = `${node}.material`
    }
  }

  if (isInstancedMesh(obj)) {
    if (obj.instanceMatrix) props['instanceMatrix'] = `${node}.instanceMatrix`
    if (obj.instanceColor) props['instanceColor'] = `${node}.instanceColor`
  }
  if (isSkinnedMesh(obj)) props['skeleton'] = `${node}.skeleton`
  if (obj.visible === false) props['visible'] = false
  if (obj.castShadow === true) props['castShadow'] = true
  if (obj.receiveShadow === true) props['receiveShadow'] = true
  if (isPoints(obj)) {
    props['morphTargetDictionary'] = `${node}.morphTargetDictionary}`
    props['morphTargetInfluences'] = `${node}.morphTargetInfluences}`
  }
  if (isLight(obj)) {
    if (a.rNbr(obj.intensity)) props['intensity'] = a.rNbr(obj.intensity)
  }
  //if (obj.power && obj.power !== 4 * Math.PI) props['power'] = ${a.rNbr(obj.power)} `
  if (isSpotLight(obj)) {
    if (obj.angle !== Math.PI / 3) props['angle'] = a.rDeg(obj.angle)
    if (obj.penumbra && a.rNbr(obj.penumbra) !== 0) props['penumbra'] = a.rNbr(obj.penumbra)
  }

  // SpotLight | PointLight
  if (isDecayed(obj)) {
    if (obj.decay && a.rNbr(obj.decay) !== 1) props['decay'] = a.rNbr(obj.decay)
  }
  if (isDistanced(obj)) {
    if (obj.distance && a.rNbr(obj.distance) !== 0) props['distance'] = a.rNbr(obj.distance)
  }

  if (obj.up && obj.up.isVector3 && !obj.up.equals(new Vector3(0, 1, 0))) {
    props['up'] = `[${a.rNbr(obj.up.x)}, ${a.rNbr(obj.up.y)}, ${a.rNbr(obj.up.z)}]`
  }

  if (isColored(obj) && obj.color.getHexString() !== 'ffffff')
    props['color'] = `"#${obj.color.getHexString()}"`
  if (obj.position && obj.position.isVector3 && a.rNbr(obj.position.length()))
    props['position'] =
      `[${a.rNbr(obj.position.x)}, ${a.rNbr(obj.position.y)}, ${a.rNbr(obj.position.z)}]`
  if (
    obj.rotation &&
    obj.rotation.isEuler &&
    a.rNbr(new Vector3(obj.rotation.x, obj.rotation.y, obj.rotation.z).length())
  ) {
    props['rotation'] =
      `[${a.rDeg(obj.rotation.x)}, ${a.rDeg(obj.rotation.y)}, ${a.rDeg(obj.rotation.z)}]`
  }
  if (
    obj.scale &&
    obj.scale.isVector3 &&
    !(a.rNbr(obj.scale.x) === 1 && a.rNbr(obj.scale.y) === 1 && a.rNbr(obj.scale.z) === 1)
  ) {
    const rX = a.rNbr(obj.scale.x)
    const rY = a.rNbr(obj.scale.y)
    const rZ = a.rNbr(obj.scale.z)
    if (rX === rY && rX === rZ) {
      props['scale'] = rX
    } else {
      props['scale'] = `[${rX}, ${rY}, ${rZ}]`
    }
  }
  if (options.meta && obj.userData && Object.keys(obj.userData).length) {
    props['userData'] = JSON.stringify(obj.userData)
  }
  return props
}
