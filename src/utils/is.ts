import { Mesh } from 'three'

export const isMesh = (o: any): o is Mesh => o instanceof Mesh // (o as any).isMesh

// interface Removeable {
//   __removed?: boolean
// }

export const isNotRemoved = (o: any): boolean => !o.__removed
