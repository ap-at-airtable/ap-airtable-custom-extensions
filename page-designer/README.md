# Page Designer

Design pixel-perfect, printable pages straight from your records, without leaving your Interface. Point it at a table, design one layout, and it renders a page per record that's ready to print or save as PDF. It's the Interface version of the classic Page Designer from Airtable's data layer.

Good for invoices, quotes, and work orders, packing slips and shipping labels, name badges and event tickets, product labels with real barcodes and QR codes, and certificates or spec sheets.

## Features

- Drag, resize, and rotate fields, text, images, lines, barcodes, and QR codes on a real page canvas
- Merge record values into text with `{Field name}`, plus number/currency/percent formatting and prefixes and suffixes
- Conditional visibility and conditional color, so a page reacts to the record (turn an "Overdue" status red, hide an empty field)
- Linked records as a comma list, a bulleted list, or a table with the columns you pick
- Letter, A4, legal, and slide sizes, page background color, zoom, and a single-page or continuous view
- Multi-select with align and distribute, a snap grid, and undo/redo (Cmd/Ctrl+Z)
- Full-screen **Present** mode: one page per record scaled to fit the screen, arrow/Space/PageUp-PageDown navigation, Esc to exit
- Print that comes out one clean sheet per record, sized to match what you designed
- Barcode and QR libraries are bundled, so rendering works with no runtime CDN dependency

## Setup

1. In your Interface, edit a page and add a **Custom element**.
2. Pick the **table** you want as the record source.
3. Search for this extension and add it.
4. Hit **Finish**, then design your layout in edit mode. The published page renders for viewers.

### Custom properties

- **Title.** An optional heading shown above the view.
- **Table.** The table whose records each become a page.

## Local development

This is a **custom interface extension** — it runs on an Interface page (via a Custom element), not in the classic dashboard/extensions panel. It's built on Airtable's interface-extensions **preview SDK** (`@airtable/blocks@interface-alpha`). That SDK is pre-release, so the exact build is pinned in `package-lock.json` — install with `npm ci` for a reproducible tree, and expect occasional API drift if you later upgrade.

```bash
cd page-designer
npm ci        # reproducible install (pins the preview SDK); use `npm install` to update
block run     # bundles + serves the extension locally
```

Requires the [Airtable Blocks CLI](https://airtable.com/developers/extensions/guides/getting-started) and a custom extension registered for an interface page in your base (create one, point it at your `block run` dev build, and `block release` to publish). If you edit the Tailwind styles, regenerate the precompiled CSS with `npm run build:css`.

## Notes

- It renders one page per record from the element's record source.
- It's built for print and PDF output. True 1:1 sizing depends on your browser's print settings (set Margins to None and Scale to 100%), and the view tells you which to set.
- Present mode uses the browser's fullscreen API. If the host doesn't grant the extension fullscreen, it presents within the extension's panel instead of the whole screen.

## License

MIT No Attribution. See [LICENSE.md](./LICENSE.md).
