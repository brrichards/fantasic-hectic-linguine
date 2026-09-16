import { Tree, type TreeNode } from 'fluid-framework'
import { useCallback, useRef, useSyncExternalStore } from 'react'

/**
 * Re-renders the calling component whenever `node` changes. `nodeChanged`
 * covers the node's own fields or items; `treeChanged` covers its whole
 * subtree. Returns a change counter that can be used as a memo dependency.
 */
export function useNode(node: TreeNode, event: 'nodeChanged' | 'treeChanged' = 'nodeChanged'): number {
  const version = useRef(0)
  const subscribe = useCallback(
    (onChange: () => void) =>
      Tree.on(node, event, () => {
        version.current += 1
        onChange()
      }),
    [node, event],
  )
  return useSyncExternalStore(subscribe, () => version.current)
}
