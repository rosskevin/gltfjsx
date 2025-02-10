import { SimplifyOptions } from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'

import { TransformOptions } from '../options.js'
import { WithRequired } from '../utils/types.js'

export function resolveSimplifyOptions(
  simplify: WithRequired<TransformOptions, 'simplify'>['simplify'],
): SimplifyOptions {
  if (typeof simplify === 'boolean') {
    return {
      simplifier: MeshoptSimplifier,
      ratio: 0.75, // sync with cli defaults if changed
      error: 0.001,
    }
  } else {
    return {
      simplifier: MeshoptSimplifier, // default simplifier
      ...simplify,
    }
  }
}
