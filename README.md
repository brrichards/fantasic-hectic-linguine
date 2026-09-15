# fantasic-hectic-linguine

Microsoft FHL 2026 Fall project focusing on consumer utilization of Shared Tree/Fluid Framework APIs

A collaborative recipe book built on [SharedTree](https://fluidframework.com/docs/data-structures/tree).
Every text field in a recipe is a SharedTree `FormattedText` node (an alpha API)
edited through [Quill](https://quilljs.com), so collaborators see each other's
typing and formatting live, character by character.

## Stack

- React 19.2 + TypeScript 6 + [Vite](https://vite.dev)
- [`fluid-framework`](https://www.npmjs.com/package/fluid-framework) 3.x (ESM-only, requires TS 6+) with
  `@fluidframework/tinylicious-client` and [tinylicious](https://fluidframework.com/docs/testing/tinylicious)
  as the local Fluid service. The `fluid-framework/beta` and `fluid-framework/alpha`
  entrypoints are used for `SchemaFactoryBeta`, `FormattedText`, and in-memory test views.
- [Quill](https://quilljs.com) 2 and `quill-delta` for rich text editing
- Vitest + React Testing Library for unit tests, Playwright for the live sync check

Version notes:

- Fluid 3.x requires TypeScript 6+, `moduleResolution: "bundler"`/Node16, and strict
  null checks (`strict` is enabled in `tsconfig.app.json`).
- React 19 matches Microsoft's current official SharedTree examples. Do not add the
  `@fluidframework/react` or `@fluidframework/quill-react` helper packages: both are
  alpha or internal and hard-depend on React 18. The Quill bridge in `src/text/` is a
  port of the internal `quill-react` package with size and font formatting removed.
- `FormattedText` is an alpha API and may change between Fluid releases.

## Getting started

```sh
npm install
npm run start:server   # tinylicious, the local Fluid service (port 7070)
npm run dev            # Vite dev server (port 5173), in a second terminal
```

Open http://localhost:5173 — on first use the app creates two dummy profiles,
Alice and Bob, each with its own empty recipe book, and signs this tab in as
Alice. A profile is a name and its book's container id; the book id is the
profile's identity. The header lets each tab pick who it is, so two tabs in one
browser can be two people; a new tab opens as whoever was picked most recently. "Sign in" accepts a pasted book link or id and adds it
as a profile, which is how you open a friend's book as yourself.

Nothing lives in the URL. To share your book, click "Copy book id" in the
header; it is the book's container id in a 22-character compact form. The other
person pastes it into "Paste a book id to visit" and clicks "Visit book". They see
your book with a "Back to my book" button and a "Save to my book" button on every
recipe. Saving adds the recipe to their book as the same shared recipe, not a
copy: edits from either book land in the one container, and the saved card says
whose book it came from and visits it on click. Which book a tab is visiting and
which recipe it has open are remembered per tab, so a refresh keeps your place.

## Scripts

| Script                 | What it does                                    |
| ---------------------- | ----------------------------------------------- |
| `npm run dev`          | Start the Vite dev server                       |
| `npm run start:server` | Start tinylicious (local Fluid service)         |
| `npm test`             | Run unit tests (Vitest)                         |
| `npm run test:e2e`     | Live multi-client sync check (needs both servers) |
| `npm run build`        | Typecheck and build for production              |
| `npm run lint`         | Lint with oxlint                                |

The e2e check drives Playwright browser clients through creating a recipe,
retitling it in a Quill editor and watching the card follow, a second tab
switching to Bob, visiting Alice's book by her copied id, editing the shared
recipe, saving it into his own book, editing it from there, a tag projected across
both books, a refreshed tab landing back on its open recipe, and the bad-book-id
error path (append `-- --headed` to watch it). All tabs share one browser context,
like a real user with two profiles.

## How the data is split

There are two kinds of Fluid container, because Fluid syncs and secures per
container and containers cannot nest.

- A **book container**, one per user, whose root is `RecipeBook { cards }`. Each
  `RecipeCard` holds the searchable fields of one recipe (title, tags, visibility,
  updated time), the id of that recipe's own container, and `originBookId`, the
  book the recipe was created in, which stands in for its author until profiles
  exist. Cards are a projection: nothing edits their title or tags by hand. Tags on a card are a map
  keyed by tag rather than an array, so two clients projecting the same recipe at
  once converge to one entry per tag; an array would keep both inserts.
- A **recipe container**, one per recipe, whose root is `Recipe`. This is the
  shared document collaborators edit together. Opening a card opens its container.

Your home book stays open for the life of the page, and a second book is opened
alongside it when the URL names someone else's. Saving a recipe from their book
adds a card with the same id and container id to your book. At most one recipe
container is open at a time, the selected one; switching recipes disposes the
previous container once its edits are acknowledged. While a recipe is open, the
client syncs its cards in every open book once on open, then watches its title and
tags and writes them, debounced and only when the projection differs, so a second
client browsing either book sees titles update live. Cards in books nobody has
open go stale until someone opens that recipe from that book.

## Layout

- `src/fluid/schema.ts` — both schemas. `RichText` is built with
  `FormattedText.createSchema` over a `CharacterFormat` of bold, italic, and
  underline plus a `LineAtom` that carries Quill's line formatting (headers, lists,
  blockquote, code block) on a newline. `Recipe` has a title, description, source
  URL, optional servings and prep/cook minutes, and ordered `Ingredients`, `Steps`,
  `Tags`, and `Notes`; `Recipe.create(title, id?)` builds a blank one. `RecipeBook`
  holds `RecipeCards` with `add`, `findById`, and `removeById`. Recipes, cards,
  ingredients, steps, and notes carry an `sf.identifier` id; a card's id equals its
  recipe's id. Ordered collections expose `add` and `move`, and `move` uses
  `moveToIndex` so concurrent edits to a moved item survive.
- `src/fluid/projection.ts` — `projectRecipe`, `syncCard`, and
  `watchRecipeProjection`, which copies a recipe's title and tags onto its card in
  one transaction after a debounce.
- `src/fluid/session.ts` — `RecipeSession`, which owns the home book, an optional
  browsed book, and the one open recipe container, with `saveToHome`, over a
  `ContainerSource` interface so tests can run it on in-memory views.
- `src/profiles.ts` — the profiles known on this device (name and book id), which
  one each tab is signed in as, and the first-run creation of Alice and Bob.
- `src/ids.ts` — compact base64url form of a container UUID, and 8-character
  recipe ids.
- `src/tabState.ts` — the book this tab is visiting and the recipe it has open,
  in session storage.
- `src/fluid/client.ts` — the tinylicious `ContainerSource` and `loadBook`, with the
  `canInitialize` / `canView` / `canUpgrade` checks the Fluid docs recommend.
- `src/text/quillAttributes.ts` — maps Quill attributes to and from the tree's
  character format and line tags.
- `src/text/quillBridge.ts` — the two-way translation. `applyQuillDeltaToTree`
  turns a Quill delta from a user edit into one tree transaction.
  `contentOpsToQuillDelta` turns the tree's content ops back into Quill ops, and
  `buildDeltaFromTree` renders the whole node. Quill counts UTF-16 code units and
  the tree counts code points, so every position is tracked in both.
- `src/text/RichTextEditor.tsx` — one Quill instance per mounted field. The
  `prose` variant has a toolbar; the `line` variant swallows Enter and strips
  pasted newlines. A re-entrancy flag stops local edits echoing back through the
  tree subscription. Quill's history module is off; there is no undo/redo yet.
- `src/hooks/useNode.ts` — `useSyncExternalStore` over `Tree.on(node, ...)` for
  non-text state, scoped per node so keystrokes in an editor never re-render the
  surrounding shell.
- `src/components/` — `RecipeList` (cards, add, remove, select, save), `RecipeDetail`
  (every field of one recipe, the visibility picker, and ingredient, step, tag,
  and note rows), and `CopyLink`. `App` holds the header with the profile picker,
  the book id for sharing, and the visit form. Changing book (profile, visit, or
  home) reloads the page, since book containers are loaded once.
- `src/test/fakeContainerSource.ts` — an in-memory `ContainerSource` for tests.

See `BACKLOG.md` for designed but unscheduled slices.

## Known limitations

- Tinylicious enforces no access control. A card's `visibility` is stored and
  shown but not enforced, and anyone with a book URL can read every card, private
  ones included. Enforcement needs a service that issues per-container tokens.
- Profiles are a local list of names and book ids, and Alice and Bob are created
  on first use. Real sign-in would supply the book id from a backend instead.
  Container ids cannot be chosen by the client with this stack, so a profile's
  id is the id the service assigned to its book.
- A saved recipe is shared, not forked. Getting your own copy to change freely is
  the export-and-import slice in the backlog.
- Removing a card does not delete its recipe container; tinylicious has no delete.
  Orphaned containers are harmless.
- Quill's mandatory terminal newline is not stored in the tree unless the last
  line carries line formatting. Pressing Enter at the very end of a field can
  therefore show one more blank line locally than remotely. This matches the
  behavior of Fluid's own Quill bridge.
- Embeds (images, links) pasted into an editor are ignored.
- Every mounted field is a live Quill instance, so a recipe with many
  ingredients carries many editors. Only the selected recipe is mounted.
