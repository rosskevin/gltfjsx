import { GLTF } from 'node-three-gltf'
import { Bone, Material, Mesh, Object3D, Vector3 } from 'three'

import { descObj3D } from '../Log.js'
import { AnalyzedGLTFOptions } from '../options.js'
import { Props } from '../utils/types.js'
import {
  isBone,
  isColored,
  isDecayed,
  isDistanced,
  isFn,
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
} from './is.js'
import { allPruneStrategies, PruneStrategy } from './pruneStrategies.js'
import {
  collectMaterials,
  materialKey,
  meshKey,
  nodeName,
  sanitizeMeshName,
  sanitizeName,
} from './utils.js'

/**
 * Analyze given GLTF, remove duplicates and prune the scene. This class is agnostic of the generated output
 * or target framework e.g. react-three-fiber.
 */
export class AnalyzedGLTF<O extends AnalyzedGLTFOptions = AnalyzedGLTFOptions> {
  /**
   * Duplicates found in the scene
   */
  public dupMaterials: Record<string, number> = {}
  public dupGeometries: Record<string, { count: number; name: string; node: string }> = {}

  /** All objects in the scene */
  public objects: Object3D[] = []

  public gltf: GLTF
  public options: AnalyzedGLTFOptions

  private pruneStrategies: PruneStrategy[]

  constructor(
    gltf: GLTF,
    options: Readonly<O>,
    pruneStrategies: PruneStrategy[] = allPruneStrategies,
  ) {
    this.gltf = gltf
    this.options = options
    this.pruneStrategies = pruneStrategies

    // Collect all objects in the scene
    this.gltf.scene.traverse((child: Object3D) => this.objects.push(child))

    // Collect all duplicates
    this.collectDuplicates()

    // Prune duplicate geometries
    this.pruneDuplicates()

    // Prune all (other) strategies
    this.pruneAllStrategies()
  }

  /**
   * Determine if pruned scene contains any of the given objects (that have not been removed)
   */
  public includes(is: isFn) {
    for (const o of this.objects) {
      if (isNotRemoved(o) && is(o)) {
        return true
      }
    }
    return false
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

  public getMeshes(): Mesh[] {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.objects.filter((o) => isMesh(o) && isNotRemoved(o)) as any
  }

  public getBones(): Bone[] {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.objects.filter(
      (o) => isBone(o) && !(o.parent && isBone(o.parent)) && isNotRemoved(o),
    ) as any
  }

  public getMaterials(): Material[] {
    return [...new Set(this.getMeshes().flatMap((o) => collectMaterials(o.material)))]
  }

  public isInstanced(o: Object3D): boolean {
    if (!o) {
      throw new Error('obj is undefined')
    }
    const { instance, instanceall } = this.options
    let instanced =
      (instance || instanceall) &&
      isMesh(o) &&
      o.geometry &&
      o.material &&
      this.dupGeometries[meshKey(o)] &&
      this.dupGeometries[meshKey(o)].count > (instanceall ? 0 : 1)
    instanced = instanced === undefined ? false : instanced
    return instanced
  }

  /**
   * Exposed for external PruneStrategies
   */
  public visitAndPrune(obj: Object3D): Object3D {
    const { log, bones } = this.options

    // Check if the root node is useless
    if (isRemoved(obj) && obj.children.length) {
      obj.children.forEach((child) => {
        this.visitAndPrune(child)
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
        this.visitAndPrune(child)
      })
    }

    const pruned = this.prune(obj)
    if (pruned) {
      log.debug('Pruned: ', descObj3D(obj))
    }

    return obj
  }

  public calculateProps(obj: Object3D): Props {
    if (!obj) {
      throw new Error('obj is undefined')
    }

    const props: Props = {}
    const node = nodeName(obj)

    // name: include name when output is uncompressed or morphTargetDictionaries are present
    if (
      obj.name.length &&
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      (this.options.keepnames || (obj as any).morphTargetDictionary || this.hasAnimations())
    ) {
      props['name'] = obj.name
    }

    // camera
    if (isPerspectiveCamera(obj) || isOrthographicCamera(obj)) {
      props['makeDefault'] = false
      if (obj.zoom !== 1) props['zoom'] = this.rNbr(obj.zoom)
      if (obj.far !== 2000) props['far'] = this.rNbr(obj.far)
      if (obj.near !== 0.1) props['near'] = this.rNbr(obj.near)
    }
    if (isPerspectiveCamera(obj)) {
      if (obj.fov !== 50) props['fov'] = this.rNbr(obj.fov)
    }

    // non-instanced
    if (!this.isInstanced(obj)) {
      // shadows
      if (isMesh(obj) && this.options.shadows) {
        props['castShadow'] = true
        props['receiveShadow'] = true
      }

      if (isMesh(obj) && !isInstancedMesh(obj)) {
        // geometry
        props['geometry'] = `${node}.geometry`

        // material
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
      if (this.rNbr(obj.intensity)) props['intensity'] = this.rNbr(obj.intensity)
    }
    //if (obj.power && obj.power !== 4 * Math.PI) props['power'] = ${this.rNbr(obj.power)} `
    if (isSpotLight(obj)) {
      if (obj.angle !== Math.PI / 3) props['angle'] = this.rDeg(obj.angle)
      if (obj.penumbra && this.rNbr(obj.penumbra) !== 0) props['penumbra'] = this.rNbr(obj.penumbra)
    }

    // SpotLight | PointLight
    if (isDecayed(obj)) {
      if (obj.decay && this.rNbr(obj.decay) !== 1) props['decay'] = this.rNbr(obj.decay)
    }
    if (isDistanced(obj)) {
      if (obj.distance && this.rNbr(obj.distance) !== 0) props['distance'] = this.rNbr(obj.distance)
    }

    if (obj.up && obj.up.isVector3 && !obj.up.equals(new Vector3(0, 1, 0))) {
      props['up'] = `[${this.rNbr(obj.up.x)}, ${this.rNbr(obj.up.y)}, ${this.rNbr(obj.up.z)}]`
    }

    if (isColored(obj) && obj.color.getHexString() !== 'ffffff')
      props['color'] = `"#${obj.color.getHexString()}"`
    if (obj.position && obj.position.isVector3 && this.rNbr(obj.position.length()))
      props['position'] =
        `[${this.rNbr(obj.position.x)}, ${this.rNbr(obj.position.y)}, ${this.rNbr(obj.position.z)}]`
    if (
      obj.rotation &&
      obj.rotation.isEuler &&
      this.rNbr(new Vector3(obj.rotation.x, obj.rotation.y, obj.rotation.z).length())
    ) {
      props['rotation'] =
        `[${this.rDeg(obj.rotation.x)}, ${this.rDeg(obj.rotation.y)}, ${this.rDeg(obj.rotation.z)}]`
    }
    if (
      obj.scale &&
      obj.scale.isVector3 &&
      !(
        this.rNbr(obj.scale.x) === 1 &&
        this.rNbr(obj.scale.y) === 1 &&
        this.rNbr(obj.scale.z) === 1
      )
    ) {
      const rX = this.rNbr(obj.scale.x)
      const rY = this.rNbr(obj.scale.y)
      const rZ = this.rNbr(obj.scale.z)
      if (rX === rY && rX === rZ) {
        props['scale'] = rX
      } else {
        props['scale'] = `[${rX}, ${rY}, ${rZ}]`
      }
    }
    if (this.options.meta && obj.userData && Object.keys(obj.userData).length) {
      props['userData'] = JSON.stringify(obj.userData)
    }
    return props
  }

  //
  protected rNbr(n: number) {
    return parseFloat(n.toFixed(Math.round(this.options.precision || 2)))
  }

  protected rDeg(n: number) {
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
        this.visitAndPrune(this.gltf.scene)
        this.compact()
      }
      // 2nd pass to eliminate hard to swat left-overs
      this.visitAndPrune(this.gltf.scene)
      this.compact()
    } catch (e) {
      log.error('Error during pruneAnalyzedGLTF: ', e)
    }
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
    const props = this.calculateProps(obj)

    for (const pruneStrategy of this.pruneStrategies) {
      if (isNotRemoved(obj)) {
        if (pruneStrategy(this, obj, props)) {
          return true
        }
      }
    }
    return false
  }
}
