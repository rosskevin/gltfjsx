import { GLTF } from 'node-three-gltf'
import { Object3D } from 'three'

import { JsxOptions, PruneOptions } from '../options.js'
import { AnalyzedGLTF } from './AnalyzedGLTF.js'
import { calculateProps, Props } from './calculateProps.js'
import { isNotRemoved, isRemoved, setRemoved } from './is.js'
import { shallowEqual } from './shallowEqual.js'
import { equalOrNegated, getType } from './utils.js'

function prune<O extends PruneOptions>(
  obj: Object3D,
  // children: string,
  props: Props, // result: string,
  oldProps: Props, // oldResult: string,
  a: AnalyzedGLTF,
  options: Readonly<O>,
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
      // FIXME actual calc of oldProps is never sent...
      if (options.debug) {
        console.log(`group ${obj.name} removed (empty)`)
      }
      setRemoved(obj)
      return true // children
    }

    // More aggressive removal strategies ...
    const first = obj.children[0]
    const firstProps = calculateProps(first, a, options)
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
            walk(child, a, options)
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
        walk(first, a, options)
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
    const hasOtherProps = propsKeys.some((key) => !['position', 'scale', 'rotation'].includes(key))
    if (obj.children.length === 1 && isNotRemoved(first) && !isChildTransformed && !hasOtherProps) {
      if (options.debug) {
        console.log(`group ${obj.name} removed (aggressive: ${propsKeys.join(' ')} overlap)`)
      }
      // Move props over from the to-be-deleted object to the child
      // This ensures that the child will have the correct transform when pruning is being repeated
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      propsKeys.forEach((key) => (obj.children[0] as any)[key].copy((obj as any)[key]))
      // Insert the props into the result string
      walk(first, a, options)
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

function walk<O extends PruneOptions>(
  obj: Object3D,
  a: AnalyzedGLTF,
  options: Readonly<O>,
): Object3D {
  // let result = ''
  // let children = ''
  const { node, instanced, animated } = a.getInfo(obj)
  const type = getType(obj)

  // Check if the root node is useless
  if (isRemoved(obj) && obj.children.length) {
    obj.children.forEach((child) => {
      /*result +=*/ walk(child, a, options)
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
      /*children +=*/ walk(child, a, options)
    })
  }

  // FIXME After conversion props/oldProps had name at this point, that's it....but old code had a bunch of string
  // FIXME generated jsx for instanced code/bones.  It seems like an irrelevant pattern to match now, different
  // FIXME conditons need to be checked to accopmlish whatever was being done before.
  // const oldProps = props
  const oldProps: Props = {} // FIXME
  const props = calculateProps(obj, a, options)
  const pruned = prune(obj, /*children,*/ props, oldProps, a, options)
  // Bail out if the object was pruned
  if (pruned) return obj //FIXME was: pruned what should this be?

  return obj // FIXME: same as pruned???
}

export function pruneAnalyzedGLTF(gltf: GLTF, options: Readonly<JsxOptions>) {
  const a = new AnalyzedGLTF(gltf, { instance: options.instance, instanceall: options.instanceall })
  try {
    if (!options.keepgroups) {
      // Dry run to prune graph
      walk(gltf.scene, a, options)

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
    walk(gltf.scene, a, options)
  } catch (e) {
    console.log('Error while parsing glTF', e)
  }
}
