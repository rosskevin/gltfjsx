import { Object3D } from 'three'

/**
 * r3f specific determination of jsx component
 */
export function getType(obj: Object3D): string {
  let type = obj.type.charAt(0).toLowerCase() + obj.type.slice(1)
  // Turn object3d's into groups, it should be faster according to the threejs docs
  if (type === 'object3D') type = 'group'
  if (type === 'perspectiveCamera') type = 'PerspectiveCamera'
  if (type === 'orthographicCamera') type = 'OrthographicCamera'
  return type
}
