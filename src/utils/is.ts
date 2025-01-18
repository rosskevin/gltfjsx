import {
  Camera,
  InstancedMesh,
  Light,
  Material,
  Mesh,
  OrthographicCamera,
  PerspectiveCamera,
  SkinnedMesh,
  SpotLight,
} from 'three'

export const isMaterial = (o: any): o is Material => (o as any).isMaterial

export const isMesh = (o: any): o is Mesh => (o as any).isMesh

export const isSkinnedMesh = (o: any): o is SkinnedMesh => (o as any).isSkinnedMesh

export const isInstancedMesh = (o: any): o is InstancedMesh => (o as any).isInstancedMesh

export const isLight = (o: any): o is Light => (o as any).isLight

export const isSpotLight = (o: any): o is SpotLight => (o as any).isSpotLight

export const isCamera = (o: any): o is Camera => (o as any).isCamera

export const isOrthographicCamera = (o: any): o is OrthographicCamera =>
  (o as any).isOrthographicCamera

export const isPerspectiveCamera = (o: any): o is PerspectiveCamera =>
  (o as any).isPerspectiveCamera

// interface Removeable {
//   __removed?: boolean
// }

export const isNotRemoved = (o: any): boolean => o.__removed === undefined || !o.__removed

export const isRemoved = (o: any): boolean => o.__removed !== undefined && o.__removed
