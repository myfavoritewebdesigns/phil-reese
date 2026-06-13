# reference/

Ground truth for the live WordPress site. Add files here as you work.

## Convention

| File pattern | Contents |
|---|---|
| `<slug>-raw.html` | Full live-site HTML saved via `curl -sL <url> > reference/<slug>-raw.html` |
| `_extract-<slug>.cjs` | Node script that strips Fusion/Avada wrappers and writes clean content |
| `<slug>-content.md` | Output of the extract script (article body, headings, tables) |
| `<widget>-html.html` | Widget's `<div>...</div>` markup only (imported via Vite `?raw`) |
| `<widget>.css` | Widget's original CSS (reference only — not imported by the build) |

## Why `reference/` matters

The live HTML is the spec. When memory or code disagrees with what `reference/<slug>-raw.html` shows,
trust the reference file. It was saved directly from the live site and is the closest thing to a frozen snapshot.

## Avada/Fusion wrapper classes to ignore

`awb-toc-el`, `fusion-builder-row`, `fusion-layout-column`, `fusion-column-inner`,
`fusion-builder-container`, `fusion-row`, `fusion-column`

Extract the **inner content** — headings, paragraphs, images, widget HTML.
