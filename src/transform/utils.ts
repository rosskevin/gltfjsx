import type { ILogger } from '@gltf-transform/core'
import type { SimplifyOptions } from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'

import type { Logger, TransformOptions } from '../options.ts'
import type { WithRequired } from '../utils/types.ts'

export class LogAdapter implements ILogger {
  constructor(private log: Logger) {}

  public debug(message: string): void {
    this.log.debug(message)
  }

  public info(message: string): void {
    this.log.info(message)
  }

  public warn(message: string): void {
    this.log.warn(message)
  }

  public error(message: string): void {
    this.log.error(message)
  }
}

export function resolveSimplifyOptions(
  simplify: WithRequired<TransformOptions, 'simplify'>['simplify'],
): SimplifyOptions {
  if (typeof simplify === 'boolean') {
    return {
      error: 0.001,
      ratio: 0.75, // sync with cli defaults if changed
      simplifier: MeshoptSimplifier,
    }
  } else {
    return {
      simplifier: MeshoptSimplifier, // default simplifier
      ...simplify,
    }
  }
}
