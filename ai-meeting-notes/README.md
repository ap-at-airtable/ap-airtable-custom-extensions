# AI Meeting Notes - Airtable Custom Extension

An AI-powered meeting management extension for Airtable. One file, zero third-party dependencies. Manages projects, meetings, notes, decisions, action items, and AI summaries - all layered on top of your existing base.

<!-- Screenshot: Project dashboard view -->

## Table of Contents

- [Quick Start](#quick-start)
- [Schema Requirements](#schema-requirements)
- [AI Fields](#ai-fields)
- [Automation Triggers](#automation-triggers)
- [Configuration](#configuration)
- [Features](#features)
- [Project Structure](#project-structure)
- [License](#license)

---

## Quick Start

### Method 1: Paste into the Block Editor (recommended)

1. Open your Airtable base
2. Ask **Omni** to create a **Custom Extension** (e.g. "Create a custom extension for meeting notes") - this generates a starter shell with the block editor open
3. Select all the code Omni generated and **delete it**
4. Paste the contents of [`source.tsx`](./source.tsx) into the code editor
5. Open the **Custom Properties** panel (gear icon) to map your tables and fields
6. Done

No npm install. No build step. No CLI. Just replace Omni's starter code with the source file.

### Method 2: Local Development (CLI)

For local development with hot reload:

```bash
cd project
npm install
block run
```

Update `project/.block/remote.json` with your block ID before running.

To release:

```bash
cd project
block release
```

---

## Schema Setup (Agent-Ready)

Use the instructions below to create the full base schema from scratch. Every table name, field name, field type, and relationship is specified exactly. Create tables and fields in the order listed to ensure link fields resolve correctly.

### Step 1: Create Tables

Create these four tables (in this order):

1. `Projects`
2. `Meetings`
3. `Action Items`
4. `Team Members`

### Step 2: Create Fields

#### Team Members table

| Field Name | Field Type | Options / Config |
|---|---|---|
| `Name` | Single line text | Primary field |

#### Projects table

| Field Name | Field Type | Options / Config |
|---|---|---|
| `Name` | Single line text | Primary field |
| `Status` | Single select | Options: `In Progress`, `Planning`, `Launched`, `Completed`, `On Hold` |
| `Priority` | Single select | Options: `High`, `Medium`, `Low` |
| `Start Date` | Date | Include time: off |
| `End Date` | Date | Include time: off |
| `Brief` | Long text | Rich text formatting: off |
| `AI Project Summary` | AI text | See [AI Fields](#ai-fields) for the prompt |

#### Meetings table

| Field Name | Field Type | Options / Config |
|---|---|---|
| `Title` | Single line text | Primary field |
| `Date` | Date | Include time: on (Date/time) |
| `Type` | Single select | Options: `Weekly Sync`, `Status Update`, `Kickoff`, `Retrospective`, `Sprint Review`, `1:1`, `Ad Hoc` |
| `Project` | Link to another record | Link to: `Projects` table |
| `Attendees` | Link to another record | Link to: `Team Members` table. Allow linking to multiple records. |
| `Notes` | Rich text | - |
| `Agenda` | Rich text | - |
| `Key Decisions` | Rich text | - |
| `AI Meeting Summary` | AI text | See [AI Fields](#ai-fields) for the prompt |
| `Extract Action Items` | Checkbox | Default: unchecked |
| `Send Follow-up Email` | Checkbox | Default: unchecked |

#### Action Items table

| Field Name | Field Type | Options / Config |
|---|---|---|
| `Title` | Single line text | Primary field |
| `Status` | Single select | Options: `To Do`, `In Progress`, `Done` |
| `Priority` | Single select | Options: `High`, `Medium`, `Low` |
| `Due Date` | Date | Include time: off |
| `Notes` | Long text | Rich text formatting: off |
| `Meeting` | Link to another record | Link to: `Meetings` table |
| `Assignee` | Link to another record | Link to: `Team Members` table |

### Step 3: Configure AI Field Prompts

**AI Meeting Summary** (on the Meetings table): Set the source fields to `Notes`, `Agenda`, and `Key Decisions`. Use this prompt:

> Summarize this meeting's notes, agenda, and key decisions into a concise bullet-point summary. Lead with the most important takeaway. Include any action items or next steps mentioned.

**AI Project Summary** (on the Projects table): Set the source fields to `Brief`, `Status`, `Start Date`, `End Date`, and the linked `Meetings` records (rolling up `Notes` and `Key Decisions`). Use this prompt:

> Summarize this project's current status, recent progress, and any blockers or risks. Keep it to 3-5 bullet points.

### Step 4: Configure Automations (optional)

**Extract Action Items automation:**
1. Trigger: "When a record matches conditions" on `Meetings` table, where `Extract Action Items` = checked
2. Action: AI action to read `Notes`, `Agenda`, and `Key Decisions` and parse out action items
3. Action: Create records in `Action Items` table for each extracted item, linking back to the triggering meeting via `Meeting` field
4. Action: Uncheck `Extract Action Items` on the triggering record

**Send Follow-up Email automation:**
1. Trigger: "When a record matches conditions" on `Meetings` table, where `Send Follow-up Email` = checked
2. Action: Send email summarizing the meeting (notes, decisions, action items) to attendees
3. Action: Uncheck `Send Follow-up Email` on the triggering record

---

## Schema Requirements (Reference)

The extension reads your base schema through the Custom Properties panel. Below are the tables and fields it expects. Fields marked **(auto-detected)** are found automatically by field type - they do not appear in the properties panel.

### Meetings Table (required)

The primary table. Each record is one meeting.

| Field | Type | Configured via | Purpose |
|-------|------|----------------|---------|
| Primary field | Single line text | Automatic | Meeting title (editable inline) |
| Notes | Long text or Rich text | Properties panel: "Notes Field" | Free-form meeting notes with rich-text editing |
| Agenda | Long text or Rich text | Properties panel: "Agenda Field" | Pre-meeting agenda |
| Key Decisions | Long text or Rich text | Properties panel: "Key Decisions Field" | Decisions captured during the meeting |
| AI Summary | AI text (`FieldType.AI_TEXT`) | Properties panel: "AI Summary Field (Meetings)" | Auto-generated summary from notes, agenda, and decisions |
| Attendees | Link to another record (`FieldType.MULTIPLE_RECORD_LINKS`) | Properties panel: "Attendees Field" | Links to Team Members table |
| Extract Action Items | Checkbox (`FieldType.CHECKBOX`) | Properties panel: "Extract Action Items Field" | Toggled by the extension to trigger an automation |
| Send Follow-up Email | Checkbox (`FieldType.CHECKBOX`) | Properties panel: "Send Follow-up Email Field" | Toggled by the extension to trigger an automation |
| Date | Date or Date/time | Auto-detected (first Date/DateTime field) | Meeting date, used for sorting and grouping |
| Type | Single select | Auto-detected (first Single select field) | Meeting type badge (e.g. "Standup", "Sprint Review", "1:1") |
| Project link | Link to another record | Auto-detected (linked to Projects table) | Associates a meeting with a project |

### Projects Table (required)

Each record is a project. Meetings are grouped under projects.

| Field | Type | Configured via | Purpose |
|-------|------|----------------|---------|
| Primary field | Single line text | Automatic | Project name |
| AI Summary | AI text (`FieldType.AI_TEXT`) | Properties panel: "AI Summary Field (Projects)" | AI-generated project summary shown on project cards |
| Status | Single select (name contains "status") | Auto-detected | Project status grouping (recognized values: In Progress, Planning, Launched, Completed, On Hold) |
| Priority | Single select (name contains "priority") | Auto-detected | Priority badge on project cards |
| Start date | Date or Date/time (name contains "start") | Auto-detected | Project start date |
| End date | Date or Date/time (name contains "end") | Auto-detected | Project end date |
| Brief | Long text | Auto-detected (first Multiline text field) | Short project description shown when no AI summary exists |

### Action Items Table (required)

Each record is a task or follow-up linked to a meeting.

| Field | Type | Configured via | Purpose |
|-------|------|----------------|---------|
| Primary field | Any | Automatic | Used as display name |
| Title | Single line text | Auto-detected (first Single line text field) | Action item title (editable inline) |
| Status | Single select | Auto-detected (first Single select field) | Status tracking. Values containing "done" mark an item complete; values containing "to do" or "todo" mark it open |
| Priority | Single select (name contains "priority") | Auto-detected | Priority level (e.g. "High", "Medium", "Low"). Displayed as a colored badge |
| Due date | Date or Date/time | Auto-detected (first Date/DateTime field) | Due date for the action item |
| Notes | Long text | Auto-detected (first Multiline text field) | Additional notes or context |
| Meeting link | Link to another record | Auto-detected (linked to Meetings table) | Associates the action item with a meeting |
| Assignee | Link to another record | Auto-detected (first linked record field that is NOT the meeting link) | Person assigned to the action item |

### Team Members Table (optional)

Used as the source for attendee and assignee pickers. If not configured, attendee management is disabled.

| Field | Type | Configured via | Purpose |
|-------|------|----------------|---------|
| Primary field | Any | Automatic | Person's name, shown in attendee chips and assignee dropdowns |

**Auto-detection rules for table defaults:**
- Meetings table: first table whose name contains "meeting", or the first table in the base
- Projects table: first table whose name contains "project"
- Action Items table: first table whose name contains "action"
- Team Members table: first table whose name contains "team" or "member"

All of these defaults can be overridden in the Custom Properties panel.

---

## AI Fields

The extension displays AI-generated content from Airtable's native **AI text fields** (`FieldType.AI_TEXT`). These fields are configured inside Airtable's field settings, not inside the extension.

### Meeting AI Summary

- **Property panel label:** "AI Summary Field (Meetings)"
- **What it does:** Displays an auto-generated summary in the meeting header. The summary updates as you edit the notes, agenda, and decisions fields.
- **Suggested AI field prompt:**

  > Summarize this meeting's notes, agenda, and key decisions into a concise bullet-point summary. Lead with the most important takeaway. Include any action items or next steps mentioned.

- **Display behavior:** If the AI output contains bullet points (lines starting with `-`, `*`, or `*`), the extension renders them as styled bullet cards. Otherwise it renders the full markdown output.

### Project AI Summary

- **Property panel label:** "AI Summary Field (Projects)"
- **What it does:** Shows an AI-generated summary on each project card in the dashboard.
- **Suggested AI field prompt:**

  > Summarize this project's current status, recent progress, and any blockers or risks. Keep it to 3-5 bullet points.

- **Display behavior:** Same bullet-point extraction logic as the meeting summary.

---

## Automation Triggers

The extension uses two **checkbox fields** on the Meetings table as signals to trigger Airtable Automations. The extension toggles these checkboxes on/off; your automations watch for the change.

### Extract Action Items

- **Property panel label:** "Extract Action Items Field"
- **Field type:** Checkbox
- **What the button does:** When clicked, the extension sets the checkbox to `true`. A green "Action items extracted" state appears. Click "Reset" to set it back to `false`.
- **Automation to build:**
  1. **Trigger:** "When a record matches conditions" on the Meetings table, where this checkbox field = `true`
  2. **Action:** Use an AI script or "Generate AI text" action to read the meeting's notes, agenda, and decisions, then parse out action items
  3. **Action:** Create records in the Action Items table for each extracted item, linking them back to the meeting
  4. **Action:** (Optional) Uncheck the field so the extension resets automatically

### Send Follow-up Email

- **Property panel label:** "Send Follow-up Email Field"
- **Field type:** Checkbox
- **What the button does:** When clicked, the extension sets the checkbox to `true`. A green "Follow-up sent" state appears. Click "Reset" to set it back to `false`.
- **Automation to build:**
  1. **Trigger:** "When a record matches conditions" on the Meetings table, where this checkbox field = `true`
  2. **Action:** Compose an email summarizing the meeting (notes, decisions, action items) and send it to the attendees via "Send email" action
  3. **Action:** (Optional) Uncheck the field after sending

Both buttons appear in the meeting workspace header and in the minimized sticky header that appears on scroll. If neither checkbox field is configured, the buttons are hidden entirely.

A "Reset" button appears when either checkbox is checked, allowing you to clear both flags at once and re-trigger the actions later.

---

## Configuration

All field mappings are done through the **Custom Properties** panel (gear icon in the extension header). No field names are hardcoded. The extension adapts to your schema.

### Properties Panel Fields

**Table mappings:**
- Meetings Table
- Projects Table
- Action Items Table
- Team Members Table

**Meetings table fields:** (shown only when a Meetings table is selected)
- Notes Field - accepts Long text or Rich text
- Agenda Field - accepts Long text or Rich text
- Key Decisions Field - accepts Long text or Rich text
- AI Summary Field (Meetings) - accepts AI text fields only
- Attendees Field - accepts Linked record fields only
- Extract Action Items Field - accepts Checkbox fields only
- Send Follow-up Email Field - accepts Checkbox fields only

**Projects table fields:** (shown only when a Projects table is selected)
- AI Summary Field (Projects) - accepts AI text fields only

### Required vs. Optional

The extension requires at minimum:
- A **Meetings Table**
- A **Projects Table**
- An **Action Items Table**
- A **Notes Field** on the Meetings table

Without these four, the extension shows a setup prompt asking you to configure them. All other fields are optional and the UI sections they power simply hide when they are not mapped.

---

## Features

### Project Dashboard
Card grid showing all projects with status badges, priority indicators, AI summaries, meeting counts, and open action item counts. Supports search, star/unstar for quick access, and a "starred only" filter. Projects are grouped by status (In Progress, Planning, Launched, Completed, On Hold).

<!-- Screenshot: Project dashboard -->

### Meeting List
Chronological list of meetings grouped by month. Each card shows the meeting type badge, date, project association, attendee avatars, action item count, and an AI summary preview. Supports:
- Search by title
- Date filtering (upcoming, this week, this month, past 30 days, past 90 days)
- Star/unstar meetings
- "Starred only" toggle
- Inline meeting creation form with type, date, project, attendees, and agenda

<!-- Screenshot: Meeting list -->

### Meeting Workspace
Full meeting editing view with:
- **Editable title** - click to rename the meeting inline
- **Meeting metadata** - type selector, date picker, attendee management with search
- **AI Summary card** - displays the AI-generated summary in the header area
- **Agenda section** - collapsible rich-text editor for pre-meeting planning
- **Key Decisions section** - collapsible rich-text editor for recording decisions
- **Notes section** - large rich-text editor for live note-taking
- **Action Items panel** - create, edit, prioritize, assign, and complete tasks

<!-- Screenshot: Meeting workspace -->

### Rich-Text Editor
Every text field (notes, agenda, decisions) uses a contentEditable editor with a formatting toolbar. Supported formats:
- Bold, italic, underline, strikethrough
- Headings (H1, H2), paragraph
- Bullet lists, numbered lists, indent/outdent
- Block quotes, inline code, horizontal rules
- Links (insert/remove)
- Superscript, subscript
- Undo/redo

Content is auto-saved 1 second after you stop typing, and immediately on blur. A status indicator shows saving/saved/error state.

### Action Items
Per-meeting task management within the workspace:
- Create new items inline with title, priority, and due date
- Toggle done/not-done by clicking the status circle
- Expand to edit title, status, priority, due date, assignee, and notes
- Delete with inline confirmation
- Done items automatically sort to the bottom

### Minimized Header
A compact sticky header fades in when you scroll past the first 200px of the meeting workspace. It shows the meeting title, type badge, date, and the AI action buttons, so you always have quick access without scrolling back up.

### Dark Mode
Full dark mode support. The extension reads the system/Airtable theme and renders all components with appropriate dark variants.

### Starred Items
Both projects and meetings can be starred for quick access. Stars and filter preferences persist in `localStorage` across sessions.

---

## Project Structure

**`source.tsx`** - The entire application in a single file (~3,100 lines). Includes:

- Inline SVG icons (extracted from Phosphor Icons - no `@phosphor-icons/react` dependency)
- Inline markdown parser (no `marked` dependency)
- Runtime CSS injection (no external stylesheet needed for the paste-in-editor method)
- All components, state management, and Airtable SDK integration

Only imports from the Airtable-provided runtime (`react`, `@airtable/blocks`).

**`project/`** - Full CLI project structure for local development:

```
project/
├── frontend/index.tsx    <- same as source.tsx
├── block.json            <- entry point config
├── package.json          <- SDK + Tailwind build deps
├── tailwind.config.js    <- design tokens (colors, fonts, spacing)
└── tsconfig.json         <- TypeScript config
```

---

## Customization

This extension is a starting point. A few ways to make it your own:

- **Add meeting types.** The `Type` single select field drives the type badges. Add whatever options fit your team (e.g. `Design Review`, `All Hands`, `Incident Debrief`).
- **Rewrite the AI prompts.** The AI text field prompts are suggestions. Change the output format, tone, or focus areas to match how your team works.
- **Add more fields.** Any new fields you add to the Meetings or Projects tables will be accessible through the Airtable record expander. The extension auto-detects fields by name and type, so naming a new date field with "start" or "end" in the name will pick it up automatically.
- **Build more automations.** The checkbox-trigger pattern used for Extract Action Items and Send Follow-up works for any automation. Add a new checkbox field, wire up an automation, and map it in the properties panel.
- **Modify the source code.** The entire app is one file. Change the layout, colors, add new views, or strip out features you don't need.

## License

MIT
