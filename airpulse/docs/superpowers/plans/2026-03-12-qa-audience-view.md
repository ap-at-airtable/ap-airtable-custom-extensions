# Q&A Audience View Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the audience-facing Q&A view for an Airtable Interface Extension that lets users submit questions, upvote others' questions, and see which question is currently being answered live.

**Architecture:** Single React component tree in `frontend/index.js` using the Airtable Blocks SDK (`@airtable/blocks/interface/ui` and `@airtable/blocks/interface/models`). All field/table references use custom properties. Data flows through `useRecords()` for real-time updates. Upvotes use the MULTIPLE_COLLABORATORS field for natural deduplication.

**Tech Stack:** React 19, Tailwind CSS 3 (with Airtable design tokens), @airtable/blocks (interface-alpha), @phosphor-icons/react

**Spec:** `docs/superpowers/specs/2026-03-12-qa-audience-view-design.md`

**SDK Rules:** `.cursor/rules/interface-extensions.mdc` — read this before writing any code. Key constraints:
- ONLY import from `@airtable/blocks/interface/ui` and `@airtable/blocks/interface/models`
- Use `FieldType` enum for field type comparisons, never string literals
- Use `table.getFieldIfExists()` — never `getField()`, `getFieldByName()`, or `getFieldById()`
- Never hard-code field names — always use custom properties
- Define custom properties function outside the component for stable identity
- Use `@phosphor-icons/react` with `Icon` suffix (e.g., `ArrowFatUpIcon`)

**Testing note:** This is an Airtable Interface Extension — it runs inside Airtable's runtime. There is no unit test infrastructure. Each task includes manual verification steps to run within the Airtable interface.

---

## File Structure

All implementation goes in a single file, with one npm dependency to install:

| File | Action | Responsibility |
|------|--------|---------------|
| `frontend/index.js` | Modify | All components: QAApp, NowAnswering, QuestionInput, QuestionQueue, QuestionRow, UpvotePill. Custom properties definition. `initializeBlock` call. |
| `frontend/style.css` | Keep as-is | Tailwind directives (already configured) |
| `package.json` | Modify | Add `@phosphor-icons/react` dependency |

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install @phosphor-icons/react**

```bash
cd /Users/ap/Desktop/slido && npm install @phosphor-icons/react --legacy-peer-deps
```

Expected: Package added to `dependencies` in `package.json`. `--legacy-peer-deps` needed because the library may not list React 19 as a peer dependency.

- [ ] **Step 2: Verify installation**

```bash
cd /Users/ap/Desktop/slido && node -e "require('@phosphor-icons/react')" 2>&1 | head -5
```

Expected: No errors (or a "require is not defined" ESM note, which is fine — it will work via the bundler).

- [ ] **Step 3: Commit**

```bash
cd /Users/ap/Desktop/slido
git add package.json package-lock.json
git commit -m "feat: add @phosphor-icons/react dependency for Q&A upvote icons"
```

---

## Task 2: Custom Properties Setup + Error/Setup Screens

**Files:**
- Modify: `frontend/index.js`

This task replaces the HelloWorldApp with the QAApp shell and implements the `getCustomProperties` function, error state handling, and setup instructions screen.

- [ ] **Step 1: Write the custom properties function and QAApp shell**

Replace the entire contents of `frontend/index.js` with:

```jsx
import {
    initializeBlock,
    useBase,
    useRecords,
    useSession,
    useCustomProperties,
} from '@airtable/blocks/interface/ui';
import {FieldType} from '@airtable/blocks/interface/models';
import {ArrowFatUpIcon} from '@phosphor-icons/react';
import './style.css';

function getCustomProperties(base) {
    const qaTable = base.tables.find(
        (t) => t.name.toLowerCase().includes('q&a') || t.name.toLowerCase().includes('qa')
    );

    if (!qaTable) {
        return [
            {
                key: 'qaTable',
                label: 'Q&A Table',
                type: 'table',
            },
        ];
    }

    const isTextField = (field) =>
        field.config.type === FieldType.SINGLE_LINE_TEXT ||
        field.config.type === FieldType.MULTILINE_TEXT;

    const isCollaboratorsField = (field) =>
        field.config.type === FieldType.MULTIPLE_COLLABORATORS;

    const isCountableField = (field) =>
        field.config.type === FieldType.NUMBER ||
        field.config.type === FieldType.FORMULA ||
        field.config.type === FieldType.COUNT ||
        field.config.type === FieldType.ROLLUP;

    const isSingleSelectField = (field) =>
        field.config.type === FieldType.SINGLE_SELECT;

    const isCreatedByField = (field) =>
        field.config.type === FieldType.CREATED_BY;

    const isLinkedRecordField = (field) =>
        field.config.type === FieldType.MULTIPLE_RECORD_LINKS;

    const textFields = qaTable.fields.filter(isTextField);
    const collaboratorFields = qaTable.fields.filter(isCollaboratorsField);
    const countableFields = qaTable.fields.filter(isCountableField);
    const selectFields = qaTable.fields.filter(isSingleSelectField);
    const createdByFields = qaTable.fields.filter(isCreatedByField);
    const linkedFields = qaTable.fields.filter(isLinkedRecordField);

    return [
        {
            key: 'qaTable',
            label: 'Q&A Table',
            type: 'table',
            defaultValue: qaTable,
        },
        {
            key: 'questionTextField',
            label: 'Question Text Field',
            type: 'field',
            table: qaTable,
            shouldFieldBeAllowed: isTextField,
            defaultValue: textFields.find((f) =>
                f.name.toLowerCase().includes('question')
            ) || textFields[0],
        },
        {
            key: 'upvotesField',
            label: 'Upvotes Field',
            type: 'field',
            table: qaTable,
            shouldFieldBeAllowed: isCollaboratorsField,
            defaultValue: collaboratorFields.find((f) =>
                f.name.toLowerCase().includes('upvote')
            ) || collaboratorFields[0],
        },
        {
            key: 'upvoteCountField',
            label: 'Upvote Count Field',
            type: 'field',
            table: qaTable,
            shouldFieldBeAllowed: isCountableField,
            defaultValue: countableFields.find((f) =>
                f.name.toLowerCase().includes('upvote') && f.name.toLowerCase().includes('count')
            ) || countableFields[0],
        },
        {
            key: 'statusField',
            label: 'Status Field',
            type: 'field',
            table: qaTable,
            shouldFieldBeAllowed: isSingleSelectField,
            defaultValue: selectFields.find((f) =>
                f.name.toLowerCase().includes('status')
            ) || selectFields[0],
        },
        {
            key: 'createdByField',
            label: 'Created By Field',
            type: 'field',
            table: qaTable,
            shouldFieldBeAllowed: isCreatedByField,
            defaultValue: createdByFields[0],
        },
        {
            key: 'eventField',
            label: 'Event Field',
            type: 'field',
            table: qaTable,
            shouldFieldBeAllowed: isLinkedRecordField,
            defaultValue: linkedFields.find((f) =>
                f.name.toLowerCase().includes('event')
            ) || linkedFields[0],
        },
    ];
}

function SetupInstructions({missingFields}) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-gray50 dark:bg-gray-gray800">
            <div className="max-w-md mx-auto text-center p-8">
                <h2 className="text-2xl font-display font-bold text-gray-gray700 dark:text-gray-gray200 mb-4">
                    Configure Q&A
                </h2>
                <p className="text-base text-gray-gray500 dark:text-gray-gray400 mb-6">
                    Open the properties panel to configure the following fields:
                </p>
                <ul className="text-left space-y-2 mb-6">
                    {missingFields.map((field) => (
                        <li
                            key={field}
                            className="text-sm text-gray-gray600 dark:text-gray-gray300 bg-gray-gray75 dark:bg-gray-gray700 rounded-md px-3 py-2"
                        >
                            {field}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

function ErrorDisplay({error}) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-gray50 dark:bg-gray-gray800">
            <div className="max-w-md mx-auto text-center p-8">
                <h2 className="text-2xl font-display font-bold text-red-red mb-4">
                    Configuration Error
                </h2>
                <p className="text-base text-gray-gray500 dark:text-gray-gray400">
                    {error?.message || 'An error occurred while setting up custom properties. Please check the properties panel.'}
                </p>
            </div>
        </div>
    );
}

function QAApp() {
    const {customPropertyValueByKey, errorState} = useCustomProperties(getCustomProperties);

    if (errorState) {
        return <ErrorDisplay error={errorState} />;
    }

    const qaTable = customPropertyValueByKey.qaTable;
    const questionTextField = customPropertyValueByKey.questionTextField;
    const upvotesField = customPropertyValueByKey.upvotesField;
    const upvoteCountField = customPropertyValueByKey.upvoteCountField;
    const statusField = customPropertyValueByKey.statusField;
    const createdByField = customPropertyValueByKey.createdByField;
    const eventField = customPropertyValueByKey.eventField;

    const missingFields = [];
    if (!qaTable) missingFields.push('Q&A Table');
    if (!questionTextField) missingFields.push('Question Text Field');
    if (!upvotesField) missingFields.push('Upvotes Field');
    if (!upvoteCountField) missingFields.push('Upvote Count Field');
    if (!statusField) missingFields.push('Status Field');
    if (!createdByField) missingFields.push('Created By Field');
    if (!eventField) missingFields.push('Event Field');

    if (missingFields.length > 0) {
        return <SetupInstructions missingFields={missingFields} />;
    }

    return (
        <div className="min-h-screen bg-gray-gray50 dark:bg-gray-gray800 p-4">
            <p className="text-base text-gray-gray500 dark:text-gray-gray400 text-center">
                Q&A configured successfully. Components coming next.
            </p>
        </div>
    );
}

initializeBlock({interface: () => <QAApp />});
```

- [ ] **Step 2: Verify in Airtable**

Open the Airtable interface page with this extension. Expected:
- If custom properties are configured: see "Q&A configured successfully" message
- If not configured: see setup instructions listing the missing fields
- Open the properties panel and verify all 7 custom properties appear with correct field type filters

- [ ] **Step 3: Commit**

```bash
cd /Users/ap/Desktop/slido
git add frontend/index.js
git commit -m "feat: add custom properties setup with error and setup instruction screens"
```

---

## Task 3: NowAnswering Hero Card

**Files:**
- Modify: `frontend/index.js`

- [ ] **Step 1: Add the NowAnswering component**

Add the following component above the `QAApp` function:

```jsx
function NowAnswering({record, questionTextField, createdByField, upvoteCountField}) {
    const questionText = record.getCellValueAsString(questionTextField);
    const createdBy = record.getCellValue(createdByField);
    const upvoteCount = record.getCellValue(upvoteCountField) || 0;
    const submitterName = createdBy?.name || 'Someone';

    return (
        <div
            className="rounded-lg p-5 mb-4"
            style={{background: 'linear-gradient(135deg, #166ee1 0%, #7c37ef 100%)'}}
        >
            <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">
                    Now Answering
                </span>
            </div>
            <p className="text-xl font-display font-bold text-white leading-snug mb-2">
                {questionText}
            </p>
            <p className="text-sm text-white/60">
                {submitterName} · {upvoteCount} {upvoteCount === 1 ? 'upvote' : 'upvotes'}
            </p>
        </div>
    );
}
```

- [ ] **Step 2: Wire NowAnswering into QAApp**

Replace the placeholder return in `QAApp` with data loading and the NowAnswering component. Update the `QAApp` function body (after the `missingFields` check) to:

```jsx
    const session = useSession();
    const currentUser = session.currentUser;
    const records = useRecords(qaTable);

    const liveRecords = records.filter((r) => {
        const status = r.getCellValue(statusField);
        return status?.name === 'Live';
    });

    const liveRecord = liveRecords.length > 0
        ? liveRecords.sort((a, b) => {
            const aCount = a.getCellValue(upvoteCountField) || 0;
            const bCount = b.getCellValue(upvoteCountField) || 0;
            return bCount - aCount;
        })[0]
        : null;

    const pendingRecords = records
        .filter((r) => {
            const status = r.getCellValue(statusField);
            return status?.name === 'Pending';
        })
        .sort((a, b) => {
            const aCount = a.getCellValue(upvoteCountField) || 0;
            const bCount = b.getCellValue(upvoteCountField) || 0;
            return bCount - aCount;
        });

    return (
        <div className="min-h-screen bg-gray-gray50 dark:bg-gray-gray800 p-4 sm:p-6">
            <div className="max-w-2xl mx-auto">
                {liveRecord && (
                    <NowAnswering
                        record={liveRecord}
                        questionTextField={questionTextField}
                        createdByField={createdByField}
                        upvoteCountField={upvoteCountField}
                    />
                )}
                <p className="text-sm text-gray-gray400 text-center mt-8">
                    {pendingRecords.length} pending question{pendingRecords.length !== 1 ? 's' : ''}
                </p>
            </div>
        </div>
    );
```

- [ ] **Step 3: Verify in Airtable**

Expected:
- If a Q&A record has Status = "Live": blue-to-purple gradient card appears with question text, submitter, and upvote count
- If no Live records: no hero card shown, just the pending count
- If multiple Live records: only the one with highest upvote count is shown

- [ ] **Step 4: Commit**

```bash
cd /Users/ap/Desktop/slido
git add frontend/index.js
git commit -m "feat: add NowAnswering hero card component with live question display"
```

---

## Task 4: Question Input

**Files:**
- Modify: `frontend/index.js`

- [ ] **Step 1: Add the QuestionInput component**

Add the following component above `QAApp`:

Add `import {useState} from 'react';` as a new line after the existing imports at the top of `frontend/index.js`.

Then add the component:

```jsx
const MAX_QUESTION_LENGTH = 500;

function QuestionInput({qaTable, questionTextField, eventField, records}) {
    const [text, setText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const canCreate = qaTable.hasPermissionToCreateRecords();
    if (!canCreate) return null;

    const trimmedText = text.trim();
    const canSubmit = trimmedText.length > 0 && trimmedText.length <= MAX_QUESTION_LENGTH && !isSubmitting;
    const showCounter = text.length > MAX_QUESTION_LENGTH - 100;

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setIsSubmitting(true);
        setError(null);

        try {
            const fields = {[questionTextField.id]: trimmedText};

            // Link to the same event as existing records
            const existingWithEvent = records.find((rec) => rec.getCellValue(eventField));
            if (existingWithEvent) {
                fields[eventField.id] = existingWithEvent.getCellValue(eventField);
            }

            await qaTable.createRecordAsync(fields);
            setText('');
        } catch (err) {
            setError('Failed to submit question. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey && canSubmit) {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <div className="mb-4">
            <div className="flex items-center gap-2 bg-white dark:bg-gray-gray700 border-2 border-gray-gray200 dark:border-gray-gray600 rounded-lg px-4 py-3 focus-within:border-blue-blue dark:focus-within:border-blue-blue transition-colors">
                <input
                    type="text"
                    value={text}
                    onChange={(e) => {
                        setText(e.target.value);
                        setError(null);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your question..."
                    maxLength={MAX_QUESTION_LENGTH}
                    disabled={isSubmitting}
                    className="flex-1 bg-transparent text-base text-gray-gray700 dark:text-gray-gray200 placeholder-gray-gray400 dark:placeholder-gray-gray500 outline-none"
                />
                <button
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                        canSubmit
                            ? 'bg-blue-blue text-white hover:bg-blue-blueDark1 cursor-pointer'
                            : 'bg-gray-gray100 dark:bg-gray-gray600 text-gray-gray400 dark:text-gray-gray500 cursor-not-allowed'
                    }`}
                >
                    {isSubmitting ? 'Sending...' : 'Send'}
                </button>
            </div>
            <div className="flex justify-between items-center mt-1 min-h-[20px]">
                {error && (
                    <p className="text-xs text-red-red">{error}</p>
                )}
                {!error && <span />}
                {showCounter && (
                    <p className={`text-xs ${
                        text.length > MAX_QUESTION_LENGTH
                            ? 'text-red-red'
                            : 'text-gray-gray400'
                    }`}>
                        {text.length}/{MAX_QUESTION_LENGTH}
                    </p>
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Wire QuestionInput into QAApp**

In the QAApp return, add QuestionInput between the NowAnswering card and the pending count:

```jsx
    return (
        <div className="min-h-screen bg-gray-gray50 dark:bg-gray-gray800 p-4 sm:p-6">
            <div className="max-w-2xl mx-auto">
                {liveRecord && (
                    <NowAnswering
                        record={liveRecord}
                        questionTextField={questionTextField}
                        createdByField={createdByField}
                        upvoteCountField={upvoteCountField}
                    />
                )}
                <QuestionInput
                    qaTable={qaTable}
                    questionTextField={questionTextField}
                    eventField={eventField}
                    records={records}
                />
                <p className="text-sm text-gray-gray400 text-center mt-8">
                    {pendingRecords.length} pending question{pendingRecords.length !== 1 ? 's' : ''}
                </p>
            </div>
        </div>
    );
```

- [ ] **Step 3: Verify in Airtable**

Expected:
- Text input with "Type your question..." placeholder and Send button
- Send button is gray/disabled when input is empty
- Typing text enables the Send button (turns blue)
- Character counter appears after 400 characters
- Pressing Enter or clicking Send creates a new Q&A record with the question text and correct Event link
- Input clears after successful submission
- If user has no create permission: input is hidden entirely

- [ ] **Step 4: Commit**

```bash
cd /Users/ap/Desktop/slido
git add frontend/index.js
git commit -m "feat: add QuestionInput component with event linking and character limit"
```

---

## Task 5: Question Queue with Upvote Pills

**Files:**
- Modify: `frontend/index.js`

- [ ] **Step 1: Add the UpvotePill component**

```jsx
function UpvotePill({record, qaTable, upvotesField, upvoteCountField, currentUser, canUpdate}) {
    const [optimisticDelta, setOptimisticDelta] = useState(0);
    const [optimisticVoted, setOptimisticVoted] = useState(null);

    const upvoters = record.getCellValue(upvotesField) || [];
    const actuallyVoted = upvoters.some((u) => u.id === currentUser.id);
    const hasVoted = optimisticVoted !== null ? optimisticVoted : actuallyVoted;
    const count = (record.getCellValue(upvoteCountField) || 0) + optimisticDelta;

    const handleClick = async () => {
        if (!canUpdate) return;

        const newVoted = !hasVoted;
        setOptimisticVoted(newVoted);
        setOptimisticDelta(newVoted ? 1 : -1);

        try {
            const currentUpvoters = record.getCellValue(upvotesField) || [];
            let newUpvoters;
            if (newVoted) {
                newUpvoters = [...currentUpvoters, {id: currentUser.id}];
            } else {
                newUpvoters = currentUpvoters.filter((u) => u.id !== currentUser.id);
            }
            await qaTable.updateRecordAsync(record, {
                [upvotesField.id]: newUpvoters,
            });
        } catch {
            // Revert on failure — useRecords hasn't changed yet
        }
        // Reset optimistic state — real data from useRecords will take over
        setOptimisticVoted(null);
        setOptimisticDelta(0);
    };

    return (
        <button
            onClick={handleClick}
            disabled={!canUpdate}
            className={`flex flex-col items-center justify-center min-w-[44px] px-2 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                hasVoted
                    ? 'bg-blue-blue text-white'
                    : 'bg-gray-gray75 dark:bg-gray-gray700 text-gray-gray600 dark:text-gray-gray300 hover:bg-gray-gray100 dark:hover:bg-gray-gray600'
            } ${canUpdate ? 'cursor-pointer' : 'cursor-default'}`}
        >
            <ArrowFatUpIcon size={16} weight={hasVoted ? 'fill' : 'regular'} />
            <span>{count}</span>
        </button>
    );
}
```

- [ ] **Step 2: Add the QuestionRow component**

```jsx
function QuestionRow({record, qaTable, questionTextField, createdByField, upvotesField, upvoteCountField, currentUser, canUpdate}) {
    const questionText = record.getCellValueAsString(questionTextField);
    const createdBy = record.getCellValue(createdByField);
    const submitterName = createdBy?.name || 'Someone';

    return (
        <div className="flex items-start gap-3 bg-white dark:bg-gray-gray700 rounded-lg p-3 shadow-xs dark:shadow-none">
            <UpvotePill
                record={record}
                qaTable={qaTable}
                upvotesField={upvotesField}
                upvoteCountField={upvoteCountField}
                currentUser={currentUser}
                canUpdate={canUpdate}
            />
            <div className="flex-1 min-w-0">
                <p className="text-base text-gray-gray700 dark:text-gray-gray200 leading-snug">
                    {questionText}
                </p>
                <p className="text-xs text-gray-gray400 dark:text-gray-gray500 mt-1">
                    {submitterName}
                </p>
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Add the QuestionQueue component**

```jsx
function QuestionQueue({pendingRecords, qaTable, questionTextField, createdByField, upvotesField, upvoteCountField, currentUser, canUpdate}) {
    if (pendingRecords.length === 0) {
        return (
            <div className="flex items-center justify-center py-16">
                <p className="text-base text-gray-gray400 dark:text-gray-gray500">
                    No questions yet. Be the first to ask!
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {pendingRecords.map((record) => (
                <QuestionRow
                    key={record.id}
                    record={record}
                    qaTable={qaTable}
                    questionTextField={questionTextField}
                    createdByField={createdByField}
                    upvotesField={upvotesField}
                    upvoteCountField={upvoteCountField}
                    currentUser={currentUser}
                    canUpdate={canUpdate}
                />
            ))}
        </div>
    );
}
```

- [ ] **Step 4: Update QAApp return to use QuestionQueue**

Replace the pending count placeholder with the full QuestionQueue:

```jsx
    const canUpdate = qaTable.hasPermissionToUpdateRecords();

    return (
        <div className="min-h-screen bg-gray-gray50 dark:bg-gray-gray800 p-4 sm:p-6">
            <div className="max-w-2xl mx-auto">
                {liveRecord && (
                    <NowAnswering
                        record={liveRecord}
                        questionTextField={questionTextField}
                        createdByField={createdByField}
                        upvoteCountField={upvoteCountField}
                    />
                )}
                <QuestionInput
                    qaTable={qaTable}
                    questionTextField={questionTextField}
                    eventField={eventField}
                    records={records}
                />
                <QuestionQueue
                    pendingRecords={pendingRecords}
                    qaTable={qaTable}
                    questionTextField={questionTextField}
                    createdByField={createdByField}
                    upvotesField={upvotesField}
                    upvoteCountField={upvoteCountField}
                    currentUser={currentUser}
                    canUpdate={canUpdate}
                />
            </div>
        </div>
    );
```

- [ ] **Step 5: Verify in Airtable**

Expected:
- Pending questions appear as cards sorted by upvote count (highest first)
- Each card shows: upvote pill (left), question text, submitter name
- Clicking the upvote pill toggles it blue (voted) / gray (not voted)
- Upvote count increments/decrements correctly
- A user can only vote once per question (clicking again removes the vote)
- If no pending questions exist: "No questions yet. Be the first to ask!" message
- Answered/Archived/Live questions do not appear in the queue
- If user has no update permission: upvote pills are non-interactive

- [ ] **Step 6: Commit**

```bash
cd /Users/ap/Desktop/slido
git add frontend/index.js
git commit -m "feat: add QuestionQueue with upvote pills and empty state"
```

---

## Task 6: Final Polish and Lint

**Files:**
- Modify: `frontend/index.js`

- [ ] **Step 1: Run ESLint**

```bash
cd /Users/ap/Desktop/slido && npm run lint
```

Fix any lint errors reported.

- [ ] **Step 2: Verify full flow end-to-end in Airtable**

Full checklist:
1. Custom properties panel shows all 7 fields with correct type filters
2. "Now Answering" hero card appears for Live questions, hidden when none
3. Question input creates records with correct Event link
4. Character counter appears at 400+ characters, blocks at 500
5. Question queue shows Pending questions sorted by upvote count
6. Upvote toggle works (add/remove current user from collaborators)
7. Real-time: another user submitting/upvoting updates the view
8. Dark mode: all components render correctly
9. Empty state shows when no pending questions exist
10. Error state shows when custom properties have issues

- [ ] **Step 3: Commit**

```bash
cd /Users/ap/Desktop/slido
git add frontend/index.js
git commit -m "fix: lint fixes and final polish for Q&A audience view"
```
