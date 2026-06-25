import type { Material } from 'three'
import { describe, expect, it } from 'vitest'

import { collectMaterials } from '../../src/index.ts'

// Minimal Material stand-in: collectMaterials only reads `.isMaterial` (via isMaterial guard) and dedups by reference.
const mat = (name: string) => ({ isMaterial: true, name }) as unknown as Material

describe('collectMaterials', () => {
  it('wraps a single material in an array', () => {
    const a = mat('A')
    expect(collectMaterials(a)).toEqual([a])
  })

  // Regression: the array branch used `result.concat(...)` (discarded) and always returned [], so multi-material
  // meshes contributed no materials to the generated GLTF interface.
  it('collects every material from an array', () => {
    const a = mat('A')
    const b = mat('B')
    expect(collectMaterials([a, b])).toEqual([a, b])
  })

  it('deduplicates repeated materials by reference', () => {
    const a = mat('A')
    expect(collectMaterials([a, a])).toEqual([a])
  })

  it('throws when a non-material is encountered', () => {
    expect(() => collectMaterials({ name: 'nope' } as unknown as Material)).toThrow()
  })
})
