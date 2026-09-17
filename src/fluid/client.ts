import { AzureClient } from '@fluidframework/azure-client'
import {
  ConnectionState,
  SharedTree,
  type IFluidContainer,
  type ImplicitFieldSchema,
  type TreeView,
  type TreeViewConfiguration,
} from 'fluid-framework'
import { connectionConfigFromEnv } from './connection'
import { Recipe, RecipeBook, bookConfig, recipeConfig } from './schema'
import type { FluidService, OpenedRecipe } from './session'

const containerSchema = {
  initialObjects: { tree: SharedTree },
} as const

type RecipeContainer = IFluidContainer<typeof containerSchema>

async function openExisting<TSchema extends ImplicitFieldSchema>(
  client: AzureClient,
  id: string,
  config: TreeViewConfiguration<TSchema>,
): Promise<{ container: RecipeContainer; view: TreeView<TSchema> }> {
  const { container } = await client.getContainer(id, containerSchema, '3.0.0')
  const view = container.initialObjects.tree.viewWith(config)
  if (view.compatibility.canInitialize) {
    throw new Error(`Container ${id} exists but its tree was never initialized`)
  }
  if (!view.compatibility.canView) {
    if (!view.compatibility.canUpgrade) {
      throw new Error(`Container ${id} has a schema this client cannot read`)
    }
    view.upgradeSchema()
  }
  return { container, view }
}

async function createNew<TSchema extends ImplicitFieldSchema>(
  client: AzureClient,
  config: TreeViewConfiguration<TSchema>,
): Promise<{ container: RecipeContainer; view: TreeView<TSchema> }> {
  const { container } = await client.createContainer(containerSchema, '3.0.0')
  const view = container.initialObjects.tree.viewWith(config)
  if (!view.compatibility.canInitialize) {
    throw new Error('New container is not safe to initialize')
  }
  return { container, view }
}

/** Resolves once every local edit has been acknowledged by the service. */
function whenSaved(container: RecipeContainer): Promise<void> {
  if (!container.isDirty) return Promise.resolve()
  return new Promise((resolve) => container.once('saved', () => resolve()))
}

/** Resolves once the container is connected and caught up on every op. */
function whenConnected(container: RecipeContainer): Promise<void> {
  if (container.connectionState === ConnectionState.Connected) return Promise.resolve()
  return new Promise((resolve) => container.once('connected', () => resolve()))
}

function opened(container: RecipeContainer, view: TreeView<typeof Recipe>): OpenedRecipe {
  return {
    view,
    dispose: () => container.dispose(),
    whenSaved: () => whenSaved(container),
    whenConnected: () => whenConnected(container),
  }
}

/**
 * Connects to the configured Fluid service. The user gets a fresh id per
 * page load and the given name.
 */
export function connect(userName: string): FluidService {
  const user = { id: crypto.randomUUID(), name: userName }
  const client = new AzureClient({ connection: connectionConfigFromEnv(import.meta.env, user) })
  return {
    async openBook(bookId) {
      const { container, view } = await openExisting(client, bookId, bookConfig)
      return { view, bookId, whenSaved: () => whenSaved(container) }
    },
    async createBook(name) {
      const { container, view } = await createNew(client, bookConfig)
      view.initialize(new RecipeBook({ name, cards: [] }))
      return { view, bookId: await container.attach(), whenSaved: () => whenSaved(container) }
    },
    source: {
      async createRecipe(recipe: Recipe) {
        const { container, view } = await createNew(client, recipeConfig)
        view.initialize(recipe)
        const id = await container.attach()
        return { id, ...opened(container, view) }
      },
      async openRecipe(id: string) {
        const { container, view } = await openExisting(client, id, recipeConfig)
        return opened(container, view)
      },
    },
  }
}
