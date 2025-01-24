import { GLTF } from 'node-three-gltf'
import { Material, Mesh, Object3D } from 'three'

import { isMesh } from './is.js'
import { meshKey, nodeName, sanitizeMeshName } from './utils.js'

interface AnalyzedGLTFOptions {
  instance?: boolean
  instanceall?: boolean
  precision?: number
}

export class AnalyzedGLTF {
  /**
   * Duplicates found in the scene
   */
  public dupMaterials: Record<string, number> = {}
  public dupGeometries: Record<string, { count: number; name: string; node: string }> = {}

  /** All objects in the scene */
  public objects: Object3D[] = []

  public gltf: GLTF
  private options: AnalyzedGLTFOptions

  constructor(gltf: GLTF, options: AnalyzedGLTFOptions) {
    this.gltf = gltf
    this.options = options

    // Collect all objects in the scene
    this.gltf.scene.traverse((child: Object3D) => this.objects.push(child))

    // Collect all duplicates
    this.collectDuplicates()

    // Prune duplicate geometries
    this.pruneDuplicates()
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
        }
      }
    }
  }
}
