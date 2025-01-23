import { GLTF } from 'node-three-gltf'
import { Object3D, Vector3 } from 'three'

import { JsxOptions } from '../options.js'
import { getType } from '../r3f/utils.js'
import { AnalyzedGLTF } from './AnalyzedGLTF.js'
import {
  isColored,
  isDecayed,
  isDistanced,
  isInstancedMesh,
  isLight,
  isMesh,
  isNotRemoved,
  isOrthographicCamera,
  isPerspectiveCamera,
  isPoints,
  isRemoved,
  isSkinnedMesh,
  isSpotLight,
  setRemoved,
} from './is.js'
import { shallowEqual } from './shallowEqual.js'
import { equalOrNegated, materialKey, sanitizeName } from './utils.js'

type Props = Record<string, any>

export function pruneAnalyzedGLTF(gltf: GLTF, options: Readonly<JsxOptions>) {
  const a = new AnalyzedGLTF(gltf, { instance: options.instance, instanceall: options.instanceall })

  function calculateProps(obj: Object3D): Props {
    const props: Props = {}
    const { animated, node, instanced } = a.getInfo(obj)
    const type = getType(obj)

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
      if (type === 'mesh' && options.shadows) {
        props['castShadow'] = true
        props['receiveShadow'] = true
      }

      if (isMesh(obj) && !isInstancedMesh(obj)) {
        // Write out geometry first
        props['geometry'] = `{${node}.geometry}`

        // Write out materials
        const materialName = materialKey(obj.material)
        if (materialName) props['material'] = `materials${sanitizeName(materialName)}`
        else props['material'] = `{${node}.material}`
      }
    }

    if (isInstancedMesh(obj)) {
      if (obj.instanceMatrix) props['instanceMatrix'] = `{${node}.instanceMatrix}`
      if (obj.instanceColor) props['instanceColor'] = `{${node}.instanceColor}`
    }
    if (isSkinnedMesh(obj)) props['skeleton'] = `{${node}.skeleton} `
    if (obj.visible === false) props['visible'] = false
    if (obj.castShadow === true) props['castShadow'] = true
    if (obj.receiveShadow === true) props['receiveShadow'] = true
    if (isPoints(obj)) {
      props['morphTargetDictionary'] = `{${node}.morphTargetDictionary}`
      props['morphTargetInfluences'] = `{${node}.morphTargetInfluences}`
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
      props['up'] = `{[${a.rNbr(obj.up.x)}, ${a.rNbr(obj.up.y)}, ${a.rNbr(obj.up.z)}]}`
    }

    if (isColored(obj) && obj.color.getHexString() !== 'ffffff')
      props['color'] = `"#${obj.color.getHexString()}"`
    if (obj.position && obj.position.isVector3 && a.rNbr(obj.position.length()))
      props['position'] =
        `{[${a.rNbr(obj.position.x)}, ${a.rNbr(obj.position.y)}, ${a.rNbr(obj.position.z)}]}`
    if (
      obj.rotation &&
      obj.rotation.isEuler &&
      a.rNbr(new Vector3(obj.rotation.x, obj.rotation.y, obj.rotation.z).length())
    ) {
      props['rotation'] =
        `{[${a.rDeg(obj.rotation.x)}, ${a.rDeg(obj.rotation.y)}, ${a.rDeg(obj.rotation.z)},]}`
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
        props['scale'] = `{[${rX}, ${rY}, ${rZ}]}`
      }
    }
    if (options.meta && obj.userData && Object.keys(obj.userData).length) {
      props['userData'] = JSON.stringify(obj.userData)
    }
    return props
  }

  function prune(
    obj: Object3D,
    // children: string,
    props: Props, // result: string,
    oldProps: Props, // oldResult: string,
  ): boolean {
    const { animated } = a.getInfo(obj)
    const type = getType(obj)
    // Prune ...
    if (
      isNotRemoved(obj) &&
      !options.keepgroups &&
      !animated &&
      (type === 'group' || type === 'scene')
    ) {
      /** Empty or no-property groups
       *    <group>
       *      <mesh geometry={nodes.foo} material={materials.bar} />
       *  Solution:
       *    <mesh geometry={nodes.foo} material={materials.bar} />
       */
      if (obj.children.length === 0 || shallowEqual(props, oldProps)) {
        if (options.debug) {
          console.log(`group ${obj.name} removed (empty)`)
        }
        setRemoved(obj)
        return true // children
      }

      // More aggressive removal strategies ...
      const first = obj.children[0]
      const firstProps = calculateProps(first)
      //const regex = /([a-z-A-Z]*)={([a-zA-Z0-9.[\]\-, /]*)}/g // original before linting /([a-z-A-Z]*)={([a-zA-Z0-9\.\[\]\-\,\ \/]*)}/g
      const propsKeys = Object.keys(props) // [...result.matchAll(regex)].map(([, match]) => match)
      // const values1 = [...result.matchAll(regex)].map(([, , match]) => match)
      const firstPropsKeys = Object.keys(firstProps) // [...firstProps.matchAll(regex)].map(([, match]) => match)

      /** Double negative rotations
       *    <group rotation={[-Math.PI / 2, 0, 0]}>
       *      <group rotation={[Math.PI / 2, 0, 0]}>
       *        <mesh geometry={nodes.foo} material={materials.bar} />
       *  Solution:
       *    <mesh geometry={nodes.foo} material={materials.bar} />
       */
      if (
        obj.children.length === 1 &&
        getType(first) === type &&
        equalOrNegated(obj.rotation, first.rotation)
      ) {
        if (
          propsKeys.length === 1 &&
          firstPropsKeys.length === 1 &&
          propsKeys[0] === 'rotation' &&
          firstPropsKeys[0] === 'rotation'
        ) {
          if (options.debug) {
            console.log(`group ${obj.name} removed (aggressive: double negative rotation)`)
          }
          setRemoved(obj, isRemoved(first))
          // children = ''
          if (first.children) {
            first.children.forEach((child) => {
              walk(child)
            })
          }
          return true // children
        }
      }

      /** Double negative rotations w/ props
       *    <group rotation={[-Math.PI / 2, 0, 0]}>
       *      <group rotation={[Math.PI / 2, 0, 0]} scale={0.01}>
       *        <mesh geometry={nodes.foo} material={materials.bar} />
       *  Solution:
       *    <group scale={0.01}>
       *      <mesh geometry={nodes.foo} material={materials.bar} />
       */
      if (
        obj.children.length === 1 &&
        getType(first) === type &&
        equalOrNegated(obj.rotation, first.rotation)
      ) {
        if (
          propsKeys.length === 1 &&
          firstPropsKeys.length > 1 &&
          propsKeys[0] === 'rotation' &&
          firstPropsKeys.includes('rotation')
        ) {
          if (options.debug) {
            console.log(`group ${obj.name} removed (aggressive: double negative rotation w/ props)`)
          }
          setRemoved(obj)
          // Remove rotation from first child
          first.rotation.set(0, 0, 0)
          walk(first)
          return true // children
        }
      }

      /** Transform overlap
       *    <group position={[10, 0, 0]} scale={2} rotation={[-Math.PI / 2, 0, 0]}>
       *      <mesh geometry={nodes.foo} material={materials.bar} />
       *  Solution:
       *    <mesh geometry={nodes.foo} material={materials.bar} position={[10, 0, 0]} scale={2} rotation={[-Math.PI / 2, 0, 0]} />
       */
      const isChildTransformed =
        firstPropsKeys.includes('position') ||
        firstPropsKeys.includes('rotation') ||
        firstPropsKeys.includes('scale')
      const hasOtherProps = propsKeys.some(
        (key) => !['position', 'scale', 'rotation'].includes(key),
      )
      if (
        obj.children.length === 1 &&
        isNotRemoved(first) &&
        !isChildTransformed &&
        !hasOtherProps
      ) {
        if (options.debug) {
          console.log(`group ${obj.name} removed (aggressive: ${propsKeys.join(' ')} overlap)`)
        }
        // Move props over from the to-be-deleted object to the child
        // This ensures that the child will have the correct transform when pruning is being repeated
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        propsKeys.forEach((key) => (obj.children[0] as any)[key].copy((obj as any)[key]))
        // Insert the props into the result string
        walk(first)
        setRemoved(obj)
        return true // children
      }

      /** Lack of content
       *    <group position={[10, 0, 0]} scale={2} rotation={[-Math.PI / 2, 0, 0]}>
       *      <group position={[10, 0, 0]} scale={2} rotation={[-Math.PI / 2, 0, 0]}>
       *        <group position={[10, 0, 0]} scale={2} rotation={[-Math.PI / 2, 0, 0]} />
       * Solution:
       *   (delete the whole sub graph)
       */
      const empty: Object3D[] = []
      obj.traverse((o) => {
        const type = getType(o)
        if (type !== 'group' && type !== 'object3D') empty.push(o)
      })
      if (!empty.length) {
        if (options.debug) console.log(`group ${obj.name} removed (aggressive: lack of content)`)
        empty.forEach((child) => setRemoved(child))
        return true // ''
      }
    }

    //?
    return isRemoved(obj) // false // children
  }

  function walk(obj: Object3D): Object3D {
    // let result = ''
    // let children = ''
    const { node, instanced, animated } = a.getInfo(obj)
    const type = getType(obj)

    // Check if the root node is useless
    if (isRemoved(obj) && obj.children.length) {
      obj.children.forEach((child) => {
        /*result +=*/ walk(child)
      })
      return obj
    }

    // Bail out on bones
    if (!options.bones && type === 'bone') {
      return obj
    }

    // Collect children
    if (obj.children) {
      obj.children.forEach((child) => {
        /*children +=*/ walk(child)
      })
    }

    // FIXME After conversion props/oldProps had name at this point, that's it....but old code had a bunch of string
    // FIXME generated jsx for instanced code/bones.  It seems like an irrelevant pattern to match now, different
    // FIXME conditons need to be checked to accopmlish whatever was being done before.
    // const oldProps = props
    const oldProps: Props = {} // FIXME
    const props = calculateProps(obj)
    const pruned = prune(obj, /*children,*/ props, oldProps)
    // Bail out if the object was pruned
    if (pruned) return obj //FIXME was: pruned what should this be?

    return obj // FIXME: same as pruned???
  }

  try {
    if (!options.keepgroups) {
      // Dry run to prune graph
      walk(gltf.scene)

      // Move children of deleted objects to their new parents
      a.objects.forEach((o) => {
        if (isRemoved(o)) {
          let parent = o.parent
          // Making sure we don't add to a removed parent
          while (parent && isRemoved(parent)) parent = parent.parent
          // If no parent was found it must be the root node
          if (!parent) parent = gltf.scene
          o.children.slice().forEach((child) => parent.add(child))
        }
      })

      // Remove deleted objects
      a.objects.forEach((o) => {
        if (isRemoved(o) && o.parent) o.parent.remove(o)
      })
    }
    // 2nd pass to eliminate hard to swat left-overs
    walk(gltf.scene)
  } catch (e) {
    console.log('Error while parsing glTF', e)
  }
}
