# Multi-Level Timeline

> **This project is strictly experimental.** It is not an official Airtable product, is not supported, and may break or change without notice. Use at your own risk.

A multi-level Gantt chart extension for Airtable Interfaces, built with React. It renders a hierarchical timeline view across three linked tables -- Projects, Tasks, and Subtasks -- with interactive bars, dependency arrows, drag-and-drop scheduling, inline editing, and full keyboard navigation.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Schema Requirements](#schema-requirements)
- [Configuration](#configuration)
- [Features](#features)
- [Dependency Types](#dependency-types)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Tech Stack](#tech-stack)
- [License](#license)

---

## Quick Start

1. Install dependencies:
   ```
   npm install
   ```

2. Run the extension locally:
   ```
   block run
   ```

3. Open the extension settings panel in your Airtable interface. Select your three tables (Projects, Tasks, Subtasks) and map the required fields.

4. Once the three tables are mapped, the Gantt chart will render automatically. If no subtasks have dates yet, click or drag on empty subtask rows in the timeline to assign dates.

---

## Schema Requirements

The extension expects a three-level hierarchy of linked tables. You can name them whatever you want -- the extension will try to auto-detect tables whose names include "project", "task", or "subtask", but you can override any selection in settings.

### Three-Level Hierarchy

```
Projects (level 0)
  └── Tasks (level 1)
       └── Subtasks (level 2)
            └── Sub-subtasks (level 3+, via self-link)
```

**Projects** are the top-level grouping. Each project links to one or more tasks. Projects display as collapsible group rows with a thin rollup bar showing the aggregate date range of all descendant subtasks.

**Tasks** sit under projects. Each task links to one or more subtasks. Like projects, tasks display as collapsible group rows with a rollup bar.

**Subtasks** are the schedulable units. They carry the start date, end date, color, and predecessor fields. Subtasks render as draggable, resizable Gantt bars. Subtasks can also nest further via a self-referencing link field, producing sub-subtasks up to 5 levels deep.

### Required Tables

| Setting | Label in Settings Panel | Purpose |
|---------|------------------------|---------|
| `projectsTable` | Projects table | Top-level grouping table |
| `tasksTable` | Tasks table | Mid-level grouping table |
| `subtasksTable` | Subtasks table | Table with the actual scheduled items |

### Required Fields

These fields are needed for the chart to display bars:

| Setting | Label in Settings Panel | Table | Field Type | Purpose |
|---------|------------------------|-------|------------|---------|
| `projectTasksLink` | Projects -> Tasks link field | Projects | Linked Record (to Tasks) | Connects each project to its tasks |
| `taskSubtasksLink` | Tasks -> Subtasks link field | Tasks | Linked Record (to Subtasks) | Connects each task to its subtasks |
| `subtaskStartDate` | Start date field | Subtasks | Date or Date/Time | Bar start position |
| `subtaskEndDate` | End date field | Subtasks | Date or Date/Time | Bar end position |

### Optional Fields

| Setting | Label in Settings Panel | Table | Field Type | Purpose |
|---------|------------------------|-------|------------|---------|
| `subtaskSelfLink` | Sub-subtask self-link field | Subtasks | Linked Record (to Subtasks, same table) | Creates nested sub-subtask hierarchy. A subtask's linked records in this field become its children. |
| `subtaskPredecessor` | Predecessor field | Subtasks | Linked Record (to Subtasks, same table) | Defines dependency relationships. A subtask's linked records in this field are treated as predecessors. |
| `subtaskColorField` | Bar color field (single select) | Subtasks | Single Select | Colors Gantt bars using the Airtable select color palette (e.g., `blueDark1`, `greenLight2`). |
| `frozenField` | Frozen first column | Subtasks | Any | An extra field displayed in the sticky name column of the sidebar (always visible when scrolling horizontally). |
| `sidebarField1`-`sidebarField4` | Sidebar column 1-4 | Subtasks | Any | Up to four additional fields shown as columns in the scrollable sidebar. These support inline editing. |

### Display Toggles

| Setting | Label in Settings Panel | Type | Default | Purpose |
|---------|------------------------|------|---------|---------|
| `hideWeekends` | Hide weekends | Boolean | `false` | When enabled, Saturday and Sunday columns are collapsed out of the timeline. |

### How the Links Work

The linking structure is straightforward:

1. **Projects -> Tasks**: A linked record field on the Projects table points to records in the Tasks table. Each linked task appears as a collapsible group under that project.

2. **Tasks -> Subtasks**: A linked record field on the Tasks table points to records in the Subtasks table. Each linked subtask appears as a Gantt bar under that task.

3. **Subtasks -> Subtasks (self-link)**: An optional linked record field on the Subtasks table points to other records in the same table. This creates nested sub-subtask hierarchies. Records that are children of another subtask via this field will not appear as top-level subtasks under the task -- they only appear nested under their parent subtask.

4. **Subtasks -> Subtasks (predecessor)**: Another optional linked record field on the Subtasks table (separate from the self-link). Records linked here are treated as predecessors, and the extension draws dependency arrows from predecessor to successor.

### Milestones

A subtask whose start date and end date are the same is automatically rendered as a diamond-shaped milestone marker instead of a bar. Milestones also get a faint vertical line drawn through the full timeline height.

---

## Configuration

All configuration happens through the Airtable Interface Extension settings panel. Open it by clicking the gear icon on the extension.

The settings panel presents table selectors first (Projects, Tasks, Subtasks), then field selectors for each mapped table. Field selectors are filtered to only show compatible field types -- link fields for relationships, date/datetime fields for dates, and single select fields for the color option.

The extension auto-detects sensible defaults on first load by looking for tables whose names include "project", "task", or "subtask". If no matches are found, it falls back to the first, second, and third tables in the base.

Settings are saved per-extension instance. Zoom level, split pane width, expand/collapse state, column widths, and compact mode are persisted to `localStorage` so they survive page reloads.

---

## Features

### Interactive Gantt Bars
Subtask bars can be moved and resized by dragging. Drag the body of a bar to move it (both start and end date shift together). Drag the left edge to adjust the start date, or the right edge to adjust the end date. While dragging, preview date labels appear above the bar showing the new start and end dates. A ghost outline remains at the original position so you can see how far you've moved.

### Drag to Create Dates
If a subtask has no dates assigned, its row in the timeline shows a "Drag to set dates" hint on hover. Click or click-and-drag on the row to assign a date range. A single click assigns a default 7-day range starting from the click position.

### Dependency Arrows
When the predecessor field is mapped, the extension draws SVG arrows between predecessor and successor bars. Arrows use L-shaped and Z-shaped routing with rounded corners. Hovering over a bar highlights all its connected dependency arrows. Clicking an arrow opens a popup showing the predecessor and successor names, with an option to remove the dependency.

### Dependency Creation
Hover over a bar to reveal a small blue circle at its bottom-right corner. Click and drag from this handle to another bar to create a predecessor link. A dashed blue line follows the cursor while dragging, and a blue dot appears on the target bar to confirm the drop target.

### Critical Path
The extension can compute the critical path -- the longest chain of dependent tasks that determines the minimum project duration. Tasks on the critical path are highlighted with gold-colored arrows. The algorithm performs a forward pass (early start/finish) and backward pass (late start/finish), then identifies items with zero float. Cycle detection prevents infinite loops in the dependency graph, and cyclic edges are drawn with red dashed lines.

### Summary Rollup Bars
Project and task group rows display thin gray rollup bars spanning the earliest start date to the latest end date across all descendant subtasks. These rollup bars include small triangular end-caps and remain visible even when children are collapsed.

### Split Pane Layout
The view is divided into a resizable left sidebar (task list) and right panel (timeline). Drag the divider between them to adjust the split. The split position is saved to `localStorage`.

### Sidebar with Inline Editing
The left panel shows a tree of projects, tasks, and subtasks with expand/collapse toggles. Up to four additional field columns can be displayed alongside the task name. These columns support inline editing:

- **Text and number fields**: Click to edit, press Enter to save, Escape to cancel.
- **Single select fields**: Click to open a dropdown with colored pills for each choice.
- **Checkbox fields**: Click to toggle immediately.
- **Linked record fields**: Click to open a searchable dropdown with checkboxes to add or remove linked records.
- **Percentage fields**: Displayed and edited as whole numbers (e.g., "50" for 50%).

Column widths are resizable by dragging the header dividers, and widths are persisted to `localStorage`.

### Frozen Column
One additional field can be designated as the "frozen first column," which stays pinned to the left of the sidebar and is always visible even when scrolling the sidebar horizontally.

### Add Rows
"Add" placeholder rows appear at the bottom of each task's subtask list and at the bottom of each project's task list. Click or navigate to these rows and type a name to create a new record. The new record is automatically linked to its parent via the appropriate link field.

### Zoom Controls
The toolbar provides four time-scale presets -- Day, Week, Month, and Quarter -- each with a different base pixels-per-day value. A continuous zoom multiplier (50% to 300%, adjustable in 25% steps) is layered on top. The "Fit to Screen" button automatically calculates the best time scale and multiplier to fit the entire date range within the visible area.

### Today Line
A blue vertical line marks today's date on the timeline, with a small downward-pointing triangle at the top.

### Infinite Scroll
The timeline extends automatically as you scroll near the left or right edges. When scrolling near the right edge, 90 days are appended. When scrolling near the left edge, 90 days are prepended, with scroll position compensation so the view doesn't jump.

### Search
Press `Cmd/Ctrl+F` to open a search bar. Type to filter and highlight matching records across the timeline. Use Enter to cycle forward through results, Shift+Enter to cycle backward. The matched item count and current position are shown ("3 / 12"). The view auto-scrolls to bring the current match into view.

### Indent and Outdent
With the self-link field configured, use `Tab` to indent a subtask under the subtask above it (making it a sub-subtask), and `Shift+Tab` to outdent it (removing it from its parent subtask's self-link).

### Compact Mode
Toggle between regular (34px) and compact (28px) row heights via the toolbar button.

### Undo / Redo
`Cmd/Ctrl+Z` to undo the last record mutation, `Cmd/Ctrl+Shift+Z` to redo. The undo stack tracks field-level changes so individual drag or edit operations can be reversed.

### Context Menu
Right-click a bar to open a context menu with options to open the record, remove its dates, and view its dependencies.

### Auto-Scheduling
When you move or resize a bar that has successors (via Finish-to-Start dependencies), the extension automatically pushes successor start dates forward if they would overlap with the predecessor's new end date. Each successor's duration is preserved.

### Dark Mode
The extension respects Airtable's dark theme, using CSS custom properties for colors and backgrounds.

### Scroll Arrows
When bars are off-screen horizontally, small indicators appear at the edge of the visible area pointing toward the off-screen content.

### Accessibility
The root element uses `role="application"` with an `aria-label`. A live region announces navigation actions, expand/collapse operations, and record mutations. The task list uses `role="tree"` semantics.

---

## Dependency Types

The extension supports four standard dependency types in its rendering engine:

| Type | Name | Meaning |
|------|------|---------|
| **FS** | Finish-to-Start | Successor cannot start until predecessor finishes. This is the default. |
| **SS** | Start-to-Start | Successor cannot start until predecessor starts. |
| **FF** | Finish-to-Finish | Successor cannot finish until predecessor finishes. |
| **SF** | Start-to-Finish | Successor cannot finish until predecessor starts. |

All four types are supported for arrow rendering and critical path computation. Dependency creation via drag always creates FS links. The auto-scheduling propagation (pushing successor dates forward when a predecessor moves) only applies to FS dependencies.

### Arrow Routing

Arrows depart from the bottom of the predecessor bar (inset slightly from the relevant edge) and arrive at the left or right edge of the successor bar at its vertical center. When the successor is positioned to the right of the predecessor (the common case), an L-shaped path is used. When the successor is to the left (a backward dependency), a Z-shaped path with three segments is used. All corners are rounded.

### Visual States

- **Default arrows**: Light gray (`#c0c0c0`)
- **Highlighted arrows** (when hovering over a connected bar): Medium gray (`#888888`), slightly thicker
- **Critical path arrows**: Gold (`#ffc000`)
- **Cyclic dependency arrows**: Red dashed lines (`#dc043b`)

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Up / Down` | Navigate between rows (including add-row placeholders) |
| `Left` | Collapse the current group, or jump to parent if already collapsed |
| `Right` | Expand the current group |
| `Enter` | Add a sibling record (activates the nearest add-row for the same parent) |
| `Shift+Enter` | Add a child record (activates the add-row inside the current group) |
| `Space` | Open the selected record's expand view |
| `Escape` | Close search or help panel; if neither is open, clear selection |
| `Cmd/Ctrl+Backspace` | Delete the selected record |
| `Tab` | Indent subtask (make it a child of the subtask above via self-link) |
| `Shift+Tab` | Outdent subtask (remove from parent subtask's self-link) |
| `+` / `-` | Zoom in / out (adjusts zoom multiplier by 25%) |
| `T` | Scroll the timeline to today |
| `F` | Fit the entire date range to the visible area |
| `Home` | Scroll timeline to the start |
| `End` | Scroll timeline to the end |
| `Cmd/Ctrl+F` | Open search bar |
| `Cmd/Ctrl+Z` | Undo last change |
| `Cmd/Ctrl+Shift+Z` | Redo |
| `?` | Toggle the keyboard shortcuts help panel |

Press `?` at any time to see this list inside the extension.

---

## Tech Stack

- React 19
- @airtable/blocks (Interface Extensions alpha)
- @dnd-kit/core for bar drag-and-drop
- Tailwind CSS 3
- Phosphor Icons

---

## License

See [LICENSE.md](LICENSE.md).
