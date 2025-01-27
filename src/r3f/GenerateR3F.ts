import { Bone, Mesh, Object3D } from 'three'
import {
  FormatCodeSettings,
  FunctionDeclaration,
  InterfaceDeclaration,
  ObjectLiteralExpression,
  Project,
  ScriptTarget,
  SourceFile,
  SyntaxKind,
  ts,
  VariableDeclarationKind,
} from 'ts-morph'

import { AnalyzedGLTF } from '../analyze/AnalyzedGLTF.js'
import { isBone, isNotRemoved, isTargetedLight } from '../analyze/is.js'
import isVarName from '../analyze/isVarName.js'
import { JsxOptions } from '../options.js'

/**
 * Generate React Three Fiber component
 *
 * This uses a mix of a string template, and ts-morph to generate the source file.  Protected member functions
 * are used to manipulate the source file and allow for extensibiilty/customization.  Customization of the
 * ts-morph {SourceFile} can also be done externally as opposed or in conjunction with extending this class.
 *
 * Much was converted to use stringified template for simplicity, but blocks can be moved out to ts-morph
 * as needed.
 */
export class GeneratedR3F {
  protected project: Project
  protected src: SourceFile
  protected gltfInterface!: InterfaceDeclaration
  protected propsInterface!: InterfaceDeclaration
  protected instancesFn: FunctionDeclaration
  protected fn!: FunctionDeclaration

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

    const { log, header, instance, instanceall } = this.options

    // set constants - load path, draco
    this.setConstants()

    this.setModelGLTFTypes()

    // format after manipulation
    this.src.formatText(this.getFormatCodeSettings())
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

  protected getFormatCodeSettings(): FormatCodeSettings {
    return {
      semicolons: ts.SemicolonPreference.Remove,
    }
  }

  protected setConstants() {
    const { draco, modelLoadPath: inModelLoadPath } = this.options
    const modelLoadPath =
      (inModelLoadPath.toLowerCase().startsWith('http') ? '' : '/') + inModelLoadPath
    this.src.getVariableDeclaration('modelLoadPath')?.setInitializer(`'${modelLoadPath}'`)
    this.src.getVariableDeclaration('draco')?.setInitializer(draco ? 'true' : 'false')
  }

  protected setModelGLTFTypes() {
    // nodes
    const meshes: Mesh[] = this.a.getMeshes()
    const bones: Bone[] = this.a.getBones()
    const nodes = this.gltfInterface.getProperty('nodes')
    if (!nodes) throw new Error('gltfInterface nodes not found')
    nodes.setType(
      `{ ${[...meshes, ...bones].map(({ name, type }) => (isVarName(name) ? name : `['${name}']`) + ': ' + type).join(', ')} }`,
    )

    // materials
    const materials = this.gltfInterface.getProperty('materials')
    if (!materials) throw new Error('gltfInterface materials not found')
    materials.setType(
      `{ ${this.a
        .getMaterials()
        .map(({ name, type }) => (isVarName(name) ? name : `['${name}']`) + ': ' + type)
        .join(', ')} }`,
    )

    // animations (done in the template)
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

  protected getModelActionName() {
    return this.options.componentName + 'Action'
  }

  protected getModelGLTFName() {
    return this.options.componentName + 'GLTF'
  }

  protected getModelInstancesName() {
    return this.options.componentName + 'Instances'
  }

  protected isPrimitive(o: Object3D) {
    if (isTargetedLight(o)) {
      return true
    }
    if (isBone(o)) {
      return true
    }

    return false
  }

  protected hasPrimitives() {
    for (const o of this.a.objects) {
      if (isNotRemoved(o) && this.isPrimitive(o)) {
        return true
      }
    }
    return false
  }

  /**
   * Provides the template for the generated source file.
   *
   * NOTE: for simplicity, opted to just include all potential imports or destructured variables, let eslint sort out unused in userland
   *
   * @returns
   */
  protected getTemplate() {
    const { componentName } = this.options
    const modelGLTFName = this.getModelGLTFName()
    const modelActionName = this.getModelActionName()
    const modelPropsName = this.getModelPropsName()
    const modelInstancesName = this.getModelInstancesName()
    const hasAnimations = this.a.hasAnimations()
    const hasInstances = this.a.hasInstances()
    const dupGeometryValues = Object.values(this.a.dupGeometries)
    const hasPrimitives = this.hasPrimitives() // bones, lights,

    // NOTE: for simplicity, opted to just include all potential imports, let eslint sort out unused in userland
    const template = `
      import { useGLTF } from '@react-three/drei'
      import { GroupProps, MeshProps, useGraph } from '@react-three/fiber'
      import * as React from 'react'
      import { AnimationClip, GLTF, Mesh, MeshStandardMaterial } from 'three'
      import { GLTF, SkeletonUtils } from 'three-stdlib'

      ${
        hasAnimations
          ? `
        type ${modelActionName}Names = ${this.a.gltf.animations.map((clip, i) => `'${clip.name}'`).join(' | ')}
        interface ${modelActionName} extends AnimationClip { name: ${modelActionName}Names }
        `
          : ''
      }

      interface ${modelGLTFName} extends GLTF {
        nodes: {}
        materials: {}
        ${hasAnimations ? `animations: ${modelActionName}[]` : ''}
      }

      export interface ${modelPropsName} extends GroupProps {}

      const modelLoadPath = '<foo>.glb'
      const draco = false

      ${
        hasInstances
          ? `
      type ContextType = Record<string, React.ForwardRefExoticComponent<MeshProps>>

      const context = React.createContext<ContextType>({})

      export function ${modelInstancesName}({ children, ...props }: ${modelPropsName}) {
        const { nodes } = useGLTF(modelLoadPath, draco) as ${modelGLTFName}
        const instances = React.useMemo(() => ({
          ${dupGeometryValues.map((v) => `${v.name}: ${v.node}`).join(', ')}
        }), [nodes])
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
          hasInstances
            ? 'const instances = React.useContext(context)'
            : hasPrimitives
              ? `
                const { ${hasAnimations ? 'animations, ' : ''}scene } = useGLTF(modelLoadPath, draco) as ${modelGLTFName}
                const clone = React.useMemo(() => SkeletonUtils.clone(scene), [scene])
                const { nodes, materials } = useGraph(clone) as ${modelGLTFName}
              `
              : `const { ${hasAnimations ? 'animations, ' : ''}nodes, materials } = useGLTF(modelLoadPath, draco) as ${modelGLTFName}`
        }
        ${hasAnimations ? `const groupRef = React.useRef<Group>()}` : ''}
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
