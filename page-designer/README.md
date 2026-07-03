# Page Designer

Design pixel-perfect, printable pages straight from your records, without leaving your Interface. Point it at a table, design one layout, and it renders a page per record that's ready to print or save as PDF. It's the Interface version of the classic Page Designer from Airtable's data layer.

Good for invoices, quotes, and work orders, packing slips and shipping labels, name badges and event tickets, product labels with real barcodes and QR codes, and certificates or spec sheets.

## Features

- Drag, resize, and rotate fields, text, images, lines, barcodes, and QR codes on a real page canvas
- Merge record values into text with `{Field name}`; field values render with the field's own formatting (currency, percent, decimals)
- Linked records as a comma list, a bulleted list, or a table with the columns you pick
- Letter, A4, legal, and slide sizes, page background color, zoom, and a single-page or continuous view
- Multi-select with align and distribute, a snap grid, and undo/redo (Cmd/Ctrl+Z)
- Full-screen **Present** mode: one page per record scaled to fit the screen, arrow/Space/PageUp-PageDown navigation, Esc to exit
- Print that comes out one clean sheet per record, sized to match what you designed
- Barcode and QR libraries are bundled, so rendering works with no runtime CDN dependency

## Get it on your base

This is a **custom interface extension** — it runs on an Interface page (via a Custom element), not in the classic dashboard/extensions panel. You publish it to your own base with Airtable's Blocks CLI, using this repo as the source code:

1. **Create a custom extension.** In your Interface, edit a page, add a **Custom element**, and choose to build a new custom extension. Airtable shows you a scaffold command for your new extension, like:

    ```bash
    block init NONE/blkYourBlockId --template=https://github.com/Airtable/interface-extensions-hello-world my_extension
    ```

    Run it (it needs the [Blocks CLI](https://airtable.com/developers/extensions/guides/getting-started): `npm install -g @airtable/blocks-cli`). You now have a working scaffold wired to *your* extension, with dependencies installed.

2. **Drop in this code.** Replace the scaffold's `frontend/` folder with the `frontend/` folder from this repo, and make sure its `block.json` points at `frontend/index.js` (this repo's `block.json` already does — you can copy that too).

3. **Release it:**

    ```bash
    block run      # optional: live-develop it on your page first
    block release  # publish it to your base
    ```

4. **Design.** Back in your Interface: point the Custom element at your extension, pick the **table** whose records become pages, hit **Finish**, and lay out your page in edit mode. The published page renders for viewers.

### Custom properties

- **Title.** An optional heading shown above the view.
- **Table.** The table whose records each become a page.

## Working on this repo

It's built on Airtable's interface-extensions **preview SDK** (`@airtable/blocks@interface-alpha`), which is pre-release — expect occasional API drift if you upgrade it. If you edit the Tailwind styles, regenerate the precompiled CSS with `npm run build:css`. Unit tests run with `node --test`.

Heads-up for contributors: the committed `package-lock.json` was generated behind a corporate npm proxy, so its `resolved` URLs aren't publicly reachable — `npm ci` will fail outside that network. Use the scaffold flow above (recommended), or `npm install` to resolve dependencies fresh from the public registry.

## Notes

- It renders one page per record from the element's record source.
- It's built for print and PDF output. True 1:1 sizing depends on your browser's print settings (set Margins to None and Scale to 100%), and the view tells you which to set.
- Present mode uses the browser's fullscreen API. If the host doesn't grant the extension fullscreen, it presents within the extension's panel instead of the whole screen.
- The design is meant to be edited by one builder at a time. Concurrent edits are last-write-wins, and your undo history resets if someone else edits the design while you have it open.

## License

MIT No Attribution. See [LICENSE.md](./LICENSE.md).
