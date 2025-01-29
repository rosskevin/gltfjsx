import { Object3D } from 'three'

import { descObj3D } from '../Log.js'
import { Props } from '../utils/types.js'
import { AnalyzedGLTF } from './AnalyzedGLTF.js'
import { isChildless, isGroup, isNotRemoved, isRemoved, setRemoved } from './is.js'
import { equalOrNegated } from './utils.js'

export type PruneStrategy = (a: AnalyzedGLTF, obj: Object3D, props: Props) => boolean

/**
 * Empty or no-property groups
 *    <group>
 *      <mesh geometry={nodes.foo} material={materials.bar} />
 *  Solution:
 *    <mesh geometry={nodes.foo} material={materials.bar} />
 */
export const pruneEmpty: PruneStrategy = (a, obj, props) => {
  const { log, keepgroups } = a.options

  if (
    !keepgroups &&
    !a.hasAnimations() &&
    isGroup(obj) // scene is also a group too
  ) {
    const noChildren = obj.children.length === 0
    const noProps = Object.keys(props).length === 0
    if (noChildren || noProps) {
      log.debug(`Removed (${noChildren ? 'no children' : 'no props'}): `, descObj3D(obj))
      setRemoved(obj)
      return true
    }
  }
  return false
}

/**
 * Double negative rotations
 *    <group rotation={[-Math.PI / 2, 0, 0]}>
 *      <group rotation={[Math.PI / 2, 0, 0]}>
 *        <mesh geometry={nodes.foo} material={materials.bar} />
 *  Solution:
 *    <mesh geometry={nodes.foo} material={materials.bar} />
 */
export const pruneDoubleNegativeRotation: PruneStrategy = (a, obj, props) => {
  const { log } = a.options

  if (isChildless(obj)) return false

  const propsKeys = Object.keys(props)
  const first = obj.children[0]
  const firstPropsKeys = Object.keys(a.calculateProps(first))

  if (
    obj.children.length === 1 &&
    first.type === obj.type &&
    equalOrNegated(obj.rotation, first.rotation)
  ) {
    if (
      propsKeys.length === 1 &&
      firstPropsKeys.length === 1 &&
      propsKeys[0] === 'rotation' &&
      firstPropsKeys[0] === 'rotation'
    ) {
      log.debug('Removed (aggressive: double negative rotation): ', descObj3D(obj))

      setRemoved(obj, isRemoved(first))
      if (first.children) {
        first.children.forEach((child) => {
          a.visitAndPrune(child)
        })
      }
      return true
    }
  }
  return false
}

/**
 * Double negative rotations w/ props
 *    <group rotation={[-Math.PI / 2, 0, 0]}>
 *      <group rotation={[Math.PI / 2, 0, 0]} scale={0.01}>
 *        <mesh geometry={nodes.foo} material={materials.bar} />
 *  Solution:
 *    <group scale={0.01}>
 *      <mesh geometry={nodes.foo} material={materials.bar} />
 */
export const pruneDoubleNegativeRotationWithProps: PruneStrategy = (a, obj, props) => {
  const { log } = a.options

  if (isChildless(obj)) return false

  const propsKeys = Object.keys(props)
  const first = obj.children[0]
  const firstPropsKeys = Object.keys(a.calculateProps(first))

  if (
    obj.children.length === 1 &&
    first.type === obj.type &&
    equalOrNegated(obj.rotation, first.rotation)
  ) {
    if (
      propsKeys.length === 1 &&
      firstPropsKeys.length > 1 &&
      propsKeys[0] === 'rotation' &&
      firstPropsKeys.includes('rotation')
    ) {
      log.debug('Removed (aggressive: double negative rotation w/ props): ', descObj3D(obj))

      setRemoved(obj)
      // Remove rotation from first child
      first.rotation.set(0, 0, 0)
      a.visitAndPrune(first)
      return true
    }
  }
  return false
}

/**
 * Transform overlap
 *    <group position={[10, 0, 0]} scale={2} rotation={[-Math.PI / 2, 0, 0]}>
 *      <mesh geometry={nodes.foo} material={materials.bar} />
 *  Solution:
 *    <mesh geometry={nodes.foo} material={materials.bar} position={[10, 0, 0]} scale={2} rotation={[-Math.PI / 2, 0, 0]} />
 */
export const pruneTransformOverlap: PruneStrategy = (a, obj, props) => {
  const { log } = a.options

  if (isChildless(obj)) return false

  const propsKeys = Object.keys(props)
  const first = obj.children[0]
  const firstPropsKeys = Object.keys(a.calculateProps(first))

  const isChildTransformed =
    firstPropsKeys.includes('position') ||
    firstPropsKeys.includes('rotation') ||
    firstPropsKeys.includes('scale')
  const hasOtherProps = propsKeys.some((key) => !['position', 'scale', 'rotation'].includes(key))
  if (obj.children.length === 1 && isNotRemoved(first) && !isChildTransformed && !hasOtherProps) {
    log.debug(`Removed (aggressive: ${propsKeys.join(' ')} overlap): `, descObj3D(obj))

    // Move props over from the to-be-deleted object to the child
    // This ensures that the child will have the correct transform when pruning is being repeated
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    propsKeys.forEach((key) => (obj.children[0] as any)[key].copy((obj as any)[key]))
    // Insert the props into the result string
    a.visitAndPrune(first)
    setRemoved(obj)
    return true
  }
  return false
}

/** Lack of content
 *    <group position={[10, 0, 0]} scale={2} rotation={[-Math.PI / 2, 0, 0]}>
 *      <group position={[10, 0, 0]} scale={2} rotation={[-Math.PI / 2, 0, 0]}>
 *        <group position={[10, 0, 0]} scale={2} rotation={[-Math.PI / 2, 0, 0]} />
 * Solution:
 *   (delete the whole sub graph)
 */
export const pruneLackOfContent: PruneStrategy = (a, obj, props) => {
  const { log } = a.options

  const empty: Object3D[] = []
  obj.traverse((o) => {
    if (!isGroup(o)) {
      empty.push(o)
    }
  })
  if (!empty.length) {
    log.debug('Removed (aggressive: lack of content): ', descObj3D(obj))
    empty.forEach((child) => setRemoved(child))
    return true // ''
  }
  return false
}

export const allPruneStrategies: PruneStrategy[] = [
  pruneEmpty,
  pruneDoubleNegativeRotation,
  pruneDoubleNegativeRotationWithProps,
  pruneTransformOverlap,
  pruneLackOfContent,
]
