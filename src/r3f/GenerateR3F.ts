import {
  FunctionDeclaration,
  InterfaceDeclaration,
  Project,
  ScriptTarget,
  SourceFile,
} from 'ts-morph'

import { AnalyzedGLTF } from '../analyze/AnalyzedGLTF.js'
import { JsxOptions } from '../options.js'

export class GeneratedR3F {
  protected project: Project
  protected src: SourceFile
  protected propsInterface!: InterfaceDeclaration
  protected fn!: FunctionDeclaration
  protected instancesFn: FunctionDeclaration

  constructor(
    private a: AnalyzedGLTF,
    private options: Readonly<JsxOptions>,
  ) {
    this.project = new Project({
      useInMemoryFileSystem: true,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      compilerOptions: {
        target: ScriptTarget.ESNext,
        jsx: 1, // JsxEmit.Preserve bug https://github.com/dsherret/ts-morph/issues/1605
      } as any,
    })
    this.src = this.project.createSourceFile(`${options.componentName}.tsx`, this.getTemplate())

    // gather references before we rename them
    const propsInterface = this.src.getInterface('ModelProps')
    if (!propsInterface) throw new Error('ModelProps not found')
    this.propsInterface = propsInterface

    const fn = this.src.getFunction('Model')
    if (!fn) throw new Error('Model function not found')
    this.fn = fn

    // may or may not exist
    this.instancesFn = this.src.getFunction('ModelInstances')!
  }

  public generate(): SourceFile {
    const { log, header, instance, instanceall } = this.options

    // set constants - load path, draco
    this.setConstants()

    // rename ModelProps and Model function
    this.renameModel()

    // format after manipulation
    this.src.formatText()

    return this.src
  }

  public getSrc() {
    return this.src
  }

  /**
   * @returns the source as tsx
   */
  public toTsx() {
    return this.src.getFullText()
  }

  /**
   * @returns the source as jsx
   */
  public toJsx() {
    // npx tsc --jsx preserve -t esnext --outDir js --noEmit false
    const result = this.project.emitToMemory()
    return result.getFiles()[0].text
  }

  protected setConstants() {
    const { draco, modelLoadPath: inModelLoadPath } = this.options
    const modelLoadPath =
      (inModelLoadPath.toLowerCase().startsWith('http') ? '' : '/') + inModelLoadPath
    this.src.getVariableDeclaration('modelLoadPath')?.setInitializer(`'${modelLoadPath}'`)
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

    // rename the Model and ModelInstances fn, rename ModelProps arg
    this.fn.set({ name: componentName })
    this.instancesFn?.set({ name: componentName + 'Instances' })
    const props = this.fn.getParameters()[0]
    if (!props) throw new Error('Model props not found')
    props.setType(modelPropsName)
  }
  protected getTemplate() {
    const { instanceall } = this.options
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

      ${
        instanceall
          ? `
      type ContextType = Record<string, React.ForwardRefExoticComponent<MeshProps>>

      const context = React.createContext<ContextType>({})

      export function ModelInstances({ children, ...props }: ModelProps) {
        const { nodes } = useGLTF(modelLoadPath, draco) as GLTFResult
        const instances = React.useMemo(() => ({}), [nodes])
        return (
          <Merged meshes={instances} {...props}>
            {(instances: ContextType) => <context.Provider value={instances} children={children} />}
          </Merged>
        )
      }        
      `
          : ''
      }

      export function Model(props: ModelProps) {
        ${
          instanceall
            ? 'const instances = React.useContext(context)'
            : 'const { nodes, materials } = useGLTF(modelLoadPath, draco) as GLTFResult'
        }
        return (
          <group {...props} dispose={null}/>
        )
      }

      useGLTF.preload(modelLoadPath, draco)
      `
    return template
  }
}
