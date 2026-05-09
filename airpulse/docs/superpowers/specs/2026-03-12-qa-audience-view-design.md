# Q&A Audience View — Design Spec

## Overview

An Airtable Interface Extension that replaces Slido's Q&A functionality for all-hands meetings. This spec covers the **audience view** — the page where attendees submit questions and upvote others' questions. A separate host/presenter view (for marking questions as answered and focusing on the current question) will be designed separately.

## Context

- **Setting**: All-hands / town hall — one presenter, large audience
- **Platform**: Airtable Interface Extension using `@airtable/blocks` (interface alpha), React 19, Tailwind CSS 3
- **Data**: Existing Airtable base with Events and Q&A tables
- **No moderation**: All submitted questions are immediately visible
- **Submitter tracked**: The current user's name is displayed on their questions (via Created By field)

## Data Model

### Existing Tables

**Events**
| Field | Type | Purpose |
|-------|------|---------|
| Name | Single line text | Event title |
| Date | Date | Event date |
| Status | Single select | Includes "Live" to mark active event |
| Share Code | Single line text | Sharing mechanism |
| Description | Long text | Event description |
| Polls | Linked records | Link to Polls table (future) |
| Q&A | Linked records | Link to Q&A table |

**Q&A**
| Field | Type | Purpose |
|-------|------|---------|
| Question Text | Single line text or Long text | The question content (single-line input in the UI regardless of underlying field type) |
| Event | Linked record → Events | Which event this belongs to |
| Upvotes | Multiple collaborators | Users who upvoted — provides deduplication |
| Status | Single select | Pending (default), Live, Answered, Archived |
| Created By | Created by | Auto-populated by Airtable with submitter |
| Upvote Count | Formula/Count | Derived count of collaborators in Upvotes |

### Schema Requirement

The Status field on Q&A needs a **"Live"** option added (in addition to existing Pending, Answered, Archived). This status indicates the host is currently addressing the question.

### Event Filtering

The Airtable interface page is configured (via built-in interface filtering) to only show Q&A records for the current live event. The extension does not handle event selection — it renders whatever Q&A records are available to it.

When creating new questions, the extension must link them to the correct event. It does this by reading the Event field from any existing Q&A record in the current filtered set to determine the event record ID, then setting that same linked record value on the new question. If no existing records are available (first question for the event), the extension cannot infer the event — the Event field default or an Airtable Automation should handle this case.

## Custom Properties

All table/field references use custom properties so builders can configure the extension per-page. No hard-coded field names or IDs.

| Key | Label | Type | `shouldFieldBeAllowed` | Default Strategy |
|-----|-------|------|----------------------|-----------------|
| `qaTable` | Q&A Table | `table` | N/A | Find table with name containing "q&a" or "qa" |
| `questionTextField` | Question Text Field | `field` (on qaTable) | `SINGLE_LINE_TEXT`, `MULTILINE_TEXT` | First matching field |
| `upvotesField` | Upvotes Field | `field` (on qaTable) | `MULTIPLE_COLLABORATORS` | First matching field |
| `upvoteCountField` | Upvote Count Field | `field` (on qaTable) | `NUMBER`, `FORMULA`, `COUNT`, `ROLLUP` | First matching field |
| `statusField` | Status Field | `field` (on qaTable) | `SINGLE_SELECT` | First matching field |
| `createdByField` | Created By Field | `field` (on qaTable) | `CREATED_BY` | First matching field |
| `eventField` | Event Field | `field` (on qaTable) | `MULTIPLE_RECORD_LINKS` | First linked record field |

The custom properties definition function must be defined outside the component (or wrapped in `useCallback`) to ensure a stable identity for memoization and schema subscriptions.

If any required custom property is not configured, the extension renders setup instructions directing the builder to the properties panel. If `errorState` is returned from `useCustomProperties`, render a user-friendly error message with the error details.

## UI Layout

The audience view has three zones stacked vertically, filling the full width and height of its container.

### Zone 1: "Now Answering" Hero Card

- **Visibility**: Rendered when one or more Q&A records have Status = "Live". If multiple are Live (edge case from host error), show only the one with the highest Upvote Count.
- **Appearance**: Gradient background (blue `#166ee1` → purple `#7c37ef`), rounded corners, white text
- **Content**:
  - Label: "Now Answering" with a pulsing dot indicator
  - Question text (large, bold)
  - Submitter name + upvote count (smaller, semi-transparent)
- **Dark mode**: Same gradient works in both themes
- **If no Live question**: This zone is hidden entirely — the input and queue shift up

### Zone 2: Question Input

- **Appearance**: Text input with border, rounded corners, Send button on the right. 500-character client-side limit with a character counter shown when approaching the limit.
- **Behavior**:
  - Check `table.hasPermissionToCreateRecords()` — hide the input entirely if no permission
  - On submit: `table.createRecordAsync()` with the Question Text field set
  - Status defaults to "Pending" via Airtable's field default
  - Created By is auto-populated by Airtable
  - Clear the input after successful creation
  - Disable the Send button while the input is empty or while a submission is in-flight
- **Dark mode**: Darker background, lighter border, white text

### Zone 3: Question Queue

- **Data**: All Q&A records with Status = "Pending", sorted by Upvote Count descending. Tiebreaker: record array order from `useRecords()` (best-effort chronological; a dedicated Created Time field is not required for this view but could be added later for precise ordering).
- **Each row displays**:
  - **Upvote pill** (left): Shows arrow + count. Blue filled (`bg-blue-blue text-white`) if the current user has upvoted, gray (`bg-gray-gray100 text-gray-gray700`) if not. Clickable.
  - **Question text** (center): The question content, wrapping as needed
  - **Submitter info** (below question text): Created By name + relative timestamp (if available)
- **Answered/Archived questions are excluded** — they do not appear in the list
- **Empty state**: When no pending questions exist, show a centered message like "No questions yet. Be the first to ask!"

## Interaction Details

### Upvoting

1. Get current user via `useSession()` → `session.currentUser`
2. On upvote pill click, read current cell value of the Upvotes field for that record (array of `{id, email, name}` objects)
3. Match using `collaborator.id === session.currentUser.id` to determine if the user has already upvoted
4. If match found → remove them from the array (un-upvote). If no match → add `{id: session.currentUser.id}` to the array.
5. Write back via `table.updateRecordAsync(record, { [upvotesField.id]: newValue })`
6. **Optimistic UI**: Toggle the visual state (pill color, count ±1) immediately on click. If the write fails, revert the visual state.
7. Check `table.hasPermissionToUpdateRecords()` — if no permission, render the upvote pill as non-interactive (show count only, no hover/click state)

### Submitting a Question

1. Check `table.hasPermissionToCreateRecords()` on mount
2. If no permission: hide the entire input zone
3. On submit:
   - Validate input is non-empty (trimmed)
   - Set submitting state to disable button and show loading indicator
   - Determine the event record ID by reading the Event field from any existing Q&A record in the current set
   - Call `table.createRecordAsync({ [questionTextField.id]: questionText, [eventField.id]: eventRecordLink })` where `eventRecordLink` is the linked record value from the existing record
   - On success: clear input, reset submitting state
   - On failure: show brief error, reset submitting state, keep input text

### Real-Time Updates

`useRecords()` from the Airtable SDK automatically re-renders when records are created, updated, or deleted. This means:
- New questions from other users appear automatically
- Upvote counts update in real-time as others vote
- When the host marks a question as "Live" or "Answered", the audience view updates immediately
- No polling or manual refresh needed

## Appearance

- **Styling**: Tailwind CSS with Airtable design tokens (configured in `tailwind.config.js`)
- **Dark mode**: Full support via Tailwind `dark:` prefixes. The "Now Answering" gradient is used as-is in both themes.
- **Icons**: `@phosphor-icons/react` for the upvote arrow (`ArrowFatUpIcon` or `CaretUpIcon`)
- **Typography**: System font stack via Tailwind config, `font-display` for headings
- **Responsive**: Full width of container. Scrolls vertically when questions overflow.

## Component Structure

```
frontend/index.js
  └── QAApp (root)
        ├── NowAnswering (hero card for Live question)
        ├── QuestionInput (submission form)
        └── QuestionQueue
              └── QuestionRow (repeated per pending question)
                    ├── UpvotePill
                    └── QuestionContent (text + submitter)
```

All components live in `frontend/index.js` since this is a single-view extension with modest complexity. If the file grows unwieldy during implementation, components can be extracted to separate files.

The entrypoint must conclude with `initializeBlock({ interface: () => <QAApp /> })` as required by the Airtable Interface Extension SDK.

## Out of Scope

- **Host/presenter view** — separate design, will be built as a different mode/page
- **Event selection** — handled by Airtable interface filtering
- **Anonymous questions** — submitter is always tracked
- **Moderation queue** — all questions visible immediately
- **Polls/quizzing** — future phases
- **Share Code functionality** — handled outside the extension
