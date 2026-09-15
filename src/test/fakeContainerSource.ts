import { createIndependentTreeView, type TreeViewBeta } from 'fluid-framework/beta'
import { Recipe, RecipeBook, bookConfig, recipeConfig } from '../fluid/schema'
import type { ContainerSource } from '../fluid/session'

/**
 * A container source backed by independent tree views, for tests. Records
 * every call so tests can assert ordering and disposal, and lets a test hold
 * back the "saved" signal of any container.
 */
export function fakeContainerSource() {
  const views = new Map<string, TreeViewBeta<typeof Recipe>>()
  const log: string[] = []
  const savedGates = new Map<string, () => void>()
  const connectedGates = new Map<string, () => void>()
  let n = 0

  const gated = (gates: Map<string, () => void>, containerId: string) =>
    new Promise<void>((resolve) => {
      if (gates.has(containerId)) gates.set(containerId, resolve)
      else resolve()
    })

  const opened = (containerId: string) => ({
    view: views.get(containerId)!,
    dispose: () => {
      log.push(`dispose ${containerId}`)
    },
    whenSaved: () => gated(savedGates, containerId),
    whenConnected: () => gated(connectedGates, containerId),
  })

  const source: ContainerSource = {
    async createRecipe(recipe: Recipe) {
      const view = createIndependentTreeView(recipeConfig)
      view.initialize(recipe)
      n += 1
      const containerId = `container-${n}`
      views.set(containerId, view)
      log.push(`create ${containerId}`)
      return { containerId, ...opened(containerId) }
    },
    async openRecipe(containerId: string) {
      if (!views.has(containerId)) throw new Error(`no container ${containerId}`)
      log.push(`open ${containerId}`)
      return opened(containerId)
    },
  }

  const hold = (gates: Map<string, () => void>, containerId: string) => {
    gates.set(containerId, () => {})
    return () => {
      gates.get(containerId)?.()
      gates.delete(containerId)
    }
  }
  /** Makes the next whenSaved for this container wait until the returned function is called. */
  const holdSaved = (containerId: string) => hold(savedGates, containerId)
  /** Makes the next whenConnected for this container wait until the returned function is called. */
  const holdConnected = (containerId: string) => hold(connectedGates, containerId)

  return { source, log, views, holdSaved, holdConnected }
}

/** A hydrated, empty book view. */
export function makeBookView() {
  const view = createIndependentTreeView(bookConfig)
  view.initialize(new RecipeBook({ cards: [] }))
  return view
}
