import { GLTF } from 'node-three-gltf'
import * as prettier from 'prettier'
import babelParser from 'prettier/parser-babel.js'
import { AnimationClip, Mesh, Object3D } from 'three'

import { AnalyzedGLTF } from '../analyze/AnalyzedGLTF.js'
import { calculateProps } from '../analyze/calculateProps.js'
import {
  isBone,
  isInstancedMesh,
  isLight,
  isMesh,
  isNotRemoved,
  isRemoved,
  isTargeted,
} from '../analyze/is.js'
import isVarName from '../analyze/isVarName.js'
import { collectMaterials, materialKey, meshKey, sanitizeName } from '../analyze/utils.js'
import { JsxOptions } from '../options.js'
import { getType } from './utils.js'

export function createR3FComponent(gltf: GLTF, options: Readonly<JsxOptions>) {
  const a = new AnalyzedGLTF(gltf, { instance: options.instance, instanceall: options.instanceall })

  const useGTLFLoadPath =
    (options.modelLoadPath.toLowerCase().startsWith('http') ? '' : '/') + options.modelLoadPath

  function printTypes(objects: Object3D[], animations: AnimationClip[]) {
    const meshes = objects.filter((o) => isMesh(o) && isNotRemoved(o))
    // .isBone isn't in glTF spec. See ._markDefs in GLTFLoader.js
    const bones = objects.filter(
      (o) => isBone(o) && !(o.parent && isBone(o.parent)) && isNotRemoved(o),
    )
    // TODO validate if this is correct
    const materials = [...new Set(objects.filter((o) => isMesh(o) && collectMaterials(o.material)))]
    // eslint-disable-next-line prefer-const
    let materialsOldCollectionMethod = [
      ...new Set(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
        objects.filter((o: any) => o.material && o.material.name).map((o: any) => o.material),
      ),
    ]

    console.log(
      '!!!!!!!!!!!!!!!!compare materials collection!!!!!!!!!!!!!!!! size: ',
      materials.length,
      'vs old: ',
      materialsOldCollectionMethod.length,
    )

    let animationTypes = ''
    if (animations.length) {
      animationTypes = `\n
  type ActionName = ${animations.map((clip, i) => `"${clip.name}"`).join(' | ')};

  interface GLTFAction extends THREE.AnimationClip { name: ActionName }\n`
    }

    const types = [...new Set([...meshes, ...bones].map((o) => getType(o)))]
    const contextType = a.hasInstances()
      ? `\ntype ContextType = Record<string, React.ForwardRefExoticComponent<
     ${types.map((type) => `JSX.IntrinsicElements['${type}']`).join(' | ')}
    >>\n`
      : ''

    return `\n${animationTypes}\ntype GLTFResult = GLTF & {
    nodes: {
      ${meshes.map(({ name, type }) => (isVarName(name) ? name : `['${name}']`) + ': THREE.' + type).join(',')}
      ${bones.map(({ name, type }) => (isVarName(name) ? name : `['${name}']`) + ': THREE.' + type).join(',')}
    }
    materials: {
      ${materials.map(({ name, type }) => (isVarName(name) ? name : `['${name}']`) + ': THREE.' + type).join(',')}
    }
    animations: GLTFAction[]
  }\n${contextType}`
  }

  function printProps(obj: Object3D) {
    const props = calculateProps(obj, a, options)
    return Object.keys(props)
      .map((key: string) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const value = props[key]
        if (value === true) {
          return key // e.g. castShadow
        }
        return `${key}={${value}}`
      })
      .join(' ')
  }

  function print(obj: Object3D) {
    let result = ''
    let children = ''
    const { node, instanced, animated } = a.getInfo(obj)
    let type = getType(obj)

    // Check if the root node is useless
    if (isRemoved(obj) && obj.children.length) {
      obj.children.forEach((child) => (result += print(child)))
      return result
    }

    // Bail out on bones
    if (!options.bones && type === 'bone') {
      return `<primitive object={${node}} />`
    }

    // Take care of lights with targets
    if (isLight(obj) && isTargeted(obj) && obj.children[0] === obj.target) {
      return `<${type} ${printProps(obj)} target={${node}.target}>
        <primitive object={${node}.target} ${printProps(obj.target)} />
      </${type}>`
    }

    // Collect children
    if (obj.children) obj.children.forEach((child) => (children += print(child)))

    // Bail out if the object was pruned
    if (isRemoved(obj)) return children

    if (instanced) {
      result = `<instances.${a.dupGeometries[meshKey(obj as Mesh)].name} `
      type = `instances.${a.dupGeometries[meshKey(obj as Mesh)].name}`
    } else {
      if (isInstancedMesh(obj)) {
        const geo = `${node}.geometry`
        const materialName = materialKey(obj.material)
        const mat = materialName ? `materials${sanitizeName(materialName)}` : `${node}.material`
        type = 'instancedMesh'
        result = `<instancedMesh args={[${geo}, ${mat}, ${!obj.count ? `${node}.count` : obj.count}]} `
      } else {
        // Form the object in JSX syntax
        if (type === 'bone') result = `<primitive object={${node}} `
        else result = `<${type} `
      }
    }

    result += printProps(obj)

    // Close tag
    result += `${children.length ? '>' : '/>'}\n`

    // Add children and return
    if (children.length) {
      if (type === 'bone') result += children + `</primitive>`
      else result += children + `</${type}>`
    }
    return result
  }

  function printAnimations(animations: AnimationClip[]) {
    return animations.length ? `\nconst { actions } = useAnimations(animations, group)` : ''
  }

  function parseExtras(extras: any) {
    if (extras) {
      console.log('extras', extras)
      return (
        Object.keys(extras as Record<string, any>)
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          .map((key) => `${key.charAt(0).toUpperCase() + key.slice(1)}: ${extras[key]}`)
          .join('\n') + '\n'
      )
    } else return ''
  }

  function p(obj: Object3D, line: number, a: AnalyzedGLTF) {
    console.log(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      [...new Array(line * 2)].map(() => ' ').join(''),
      obj.type,
      obj.name,
      'pos:',
      obj.position.toArray().map(a.rNbr),
      'scale:',
      obj.scale.toArray().map(a.rNbr),
      'rot:',
      [obj.rotation.x, obj.rotation.y, obj.rotation.z].map(a.rNbr),
      'mat:',
      isMesh(obj)
        ? materialKey(obj.material) /*`${obj.material.name}-${obj.material.uuid.substring(0, 8)}`*/
        : '',
    )
    obj.children.forEach((o) => p(o, line + 1, a))
  }

  if (options.debug) p(gltf.scene, 0, a)

  let scene: string = ''
  try {
    if (!options.keepgroups) {
      // Dry run to prune graph
      print(gltf.scene)
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
    scene = print(gltf.scene)
  } catch (e) {
    console.log('Error while parsing glTF', e)
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const parsedExtras = parseExtras(gltf.parser.json.asset && gltf.parser.json.asset.extras)
  const header = `/*
${options.header ? options.header : 'Auto-generated'} ${
    options.size ? `\nFiles: ${options.size}` : ''
  }
${parsedExtras}*/`
  const hasPrimitives = scene.includes('<primitive')
  const result = `${options.types ? `\nimport * as THREE from 'three'` : ''}
        import React from 'react'${hasPrimitives ? '\nimport { useGraph } from "@react-three/fiber"' : ''}
        import { useGLTF, ${a.hasInstances() ? 'Merged, ' : ''} ${
          scene.includes('PerspectiveCamera') ? 'PerspectiveCamera,' : ''
        }
        ${scene.includes('OrthographicCamera') ? 'OrthographicCamera,' : ''}
        ${a.hasAnimations() ? 'useAnimations' : ''} } from '@react-three/drei'
        ${
          hasPrimitives || options.types
            ? `import { ${options.types ? 'GLTF,' : ''} ${hasPrimitives ? 'SkeletonUtils' : ''} } from "three-stdlib"`
            : ''
        }
        ${options.types ? printTypes(a.objects, gltf.animations) : ''}
        const useGTLFLoadPath = '${useGTLFLoadPath}'
        ${
          a.hasInstances()
            ? `
        const context = React.createContext(${options.types ? '{} as ContextType' : ''})

        export function Instances({ children, ...props }${options.types ? ': JSX.IntrinsicElements["group"]' : ''}) {
          const { nodes } = useGLTF(useGTLFLoadPath${options.draco ? `, ${JSON.stringify(options.draco)}` : ''})${
            options.types ? ' as GLTFResult' : ''
          }
          const instances = React.useMemo(() => ({
            ${Object.values(a.dupGeometries)
              .map((v) => `${v.name}: ${v.node}`)
              .join(', ')}
          }), [nodes])
          return (
            <Merged meshes={instances} {...props}>
              {(instances${
                options.types ? ': ContextType' : ''
              }) => <context.Provider value={instances} children={children} />}
            </Merged>
          )
        }
        `
            : ''
        }

        export ${options.exportdefault ? 'default' : ''} function Model(props${
          options.types ? ": JSX.IntrinsicElements['group']" : ''
        }) {
          ${a.hasInstances() ? 'const instances = React.useContext(context);' : ''} ${
            a.hasAnimations()
              ? `const group = ${options.types ? 'React.useRef<THREE.Group>()' : 'React.useRef()'};`
              : ''
          } ${
            !options.instanceall
              ? `const { ${!hasPrimitives ? `nodes, materials` : 'scene'} ${
                  a.hasAnimations() ? ', animations' : ''
                }} = useGLTF(useGTLFLoadPath${options.draco ? `, ${JSON.stringify(options.draco)}` : ''})${
                  !hasPrimitives && options.types ? ' as GLTFResult' : ''
                }${
                  hasPrimitives
                    ? `\nconst clone = React.useMemo(() => SkeletonUtils.clone(scene), [scene])
                const { nodes, materials } = useGraph(clone) ${options.types ? ' as GLTFResult' : ''}`
                    : ''
                }`
              : ''
          } ${printAnimations(gltf.animations)}
          return (
            <group ${a.hasAnimations() ? `ref={group}` : ''} {...props} dispose={null}>
        ${scene}
            </group>
          )
        }

useGLTF.preload(useGTLFLoadPath)`

  // if (!options.console) console.log(header)
  const output = header + '\n' + result

  console.log('output:\n', output)
  const formatted = prettier.format(output, {
    semi: false,
    printWidth: 1000,
    singleQuote: true,
    jsxBracketSameLine: true,
    parser: 'babel-ts',
    plugins: [babelParser],
  })
  return formatted
}
