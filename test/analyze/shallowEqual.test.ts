import { describe, expect, it } from 'vitest'

import { shallowEqual } from '../../src/index.ts'

describe('shallowEqual', () => {
  it('should work', () => {
    const obj1 = { age: 33, name: 'John' }
    const obj2 = { age: 33, name: 'John' }
    const obj3 = { age: 45, name: 'John' }

    const aobj1 = { age: 33, kids: ['booker', 'archer'], name: 'John' }
    const aobj2 = { age: 33, kids: ['archer', 'booker'], name: 'John' }
    const aobj3 = { age: 33, kids: ['bookerx', 'archerx'], name: 'John' }

    expect(shallowEqual(obj1, obj2)).toBe(true)
    expect(shallowEqual(obj1, obj3)).toBe(false)

    expect(shallowEqual(aobj1, aobj2)).toBe(true)
    expect(shallowEqual(aobj1, aobj3)).toBe(false)
  })
})
