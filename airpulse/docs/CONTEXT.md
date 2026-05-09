# Slido Replacement — Airtable Interface Extension

## Purpose

Replace Slido (out-of-band audience interaction tool) with a native Airtable Interface Extension for Q&A at all-hands / town hall meetings. All Q&A data lives in Airtable, benefits from Airtable's permissions model, and integrates with existing workflows — no context switching to external tools.

## Base & Schema

**Base ID:** `appr8OnXr0Cfg0nSc`

### Tables

**Events** — Name, Date, Status (includes "Live"), Share Code, Description, Polls (linked), Q&A (linked)

**Q&A** — Question Text, Event (linked → Events), Upvotes (linked → Upvotes table), Status (single select: Pending/Live/Answered/Archived), Created By (auto), Upvote Count (formula counting linked Upvotes records)

**Upvotes** — ID (autonumber), Question (linked → Q&A), Created By (auto). One record per vote. Deduplication handled by an Airtable formula on the Q&A table.

### Key Schema Decisions

- **"Live" status** on Q&A's Status field supports the "Now Answering" feature — the host sets a question to Live, both views react in real-time.
- **Upvotes table** replaced a MULTIPLE_COLLABORATORS field approach. The original had a race condition: concurrent upvotes could overwrite each other since `updateRecordAsync` does a full field replacement. The Upvotes table uses `createRecordAsync` (additive) which eliminates the conflict.
- **Event filtering** is handled by Airtable's built-in interface page filters, not the extension. The extension reads the Events table to show a picker for multiple live events.

## Architecture

- **Entry:** `frontend/index.js` (~1300 lines, single file)
- **Styling:** Tailwind CSS 3 with Airtable design tokens + custom CSS in `frontend/style.css`
- **Icons:** `@phosphor-icons/react`
- **SDK:** `@airtable/blocks` (interface-alpha), React 19

### Two Modes (custom property enum)

**Audience Mode** — for attendees:
- Submit questions (linked to selected event)
- Upvote/un-upvote (creates/deletes Upvotes records)
- Delete own questions
- "Now Answering" hero card when a question is Live
- Event picker for multiple live events
- Fullscreen toggle

**Admin Mode** — for hosts/presenters:
- "Now Answering" card with Mark Answered / Archive buttons
- Auto-advance: top-voted pending question goes Live automatically
- Queue with Go Live / Archive per question
- Go Live demotes current live question to Pending first
- Collapsible history with Restore
- Fullscreen presentation mode (browser Fullscreen API, covers entire screen)

### Component Tree

```
QAApp (root — custom properties, mode routing)
├── ThemeProvider (CSS variables for colors)
├── FullscreenToggle
├── QAContent (audience)
│   ├── Logo
│   ├── EventPicker
│   ├── NowAnswering
│   ├── QuestionInput → QuestionInputInner
│   └── QuestionQueue → QuestionRow → UpvotePill
└── AdminContent (admin)
    ├── Logo
    ├── EventPicker
    ├── PresentMode (fullscreen overlay)
    ├── AdminLiveCard / AdminEmptyLive
    ├── AdminQueueRow
    └── AdminHistoryRow
```

## Custom Properties (17)

### Display
| Key | Type | Default | Purpose |
|-----|------|---------|---------|
| `mode` | enum | Audience | Audience or Admin view |
| `primaryColor` | string | #166ee1 | Primary theme color |
| `secondaryColor` | string | #7c37ef | Secondary / question card color |
| `accentColor` | string | #dd04a8 | Accent color (CSS variable available) |
| `cardStyle` | enum | Gradient | Gradient or Solid for live card |
| `logoTable` | table | — | Table containing logo attachment |
| `logoRecordId` | string | — | Record ID for primary logo |
| `secondaryLogoRecordId` | string | — | Record ID for alternate logo |
| `logoSize` | enum | Medium | Small / Medium / Large / Extra Large |
| `presentLogo` | enum | Primary | Which logo in fullscreen present mode |

### Data
| Key | Type | Purpose |
|-----|------|---------|
| `eventsTable` | table | Events table |
| `qaTable` | table | Q&A table |
| `upvotesTable` | table | Upvotes table |
| `questionTextField` | field | Question text (SINGLE_LINE_TEXT / MULTILINE_TEXT) |
| `upvoteQuestionField` | field | Upvote → Question link (MULTIPLE_RECORD_LINKS) |
| `upvoteCreatedByField` | field | Created By on Upvotes table (CREATED_BY) |
| `upvoteCountField` | field | Upvote count formula (NUMBER/FORMULA/COUNT/ROLLUP) |
| `statusField` | field | Status on Q&A (SINGLE_SELECT) |
| `createdByField` | field | Created By on Q&A (CREATED_BY) |
| `eventField` | field | Event link on Q&A (MULTIPLE_RECORD_LINKS) |

## Theming System

Colors flow through CSS variables set by `ThemeProvider`:
- `--color-primary` / `--color-primary-rgb`
- `--color-secondary` / `--color-secondary-rgb`
- `--color-accent` / `--color-accent-rgb`
- `--color-secondary-text` — auto white or dark based on luminance
- `--color-secondary-subtext` — auto semi-transparent version

CSS classes: `.live-card-gradient`, `.live-card-solid`, `.btn-primary`, `.pill-voted`, `.event-pill-active`, `.question-card`, `.present-overlay-gradient`, `.present-overlay-solid`, `.input-themed`, `.live-label-shimmer`

## Key Technical Decisions

1. **QuestionInput split** — Guard component (no hooks) + Inner component (hooks). Satisfies rules of hooks.
2. **Hooks before returns** — `useRecords`/`useSession` at top of content components. Parent `QAApp` gates rendering.
3. **Non-mutating sorts** — `[...array].sort()` everywhere to avoid corrupting `useRecords` arrays.
4. **`finally` on async handlers** — Prevents permanently disabled buttons on error.
5. **No optimistic UI on upvotes** — Removed after Upvotes table switch (caused double-counting). Real-time `useRecords` updates fast enough.
6. **Status constants** — `STATUS.LIVE`, `STATUS.PENDING`, etc. centralized for easy rename.
7. **Fullscreen via useEffect** — Not ref callback, to avoid re-triggering per render.
8. **Logo auto-detects attachment field** — Finds first `MULTIPLE_ATTACHMENTS` on the logo table.
9. **Text color auto-detection** — Luminance formula picks white or dark text for secondary color backgrounds.

## Release History

- **v1.0** (2026-03-12) — Initial release. Audience Q&A + Admin view + theming + logos + fullscreen present mode.

## Future Phases

- **Polls** — Events table already has a Polls linked field
- **Quizzing** — not yet designed
- **Host enhancements** — reordering, pinning, topic tagging

## SDK Rules

See `.cursor/rules/interface-extensions.mdc` for Airtable Interface Extension SDK constraints. Key rules:
- Only import from `@airtable/blocks/interface/ui` and `@airtable/blocks/interface/models`
- Use `FieldType` enum, never string literals for field types
- Never hard-code field names — always custom properties
- Custom properties function defined outside component for stable identity
- `@phosphor-icons/react` with `Icon` suffix
- Check permissions before mutations
