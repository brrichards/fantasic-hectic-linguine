import { TinyliciousClient } from '@fluidframework/tinylicious-client'
import { SharedTree, TreeViewConfiguration, type TreeView } from 'fluid-framework'
import { Counter } from './schema'

const client = new TinyliciousClient()

const containerSchema = {
  initialObjects: { tree: SharedTree },
} as const

const treeConfig = new TreeViewConfiguration({ schema: Counter })

/**
 * Loads the container named by the URL hash, or creates a new one (and sets
 * the hash) so the URL can be shared with other clients to join the session.
 */
export async function loadCounterView(): Promise<TreeView<typeof Counter>> {
  const existingId = location.hash.slice(1)
  if (existingId) {
    const { container } = await client.getContainer(existingId, containerSchema, '3.0.0')
    return container.initialObjects.tree.viewWith(treeConfig)
  }

  const { container } = await client.createContainer(containerSchema, '3.0.0')
  const view = container.initialObjects.tree.viewWith(treeConfig)
  view.initialize(new Counter({ count: 0 }))
  location.hash = await container.attach()
  return view
}
