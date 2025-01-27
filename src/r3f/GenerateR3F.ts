import {
  FunctionDeclaration,
  InterfaceDeclaration,
  ObjectLiteralExpression,
  Project,
  ScriptTarget,
  SourceFile,
  SyntaxKind,
  VariableDeclarationKind,
} from 'ts-morph'

import { AnalyzedGLTF } from '../analyze/AnalyzedGLTF.js'
import { JsxOptions } from '../options.js'

export class GeneratedR3F {
  protected project: Project
  protected src: SourceFile
  protected gltfInterface!: InterfaceDeclaration
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
    this.gltfInterface = this.getInterface(this.getModelGLTFName())
    this.propsInterface = this.getInterface(this.getModelPropsName())

    const fn = this.src.getFunction(this.options.componentName)
    if (!fn) throw new Error('Model function not found')
    this.fn = fn

    // may or may not exist
    this.instancesFn = this.src.getFunction(this.getModelInstancesName())!
  }

  public generate(): SourceFile {
    const { log, header, instance, instanceall } = this.options

    // set constants - load path, draco
    this.setConstants()

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

  // FIXME remove this example
  protected deletemeObjectLiteralExample() {
    const variable = this.src.addVariableStatement({
      declarationKind: VariableDeclarationKind.Const,
      declarations: [{ name: 'example', initializer: '{}' }],
    })

    const objectLiteral: ObjectLiteralExpression = variable.getFirstDescendantByKindOrThrow(
      SyntaxKind.ObjectLiteralExpression,
    )

    objectLiteral.addPropertyAssignments([
      { name: 'property1', initializer: '123' },
      {
        name: 'property2',
        initializer: 'false',
      },
    ])
  }

  protected getModelPropsName() {
    return this.options.componentName + 'Props'
  }

  protected getModelGLTFName() {
    return this.options.componentName + 'GLTF'
  }

  protected getModelInstancesName() {
    return this.options.componentName + 'Instances'
  }

  protected getTemplate() {
    const { componentName, instanceall } = this.options
    const modelGLTFName = this.getModelGLTFName()
    const modelPropsName = this.getModelPropsName()
    const modelInstancesName = this.getModelInstancesName()
    const template = `
      import { useGLTF } from '@react-three/drei'
      import { GroupProps, MeshProps } from '@react-three/fiber'
      import * as React from 'react'
      import { Mesh, MeshStandardMaterial, GLTF } from 'three'
      import { GLTF } from 'three-stdlib'

      interface ${modelGLTFName} extends GLTF {
        nodes: {}
        materials: {}
      }

      export interface ${modelPropsName} extends GroupProps {}

      const modelLoadPath = '<foo>.glb'
      const draco = false

      ${
        instanceall
          ? `
      type ContextType = Record<string, React.ForwardRefExoticComponent<MeshProps>>

      const context = React.createContext<ContextType>({})

      export function ${modelInstancesName}({ children, ...props }: ${modelPropsName}) {
        const { nodes } = useGLTF(modelLoadPath, draco) as ${modelGLTFName}
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

      export function ${componentName}(props: ${modelPropsName}) {
        ${
          instanceall
            ? 'const instances = React.useContext(context)'
            : `const { nodes, materials } = useGLTF(modelLoadPath, draco) as ${modelGLTFName}`
        }
        return (
          <group {...props} dispose={null}/>
        )
      }

      useGLTF.preload(modelLoadPath, draco)
      `
    return template
  }

  /** convenience */
  private getInterface(name: string) {
    const i = this.src.getInterface(name)
    if (!i) throw new Error(`${name} interface not found`)
    return i
  }
}
