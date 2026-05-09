# Multi-Level Timeline

> **This project is strictly experimental.** It is not an official Airtable product, is not supported, and may break or change without notice. Use at your own risk.

A multi-level Gantt chart extension for Airtable Interfaces, built with React. It renders a hierarchical timeline view across three linked tables (Projects, Tasks, Subtasks) with interactive bars, dependency arrows, drag-and-drop scheduling, and keyboard navigation.

## Features

- **Three-level hierarchy** — Projects roll up Tasks, which roll up Subtasks, each with collapsible rows and summary bars
- **Interactive Gantt bars** — drag to move, resize edges to adjust dates, double-click to open the record
- **Dependency arrows** — finish-to-start (and read support for SS/FF/SF), with critical path highlighting
- **Dependency creation** — drag from one bar to another to create a link
- **Split-pane layout** — resizable sidebar with configurable field columns alongside the timeline
- **Zoom controls** — day, week, month, quarter scales with continuous zoom via +/- keys
- **Keyboard navigation** — arrow keys, Tab to indent/outdent, T for today, F to fit, ? for help
- **Search** — find and highlight records across the timeline
- **Compact mode** — toggle between regular and compact row heights
- **Inline editing** — edit cell values directly in the sidebar
- **Add rows** — create new records from within the extension
- **Dark mode support** — respects Airtable's theme
- **LocalStorage persistence** — remembers zoom, layout, and expand/collapse state

## Setup

This is an [Airtable Interface Extension](https://airtable.com/developers/extensions). To run it:

1. Install dependencies:
   ```
   npm install
   ```

2. Run the block locally:
   ```
   block run
   ```

3. In the extension settings panel, configure:
   - **Projects table** — your top-level grouping
   - **Tasks table** — linked to Projects
   - **Subtasks table** — linked to Tasks, with start/end date fields

4. Map the required fields (start date, end date, link fields, and optionally color, predecessor, and sidebar fields).

## Tech Stack

- React 19
- @airtable/blocks (Interface Extensions alpha)
- @dnd-kit/core for drag-and-drop
- Tailwind CSS 3
- Phosphor Icons

## License

See [LICENSE.md](LICENSE.md).
