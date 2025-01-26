import { GLTF } from 'node-three-gltf'
import {
  FunctionDeclaration,
  InterfaceDeclaration,
  ObjectLiteralExpression,
  Project,
  SourceFile,
  SyntaxKind,
  VariableDeclarationKind,
} from 'ts-morph'

// import * as prettier from 'prettier'
// import babelParser from 'prettier/parser-babel.js'
import { AnalyzedGLTF } from '../analyze/AnalyzedGLTF.js'
import { JsxOptions } from '../options.js'

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

export function createR3F(gltf: GLTF, options: Readonly<JsxOptions>) {
  const { log, header, instance, instanceall } = options
  const a = new AnalyzedGLTF(gltf, { instance, instanceall, log })

  const project = new Project({ useInMemoryFileSystem: true })
  const src = project.createSourceFile('file.ts', template)

  // set constants - load path, draco
  setConstants(src, options)

  // gather references before we rename them
  const modelProps = src.getInterface('ModelProps')
  if (!modelProps) throw new Error('ModelProps not found')
  const fn = src.getFunction('Model')
  if (!fn) throw new Error('Model function not found')

  renameModelProps(modelProps, fn, options)

  const variable = src.addVariableStatement({
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

  return src.getFullText()

  // if (!options.console) console.log(header)
  // const output = header + '\n' + code

  // console.log('output:\n', output)
  // const formatted = prettier.format(output, {
  //   semi: false,
  //   printWidth: 1000,
  //   singleQuote: true,
  //   jsxBracketSameLine: true,
  //   parser: 'babel-ts',
  //   plugins: [babelParser],
  // })
  // return formatted
}
function setConstants(src: SourceFile, options: Readonly<JsxOptions>) {
  const { draco, modelLoadPath: inModelLoadPath } = options
  const modelLoadPath =
    (inModelLoadPath.toLowerCase().startsWith('http') ? '' : '/') + inModelLoadPath
  src.getVariableDeclaration('modelLoadPath')?.setInitializer(modelLoadPath)
  src.getVariableDeclaration('draco')?.setInitializer(draco ? 'true' : 'false')
}

function renameModelProps(
  modelProps: InterfaceDeclaration,
  fn: FunctionDeclaration,
  options: Readonly<JsxOptions>,
) {
  const { componentName } = options
  // set ModelProps name
  const modelPropsName = componentName + 'Props'
  modelProps.set({ name: modelPropsName }) // does not rename everywhere

  // get Model function declaration, rename it and rename ModelProps arg
  fn.set({ name: componentName })
  const props = fn.getParameters()[0]
  if (!props) throw new Error('Model props not found')
  props.setType(modelPropsName)
}
