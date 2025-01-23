import { GLTF } from 'node-three-gltf'
import * as prettier from 'prettier'
import babelParser from 'prettier/parser-babel.js'
import * as THREE from 'three'
import { AnimationClip, Mesh, Object3D, OrthographicCamera } from 'three'

import { AnalyzedGLTF } from '../analyze/AnalyzedGLTF.js'
import {
  isBone,
  isColored,
  isDecayed,
  isDistanced,
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
  isTargeted,
  setRemoved,
} from '../analyze/is.js'
import isVarName from '../analyze/isVarName.js'
import {
  collectMaterials,
  equalOrNegated,
  materialKey,
  meshKey,
  sanitizeName,
} from '../analyze/utils.js'
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

  function handleProps(obj: Object3D) {
    const { node, instanced } = a.getInfo(obj)
    const type = getType(obj)
    let result = ''
    // Handle cameras
    if (isPerspectiveCamera(obj) || isOrthographicCamera(obj)) {
      result += `makeDefault={false} `
      if (obj.zoom !== 1) result += `zoom={${rNbr(obj.zoom)}} `
      if (obj.far !== 2000) result += `far={${rNbr(obj.far)}} `
      if (obj.near !== 0.1) result += `near={${rNbr(obj.near)}} `
    }
    if (isPerspectiveCamera(obj)) {
      if (obj.fov !== 50) result += `fov={${rNbr(obj.fov)}} `
    }

    if (!instanced) {
      // Shadows
      if (type === 'mesh' && options.shadows) result += `castShadow receiveShadow `

      if (isMesh(obj) && !isInstancedMesh(obj)) {
        // Write out geometry first
        result += `geometry={${node}.geometry} `

        // Write out materials
        const materialName = materialKey(obj.material)
        if (materialName) result += `material={materials${sanitizeName(materialName)}} `
        else result += `material={${node}.material} `
      }
    }

    if (isInstancedMesh(obj)) {
      if (obj.instanceMatrix) result += `instanceMatrix={${node}.instanceMatrix} `
      if (obj.instanceColor) result += `instanceColor={${node}.instanceColor} `
    }
    if (isSkinnedMesh(obj)) result += `skeleton={${node}.skeleton} `
    if (obj.visible === false) result += `visible={false} `
    if (obj.castShadow === true) result += `castShadow `
    if (obj.receiveShadow === true) result += `receiveShadow `
    if (isPoints(obj)) {
      result += `morphTargetDictionary={${node}.morphTargetDictionary} `
      result += `morphTargetInfluences={${node}.morphTargetInfluences} `
    }
    if (isLight(obj)) {
      if (rNbr(obj.intensity)) result += `intensity={${rNbr(obj.intensity)}} `
    }
    //if (obj.power && obj.power !== 4 * Math.PI) result += `power={${rNbr(obj.power)}} `
    if (isSpotLight(obj)) {
      if (obj.angle !== Math.PI / 3) result += `angle={${rDeg(obj.angle)}} `
      if (obj.penumbra && rNbr(obj.penumbra) !== 0) result += `penumbra={${rNbr(obj.penumbra)}} `
    }

    // SpotLight | PointLight
    if (isDecayed(obj)) {
      if (obj.decay && rNbr(obj.decay) !== 1) result += `decay={${rNbr(obj.decay)}} `
    }
    if (isDistanced(obj)) {
      if (obj.distance && rNbr(obj.distance) !== 0) result += `distance={${rNbr(obj.distance)}} `
    }

    if (obj.up && obj.up.isVector3 && !obj.up.equals(new THREE.Vector3(0, 1, 0))) {
      result += `up={[${rNbr(obj.up.x)}, ${rNbr(obj.up.y)}, ${rNbr(obj.up.z)},]} `
    }

    if (isColored(obj) && obj.color.getHexString() !== 'ffffff')
      result += `color="#${obj.color.getHexString()}" `
    if (obj.position && obj.position.isVector3 && rNbr(obj.position.length()))
      result += `position={[${rNbr(obj.position.x)}, ${rNbr(obj.position.y)}, ${rNbr(obj.position.z)},]} `
    if (
      obj.rotation &&
      obj.rotation.isEuler &&
      rNbr(new THREE.Vector3(obj.rotation.x, obj.rotation.y, obj.rotation.z).length())
    ) {
      result += `rotation={[${rDeg(obj.rotation.x)}, ${rDeg(obj.rotation.y)}, ${rDeg(obj.rotation.z)},]} `
    }
    if (
      obj.scale &&
      obj.scale.isVector3 &&
      !(rNbr(obj.scale.x) === 1 && rNbr(obj.scale.y) === 1 && rNbr(obj.scale.z) === 1)
    ) {
      const rX = rNbr(obj.scale.x)
      const rY = rNbr(obj.scale.y)
      const rZ = rNbr(obj.scale.z)
      if (rX === rY && rX === rZ) {
        result += `scale={${rX}} `
      } else {
        result += `scale={[${rX}, ${rY}, ${rZ},]} `
      }
    }
    if (options.meta && obj.userData && Object.keys(obj.userData).length) {
      result += `userData={${JSON.stringify(obj.userData)}} `
    }
    return result
  }

  function prune(
    obj: Object3D,
    children: string,
    result: string,
    oldResult: string,
    silent: boolean,
  ) {
    const { animated } = a.getInfo(obj)
    const type = getType(obj)
    // Prune ...
    if (
      isNotRemoved(obj) &&
      !options.keepgroups &&
      !animated &&
      (type === 'group' || type === 'scene')
    ) {
      /** Empty or no-property groups
       *    <group>
       *      <mesh geometry={nodes.foo} material={materials.bar} />
       *  Solution:
       *    <mesh geometry={nodes.foo} material={materials.bar} />
       */
      if (result === oldResult || obj.children.length === 0) {
        if (options.debug && !silent) {
          console.log(`group ${obj.name} removed (empty)`)
        }
        setRemoved(obj)
        return children
      }

      // More aggressive removal strategies ...
      const first = obj.children[0]
      const firstProps = handleProps(first)
      const regex = /([a-z-A-Z]*)={([a-zA-Z0-9.[\]\-, /]*)}/g // original before linting /([a-z-A-Z]*)={([a-zA-Z0-9\.\[\]\-\,\ \/]*)}/g
      const keys1 = [...result.matchAll(regex)].map(([, match]) => match)
      // const values1 = [...result.matchAll(regex)].map(([, , match]) => match)
      const keys2 = [...firstProps.matchAll(regex)].map(([, match]) => match)

      /** Double negative rotations
       *    <group rotation={[-Math.PI / 2, 0, 0]}>
       *      <group rotation={[Math.PI / 2, 0, 0]}>
       *        <mesh geometry={nodes.foo} material={materials.bar} />
       *  Solution:
       *    <mesh geometry={nodes.foo} material={materials.bar} />
       */
      if (
        obj.children.length === 1 &&
        getType(first) === type &&
        equalOrNegated(obj.rotation, first.rotation)
      ) {
        if (
          keys1.length === 1 &&
          keys2.length === 1 &&
          keys1[0] === 'rotation' &&
          keys2[0] === 'rotation'
        ) {
          if (options.debug && !silent) {
            console.log(`group ${obj.name} removed (aggressive: double negative rotation)`)
          }
          setRemoved(obj, isRemoved(first))
          children = ''
          if (first.children) first.children.forEach((child) => (children += print(child, true)))
          return children
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
        getType(first) === type &&
        equalOrNegated(obj.rotation, first.rotation)
      ) {
        if (
          keys1.length === 1 &&
          keys2.length > 1 &&
          keys1[0] === 'rotation' &&
          keys2.includes('rotation')
        ) {
          if (options.debug && !silent) {
            console.log(`group ${obj.name} removed (aggressive: double negative rotation w/ props)`)
          }
          setRemoved(obj)
          // Remove rotation from first child
          first.rotation.set(0, 0, 0)
          children = print(first, true)
          return children
        }
      }

      /** Transform overlap
       *    <group position={[10, 0, 0]} scale={2} rotation={[-Math.PI / 2, 0, 0]}>
       *      <mesh geometry={nodes.foo} material={materials.bar} />
       *  Solution:
       *    <mesh geometry={nodes.foo} material={materials.bar} position={[10, 0, 0]} scale={2} rotation={[-Math.PI / 2, 0, 0]} />
       */
      const isChildTransformed =
        keys2.includes('position') || keys2.includes('rotation') || keys2.includes('scale')
      const hasOtherProps = keys1.some((key) => !['position', 'scale', 'rotation'].includes(key))
      if (
        obj.children.length === 1 &&
        isNotRemoved(first) &&
        !isChildTransformed &&
        !hasOtherProps
      ) {
        if (options.debug && !silent) {
          console.log(`group ${obj.name} removed (aggressive: ${keys1.join(' ')} overlap)`)
        }
        // Move props over from the to-be-deleted object to the child
        // This ensures that the child will have the correct transform when pruning is being repeated
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        keys1.forEach((key) => (obj.children[0] as any)[key].copy((obj as any)[key]))
        // Insert the props into the result string
        children = print(first, true)
        setRemoved(obj)
        return children
      }

      /** Lack of content
       *    <group position={[10, 0, 0]} scale={2} rotation={[-Math.PI / 2, 0, 0]}>
       *      <group position={[10, 0, 0]} scale={2} rotation={[-Math.PI / 2, 0, 0]}>
       *        <group position={[10, 0, 0]} scale={2} rotation={[-Math.PI / 2, 0, 0]} />
       * Solution:
       *   (delete the whole sub graph)
       */
      const empty: any[] = []
      obj.traverse((o) => {
        const type = getType(o)
        if (type !== 'group' && type !== 'object3D') empty.push(o)
      })
      if (!empty.length) {
        if (options.debug && !silent)
          console.log(`group ${obj.name} removed (aggressive: lack of content)`)
        empty.forEach((child) => setRemoved(child))
        return ''
      }
    }

    //?
    return children
  }

  function print(obj: Object3D, silent = false) {
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
      return `<${type} ${handleProps(obj)} target={${node}.target}>
        <primitive object={${node}.target} ${handleProps(obj.target)} />
      </${type}>`
    }

    // Collect children
    if (obj.children) obj.children.forEach((child) => (children += print(child)))

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

    // Include names when output is uncompressed or morphTargetDictionaries are present
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (obj.name.length && (options.keepnames || (obj as any).morphTargetDictionary || animated))
      result += `name="${obj.name}" `

    const oldResult = result
    result += handleProps(obj)

    const pruned = prune(obj, children, result, oldResult, silent)
    // Bail out if the object was pruned
    if (pruned !== undefined) return pruned

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

  function p(obj: Object3D, line: number) {
    console.log(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      [...new Array(line * 2)].map(() => ' ').join(''),
      obj.type,
      obj.name,
      'pos:',
      obj.position.toArray().map(rNbr),
      'scale:',
      obj.scale.toArray().map(rNbr),
      'rot:',
      [obj.rotation.x, obj.rotation.y, obj.rotation.z].map(rNbr),
      'mat:',
      isMesh(obj)
        ? materialKey(obj.material) /*`${obj.material.name}-${obj.material.uuid.substring(0, 8)}`*/
        : '',
    )
    obj.children.forEach((o) => p(o, line + 1))
  }

  if (options.debug) p(gltf.scene, 0)

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

  if (!options.console) console.log(header)
  const output = header + '\n' + result
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
