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

## License

MIT
