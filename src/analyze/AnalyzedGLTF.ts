import { GLTF } from 'node-three-gltf'
import { Material, Mesh, Object3D } from 'three'

import { descObj3D } from '../Log.js'
import { PropsOptions } from '../options.js'
import { calculateProps } from './calculateProps.js'
import { isBone, isGroup, isMesh, isNotRemoved, isRemoved, setRemoved } from './is.js'
import { equalOrNegated, meshKey, nodeName, sanitizeMeshName } from './utils.js'

interface AnalyzedGLTFOptions extends PropsOptions {
  // bones?: boolean
  // instance?: boolean
  // instanceall?: boolean
  // keepgroups?: boolean
  precision?: number
}

/**
 * Analyze given GLTF, remove duplicates and prune the scene
 */
export class AnalyzedGLTF {
  /**
   * Duplicates found in the scene
   */
  public dupMaterials: Record<string, number> = {}
  public dupGeometries: Record<string, { count: number; name: string; node: string }> = {}

  /** All objects in the scene */
  public objects: Object3D[] = []

  public gltf: GLTF
  public options: AnalyzedGLTFOptions

  constructor(gltf: GLTF, options: AnalyzedGLTFOptions) {
    this.gltf = gltf
    this.options = options

    // Collect all objects in the scene
    this.gltf.scene.traverse((child: Object3D) => this.objects.push(child))

    // Collect all duplicates
    this.collectDuplicates()

    // Prune duplicate geometries
    this.pruneDuplicates()

    // Prune all (other) strategies
    this.pruneAllStrategies()
  }

  public hasAnimations() {
    return this.gltf.animations && this.gltf.animations.length > 0
  }

  public hasInstances(): boolean {
    return (this.options.instance || this.options.instanceall) &&
      Object.keys(this.dupGeometries).length > 0
      ? true
      : false
  }

  public rNbr(n: number) {
    return parseFloat(n.toFixed(Math.round(this.options.precision || 2)))
  }

  public rDeg(n: number) {
    const abs = Math.abs(Math.round(n * 100000))
    for (let i = 1; i <= 10; i++) {
      if (abs === Math.round((Math.PI / i) * 100000))
        return `${n < 0 ? '-' : ''}Math.PI${i > 1 ? ' / ' + i : ''}`
    }
    for (let i = 1; i <= 10; i++) {
      if (abs === Math.round(Math.PI * i * 100000))
        return `${n < 0 ? '-' : ''}Math.PI${i > 1 ? ' * ' + i : ''}`
    }
    return this.rNbr(n)
  }

  public getInfo(obj: Object3D): {
    // type: string
    node: string
    instanced: boolean
    animated: boolean
  } {
    const { instance, instanceall } = this.options
    /* const type = getType(obj) */
    const node = nodeName(obj)
    let instanced =
      (instance || instanceall) &&
      isMesh(obj) &&
      obj.geometry &&
      obj.material &&
      this.dupGeometries[meshKey(obj)] &&
      this.dupGeometries[meshKey(obj)].count > (instanceall ? 0 : 1)
    instanced = instanced === undefined ? false : instanced
    return { /*type,*/ node, instanced, animated: this.hasAnimations() }
  }

  //
  private uniqueName(attempt: string, index = 0): string {
    const newAttempt = index > 0 ? attempt + index : attempt
    if (Object.values(this.dupGeometries).find(({ name }) => name === newAttempt) === undefined)
      return newAttempt
    else return this.uniqueName(attempt, index + 1)
  }

  private collectDuplicates() {
    // collect duplicates
    this.gltf.scene.traverse((o: Object3D) => {
      if (isMesh(o)) {
        const mesh = o as Mesh
        // materials
        this.colectDuplicateMaterial(mesh.material)

        // geometry
        if (mesh.geometry) {
          const key = meshKey(mesh)
          if (!this.dupGeometries[key]) {
            this.dupGeometries[key] = {
              count: 1,
              name: this.uniqueName(sanitizeMeshName(mesh)),
              node: nodeName(mesh), // 'nodes' + sanitizeName(mesh.name),
            }
          } else {
            this.dupGeometries[key].count++
          }
        }
      }
    })
  }

  private colectDuplicateMaterial(material: Material | Material[]) {
    if (Array.isArray(material)) {
      material.forEach((m) => this.colectDuplicateMaterial(m))
    } else {
      if (material.name) {
        if (!this.dupMaterials[material.name]) {
          this.dupMaterials[material.name] = 1
        } else {
          this.dupMaterials[material.name]++
        }
      }
    }
  }

  private pruneDuplicates() {
    // Prune duplicate geometries
    if (!this.options.instanceall) {
      for (const key of Object.keys(this.dupGeometries)) {
        const duplicate = this.dupGeometries[key]
        // if there is only one geometry, it's not a duplicate and we won't instance it
        if (duplicate.count === 1) {
          delete this.dupGeometries[key]
          this.options.log.debug(`Deleted duplicate Geometry: ${duplicate.name}`)
        }
      }
    }
  }

  private pruneAllStrategies() {
    const { log, keepgroups } = this.options
    try {
      if (!keepgroups) {
        // Dry run to prune graph
        this.walk(this.gltf.scene)
        this.compact()
      }
      // 2nd pass to eliminate hard to swat left-overs
      this.walk(this.gltf.scene)
      this.compact()
    } catch (e) {
      log.error('Error during pruneAnalyzedGLTF: ', e)
    }
  }

  private walk(obj: Object3D): Object3D {
    const { log, bones } = this.options

    // Check if the root node is useless
    if (isRemoved(obj) && obj.children.length) {
      obj.children.forEach((child) => {
        this.walk(child)
      })
      return obj
    }

    // Bail out on bones
    if (!bones && isBone(obj)) {
      return obj
    }

    // Walk the children first
    if (obj.children) {
      obj.children.forEach((child) => {
        this.walk(child)
      })
    }

    const pruned = this.prune(obj)
    if (pruned) {
      log.debug('Pruned: ', descObj3D(obj))
    }

    return obj
  }

  /**
   * Reorganize graph and remove deleted objects
   */
  private compact() {
    // Move children of deleted objects to their new parents
    this.objects.forEach((o) => {
      if (isRemoved(o)) {
        let parent = o.parent
        // Making sure we don't add to a removed parent
        while (parent && isRemoved(parent)) parent = parent.parent
        // If no parent was found it must be the root node
        if (!parent) parent = this.gltf.scene
        o.children.slice().forEach((child) => parent.add(child))
      }
    })

    // Remove deleted objects
    this.objects.forEach((o) => {
      if (isRemoved(o) && o.parent) o.parent.remove(o)
    })
  }

  private prune(obj: Object3D): boolean {
    const props = calculateProps(obj, this)
    const { animated } = this.getInfo(obj)
    const { log, keepgroups } = this.options
    // const type = getType(obj)
    if (
      isNotRemoved(obj) &&
      !keepgroups &&
      !animated &&
      isGroup(obj) // scene is also a group too
    ) {
      /** Empty or no-property groups
       *    <group>
       *      <mesh geometry={nodes.foo} material={materials.bar} />
       *  Solution:
       *    <mesh geometry={nodes.foo} material={materials.bar} />
       */
      const noChildren = obj.children.length === 0
      const noProps = Object.keys(props).length === 0
      if (noChildren || noProps) {
        log.debug(`Removed (${noChildren ? 'no children' : 'no props'}): `, descObj3D(obj))
        setRemoved(obj)
        return true // children
      }

      // More aggressive removal strategies ...
      const first = obj.children[0]
      const firstProps = calculateProps(first, this)
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
          // children = ''
          if (first.children) {
            first.children.forEach((child) => {
              this.walk(child)
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
          this.walk(first)
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
        log.debug(`Removed (aggressive: ${propsKeys.join(' ')} overlap): `, descObj3D(obj))

        // Move props over from the to-be-deleted object to the child
        // This ensures that the child will have the correct transform when pruning is being repeated
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        propsKeys.forEach((key) => (obj.children[0] as any)[key].copy((obj as any)[key]))
        // Insert the props into the result string
        this.walk(first)
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
        if (!isGroup(o)) {
          empty.push(o)
        }
      })
      if (!empty.length) {
        log.debug('Removed (aggressive: lack of content): ', descObj3D(obj))
        empty.forEach((child) => setRemoved(child))
        return true // ''
      }
    }

    //?
    return isRemoved(obj) // false // children
  }
}
