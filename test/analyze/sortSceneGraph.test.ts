import type { GLTF } from 'node-three-gltf'
import { BufferGeometry, Group, Mesh, MeshStandardMaterial, type Object3D, SpotLight } from 'three'
import { describe, expect, it } from 'vitest'

import { AnalyzedGLTF } from '../../src/index.ts'
import { fixtureAnalyzeOptions } from '../fixtures.ts'

/**
 * Unit coverage for the canonical sibling ordering AnalyzedGLTF imposes to undo the GLTFLoader's
 * non-deterministic child order. The FlightHelmet fixtures are all distinctly-named single-primitive
 * leaf meshes, so they never exercise the `primitives` / name tiebreakers, association-less nodes, or
 * the light-target pin. This builds a synthetic scene that does, without any file I/O.
 */

type AssocRef = { nodes?: number; primitives?: number; meshes?: number }
type Assoc = Map<Object3D, AssocRef>

function namedMesh(name: string) {
  const m = new Mesh(new BufferGeometry(), new MeshStandardMaterial())
  m.name = name
  ;(m.material as MeshStandardMaterial).name = `${name}Mat`
  return m
}

/**
 * Build a fresh scene each call (AnalyzedGLTF mutates the graph in place). Returns the light so the
 * test can assert its target stays pinned. Children are deliberately added out of canonical order.
 */
function buildScene() {
  const scene = new Group() // parent === null marks it the scene root

  // Targeted light with an authored child node — the target must remain children[0] after sorting.
  const spot = new SpotLight()
  spot.name = 'Spot'
  spot.add(spot.target) // loader appends the synthetic target first
  const lightChild = namedMesh('LightChild')
  spot.add(lightChild)

  // Node-indexed leaves, added reversed vs. their glTF node index.
  const bravo = namedMesh('Bravo')
  const alpha = namedMesh('Alpha')

  // A multi-primitive mesh: a Group (node) whose children carry only a primitive index, no node index.
  const multi = new Group()
  multi.name = 'Multi'
  multi.position.set(1, 0, 0) // a prop so pruneEmpty keeps it
  const prim1 = namedMesh('Prim1')
  const prim0 = namedMesh('Prim0')
  multi.add(prim1, prim0)

  // Association-less leaves to exercise the name tiebreaker.
  const zulu = namedMesh('Zulu')
  const yankee = namedMesh('Yankee')

  scene.add(spot, bravo, alpha, multi, zulu, yankee)

  const associations: Assoc = new Map<Object3D, AssocRef>([
    [spot, { nodes: 0 }],
    [lightChild, { nodes: 1 }],
    [alpha, { nodes: 2 }],
    [bravo, { nodes: 3 }],
    [multi, { meshes: 5, nodes: 5 }],
    [prim0, { meshes: 5, primitives: 0 }],
    [prim1, { meshes: 5, primitives: 1 }],
  ])

  const gltf = {
    animations: [],
    parser: { associations, json: {} },
    scene,
  } as unknown as GLTF

  return { gltf, spot }
}

function reverseChildrenDeep(o: Object3D) {
  o.children.reverse()
  o.children.forEach(reverseChildrenDeep)
}

describe('AnalyzedGLTF sibling ordering', () => {
  it('orders by glTF node index, then primitive index, then name', () => {
    const { gltf } = buildScene()
    const a = new AnalyzedGLTF(gltf, fixtureAnalyzeOptions())
    expect(a.getMeshes().map((m) => m.name)).toEqual([
      'LightChild', // node 1 (under Spot, node 0)
      'Alpha', // node 2
      'Bravo', // node 3
      'Prim0', // node 5, primitive 0
      'Prim1', // node 5, primitive 1
      'Yankee', // no association → name tiebreaker
      'Zulu',
    ])
  })

  it('is invariant to incoming sibling order (canonicalizes any permutation)', () => {
    const normal = new AnalyzedGLTF(buildScene().gltf, fixtureAnalyzeOptions())
    const reversedScene = buildScene()
    reverseChildrenDeep(reversedScene.gltf.scene)
    const reversed = new AnalyzedGLTF(reversedScene.gltf, fixtureAnalyzeOptions())
    expect(reversed.getMeshes().map((m) => m.name)).toEqual(normal.getMeshes().map((m) => m.name))
  })

  it("pins a light's synthetic target to children[0] so isTargetedLight still holds", () => {
    const { gltf, spot } = buildScene()
    new AnalyzedGLTF(gltf, fixtureAnalyzeOptions())
    expect(spot.children[0]).toBe(spot.target)
  })
})
