# AI Meeting Notes — Airtable Custom Extension

An AI-powered meeting management extension for Airtable. One file, zero third-party dependencies. Manages projects, meetings, notes, decisions, action items, and AI summaries — all layered on top of your existing base.

## Quick Start (Airtable Block Editor)

1. Open your Airtable base
2. Ask **Omni** to create a **Custom Extension** (e.g. "Create a custom extension for meeting notes") — this generates a starter shell with the block editor open
3. Select all the code Omni generated and **delete it**
4. Paste the contents of [`source.tsx`](./source.tsx) into the code editor
5. Configure the custom properties panel to map your tables and fields
6. Done

No npm install. No build step. No CLI. Just replace Omni's starter code with the source file.

## Local Development (CLI)

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

## What's Inside

**`source.tsx`** — The entire application in a single file (~3,100 lines). Includes:

- Inline SVG icons (extracted from Phosphor Icons — no `@phosphor-icons/react` dependency)
- Inline markdown parser (no `marked` dependency)
- Runtime CSS injection (no external stylesheet)
- All components, state management, and Airtable SDK integration

Only imports from the Airtable-provided runtime (`react`, `@airtable/blocks`).

**`project/`** — Full CLI project structure for local development:

```
project/
├── frontend/index.tsx    ← same as source.tsx
├── block.json            ← entry point config
├── package.json          ← SDK + Tailwind build deps
├── tailwind.config.js    ← design tokens (colors, fonts, spacing)
└── tsconfig.json         ← TypeScript config
```

## Features

- **Project Dashboard** — Card grid with AI summaries, status indicators, star/filter/search
- **Meeting List** — Date-grouped meetings with type badges, AI preview, date filtering, starring
- **Meeting Workspace** — Rich-text editor for notes/agenda/decisions, inline attendee management, AI summary display
- **Action Items** — Create, edit, prioritize, assign, and complete tasks per meeting. Done items sort to bottom. Custom dropdown selectors, inline delete confirmation
- **AI Actions** — One-click triggers for AI action-item extraction and follow-up emails (via Airtable Automations)
- **Minimized Header** — Compact sticky header appears on scroll with meeting context and action buttons

## Configuration

All field mappings are done through the Custom Properties panel — no hardcoded field names. The extension adapts to your existing schema.

Required tables: Meetings, Projects (optional), Action Items (optional), Team Members (optional)

## License

MIT
