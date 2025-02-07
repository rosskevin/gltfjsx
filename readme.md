# GLTFJSX

[![Version](https://img.shields.io/npm/v/gltfjsx?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/gltfjsx) [![Discord Shield](https://img.shields.io/discord/740090768164651008?style=flat&colorA=000000&colorB=000000&label=discord&logo=discord&logoColor=ffffff)](https://discord.gg/ZZjjNvJ)

<https://user-images.githubusercontent.com/2223602/126318148-99da7ed6-a578-48dd-bdd2-21056dbad003.mp4>

A small command-line tool that turns GLTF assets into declarative and re-usable [react-three-fiber](https://github.com/pmndrs/react-three-fiber) JSX components.

## The GLTF workflow on the web is not ideal

- GLTF is thrown whole into the scene which prevents re-use, in threejs objects can only be mounted once
- Contents can only be found by traversal which is cumbersome and slow
- Changes to queried nodes are made by mutation, which alters the source data and prevents re-use
- Re-structuring content, making nodes conditional or adding/removing is cumbersome
- Model compression is complex and not easily achieved
- Models often have unnecessary nodes that cause extra work and matrix updates

### GLTFJSX fixes that

- 🧑‍💻 It creates a virtual graph of all objects and materials. Now you can easily alter contents and re-use.
- 🏎️ The graph gets pruned (empty groups, unnecessary transforms, ...) and will perform better.
- ⚡️ It will optionally compress your model with up to 70%-90% size reduction.

### Demo

<https://user-images.githubusercontent.com/2223602/126318148-99da7ed6-a578-48dd-bdd2-21056dbad003.mp4>

## Usage

```text
Usage
  $ npx gltfjsx <Model.glb> <options>

Options
    --output, -o        Output src file name/path (default: Model.(j|t)sx)
    --draco, -d         Use draco to load file
    --types, -t         Write as .tsx file with types (default: true)
    --keepnames, -k     Keep original names
    --keepgroups, -K    Keep (empty) groups, disable pruning
    --bones, -b         Lay out bones declaratively (default: false)
    --meta, -m          Include metadata (as userData)
    --shadows, s        Let meshes cast and receive shadows
    --printwidth, w     Prettier printWidth (default: 120)
    --precision, -p     Number of fractional digits (default: 3)
    --root, -r          Sets directory from which .gltf file is served
    --exportdefault, -E Use default export
    --console, -c       Log JSX to console, won't produce a file
    --debug, -D         Debug output
    The following options apply a series of transformations to the GLTF file via the @gltf-transform libraries:
        --instance, -i      Instance re-occuring geometry
        --instanceall, -I   Instance every geometry (for cheaper re-use)
        --resolution, -R  Resolution for texture resizing (default: 1024)
        --keepmeshes, -j  Do not join compatible meshes
        --keepmaterials, -M Do not palette join materials
        --keepattributes, Whether to keep unused vertex attributes, such as UVs without an assigned texture
        --format, -f      Texture format jpeg | png | webp | avif (default: "webp")
        --simplify, -S    Mesh simplification (default: false)
        --ratio         Simplifier ratio (default: 0)
        --error         Simplifier error threshold (default: 0.0001)
```

### A typical use-case

First you run your model through gltfjsx. `npx` allows you to use npm packages without installing them.

```bash
npx gltfjsx model.gltf --transform
```

This will create a `Model.jsx` file that plots out all of the assets contents.

```jsx
/*
Auto-generated by: https://github.com/pmndrs/gltfjsx
*/

import { PerspectiveCamera, useGLTF } from '@react-three/drei'

const modelLoadPath = '/model-transformed.glb'
export function Model(props) {
  const { nodes, materials } = useGLTF(modelLoadPath)
  return (
    <group {...props} dispose={null}>
      <PerspectiveCamera name="camera" fov={40} near={10} far={1000} position={[10, 0, 50]} />
      <pointLight intensity={10} position={[100, 50, 100]} rotation={[-Math.PI / 2, 0, 0]} />
      <group position={[10, -5, 0]}>
        <mesh geometry={nodes.robot.geometry} material={materials.metal} />
        <mesh geometry={nodes.rocket.geometry} material={materials.wood} />
      </group>
    </group>
  )
}

useGLTF.preload(modelLoadPath)
```

Add your model to your `/public` folder as you would normally do. With the `--transform` flag it has created a compressed copy of it (in the above case `model-transformed.glb`). Without the flag just copy the original model.

```text
/public
  model-transformed.glb
```

The component can now be dropped into your scene.

```jsx
import { Canvas } from '@react-three/fiber'

import { Model } from './Model'

function App() {
  return (
    <Canvas>
      <Model />
    </Canvas>
  )
}
```

You can re-use it, it will re-use geometries and materials out of the box:

```jsx
<Model position={[0, 0, 0]} />
<Model position={[10, 0, -10]} />
```

## Common manual changes to generated Model.jsx

### Change its colors

```jsx
<mesh geometry={nodes.robot.geometry} material={materials.metal} material-color="green" />
```

### Change materials

```jsx
<mesh geometry={nodes.robot.geometry}>
  <meshPhysicalMaterial color="hotpink" />
</mesh>
```

### Make contents conditional

```jsx
{
  condition ? <mesh geometry={nodes.robot.geometry} material={materials.metal} /> : null
}
```

### Add events

```jsx
<mesh geometry={nodes.robot.geometry} material={materials.metal} onClick={handleClick} />
```

## Features

### ⚡️ Draco and meshopt compression ootb

You don't need to do anything if your models are draco compressed, simply add the `--draco` flag.

### ⚡️ Preload your assets for faster response

The asset will be preloaded by default, this makes it quicker to load and reduces time-to-paint. Remove the preloader if you don't need it.

### ⚡️ Transform (compression, resize)

With the `--transform` flag it creates:

- a binary-packed
- draco-compressed
- texture-resized (1024x1024)
- webp compressed
- deduped
- instanced
- pruned

`*.glb` ready to be consumed on a web site. It uses [glTF-Transform](https://github.com/donmccurdy/glTF-Transform). This can reduce the size of an asset by 70%-90%.

It will not alter the original but create a copy and append `[modelname]-transformed.glb`.

### ⚡️ Typescript types

Add the `--types` flag and your GLTF will be typesafe and generate a `.tsx` file instead of `.jsx` with exported named types to match the inferred component name.

```tsx
interface SpaceGLTF extends GLTF {
  nodes: { robot: Mesh; rocket: Mesh }
  materials: { metal: MeshStandardMaterial; wood: MeshStandardMaterial }
}

export interface SpaceProps extends GroupProps {}

export function Space(props: SpaceProps) {
  const { nodes, materials } = useGLTF<GLTFResult>('/model.gltf')
}
```

### ⚡️ Easier access to animations

If your GLTF contains animations it will add [drei's](https://github.com/pmndrs/drei) `useAnimations` hook, which extracts all clips and prepares them as actions:

```jsx
const { nodes, materials, animations } = useGLTF('/model.gltf')
const { actions } = useAnimations(animations, group)
```

If you want to play an animation you can do so at any time:

```jsx
<mesh onClick={(e) => actions.jump.play()} />
```

If you want to blend animations:

```jsx
const [name, setName] = useState("jump")
...
useEffect(() => {
  actions[name].reset().fadeIn(0.5).play()
  return () => actions[name].fadeOut(0.5)
}, [name])
```

### ⚡️ Instancing

Use the `--instance` flag and it will look for similar geometry and create instances of them. Look into [drei/Instances](https://drei.docs.pmnd.rs/performances/instances) and [drei/Merged](https://drei.docs.pmnd.rs/performances/merged) components to understand how it works. It does not matter if you instanced the model previously in Blender, it creates instances for each mesh that has a specific geometry and/or material.

`--instanceall` will create instances of all the geometry. This allows you to re-use the model with the smallest amount of drawcalls.

Your export will look like something like this:

```jsx
const context = createContext()
export function PartsInstances({ children, ...props }) {
  const { nodes } = useGLTF(modelLoadPath, draco) as PartsGLTF
  const instances = useMemo(() => ({ Screw1: nodes['Screw1'], Screw2: nodes['Screw2'] }), [nodes])
  return (
    <Merged meshes={instances} {...props}>
      {(instances) => <context.Provider value={instances} children={children} />}
    </Merged>
  )
}

export function Parts(props) {
  const instances = useContext(context)
  return (
    <group {...props} dispose={null}>
      <instances.Screw1 position={[-0.42, 0.04, -0.08]} rotation={[-Math.PI / 2, 0, 0]} />
      <instances.Screw2 position={[-0.42, 0.04, -0.08]} rotation={[-Math.PI / 2, 0, 0]} />
    </group>
  )
}
```

Note that similar to `--transform` it also has to transform the model. In order to use and re-use the model import both `Instances` and `Model`. Put all your models into the `Instances` component (you can nest).

The following will show the model three times, but you will only have 2 drawcalls tops.

```jsx
import { Instances, Model } from './Model'

<Instances>
  <Model position={[10,0,0]}>
  <Model position={[-10,0,0]}>
  <Model position={[-10,10,0]}>
</Instance>
```

## API access

This package is split into two entrypoints, one for the CLI, one for the API. You can use parts of, or advanced features of the API that are not easily exposed via command line e.g. `exposeProps` in `GenerateR3F`.

The API is broken down with the intent of supporting external use cases that `generate` code for component systems other than `react-three-fiber`. With that said, it is the intent of this project to support `react-three-fiber` generation, and efforts for other frameworks _may_ be determined to be out of scope.

### API organization

- Transform - `gltfTransform` is an opinionated wrapper using [glTF-Transform](https://github.com/donmccurdy/glTF-Transform) api
- Load - `loadGLTF` is a small wrapper using maintained loaders from [node-three-gltf](https://github.com/Brakebein/node-three-gltf)
- Analyze - `AnalyzedGLTF` deduplicates, prunes, and provides convenient accessors to the GLTF
- Generate - `GenerateR3F` uses [ts-morph](https://ts-morph.com/) to generate the source file, allowing for external changes or subclassing to customize behavior.

### Transform

```tsx
await gltfTransform(modelFile, toTransformedModelFile, options)
```

### Load

```tsx
import { DRACOLoader } from 'node-three-gltf'

let dracoLoader = null
try {
  dracoLoader = new DRACOLoader() // use a single instance for one to many models
  const modelGLTF = await loadGLTF(modelFile, dracoLoader)
} finally {
  dracoLoader?.dispose()
}
```

This can be useful to test GLTF assets (see `test/loadGLTF.test.ts`):

```tsx
it('should have a scene with a blue mesh', async () => {
  const scene = await loadGLTF(modelFile, dracoLoader)
  expect(() => scene.children.length).toEqual(1)
  expect(() => scene.children[0].type).toEqual('mesh')
  expect(() => scene.children[0].material.color).toEqual('blue')
})
```

### Analyze

You can subclass to modify behaviors, or provide additional or different pruning strategies.

```tsx
const a = new AnalyzedGLTF(modelGLTF, { options })
```

### Generate

Generate a `tsx` or `jsx` file. Access `ts-morph` primitives directly on the `GenerateR3F` class to modify before
formatting/stringifying with the `to` methods.

```tsx
const g = new GenerateR3F(a, genOptions)

// modify
g.src.insertStatements(1, `const foo = 'bar'`)

// stringify with or without types
g.toJsx()
g.toTsx()
```

#### `exposeProps` - simple example

Instead of instrumenting code by hand, especially for large models, you can `exposeProps` that map the component props to arbitrary `jsx` children.

For example, if you want to be able to turn on/off shadows via `shadows: true` property, the following options:

```ts
  exposeProps: {
    shadows: {
      to: ['castShadow', 'receiveShadow'],
      structure: {
        type: 'boolean',
        hasQuestionToken: true,
      },
    },
  },
```

would generate code using `ts-morph` that will:

- Add all mapped props to the `ModelProps` interface
- Destructure variables in the function body with a ...rest
- Change the identifer on the root `<group {...rest} />` element
- Set the argument in the function signature

This roughly equates to this output:

```tsx
export interface FlightHelmetProps extends GroupProps {
  shadows?: boolean
}

export function FlightHelmet(props: FlightHelmetProps) {
  const { nodes, materials } = useGLTF(modelLoadPath, draco) as FlightHelmetGLTF
  const { shadows, ...rest } = props

  return (
    <group {...rest} dispose={null}>
      <mesh castShadow={shadows} receiveShadow={shadows} />
    </group>
  )
}
```

NOTE: if the `Object3D` property does not exist as part of calculated properties, it cannot be known at generation time that it is safe to add. If you want to force it to be added, use a `matcher` (see next section).

#### `exposeProps` - advanced example with `matcher`

A more powerful option is using the match specific nodes and expose those properties. Observe the following pseudo types (truncated for simplicity, see source for full type information):

```ts
interface GenerateOptions {
  /**
   * Expose component prop and propagate to matching Object3D props
   * e.g. shadows->[castShadow, receiveShadow]
   */
  exposeProps?: Record<string, MappedProp>
}

interface MappedProp {
  /**
   * Object3D prop(s)
   * e.g. castShadow | [castShadow, receiveShadow]
   * */
  to: string | string[]
  /**
   * Match a specific type of object.
   * If not provided, matches all that have the {to} prop
   * */
  matcher?: (o: Object3D, a: AnalyzedGLTF) => boolean
  /**
   * ts-morph prop structure (name is already supplied)
   * */
  structure: Omit<OptionalKind<PropertySignatureStructure>, 'name'>
}
```

This allows flexible exposure on arbitrary elements specified by the `matcher`. For example, if I wanted to toggle visibility on/off for some named elements:

```tsx
for (const search of ['base', 'side', 'top']) {
  options.exposeProps![search] = {
    to: ['visible'],
    structure: {
      type: 'boolean',
      hasQuestionToken: true,
    },
    matcher: (o, a) =>
      // note isGroup doesn't work, because the model may be Object3D that is converted at generation time
      (isMesh(o) || getJsxElementName(o, a) == 'group') && o.name?.toLowerCase().includes(search),
  }
}
```

this would map:

```tsx
export interface FooProps extends GroupProps {
  base?: boolean
  side?: boolean
  top?: boolean
}
```

to related elements. Because a `matcher` is specified, the property will be added to every element matched.

## Requirements

- Nodejs >= 16 must be installed
- The GLTF file has to be present in your projects `/public` folder
- [three](https://github.com/mrdoob/three.js/)
- [@react-three/fiber](https://github.com/pmndrs/react-three-fiber)
- [@react-three/drei](https://github.com/pmndrs/drei)
