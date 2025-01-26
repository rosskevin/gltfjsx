import { FunctionDeclaration, InterfaceDeclaration, Project, SourceFile } from 'ts-morph'

import { AnalyzedGLTF } from '../analyze/AnalyzedGLTF.js'
import { JsxOptions } from '../options.js'

export class GeneratedR3F {
  protected project: Project
  protected src: SourceFile
  protected propsInterface!: InterfaceDeclaration
  protected fn!: FunctionDeclaration

  constructor(
    private a: AnalyzedGLTF,
    private options: Readonly<JsxOptions>,
  ) {
    this.project = new Project({ useInMemoryFileSystem: true })
    this.src = this.project.createSourceFile('in-memory-file.ts', this.getTemplate())

    // gather references before we rename them
    const propsInterface = this.src.getInterface('ModelProps')
    if (!propsInterface) throw new Error('ModelProps not found')
    this.propsInterface = propsInterface

    const fn = this.src.getFunction('Model')
    if (!fn) throw new Error('Model function not found')
    this.fn = fn
  }

  public generate(): SourceFile {
    const { log, header, instance, instanceall } = this.options

    // set constants - load path, draco
    this.setConstants()

    this.renameModel()

    // format after manipulation
    this.src.formatText()

    return this.src
  }

  protected setConstants() {
    const { draco, modelLoadPath: inModelLoadPath } = this.options
    const modelLoadPath =
      (inModelLoadPath.toLowerCase().startsWith('http') ? '' : '/') + inModelLoadPath
    this.src.getVariableDeclaration('modelLoadPath')?.setInitializer(modelLoadPath)
    this.src.getVariableDeclaration('draco')?.setInitializer(draco ? 'true' : 'false')
  }

  /**
   * Rename ModelProps and Model function
   */
  protected renameModel() {
    const { componentName } = this.options
    const modelPropsName = componentName + 'Props'

    // set ModelProps interface name
    this.propsInterface.set({ name: modelPropsName }) // does not rename everywhere

    // rename the Model fn and rename ModelProps arg
    this.fn.set({ name: componentName })
    const props = this.fn.getParameters()[0]
    if (!props) throw new Error('Model props not found')
    props.setType(modelPropsName)
  }
  protected getTemplate() {
    const template = `
      import { useGLTF } from '@react-three/drei'
      import { GroupProps } from '@react-three/fiber'
      import * as React from 'react'
      import { Mesh, MeshStandardMaterial, GLTF } from 'three'
      import { GLTF } from 'three-stdlib'

      interface GLTFResult extends GLTF {
        nodes: {}
        materials: {}
      }

      export interface ModelProps extends GroupProps {}

      const modelLoadPath = '<foo>.glb'
      const draco = false

      export function Model(props: ModelProps) {
        const { nodes, materials } = useGLTF(modelLoadPath, draco) as GLTFResult
        return (
          <group {...props} dispose={null}/>
        )
      }

      useGLTF.preload(modelLoadPath)
      `
    return template
  }
}
