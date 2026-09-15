# Backlog

Slices that are designed but not scheduled. Each is independent of the others unless noted.

## Image atoms in RichText

Embed images inline in any RichText field as a custom FormattedText atom.

- Schema: `ImageAtom { src: string, alt?: string }` with `readonly content = "￼"`, added to `RichText`'s extra atoms next to `LineAtom`. Existing containers need `upgradeSchema`, which `client.ts` already runs.
- Bridge: a Quill embed insert `{ insert: { image } }` becomes `insertWithFormattingAt` of an `ImageAtom`, advancing both position counters by one. `contentOpsToQuillDelta` and `buildDeltaFromTree` emit the embed op for an `ImageAtom`. Runs already break on atom type.
- Editor: derive pre-edit text from `quill.getContents()` mapping each embed to one U+FFFC, because `quill.getText()` omits embeds and would shift every UTF-16 position after an image. Add the `image` toolbar button with a handler that downscales and rejects files over about 500 KB (default op batch limit is 700 KB). The `line` variant drops embeds like it drops newlines.
- Storage: `src` is a string. Data URLs for the local demo; a URL into an asset store for deployment. `IFluidContainer.uploadBlob` exists but is documented as ODSP only, so blob handles are not an option on tinylicious.
- Tests: bridge insert, delete, and retain across an image; two editors converging on an image; pre-edit positions after an image; schema round-trip.

Verified 2026-09-14 against fluid-framework 3.0.2: a one-character custom atom counts as one character, `getString` returns the placeholder, a typed U+FFFC stays a plain text atom, and `formatRange` over an image atom is harmless.

## Links in RichText

A Quill link is an inline attribute, not an embed. Add `link?: string` as an optional field on `CharacterFormat` and map the `link` attribute in `quillAttributes.ts`. Compatible schema evolution, no bridge change.

## Access enforcement

`visibility` on cards is stored, not enforced. Enforcement needs a service that issues per-container tokens (Azure Fluid Relay or self-hosted Routerlicious) plus a directory service that maps users to book and recipe containers. Read-only tokens should mount Quill with `readOnly` and hide add, move, and remove controls.
