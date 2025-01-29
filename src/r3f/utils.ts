import { Object3D } from 'three'

import { isBone, isTargetedLight } from '../analyze/is.js'

/**
 * r3f specific determination of jsx component
 */
export function getJsxElementName(o: Object3D): string {
  let type = o.type.charAt(0).toLowerCase() + o.type.slice(1)
  // Turn object3d's into groups, it should be faster according to the threejs docs
  if (type === 'object3D') type = 'group'
  if (type === 'perspectiveCamera') type = 'PerspectiveCamera'
  if (type === 'orthographicCamera') type = 'OrthographicCamera'
  return type
}

export function isPrimitive(o: Object3D) {
  if (isTargetedLight(o)) {
    return true
  }
  if (isBone(o)) {
    return true
  }

  return false
}
