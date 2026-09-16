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
  `@fluidframework/tinylicious-client` and
  [tinylicious](https://fluidframework.com/docs/testing/tinylicious), the local
  Fluid service. The `fluid-framework/beta` and `fluid-framework/alpha`
  entrypoints supply `SchemaFactoryBeta`, `FormattedText`, and the in-memory
  test views.
- [Quill](https://quilljs.com) and `quill-delta` for rich text editing
- Vitest and React Testing Library for the unit tests. Playwright for the live
  sync test.

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

On the first use, the app makes two example profiles, Alice and Bob. Each
profile has an empty recipe book. The app signs this tab in as Alice. A profile
is a name and the container id of its book. The book id is the identity of the
profile. In the header, each tab selects its profile. As a result, two tabs in one
browser can be two different users. A new tab opens as the profile that was
selected last. "Sign in" accepts a book link or a book id. It adds the book as
a profile. Use this to open the book of a different user as yourself.

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

| Script                 | Function                                                     |
| ---------------------- | ------------------------------------------------------------ |
| `npm run dev`          | Start the Vite dev server                                    |
| `npm run start:server` | Start tinylicious, the local Fluid service                   |
| `npm test`             | Do the unit tests with Vitest                                |
| `npm run test:e2e`     | Do the live multi-client sync test. Both servers must be on. |
| `npm run build`        | Check the types and build for production                     |
| `npm run lint`         | Lint with oxlint                                             |

The e2e test controls Playwright browser clients. It does these steps:

1. Make a recipe.
2. Change the title in a Quill editor and make sure that the card shows the new
   title.
3. In a second tab, change the profile to Bob.
4. Visit the book of Alice with her copied id.
5. Edit the shared recipe.
6. Save the recipe to the book of Bob.
7. Edit the recipe from the book of Bob.
8. Make sure that a tag shows in the two books.
9. Refresh a tab and make sure that it goes back to its open recipe.
10. Make sure that the app shows an error for an incorrect book id.

To see the test in a browser window, add `-- --headed` to the command. All
tabs use one browser context. This is the same as one user with two profiles.

## How the data is divided

There are two types of Fluid container. Fluid syncs each container and
protects each container separately. A container cannot contain a different
container.

- A **book container**. There is one book container for each user. Its root is
  `RecipeBook { cards }`. Each `RecipeCard` holds the searchable fields of one
  recipe: the title, the tags, and the time of the last update. The card also
  holds the id of the container of that recipe, and `originBookId`. The
  `originBookId` is the book in which the recipe was made. It identifies the
  author until profiles exist. The cards are a projection. No code edits the
  title or the tags of a card directly. The tags on a card are a map with the
  tag as the key. They are not an array. As a result, when two clients project the
  same recipe at the same time, the result has one entry for each tag. An array
  would keep the two inserts.
- A **recipe container**. There is one recipe container for each recipe. Its
  root is `Recipe`. This is the shared document that the users edit together.
  When a user opens a card, the app opens its container.

Your home book stays open until the page closes. When the URL names the book
of a different user, the app opens a second book. When you save a recipe from
that book, the app adds a card with the same id and the same container id to
your book. Not more than one recipe container is open at one time. This is the
selected recipe. When you select a different recipe, the app closes the
previous container after the service acknowledges its edits. When a recipe is
open, the client syncs its cards in each open book one time. Then the client
monitors the title and the tags of the recipe. When the projection is
different, the client writes the new values after a short delay. As a result, a second
client that reads one of the books sees the new title immediately. Cards in
books that no user has open stay out of date until a user opens that recipe
from that book.

## Known limitations

- The profiles are a local list of names and book ids. The app makes Alice and
  Bob on the first use. A real sign-in would get the book id from a backend.
  With this stack, the client cannot select a container id. As a result, the id of a
  profile is the id that the service gave to its book.
- A saved recipe is shared. It is not a fork. You cannot make your own copy
  that you can change freely.
- Quill requires a newline at the end of the text. The tree does not store this
  newline unless the last line has a line format. As a result, when you push Enter at
  the end of a field, the local view can show one more empty line than the
  remote view. This is the same as the behavior of the Quill bridge of Fluid.
- The editor does not use embeds (images, links) in pasted text.
- Each mounted field is a live Quill instance. As a result, a recipe with many
  ingredients has many editors. Only the selected recipe is mounted.
