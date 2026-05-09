# AirPulse

Real-time audience Q&A built natively as an Airtable Interface Extension. AirPulse replaces external tools like Slido by keeping all Q&A data, voting, and event management inside your Airtable workspace.

Attendees submit and upvote questions, hosts manage a live queue with presentation mode, and organizers set up events with custom branding - all from a single interface.

## Quick Start

1. **Create the schema.** Add three tables to your base: Events, Q&A, and Upvotes. See [Schema Requirements](#schema-requirements) below for the exact fields needed.
2. **Add the extension.** Install AirPulse as an Interface Extension on an Airtable interface page.
3. **Configure tables.** Open the properties panel (right sidebar) and connect your three tables. Most fields are detected automatically by name.
4. **Create an event.** Switch the Mode property to "Setup", then click "New Event" to create your first event.
5. **Go live.** Toggle the event to "Live", switch Mode to "Audience" on the attendee-facing page and "Admin" on the host page.

## Schema Setup (Agent-Ready)

Use the instructions below to create the full base schema from scratch. Every table name, field name, field type, and relationship is specified exactly. Create tables and fields in the order listed to ensure link fields resolve correctly.

### Step 1: Create Tables

Create these three tables (in this order):

1. `Events`
2. `Q&A`
3. `Upvotes`

### Step 2: Create Fields

#### Events table

| Field Name | Field Type | Options / Config |
|---|---|---|
| `Name` | Single line text | Primary field |
| `Date` | Date | Include time: on (Date/time) |
| `Description` | Long text | Rich text formatting: off |
| `Primary Color` | Single line text | Example value: `#166ee1`. Hex color code that themes the entire interface. |
| `Logo` | Attachment | Primary logo image |
| `Secondary Logo` | Attachment | Light variant logo for dark backgrounds in presentation mode |
| `Live Event` | Checkbox | Default: unchecked. Only one event should be live at a time. |
| `Event Type` | Single select | Options: `Live Questions`, `Q/A` |

#### Q&A table

| Field Name | Field Type | Options / Config |
|---|---|---|
| `Question Text` | Single line text | Primary field |
| `Event` | Link to another record | Link to: `Events` table |
| `Status` | Single select | Options: `Pending`, `Live`, `Answered`, `Archived` (exact names required) |
| `Created By` | Created by | Automatic, no config needed |
| `AI Answer` | Long text | Rich text formatting: off. Optional, for AI-generated answer suggestions. |
| `Human Answer` | Long text | Rich text formatting: off. Optional, for admin-written answers. |
| `Answered By` | Single line text | Optional, tracks who answered. |
| `Upvote Count` | Count | Count linked records from `Upvotes` table via the `Question` field |

#### Upvotes table

| Field Name | Field Type | Options / Config |
|---|---|---|
| `Question` | Link to another record | Link to: `Q&A` table. Primary field can be auto-generated. |
| `Created By` | Created by | Automatic, no config needed. Used for deduplication (one vote per user per question). |

### Step 3: Configure the Extension Properties

After creating the schema, map these in the extension's properties panel:

| Property | Value |
|---|---|
| Mode | `Audience`, `Admin`, or `Setup` (start with `Setup`) |
| Events Table | `Events` |
| Q&A Table | `Q&A` |
| Upvotes Table | `Upvotes` |
| Event Link (Q&A -> Events) | `Event` field on Q&A table |
| Upvote Count | `Upvote Count` field on Q&A table |
| Question Link (Upvotes -> Q&A) | `Question` field on Upvotes table |

All other fields (`Primary Color`, `Logo`, `Status`, `Question Text`, `Created By`, etc.) are detected automatically by name. No additional mapping needed if you used the exact field names above.

### Step 4: Create a Test Event

1. Set Mode to `Setup` in the properties panel
2. Click "New Event"
3. Enter a name, date, and primary color (e.g. `#166ee1`)
4. Set Event Type to `Live Questions` or `Q/A`
5. Toggle the event to Live
6. Switch Mode to `Audience` to test question submission, or `Admin` to manage the queue

---

## Schema Requirements (Reference)

AirPulse requires three tables. Fields are connected in two ways: some are selected in the properties panel (marked **custom property**), while others are looked up automatically by field name (marked **by name**).

### 1. Events Table

Stores event metadata and branding. Connected via the **Events Table** custom property.

| Field Name | Field Type | Required | Detection | Notes |
|---|---|---|---|---|
| *(primary field)* | Single line text | Yes | Automatic | The event name displayed to attendees |
| `Primary Color` | Single line text | No | By name | Hex color code (e.g. `#166ee1`). Drives the theme for the entire interface. |
| `Logo` | Attachment | No | By name | Primary logo image. Displayed in the audience and admin views. |
| `Secondary Logo` | Attachment | No | By name | Alternate logo (typically white/light variant) used on dark backgrounds in presentation mode. |
| `Date` | Date or Date time | No | By name | Event date. Used for sorting events (most recent first). |
| `Description` | Long text | No | By name | Optional event description shown to attendees in Q/A mode. |
| `Live Event` | Checkbox | No | By name | Toggle to mark an event as active. Only one event should be live at a time (the extension enforces this). |
| `Event Type` | Single select | No | By name | Options: `Live Questions`, `Q/A`. Determines the layout and feature set for the event. |

### 2. Q&A Table

Stores all submitted questions. Connected via the **Q&A Table** custom property.

| Field Name | Field Type | Required | Detection | Notes |
|---|---|---|---|---|
| `Question Text` | Single line text | Yes | By name | The question content submitted by attendees |
| `Event` | Link to Events table | Yes | Custom property ("Event Link") | Links each question to its event. The field name in your table can be anything - just map it in properties. |
| `Status` | Single select | Yes | By name | Must contain these options: `Pending`, `Live`, `Answered`, `Archived` |
| `Created By` | Created by | Yes | By name | Tracks who submitted the question. Used for ownership (delete own questions) and display. |
| `Upvote Count` | Count, Formula, Number, or Rollup | Yes | Custom property | A count of linked Upvotes records. Map this in the properties panel. |
| `AI Answer` | Single line text or Long text | No | By name | Optional. If populated, shown as an "AI Suggestion" in the admin Q/A view. Supports Markdown. |
| `Human Answer` | Single line text or Long text | No | By name | Optional. Admins can write answers directly in the extension, or pre-populate this field. Supports Markdown. |
| `Answered By` | Single line text or Long text | No | By name | Optional. Displays who answered the question in the Q/A view. |

### 3. Upvotes Table

One record per vote. This design avoids race conditions that would occur with a collaborator-list approach. Connected via the **Upvotes Table** custom property.

| Field Name | Field Type | Required | Detection | Notes |
|---|---|---|---|---|
| `Question` | Link to Q&A table | Yes | Custom property ("Question Link") | Links the upvote to a question. The field name can be anything. |
| `Created By` | Created by | Yes | By name | Identifies who cast the vote. Used for deduplication (one vote per user per question). |

### Why a Separate Upvotes Table?

Concurrent votes using a multi-collaborator field on the Q&A table would cause race conditions: `updateRecordAsync` does a full field replacement, so two simultaneous votes could overwrite each other. The Upvotes table uses `createRecordAsync` (additive), which eliminates that conflict entirely.

## Configuration

All configuration happens through the **properties panel** in the Airtable interface builder (right sidebar when editing an interface page).

### Custom Properties

**Mode** (enum) - Controls which view is rendered:
- `Audience` - The attendee-facing view. Submit and upvote questions.
- `Admin` - The host/presenter view. Manage the queue, mark answered, present.
- `Setup` - Event management view. Create and edit events, set branding, toggle live.

**Events Table** (table) - Select your Events table.

**Q&A Table** (table) - Select your Q&A table.

**Upvotes Table** (table) - Select your Upvotes table.

**Event Link (Q&A -> Events)** (field) - The linked record field on your Q&A table that points to Events.

**Upvote Count** (field) - A count/formula/number/rollup field on your Q&A table that counts linked Upvotes.

**Question Link (Upvotes -> Q&A)** (field) - The linked record field on your Upvotes table that points to Q&A.

### Auto-Detected Fields

The following fields are looked up by exact name on their respective tables. You do not configure these in the properties panel - just name them correctly.

**On the Events table:** `Primary Color`, `Logo`, `Secondary Logo`, `Date`, `Description`, `Live Event`, `Event Type`

**On the Q&A table:** `Question Text`, `Status`, `Created By`, `AI Answer`, `Human Answer`, `Answered By`

**On the Upvotes table:** `Created By`

### First-Time Setup Wizard

If required tables or fields are missing, AirPulse shows an onboarding wizard with a progress bar. It walks through three steps (Events, Q&A, Upvotes) and shows which fields have been detected and which are still missing. A built-in schema reference is available if you need to create tables from scratch.

## Features

### Two Event Types

AirPulse supports two event formats, controlled by the `Event Type` field on each event:

- **Live Questions** - Audience submits and upvotes questions. The host picks questions to answer live. A "Now Answering" card shows the active question to everyone. Best for all-hands, town halls, and live presentations.
- **Q/A** - Audience submits questions. Admins review and write answers (with optional AI suggestions). A split-panel layout shows pending and answered questions. Best for async Q&A, AMAs, and written-response formats.

### Audience Mode

- Submit questions linked to the active event (500 character limit)
- Upvote and un-upvote questions (each vote creates or deletes an Upvotes record)
- Delete your own questions
- "Now Answering" hero card when a question has Live status (Live Questions mode)
- Expandable answered questions with Markdown-rendered responses (Q/A mode)
- "My Questions" filter tab to see your own submissions
- Press `/` anywhere to focus the question input (keyboard shortcut)
- Event picker dropdown when multiple events exist

### Admin Mode

- **Live Questions layout:** Split view with the live question on a dark-branded left panel and the pending queue on the right.
  - "Pin Question" (Go Live) promotes a question and demotes the current live one back to Pending
  - Mark Answered or Archive the current live question; auto-advances to the next top-voted pending question
  - Collapsible history section with Restore action
  - Present button launches fullscreen presentation mode
- **Q/A layout:** Split view with a progress ring and stats on the left, and a card-based admin panel on the right.
  - AI Answer suggestions displayed inline with each pending question
  - Human answer textarea with Cmd+Enter to submit
  - Mark Answered and Archive controls per question
  - Answered section shows final answers with "Answered by" attribution
  - Filter tabs for All, Pending, and Answered
  - Restore answered questions back to Pending

### Setup Mode

- Create new events with name, date, description, brand color, and event type
- Edit existing events in-place
- Toggle events live/not-live (enforces single-live-event constraint)
- Open the record detail page to manage logo attachments
- Event list sorted by date (most recent first)

### Presentation Mode (Fullscreen)

Available in Admin mode for Live Questions events. Covers the entire screen using the browser Fullscreen API.

- Displays the current live question at large scale (72px font)
- Shows submitter name and upvote count
- "Mark Answered" button advances to the next question
- Event name, date, and logo displayed at the bottom
- Uses the secondary logo (if set) for better visibility on dark backgrounds
- Close button exits both the overlay and browser fullscreen

### Theming

Each event can have its own brand color via the `Primary Color` field. The extension derives an accent color automatically (a darkened variant of the primary) and sets CSS custom properties:

- `--color-primary` and `--color-primary-rgb`
- `--color-accent` and `--color-accent-rgb`
- `--color-tint` (a 6% opacity tint of the primary)
- `--color-primary-text` (white or dark, chosen by luminance)
- `--color-accent-text` (white or dark, chosen by luminance)
- `--color-accent-subtext` (semi-transparent variant for secondary text)

If no color is set, the default primary is `#166ee1` (Airtable blue).

### Dark Mode

The extension supports Airtable's dark mode through Tailwind utility classes (`dark:` prefix). All components adapt their backgrounds, text colors, and borders based on the system/Airtable theme setting.

### Fullscreen Toggle

A fullscreen button appears in the top-right corner of audience and admin views. On first load, a dismissible hint nudges users to go fullscreen. The toggle uses the browser Fullscreen API and tracks state changes via the `fullscreenchange` event.

## Automation / Webhook Setup

### AI Answer Generation (Optional)

If you want AI-generated answer suggestions to appear in the admin Q/A view, set up an Airtable Automation:

1. **Trigger:** When a record is created in the Q&A table (or when Status changes to Pending)
2. **Action:** Use an AI action (or script with an external API call) to generate a suggested answer based on the `Question Text` field
3. **Action:** Update the same record's `AI Answer` field with the generated response

The extension will display the AI answer as a suggestion that admins can use, edit, or ignore when writing the final human answer.

### No Other External Services Required

AirPulse runs entirely within the Airtable Interface SDK. There are no webhooks, external APIs, or third-party services to configure. Real-time updates come from Airtable's `useRecords` hook, which re-renders when data changes.

## Dependencies

- `@airtable/blocks` (interface-alpha) - Airtable Interface Extension SDK
- `react` / `react-dom` ^19.1.0
- `@phosphor-icons/react` ^2.1.10 - Icon library
- `react-markdown` ^10.1.0 - Markdown rendering for answers
- `remark-gfm` ^4.0.1 - GitHub Flavored Markdown support
- `remark-breaks` ^4.0.0 - Line break handling in Markdown
- Tailwind CSS 3 (dev dependency, with Airtable design tokens)

## License

Internal use. Not published to the Airtable Marketplace.
