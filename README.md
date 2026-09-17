# fantasic-hectic-linguine

This is a Microsoft FHL 2026 Fall project. It examines how consumers use the
SharedTree and Fluid Framework APIs.

The project is a recipe book that many users can edit at the same time. It is
built on [SharedTree](https://fluidframework.com/docs/data-structures/tree).
Each text field in a recipe is a SharedTree `FormattedText` node. This node is
an alpha API. The user edits the field with [Quill](https://quilljs.com). When
one user types text or applies a format, the other users see each character
immediately.

## Stack

- React 19.2, TypeScript 6, and [Vite](https://vite.dev)
- [`fluid-framework`](https://www.npmjs.com/package/fluid-framework) 3.x. This
  package is ESM only and requires TypeScript 6 or later. It is used with
  `@fluidframework/azure-client`, which connects to
  [tinylicious](https://fluidframework.com/docs/testing/tinylicious), the local
  Fluid service, by default, or to Azure Fluid Relay when configured. The
  `fluid-framework/beta` and `fluid-framework/alpha` entrypoints supply
  `SchemaFactoryBeta`, `FormattedText`, and the in-memory test views.
- [Quill](https://quilljs.com) and `quill-delta` for rich text editing
- Vitest and React Testing Library for the unit tests
- oxlint and Prettier for linting and formatting

## Getting started

1. Install the dependencies.
2. Start tinylicious, the local Fluid service. It uses port 7070.
3. In a second terminal, start the Vite dev server. It uses port 5173.

```sh
npm install
npm run start:server
npm run dev
```

4. Open http://localhost:5173 in a browser.

The app opens on a start page. The start page does not connect to the Fluid
service, and the browser does not load the Fluid code until you sign in. There
are two ways to sign in:

- **Create a book.** Type a name and click "Create book". The app makes one
  book container with that name and signs this tab in to it.
- **Open a book.** Paste the id of a book that exists and click "Open book".
  This is how you get back to a book from a different browser or device.

The book id is your identity. The name of a book is in the book container, so
each device shows the same name. The browser remembers the books that it has
signed in to, and the start page shows them in a list. Click a name to sign in
again. Click "Forget" to remove a book from the list. "Forget" does not delete
the book.

Each tab signs in separately. As a result, two tabs in one browser can be two
different users. A refresh keeps the tab signed in. A new tab opens on the
start page. To go back to the start page, click "Sign out" in the header.

The URL contains no data. To share your book, click "Copy book id" in the
header. The book id is the container id of the book in a compact form of 22
characters. The other user pastes the id into "Paste a book id to visit" and
clicks "Visit book". The other user then sees your book. The page shows a "Back
to my book" button and a "Save to my book" button on each recipe. When the
other user saves a recipe, the app adds the same shared recipe to the book of
the other user. The app does not make a copy. An edit from one book or the
other book goes to the one container. The saved card shows the book that the
recipe came from. When the user clicks the card, the app visits that book. Each
tab remembers the book it visits and the recipe it has open. As a result, a refresh
keeps your position.

## Scripts

| Script                 | Function                                                          |
| ---------------------- | ----------------------------------------------------------------- |
| `npm run dev`          | Start the Vite dev server against local tinylicious               |
| `npm run dev:azure`    | Start the Vite dev server against Azure Fluid Relay               |
| `npm run start:server` | Start tinylicious, the local Fluid service                        |
| `npm test`             | Do the unit tests with Vitest                                     |
| `npm run build`        | Check formatting, lint, check the types, and build for production |
| `npm run lint`         | Lint with oxlint                                                  |
| `npm run format`       | Format everything with Prettier                                   |
| `npm run format:check` | Report files that Prettier would change                           |

## Connecting to Azure Fluid Relay

The app follows the Fluid Framework examples: one client, `AzureClient`,
and an environment switch that picks the service. Without the switch, the
client uses local tinylicious. To use Azure Fluid Relay:

1. Copy `.env.example` to `.env.azure.local`. Git ignores that file.
2. Fill in the tenant id, the service endpoint, and one tenant key. All three
   are on the Access Keys page of the Fluid Relay resource in the Azure
   portal.
3. Start the app with `npm run dev:azure`. No local server is needed.

Books and recipes on the relay are separate from the local ones. Each book
that the browser remembers is on one service or the other. When you open a
book that is on the other service, the start page shows an error. Use
"Forget" to remove that book from the list, or change modes.

In both modes the browser signs its own tokens with the key, the way the
examples' `InsecureTokenProvider` does. In Azure mode that puts the tenant
key in the browser bundle, so this mode is for trying the relay, not for
sharing with others. A token service that keeps the key on a server is the
next step for real users.

## How the data is divided

There are two types of Fluid container. Fluid syncs each container and
protects each container separately. A container cannot contain a different
container.

- A **book container**. There is one book container for each user. Its root is
  `RecipeBook { name, cards }`. The name is set when the book is made. Each `RecipeCard` holds the searchable fields of one
  recipe: the title, the tags, and the author. The id of a card is the id of
  the container of that recipe. The cards are a projection. No code edits the
  fields of a card directly. The tags on a card are a map with the
  tag as the key. They are not an array. As a result, when two clients project the
  same recipe at the same time, the result has one entry for each tag. An array
  would keep the two inserts.
- A **recipe container**. There is one recipe container for each recipe. Its
  root is `Recipe`. This is the shared document that the users edit together.
  When a user opens a card, the app opens its container.

Your home book stays open until the page closes. When this tab visits the book
of a different user, the app opens a second book. When you save a recipe from
that book, the app adds a card with the same id to your book. Not more than one recipe container is open at one time. This is the
selected recipe. When you select a different recipe, the app closes the
previous container after the service acknowledges its edits. When a recipe is
open, the client syncs its cards in each open book one time. Then the client
monitors the title and the tags of the recipe. When the projection is
different, the client writes the new values at once. As a result, a second
client that reads one of the books sees the new title immediately. Cards in
books that no user has open stay out of date until a user opens that recipe
from that book.

## Known limitations

- A book id is the only thing that you need to sign in. The id that you share
  so that others can visit your book is the same id, so this is not real
  authentication. With this stack, the client cannot select a container id.
  As a result, your identity is the id that the service gave to your book, and
  you must keep that id to open the book from a different browser. The planned
  next step is a server that maps a unique name to a book id.
- A book made before books had names cannot be opened. Make a new book.
- A saved recipe is shared. It is not a fork. You cannot make your own copy
  that you can change freely.
- Quill requires a newline at the end of the text. The tree does not store this
  newline unless the last line has a line format. As a result, when you push Enter at
  the end of a field, the local view can show one more empty line than the
  remote view. This is the same as the behavior of the Quill bridge of Fluid.
- The editor does not use embeds (images, links) in pasted text.
- Each mounted field is a live Quill instance. As a result, a recipe with many
  ingredients has many editors. Only the selected recipe is mounted.
