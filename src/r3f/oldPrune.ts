// function prune(obj: Object3D, children: string, result: string, oldResult: string) {
//   const { animated } = a.getInfo(obj)
//   const type = getType(obj)
//   // Prune ...
//   if (
//     isNotRemoved(obj) &&
//     !options.keepgroups &&
//     !animated &&
//     (type === 'group' || type === 'scene')
//   ) {
//     /** Empty or no-property groups
//      *    <group>
//      *      <mesh geometry={nodes.foo} material={materials.bar} />
//      *  Solution:
//      *    <mesh geometry={nodes.foo} material={materials.bar} />
//      */
//     if (result === oldResult || obj.children.length === 0) {
//       if (options.debug) {
//         console.log(`group ${obj.name} removed (empty)`)
//       }
//       setRemoved(obj)
//       return children
//     }

//     // More aggressive removal strategies ...
//     const first = obj.children[0]
//     const firstProps = handleProps(first)
//     const regex = /([a-z-A-Z]*)={([a-zA-Z0-9.[\]\-, /]*)}/g // original before linting /([a-z-A-Z]*)={([a-zA-Z0-9\.\[\]\-\,\ \/]*)}/g
//     const keys1 = [...result.matchAll(regex)].map(([, match]) => match)
//     // const values1 = [...result.matchAll(regex)].map(([, , match]) => match)
//     const keys2 = [...firstProps.matchAll(regex)].map(([, match]) => match)

//     /** Double negative rotations
//      *    <group rotation={[-Math.PI / 2, 0, 0]}>
//      *      <group rotation={[Math.PI / 2, 0, 0]}>
//      *        <mesh geometry={nodes.foo} material={materials.bar} />
//      *  Solution:
//      *    <mesh geometry={nodes.foo} material={materials.bar} />
//      */
//     if (
//       obj.children.length === 1 &&
//       getType(first) === type &&
//       equalOrNegated(obj.rotation, first.rotation)
//     ) {
//       if (
//         keys1.length === 1 &&
//         keys2.length === 1 &&
//         keys1[0] === 'rotation' &&
//         keys2[0] === 'rotation'
//       ) {
//         if (options.debug) {
//           console.log(`group ${obj.name} removed (aggressive: double negative rotation)`)
//         }
//         setRemoved(obj, isRemoved(first))
//         children = ''
//         if (first.children) first.children.forEach((child) => (children += print(child, true)))
//         return children
//       }
//     }

//     /** Double negative rotations w/ props
//      *    <group rotation={[-Math.PI / 2, 0, 0]}>
//      *      <group rotation={[Math.PI / 2, 0, 0]} scale={0.01}>
//      *        <mesh geometry={nodes.foo} material={materials.bar} />
//      *  Solution:
//      *    <group scale={0.01}>
//      *      <mesh geometry={nodes.foo} material={materials.bar} />
//      */
//     if (
//       obj.children.length === 1 &&
//       getType(first) === type &&
//       equalOrNegated(obj.rotation, first.rotation)
//     ) {
//       if (
//         keys1.length === 1 &&
//         keys2.length > 1 &&
//         keys1[0] === 'rotation' &&
//         keys2.includes('rotation')
//       ) {
//         if (options.debug) {
//           console.log(`group ${obj.name} removed (aggressive: double negative rotation w/ props)`)
//         }
//         setRemoved(obj)
//         // Remove rotation from first child
//         first.rotation.set(0, 0, 0)
//         children = print(first, true)
//         return children
//       }
//     }

//     /** Transform overlap
//      *    <group position={[10, 0, 0]} scale={2} rotation={[-Math.PI / 2, 0, 0]}>
//      *      <mesh geometry={nodes.foo} material={materials.bar} />
//      *  Solution:
//      *    <mesh geometry={nodes.foo} material={materials.bar} position={[10, 0, 0]} scale={2} rotation={[-Math.PI / 2, 0, 0]} />
//      */
//     const isChildTransformed =
//       keys2.includes('position') || keys2.includes('rotation') || keys2.includes('scale')
//     const hasOtherProps = keys1.some((key) => !['position', 'scale', 'rotation'].includes(key))
//     if (obj.children.length === 1 && isNotRemoved(first) && !isChildTransformed && !hasOtherProps) {
//       if (options.debug) {
//         console.log(`group ${obj.name} removed (aggressive: ${keys1.join(' ')} overlap)`)
//       }
//       // Move props over from the to-be-deleted object to the child
//       // This ensures that the child will have the correct transform when pruning is being repeated
//       // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
//       keys1.forEach((key) => (obj.children[0] as any)[key].copy((obj as any)[key]))
//       // Insert the props into the result string
//       children = print(first, true)
//       setRemoved(obj)
//       return children
//     }

//     /** Lack of content
//      *    <group position={[10, 0, 0]} scale={2} rotation={[-Math.PI / 2, 0, 0]}>
//      *      <group position={[10, 0, 0]} scale={2} rotation={[-Math.PI / 2, 0, 0]}>
//      *        <group position={[10, 0, 0]} scale={2} rotation={[-Math.PI / 2, 0, 0]} />
//      * Solution:
//      *   (delete the whole sub graph)
//      */
//     const empty: any[] = []
//     obj.traverse((o) => {
//       const type = getType(o)
//       if (type !== 'group' && type !== 'object3D') empty.push(o)
//     })
//     if (!empty.length) {
//       if (options.debug) console.log(`group ${obj.name} removed (aggressive: lack of content)`)
//       empty.forEach((child) => setRemoved(child))
//       return ''
//     }
//   }

//   //?
//   return children
// }
export default {}
