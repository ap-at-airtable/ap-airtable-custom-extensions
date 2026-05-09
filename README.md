# Airtable Extensions

Custom Airtable Interface Extensions. Each project is a standalone extension you can copy into your own base.

| Extension | Description |
|-----------|-------------|
| [AI Meeting Notes](./ai-meeting-notes) | AI-powered meeting management — projects, notes, decisions, action items, and AI summaries |
| [AirPulse](./airpulse) | Real-time audience Q&A built natively in Airtable |
| [Multi-Level Timeline](./multi-level-timeline) | Three-level Gantt chart with dependency arrows, drag-and-drop scheduling, and critical path |

## Getting Started

Each extension has its own README with setup instructions. The general pattern:

1. Open your Airtable base
2. Create a Custom Extension
3. Copy the source code from the extension's directory
4. Configure the custom properties panel to map your tables and fields

For local development with the Airtable CLI:

```bash
cd <extension-directory>
npm install
block run
```

## Making It Your Own

These extensions are starting points, not finished products. You're expected to customize them for your workflow. Some ideas:

- **Add or remove fields.** The extensions auto-detect fields by name and type. Rename fields, add new ones, or drop ones you don't need. If a field isn't mapped, the UI section that uses it simply hides.
- **Change the AI prompts.** The AI text field prompts are suggestions. Rewrite them to match your team's terminology, output format, or level of detail.
- **Modify the source code.** Every extension is plain React on top of the Airtable SDK. Change colors, layouts, features, or add entirely new views. The code is yours.
- **Combine with automations.** The extensions work well alongside Airtable Automations, Scripts, and Sync. Layer on whatever workflows make sense for your team.

## License

MIT
