import { GLTF } from 'node-three-gltf'
import * as prettier from 'prettier'
import babelParser from 'prettier/parser-babel.js'
import { AnimationClip, Bone, Mesh, Object3D } from 'three'

import { AnalyzedGLTF } from '../analyze/AnalyzedGLTF.js'
import { calculateProps } from '../analyze/calculateProps.js'
import { isBone, isInstancedMesh, isMesh, isRemoved, isTargetedLight } from '../analyze/is.js'
import isVarName from '../analyze/isVarName.js'
import { materialKey, meshKey, sanitizeName } from '../analyze/utils.js'
import { JsxOptions, Logger } from '../options.js'
import { getJsxElementName } from './utils.js'

const stringProps = ['name']

export function createR3FComponent(gltf: GLTF, options: Readonly<JsxOptions>) {
  const { log, instance, instanceall } = options
  const a = new AnalyzedGLTF(gltf, { instance, instanceall, log })

  const modelLoadPath =
    (options.modelLoadPath.toLowerCase().startsWith('http') ? '' : '/') + options.modelLoadPath

  // done
  function printTypes(a: AnalyzedGLTF) {
    const meshes: Mesh[] = a.getMeshes()
    const bones: Bone[] = a.getBones()
    const materials = a.getMaterials()

    let animationTypes = ''
    if (a.hasAnimations()) {
      animationTypes = `\n
      type ActionName = ${a.gltf.animations.map((clip, i) => `"${clip.name}"`).join(' | ')};

      interface GLTFAction extends THREE.AnimationClip { name: ActionName }\n`
    }

    const types = [...new Set([...meshes, ...bones].map((o) => getJsxElementName(o)))]
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
    ${a.hasAnimations() ? 'animations: GLTFAction[]' : ''}
  }\n${contextType}`
  }

  // done
  function printProps(obj: Object3D) {
    const props = calculateProps(obj, a)
    return Object.keys(props)
      .map((key: string) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const value = props[key]

        if (stringProps.includes(key)) {
          return `${key}="${value}"`
        }
        if (value === true) {
          return key // e.g. castShadow
        }
        return `${key}={${value}}`
      })
      .join(' ')
  }

  function print(o: Object3D) {
    let result = ''
    let children = ''
    const { node, instanced } = a.getInfo(o)
    let element = getJsxElementName(o)

    // done Check if the root node is useless
    if (isRemoved(o) && o.children.length) {
      o.children.forEach((child) => (result += print(child)))
      return result
    }

    // done Bail out on bones
    if (!options.bones && isBone(o)) {
      return `<primitive object={${node}} />`
    }

    // done Lights with targets
    if (isTargetedLight(o)) {
      return `<${element} ${printProps(o)} target={${node}.target}>
        <primitive object={${node}.target} ${printProps(o.target)} />
      </${element}>`
    }

    // done Collect children
    if (o.children) o.children.forEach((child) => (children += print(child)))

    // done Bail out if the object was pruned
    if (isRemoved(o)) return children

    if (instanced) {
      result = `<instances.${a.dupGeometries[meshKey(o as Mesh)].name} `
      element = `instances.${a.dupGeometries[meshKey(o as Mesh)].name}`
    } else {
      if (isInstancedMesh(o)) {
        const geo = `${node}.geometry`
        const materialName = materialKey(o.material)
        const mat = materialName ? `materials${sanitizeName(materialName)}` : `${node}.material`
        element = 'instancedMesh'
        result = `<instancedMesh args={[${geo}, ${mat}, ${!o.count ? `${node}.count` : o.count}]} `
      } else {
        // Form the object in JSX syntax
        if (element === 'bone') result = `<primitive object={${node}} `
        else result = `<${element} `
      }
    }

    result += printProps(o)

    // Close tag
    result += `${children.length ? '>' : '/>'}\n`

    // Add children and return
    if (children.length) {
      if (element === 'bone') result += children + `</primitive>`
      else result += children + `</${element}>`
    }
    return result
  }

  // done
  function printAnimations(animations: AnimationClip[]) {
    return animations.length ? `\nconst { actions } = useAnimations(animations, groupRef)` : ''
  }

  function parseExtras(extras: any) {
    if (extras) {
      log.debug('extras', extras)
      return (
        Object.keys(extras as Record<string, any>)
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          .map((key) => `${key.charAt(0).toUpperCase() + key.slice(1)}: ${extras[key]}`)
          .join('\n') + '\n'
      )
    } else return ''
  }

  function p(obj: Object3D, line: number, a: AnalyzedGLTF, log: Logger) {
    log.debug(
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
    obj.children.forEach((o) => p(o, line + 1, a, log))
  }

  if (options.log.isDebug()) p(gltf.scene, 0, a, options.log)

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
  // done
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const parsedExtras = parseExtras(gltf.parser.json.asset && gltf.parser.json.asset.extras)
  // done
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
        // done
        ${
          hasPrimitives || options.types
            ? `import { ${options.types ? 'GLTF,' : ''} ${hasPrimitives ? 'SkeletonUtils' : ''} } from "three-stdlib"`
            : ''
        }
        // done
        ${options.types ? printTypes(a) : ''}
        const modelLoadPath = '${modelLoadPath}'
        ${
          a.hasInstances()
            ? // done
              `
        const context = React.createContext(${options.types ? '{} as ContextType' : ''})

        export function Instances({ children, ...props }${options.types ? ': JSX.IntrinsicElements["group"]' : ''}) {
          const { nodes } = useGLTF(modelLoadPath${options.draco ? `, ${JSON.stringify(options.draco)}` : ''})${
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
        // done
        export ${options.exportdefault ? 'default' : ''} function Model(props${
          options.types ? ": JSX.IntrinsicElements['group']" : ''
        }) {
          ${
            // done
            a.hasInstances() ? 'const instances = React.useContext(context);' : ''
          } ${
            // done
            a.hasAnimations()
              ? `const groupRef = ${options.types ? 'React.useRef<THREE.Group>()' : 'React.useRef()'};`
              : ''
          } ${
            // done
            !options.instanceall
              ? `const { ${!hasPrimitives ? `nodes, materials` : 'scene'} ${
                  a.hasAnimations() ? ', animations' : ''
                }} = useGLTF(modelLoadPath${options.draco ? `, ${JSON.stringify(options.draco)}` : ''})${
                  // done
                  !hasPrimitives && options.types ? ' as GLTFResult' : ''
                }${
                  // done
                  hasPrimitives
                    ? `\nconst clone = React.useMemo(() => SkeletonUtils.clone(scene), [scene])
                const { nodes, materials } = useGraph(clone) ${options.types ? ' as GLTFResult' : ''}`
                    : ''
                }`
              : ''
          } 
          // done
          ${printAnimations(gltf.animations)}
          return (
            <group ${a.hasAnimations() ? `ref={groupRef}` : ''} {...props} dispose={null}>
        ${scene}
            </group>
          )
        }

useGLTF.preload(modelLoadPath)`

  // if (!options.console) console.log(header)
  const output = header + '\n' + result

  // console.log('output:\n', output)
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
