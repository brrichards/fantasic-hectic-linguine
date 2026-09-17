import { AzureClient } from '@fluidframework/azure-client'
import {
  ConnectionState,
  SharedTree,
  type IFluidContainer,
  type ImplicitFieldSchema,
  type TreeView,
  type TreeViewConfiguration,
} from 'fluid-framework'
import { getActiveBookId, profileForBook } from '../profiles'
import { connectionConfigFromEnv, type TokenUser } from './connection'
import { Recipe, RecipeBook, bookConfig, recipeConfig } from './schema'
import type { BookHandle, ContainerSource, OpenedRecipe } from './session'

/** A fresh id per page load, named after the profile this tab is signed in as. */
function tokenUser(): TokenUser {
  const bookId = getActiveBookId()
  const name = bookId === undefined ? undefined : profileForBook(bookId)?.name
  return { id: crypto.randomUUID(), name: name ?? 'anonymous' }
}

const client = new AzureClient({ connection: connectionConfigFromEnv(import.meta.env, tokenUser()) })

const containerSchema = {
  initialObjects: { tree: SharedTree },
} as const

type RecipeContainer = IFluidContainer<typeof containerSchema>

async function openExisting<TSchema extends ImplicitFieldSchema>(
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
 * Opens the book container with the given id, or creates a new empty book
 * when no id is given. Returns the id so the caller can put it in the URL.
 */
export async function loadBook(bookId?: string): Promise<BookHandle> {
  if (bookId) {
    const { container, view } = await openExisting(bookId, bookConfig)
    return { view, bookId, whenSaved: () => whenSaved(container) }
  }
  const { container, view } = await createNew(bookConfig)
  view.initialize(new RecipeBook({ cards: [] }))
  return { view, bookId: await container.attach(), whenSaved: () => whenSaved(container) }
}

/** Recipe containers on the configured Fluid service. */
export const fluidSource: ContainerSource = {
  async createRecipe(recipe: Recipe) {
    const { container, view } = await createNew(recipeConfig)
    view.initialize(recipe)
    const id = await container.attach()
    return { id, ...opened(container, view) }
  },
  async openRecipe(id: string) {
    const { container, view } = await openExisting(id, recipeConfig)
    return opened(container, view)
  },
}
