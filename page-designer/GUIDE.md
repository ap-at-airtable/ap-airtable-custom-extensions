# Page Designer guide

> **Works with:** Airtable Interfaces on the web, added as a **Custom element**. See the [README](./README.md) for how to install it on your base.
>
> **Permissions:** anyone who can edit the interface can design pages. Published viewers see the finished design, and can only change record values where you've turned on inline editing (and where they have editor access to the records).

Page Designer turns the records in a table into designed, printable documents. You lay out one set of pages — an invoice, a proposal deck, a packing slip, a badge — and every record in the table renders that same design with its own values. Print them all at once, present them full screen, or let viewers update values right on the page.

## How it works

A design is a set of **pages** shared by every record. Each page holds **elements**: field values, text, images, barcodes, QR codes, and lines. When someone views the extension, each record renders the full set of pages in order — so a two-page design over five records produces ten pages.

There are two modes:

- **Edit mode** (in the Interface Designer): a canvas where you lay out pages.
- **View mode** (published, or via Preview): a reader with paging, zoom, Present, and Print.

The extension has two settings in the Interface Designer's properties panel: an optional **Title** shown above the view, and the **Table** whose records become documents.

## Design your first page

1. Open your interface in the Interface Designer and select the Page Designer element.
2. Pick the **Table** in the properties panel.
3. Add fields from the **field list on the left**: drag one onto the page, or check several and click **Add fields** to place them together.
4. Add other elements from the toolbar: **Text**, **Image**, **Barcode**, **QR code**, or **Line**.
5. Drag elements to move them, use the corner and edge handles to resize, and use the round handle above an element to rotate it.
6. Click **Preview** to see the design rendered with real records.

> **Note:** the canvas snaps to a grid as you move and resize. Toggle the grid overlay from the toolbar if you want visible guides, and hold your arrow keys to nudge a selected element one pixel at a time (Shift-arrow moves a full grid step).

## Pages

A design can have up to 10 pages, stacked vertically in the editor. Every record renders every page.

- **Add a page** with the **+ Add page** tile below the last page, or from the PAGES list on the Page tab.
- **Duplicate a page** with the copy icon in the page's header — the copy lands right after it with all of its elements.
- **Reorder or delete pages** from the arrows and trash icon in the page header (deleting asks you to confirm).
- The **PAGES list** on the Page tab shows every page with its element count — click one to jump to it.

Page setup (size, orientation, background) lives on the **Page** tab:

| Setting | Options |
|---------|---------|
| Page size | Letter (8.5" × 11"), Legal (8.5" × 14"), A4, A5, Index card (3" × 5"), Business card (2" × 3.5"), Slide 16:9, Slide 4:3, or a custom size |
| Orientation | Portrait or landscape |
| Background | Any color, set per page |

Page size and orientation are shared by all pages in the design; the background color is per page.

## Working with elements

Select an element to open its settings in the inspector on the right. A few canvas skills worth knowing:

- **Multi-select** by Shift-clicking elements or dragging a marquee over them, then move the whole group, or use the align and distribute controls.
- **Right-click an element** for Duplicate, Bring to front, Send to back, and Delete.
- **Undo and redo** with Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z.

Keyboard shortcuts:

| Shortcut | Action |
|----------|--------|
| Cmd/Ctrl+D | Duplicate the selection |
| Cmd/Ctrl+] and Cmd/Ctrl+[ | Bring to front, send to back |
| Delete or Backspace | Delete the selection |
| Arrow keys | Nudge one pixel (Shift-arrow: one grid step) |
| Escape | Clear the selection |

### Element types

| Element | What it shows |
|---------|---------------|
| Field | A field's value for the current record, rendered with the field's own formatting (currency, percent, dates) |
| Text | Static text, with `{Field name}` tokens that merge in record values |
| Image | The first image in an attachment field (or an attachment lookup from a linked record), or a static image URL |
| Barcode | A scannable barcode from a field's value — CODE128, CODE39, EAN13, UPC, or ITF14 |
| QR code | A QR code from a field's value |
| Line | A horizontal rule with adjustable color and thickness |

### Element settings

The inspector groups settings by what they affect:

- **Field** — which field the element shows, how select values display, whether the field label shows, and whether viewers can edit the value.
- **Table** — appears when a linked-record field displays as a table (see below).
- **Typography** — font (10 bundled families, including two serifs and a mono), size, bold/italic/underline, text color, and alignment. Controls only appear when they do something for the bound field type.
- **Appearance** — background color, per-side padding (top, bottom, left, right), border width and color, and corner radius. These style the element's outer box.
- **Position & size** — exact X, Y, width, height, and rotation values.

### Select fields: text, pills, or a stepper

A single select or multiple select field can display as plain **text** or as colored **pills** that match your field's choice colors. Single selects can also display as a **stepper** — the field's choices laid out as ordered steps with the current value highlighted, in radio or numbered style, with a color you pick. Steppers work well for status flows like Draft → Sent → Paid.

## Linked records

A linked-record field can display three ways (set **Linked records** in the Field section):

- **Comma** — linked record names in a row.
- **List** — a bulleted list of names.
- **Table** — a real table of the linked records, with columns you choose.

In table display, the **Table** section gives you:

| Setting | What it does |
|---------|--------------|
| Columns | Pick fields from the linked table, drag to reorder |
| Header fill | Header row background color |
| Header text | Header row text color (leave empty to match the element's text color) |
| Grid lines | The color of the lines between cells |
| Row shading | Alternate-row striping, with a shading color |

Resize columns by selecting the table and dragging the dividers between columns. Tables render up to 100 linked records, with a "+N more" row when there are more.

## Inline editing

Turn on **Allow editing in view** for a field and viewers can change its value directly on the published page — click the value, edit, and it saves to the record. Supported field types: single line text, long text, email, URL, phone, number, currency, percent, single select, multiple select, checkbox, date, date and time, rating, and single or multiple collaborator.

For a linked-record table with editing on, viewers can also edit cells in the table, add rows (**+ Add row** creates a linked record), and right-click a row to delete it. Deleting asks for confirmation first, because it deletes the record from the base — not only from the list.

> **Note:** viewers need editor access to the records for edits to stick; the controls hide when they don't. In collaborator fields, people who reach the base through org-wide general access may not appear in the picker — share the base with them directly to assign them.

## Viewing, presenting, and printing

The published view (and Preview) shows one record at a time with **Previous/Next** paging — arrow keys work too — plus a zoom control (pinch to zoom on touch). Switch between **Single** and **Continuous** in the toolbar: single pages through one sheet at a time, continuous stacks pages in a scrolling column.

**Present** plays the design full screen, one page at a time — arrow keys, Space, and Page Up/Down navigate, Escape exits. With a slide-size page, this turns your records into a live deck that stays current as the data changes.

**Print** renders every record — one clean sheet per page of each record — sized to your page setup. Use the in-app Print button rather than the browser's print shortcut; the button waits for images to finish loading first.

> **Note:** for true-to-size output, set **Margins to None** and **Scale to 100%** in your browser's print dialog. The view shows a reminder, since these are browser settings the extension can't set for you.

## Limits

- Up to 10 pages per design.
- The whole design must fit in about 145 KB of settings storage. If a save would exceed it, you'll see "This design is too large to save" and the change won't stick.
- Continuous view shows up to 100 sheets; printing covers up to 500 sheets (records beyond that are left out, with a notice).
- Linked-record tables render up to 100 rows; pickers in inline editing list up to 100 options (type to narrow the list).
- One person should edit the design at a time. Concurrent edits are last-write-wins, and your undo history resets if someone else changes the design while you have it open.
- Undo history keeps your last 50 changes, and lives only in the current session.

## FAQs

**Does every record have to use the same layout?**

Yes — that's the model. All records share one design, and each renders it with its own values. Use multiple pages when a document needs more than one layout (a cover page plus a detail page, for example).

**Why doesn't my field show font and color controls?**

Typography controls appear only when they'd do something. Checkboxes and ratings render as glyphs, and pills and steppers carry their own colors from the field's choices, so text styling is hidden for those.

**Can viewers mess up my design?**

No. Viewers only see the rendered pages. The design itself can only change in the Interface Designer, and inline editing (when you turn it on) changes record values, never the layout.

**Why is my printout slightly smaller than the page size I designed?**

Check the browser's print dialog: Margins need to be **None** and Scale **100%** for 1:1 output. Anything else and the browser shrinks the page to fit.

**A collaborator I know has access isn't in the collaborator picker. Why?**

People who reach the base through org-wide general access ("anyone at company can edit") may not appear in the picker. Add them to the base directly and they'll show up.

**Do barcodes and QR codes need an internet connection to render?**

No — the barcode and QR libraries are bundled with the extension, so they render with no outside dependency.
