import * as THREE from 'three'
import * as prettier from 'prettier'
import babelParser from 'prettier/parser-babel.js'
import isVarName from './isVarName.js'
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import {
  AnimationClip,
  Euler,
  Group,
  Material,
  Mesh,
  Object3D,
  OrthographicCamera,
  PerspectiveCamera,
} from 'three'
import { Options } from '../types.js'
import { isCamera, isInstancedMesh, isLight, isMesh, isNotRemoved, isOrthographicCamera, isPerspectiveCamera, isRemoved } from './is.js'

interface TransformGltfToJsxOptions extends Options {
  fileName: string
  size: string // human readable size
}

interface Duplicates {
  names: Record<string, number>
  materials: Record<string, number>
  geometries: Record<string, { count: number; name: string; node: string }>
}

export function transformGltfToJsx(
  gltfLike: GLTF,
  { fileName = 'model', ...options }: TransformGltfToJsxOptions,
) {
  console.log('parse', gltfLike, options)
  let gltf: GLTF = gltfLike
  if ((gltf as any).isObject3D) {
    console.error('gltf is Object3D, in what case is this?', gltf)
    // Wrap scene in a GLTF Structure
    gltf = { scene: gltf, animations: [], parser: { json: {} } } as unknown as GLTF
  }

  const url = (fileName.toLowerCase().startsWith('http') ? '' : '/') + fileName
  const animations = gltf.animations
  const hasAnimations = animations.length > 0

  // Collect all objects
  const objects: Array<Object3D> = []
  gltf.scene.traverse((child: Object3D) => objects.push(child))

  // Browse for duplicates
  const duplicates: Duplicates = {
    names: {},
    materials: {},
    geometries: {},
  }

  function uniqueName(attempt: string, index = 0) {
    const newAttempt = index > 0 ? attempt + index : attempt
    if (Object.values(duplicates.geometries).find(({ name }) => name === newAttempt) === undefined)
      return newAttempt
    else return uniqueName(attempt, index + 1)
  }

  // material: Material | Material[] can be nested, so we need to flatten it and collect all materials as an array
  function collectMaterials(material: Material | Material[]): Material[] {
    const result: Material[] = []
    if (Array.isArray(material)) {
      material.forEach((m) => result.concat(collectMaterials(m)), [])
    } else {
      result.push(material)
    }
    const set = new Set(result)
    return Array.from(set)
  }

  function colectDuplicateMaterial(material: Material | Material[]) {
    if (Array.isArray(material)) {
      material.forEach((m) => colectDuplicateMaterial(m))
    } else {
      if (material.name) {
        if (!duplicates.materials[material.name]) {
          duplicates.materials[material.name] = 1
        } else {
          duplicates.materials[material.name]++
        }
      }
    }
  }

  function materialCacheKey(material: Material | Material[]) {
    if (Array.isArray(material)) {
      const result: string[] = []
      material.forEach((m) => m.name && result.push(m.name))
      if(result.length > 0){
        return result.join('-')
      }
      return null
    } else {
      return material.name
    }
  }
  
  function cacheKey(obj: Mesh) {
    // Was: child.geometry.uuid + (child.material?.name)
    // but we need to handle arrays of materials according to types
    return obj.geometry?.uuid + materialCacheKey(obj.material)
  }

  // collect duplicates
  gltf.scene.traverse((child: Object3D) => {
    if (isMesh(child)) {
      // materials
      colectDuplicateMaterial(child.material)

      // geometry
      if (child.geometry) {
        const key = cacheKey(child)
        if (!duplicates.geometries[key]) {
          let name = (child.name || 'Part').replace(/[^a-zA-Z]/g, '')
          name = name.charAt(0).toUpperCase() + name.slice(1)
          duplicates.geometries[key] = {
            count: 1,
            name: uniqueName(name),
            node: 'nodes' + sanitizeName(child.name),
          }
        } else {
          duplicates.geometries[key].count++
        }
      }
    }
  })

  // Prune duplicate geometries
  if (!options.instanceall) {
    for (const key of Object.keys(duplicates.geometries)) {
      const duplicate = duplicates.geometries[key]
      if (duplicate.count === 1) delete duplicates.geometries[key]
    }
  }

  const hasInstances =
    (options.instance || options.instanceall) && Object.keys(duplicates.geometries).length > 0

  function sanitizeName(name: string) {
    return isVarName(name) ? `.${name}` : `['${name}']`
  }

  const rNbr = (n: number) => {
    return parseFloat(n.toFixed(Math.round(options.precision || 2)))
  }

  const rDeg = (n: number) => {
    const abs = Math.abs(Math.round(n * 100000))
    for (let i = 1; i <= 10; i++) {
      if (abs === Math.round((Math.PI / i) * 100000))
        return `${n < 0 ? '-' : ''}Math.PI${i > 1 ? ' / ' + i : ''}`
    }
    for (let i = 1; i <= 10; i++) {
      if (abs === Math.round(Math.PI * i * 100000))
        return `${n < 0 ? '-' : ''}Math.PI${i > 1 ? ' * ' + i : ''}`
    }
    return rNbr(n)
  }

  function printTypes(objects: Object3D[], animations: AnimationClip[]) {
    let meshes = objects.filter((o) => isMesh(o) && isNotRemoved(o))
    // .isBone isn't in glTF spec. See ._markDefs in GLTFLoader.js
    let bones = objects.filter(
      (o) => (o as any).isBone && !(o.parent && (o.parent as any).isBone) && isNotRemoved(o),
    )
    let materials = [
      ...new Set(
        // TODO validate if this is correct
        objects.filter((o) => isMesh(o) && collectMaterials(o.material)),
      ),
    ]

    let animationTypes = ''
    if (animations.length) {
      animationTypes = `\n
  type ActionName = ${animations.map((clip, i) => `"${clip.name}"`).join(' | ')};

  interface GLTFAction extends THREE.AnimationClip { name: ActionName }\n`
    }

    const types = [...new Set([...meshes, ...bones].map((o) => getType(o)))]
    const contextType = hasInstances
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

  function getType(obj: Object3D) {
    let type = obj.type.charAt(0).toLowerCase() + obj.type.slice(1)
    // Turn object3d's into groups, it should be faster according to the threejs docs
    if (type === 'object3D') type = 'group'
    if (type === 'perspectiveCamera') type = 'PerspectiveCamera'
    if (type === 'orthographicCamera') type = 'OrthographicCamera'
    return type
  }

  function handleProps(obj: Object3D | OrthographicCamera) {
    let { type, node, instanced } = getInfo(obj)
    const anyObj = obj as any
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

      if(isMesh(obj) && !isInstancedMesh(obj)){
          // Write out geometry first
          result += `geometry={${node}.geometry} `

        // Write out materials
        const materialName = materialCacheKey(obj.material)
          if (materialName) result += `material={materials${sanitizeName(materialName)}} `
          else result += `material={${node}.material} `
        }
     }

      if (isInstancedMesh(obj) ){
        if( obj.instanceMatrix) result += `instanceMatrix={${node}.instanceMatrix} `
        if (obj.instanceColor) result += `instanceColor={${node}.instanceColor} `
      }
      if (anyObj.skeleton) result += `skeleton={${node}.skeleton} `
      if (obj.visible === false) result += `visible={false} `
      if (obj.castShadow === true) result += `castShadow `
      if (obj.receiveShadow === true) result += `receiveShadow `
      if (anyObj.morphTargetDictionary)
    {    result += `morphTargetDictionary={${node}.morphTargetDictionary} `}
      if (anyObj.morphTargetInfluences)
       { result += `morphTargetInfluences={${node}.morphTargetInfluences} `}
      if (anyObj.intensity && rNbr(anyObj.intensity)) result += `intensity={${rNbr(anyObj.intensity)}} `
      //if (obj.power && obj.power !== 4 * Math.PI) result += `power={${rNbr(obj.power)}} `
      if (anyObj.angle && anyObj.angle !== Math.PI / 3) result += `angle={${rDeg(anyObj.angle)}} `
      if (anyObj.penumbra && rNbr(anyObj.penumbra) !== 0) result += `penumbra={${rNbr(anyObj.penumbra)}} `
      if (anyObj.decay && rNbr(anyObj.decay) !== 1) result += `decay={${rNbr(anyObj.decay)}} `
      if (anyObj.distance && rNbr(anyObj.distance) !== 0) result += `distance={${rNbr(anyObj.distance)}} `


      if (anyObj.up && anyObj.up.isVector3 && !anyObj.up.equals(new THREE.Vector3(0, 1, 0))){
        result += `up={[${rNbr(anyObj.up.x)}, ${rNbr(anyObj.up.y)}, ${rNbr(anyObj.up.z)},]} `
      }
    

    if (anyObj.color && anyObj.color.getHexString() !== 'ffffff')
      result += `color="#${anyObj.color.getHexString()}" `
    if (obj.position && obj.position.isVector3 && rNbr(obj.position.length()))
      result += `position={[${rNbr(obj.position.x)}, ${rNbr(obj.position.y)}, ${rNbr(obj.position.z)},]} `
    if (
      obj.rotation &&
      obj.rotation.isEuler &&
      rNbr(new THREE.Vector3(obj.rotation.x, obj.rotation.y, obj.rotation.z).length())
    )
    {  result += `rotation={[${rDeg(obj.rotation.x)}, ${rDeg(obj.rotation.y)}, ${rDeg(obj.rotation.z)},]} `}
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
    if (options.meta && obj.userData && Object.keys(obj.userData).length)
   {   result += `userData={${JSON.stringify(obj.userData)}} `}
    return result
  }

  function getInfo(obj: Object3D) {
    let type = getType(obj)
    let node = 'nodes' + sanitizeName(obj.name)
    let instanced =
      (options.instance || options.instanceall) &&
      isMesh(obj) &&
      obj.geometry &&
      obj.material &&
      duplicates.geometries[cacheKey(obj)] &&
      duplicates.geometries[cacheKey(obj)].count > (options.instanceall ? 0 : 1)
    let animated = gltf.animations && gltf.animations.length > 0
    return { type, node, instanced, animated }
  }

  function equalOrNegated(a: Euler, b: Euler) {
    return (
      (a.x === b.x || a.x === -b.x) &&
      (a.y === b.y || a.y === -b.y) &&
      (a.z === b.z || a.z === -b.z)
    )
  }

  function prune(obj: Object3D, children: string, result: string, oldResult: string, silent: boolean) {
    const anyObj = obj as any
    let { type, animated } = getInfo(obj)
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
        if (options.debug && !silent) {console.log(`group ${obj.name} removed (empty)`)}
        (obj as any).__removed = true
        return children
      }

      // More aggressive removal strategies ...
      const first = obj.children[0]
      const firstProps = handleProps(first)
      const regex = /([a-z-A-Z]*)={([a-zA-Z0-9\.\[\]\-\,\ \/]*)}/g
      const keys1 = [...result.matchAll(regex)].map(([, match]) => match)
      const values1 = [...result.matchAll(regex)].map(([, , match]) => match)
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
          if (options.debug && !silent)
          {      console.log(`group ${obj.name} removed (aggressive: double negative rotation)`)}
          (obj as any).__removed = (first as any).__removed = true
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
          if (options.debug && !silent)
         {   console.log(`group ${obj.name} removed (aggressive: double negative rotation w/ props)`)}
          (obj as any).__removed = true
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
      if (obj.children.length === 1 &&  isNotRemoved(first) && !isChildTransformed && !hasOtherProps) {
        if (options.debug && !silent)    {console.log(`group ${obj.name} removed (aggressive: ${keys1.join(' ')} overlap)`)}
        // Move props over from the to-be-deleted object to the child
        // This ensures that the child will have the correct transform when pruning is being repeated
        keys1.forEach((key) => (obj.children[0] as any)[key].copy((obj as any)[key]))
        // Insert the props into the result string
        children = print(first, true)
        anyObj.__removed = true
        return children
      }

      /** Lack of content
       *    <group position={[10, 0, 0]} scale={2} rotation={[-Math.PI / 2, 0, 0]}>
       *      <group position={[10, 0, 0]} scale={2} rotation={[-Math.PI / 2, 0, 0]}>
       *        <group position={[10, 0, 0]} scale={2} rotation={[-Math.PI / 2, 0, 0]} />
       * Solution:
       *   (delete the whole sub graph)
       */
      const empty: Array<any> = []
      obj.traverse((o) => {
        const type = getType(o)
        if (type !== 'group' && type !== 'object3D') empty.push(o)
      })
      if (!empty.length) {
        if (options.debug && !silent)
          console.log(`group ${obj.name} removed (aggressive: lack of content)`)
        empty.forEach((child) => (child.__removed = true))
        return ''
      }
    }
  }

  function print(obj: Object3D, silent = false) {
    const anyObj = obj as any
    let result = ''
    let children = ''
    let { type, node, instanced, animated } = getInfo(obj)

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
    if (isLight(obj) &&  anyObj.target && obj.children[0] === anyObj.target) {
      return `<${type} ${handleProps(obj)} target={${node}.target}>
        <primitive object={${node}.target} ${handleProps(anyObj.target)} />
      </${type}>`
    }

    // Collect children
    if (obj.children) obj.children.forEach((child) => (children += print(child)))

    if (instanced) {
      result = `<instances.${duplicates.geometries[cacheKey(obj as Mesh)].name} `
      type = `instances.${duplicates.geometries[cacheKey(obj as Mesh)].name}`
    } else {
      if (isInstancedMesh(obj)) {
        const geo = `${node}.geometry`
        const materialName = materialCacheKey(obj.material)
        const mat = materialName
          ? `materials${sanitizeName(materialName)}`
          : `${node}.material`
        type = 'instancedMesh'
        result = `<instancedMesh args={[${geo}, ${mat}, ${!obj.count ? `${node}.count` : obj.count}]} `
      } else {
        // Form the object in JSX syntax
        if (type === 'bone') result = `<primitive object={${node}} `
        else result = `<${type} `
      }
    }

    // Include names when output is uncompressed or morphTargetDictionaries are present
    if (obj.name.length && (options.keepnames || anyObj.morphTargetDictionary || animated))
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

  function parseExtras(extras) {
    if (extras) {
      return (
        Object.keys(extras)
          .map((key) => `${key.charAt(0).toUpperCase() + key.slice(1)}: ${extras[key]}`)
          .join('\n') + '\n'
      )
    } else return ''
  }

  function p(obj, line) {
    console.log(
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
      obj.material ? `${obj.material.name}-${obj.material.uuid.substring(0, 8)}` : '',
    )
    obj.children.forEach((o) => p(o, line + 1))
  }

  if (options.debug) p(gltf.scene, 0)

  let scene
  try {
    if (!options.keepgroups) {
      // Dry run to prune graph
      print(gltf.scene)
      // Move children of deleted objects to their new parents
      objects.forEach((o) => {
        if (o.__removed) {
          let parent = o.parent
          // Making sure we don't add to a removed parent
          while (parent && parent.__removed) parent = parent.parent
          // If no parent was found it must be the root node
          if (!parent) parent = gltf.scene
          o.children.slice().forEach((child) => parent.add(child))
        }
      })
      // Remove deleted objects
      objects.forEach((o) => {
        if (o.__removed && o.parent) o.parent.remove(o)
      })
    }
    // 2nd pass to eliminate hard to swat left-overs
    scene = print(gltf.scene)
  } catch (e) {
    console.log('Error while parsing glTF', e)
  }
  const header = `/*
${options.header ? options.header : 'Auto-generated by: https://github.com/pmndrs/gltfjsx'} ${
    options.size ? `\nFiles: ${options.size}` : ''
  }
${parseExtras(gltf.parser.json.asset && gltf.parser.json.asset.extras)}*/`
  const hasPrimitives = scene.includes('<primitive')
  const result = `${options.types ? `\nimport * as THREE from 'three'` : ''}
        import React from 'react'${hasPrimitives ? '\nimport { useGraph } from "@react-three/fiber"' : ''}
        import { useGLTF, ${hasInstances ? 'Merged, ' : ''} ${
          scene.includes('PerspectiveCamera') ? 'PerspectiveCamera,' : ''
        }
        ${scene.includes('OrthographicCamera') ? 'OrthographicCamera,' : ''}
        ${hasAnimations ? 'useAnimations' : ''} } from '@react-three/drei'
        ${
          hasPrimitives || options.types
            ? `import { ${options.types ? 'GLTF,' : ''} ${hasPrimitives ? 'SkeletonUtils' : ''} } from "three-stdlib"`
import { isSkinnedMesh } from './is';

            : ''
        }
        ${options.types ? printTypes(objects, animations) : ''}

        ${
          hasInstances
            ? `
        const context = React.createContext(${options.types ? '{} as ContextType' : ''})

        export function Instances({ children, ...props }${options.types ? ': JSX.IntrinsicElements["group"]' : ''}) {
          const { nodes } = useGLTF('${url}'${options.draco ? `, ${JSON.stringify(options.draco)}` : ''})${
            options.types ? ' as GLTFResult' : ''
          }
          const instances = React.useMemo(() => ({
            ${Object.values(duplicates.geometries)
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
          ${hasInstances ? 'const instances = React.useContext(context);' : ''} ${
            hasAnimations
              ? `const group = ${options.types ? 'React.useRef<THREE.Group>()' : 'React.useRef()'};`
              : ''
          } ${
            !options.instanceall
              ? `const { ${!hasPrimitives ? `nodes, materials` : 'scene'} ${
                  hasAnimations ? ', animations' : ''
                }} = useGLTF('${url}'${options.draco ? `, ${JSON.stringify(options.draco)}` : ''})${
                  !hasPrimitives && options.types ? ' as GLTFResult' : ''
                }${
                  hasPrimitives
                    ? `\nconst clone = React.useMemo(() => SkeletonUtils.clone(scene), [scene])
                const { nodes, materials } = useGraph(clone) ${options.types ? ' as GLTFResult' : ''}`
                    : ''
                }`
              : ''
          } ${printAnimations(animations)}
          return (
            <group ${hasAnimations ? `ref={group}` : ''} {...props} dispose={null}>
        ${scene}
            </group>
          )
        }

useGLTF.preload('${url}')`

  if (!options.console) console.log(header)
  const output = header + '\n' + result
  const formatted = prettier.format(output, {
    semi: false,
    printWidth: options.printwidth || 1000,
    singleQuote: true,
    jsxBracketSameLine: true,
    parser: 'babel-ts',
    plugins: [babelParser],
  })
  return formatted
}
