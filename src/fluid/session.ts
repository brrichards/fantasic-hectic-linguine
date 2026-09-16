import type { TreeView } from 'fluid-framework'
import { cardFor, syncCard, watchRecipeProjection } from './projection'
import { Recipe, RecipeBook, RecipeCard } from './schema'

/** A recipe container that has been opened by a {@link ContainerSource}. */
export interface OpenedRecipe {
  view: TreeView<typeof Recipe>
  /** Releases the container. Safe to call once. */
  dispose(): void
  /** Resolves once the service has acknowledged every local edit. */
  whenSaved(): Promise<void>
  /**
   * Resolves once the container has caught up with the service, so its tree
   * reflects every edit made elsewhere. Reading it earlier can see stale data.
   */
  whenConnected(): Promise<void>
}

/** Where recipe containers come from. The real one talks to Fluid; tests use in-memory views. */
export interface ContainerSource {
  createRecipe(recipe: Recipe): Promise<OpenedRecipe & { id: string }>
  openRecipe(id: string): Promise<OpenedRecipe>
}

/** An open book container and its id. */
export interface BookHandle {
  view: TreeView<typeof RecipeBook>
  bookId: string
  /** Resolves once the service has acknowledged every local edit to this book. */
  whenSaved?: () => Promise<void>
}

export interface SessionBooks {
  /** This browser's own book, always open. */
  home: BookHandle
  /** Someone else's book, when this tab is visiting one. */
  browsed?: BookHandle
}

interface Selection {
  card: RecipeCard
  opened: OpenedRecipe
  /** Set once the container has caught up and projection has begun. */
  syncing: boolean
  stopProjection: () => void
}

/**
 * Holds the user's home book open for the life of the page, optionally a
 * second book being browsed, and at most one recipe container, the selected
 * one. Creating or selecting a recipe opens its container and keeps every
 * card for it in the open books projected; moving on disposes the previous
 * container once its edits are acknowledged.
 */
export class RecipeSession {
  private selection: Selection | undefined
  private readonly home: BookHandle
  private readonly browsed: BookHandle | undefined
  private readonly source: ContainerSource

  constructor(books: SessionBooks, source: ContainerSource) {
    this.home = books.home
    this.browsed = books.browsed
    this.source = source
  }

  /** The book on screen: the browsed one when there is one, else home. */
  get book(): RecipeBook {
    return (this.browsed ?? this.home).view.root
  }

  get bookId(): string {
    return (this.browsed ?? this.home).bookId
  }

  get homeBook(): RecipeBook {
    return this.home.view.root
  }

  get homeBookId(): string {
    return this.home.bookId
  }

  get isHome(): boolean {
    return this.browsed === undefined
  }

  get current(): { card: RecipeCard; recipe: Recipe } | undefined {
    if (!this.selection) return undefined
    return { card: this.selection.card, recipe: this.selection.opened.view.root }
  }

  homeHas(cardId: string): boolean {
    return this.homeBook.cards.findById(cardId) !== undefined
  }

  /**
   * Adds a card for the same recipe to the home book, so it shows up there
   * and stays the one shared recipe. Returns the existing card if the recipe
   * is already in the home book.
   */
  saveToHome(card: RecipeCard): RecipeCard {
    const existing = this.homeBook.cards.findById(card.id)
    if (existing) return existing
    const saved = this.homeBook.cards.add(
      new RecipeCard({
        id: card.id,
        title: card.title,
        tags: Object.fromEntries([...card.tags.keys()].map((tag) => [tag, true])),
        authorId: card.authorId,
      }),
    )
    // If this recipe is open and caught up, the live recipe beats the copied card.
    const selection = this.selection
    if (selection && selection.card.id === card.id && selection.syncing) {
      syncCard(saved, selection.opened.view.root)
    }
    return saved
  }

  /** Creates a recipe container, adds its card to the book on screen, and selects it. */
  async createRecipe(title: string): Promise<RecipeCard> {
    const opened = await this.source.createRecipe(Recipe.create(title, this.bookId))
    const card = this.book.cards.add(cardFor(opened.id, opened.view.root))
    this.replaceSelection({ card, opened })
    return card
  }

  /** Opens the card's container, or reuses it when already selected. */
  async select(card: RecipeCard): Promise<Recipe> {
    if (this.selection?.card.id === card.id) return this.selection.opened.view.root
    const opened = await this.source.openRecipe(card.id)
    this.replaceSelection({ card, opened })
    return opened.view.root
  }

  deselect(): void {
    this.release(this.selection)
    this.selection = undefined
  }

  /** Every card for this recipe in the books that are open here. */
  private cardsFor(card: RecipeCard): RecipeCard[] {
    const cards = [card]
    if (this.browsed) {
      const atHome = this.homeBook.cards.findById(card.id)
      if (atHome && atHome !== card) cards.push(atHome)
    }
    return cards
  }

  private replaceSelection(next: { card: RecipeCard; opened: OpenedRecipe }): void {
    this.release(this.selection)
    const selection: Selection = { ...next, syncing: false, stopProjection: () => {} }
    this.selection = selection
    // Only project once the container has caught up: a freshly opened
    // container may still be receiving edits made elsewhere, and writing its
    // interim state onto the cards would publish stale titles.
    void next.opened.whenConnected().then(() => {
      if (this.selection !== selection) return
      const recipe = next.opened.view.root
      const cards = () => this.cardsFor(next.card)
      // Cards can be stale if other clients edited while nobody here had the
      // recipe open, so bring them up to date before watching.
      for (const card of cards()) syncCard(card, recipe)
      selection.stopProjection = watchRecipeProjection(recipe, cards)
      selection.syncing = true
    })
  }

  private release(selection: Selection | undefined): void {
    if (!selection) return
    selection.stopProjection()
    void selection.opened.whenSaved().then(() => selection.opened.dispose())
  }
}
