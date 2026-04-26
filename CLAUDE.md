# Theme Park Agent

A Mastra AI agent project for planning theme park days. Provides two agents: a weather assistant and a theme park assistant with live ride wait times.

## Commands

```bash
npm run dev     # Start Mastra Studio at http://localhost:4111
npm run build   # Production build
```

## Architecture

### Agents

| Agent | File | Model | Tools |
| --- | --- | --- | --- |
| Weather Agent | `src/mastra/agents/weather-agent.ts` | `anthropic/claude-sonnet-4-5` | `weatherTool` |
| Theme Park Agent | `src/mastra/agents/theme-park-agent.ts` | `zai-coding-plan/glm-5-turbo` | `findQueueTimesParkTool`, `getQueueTimesLiveTool` |

### Tools

| Tool | File | Purpose |
| --- | --- | --- |
| `weatherTool` | `src/mastra/tools/weather-tool.ts` | Fetches current weather via Open-Meteo API |
| `findQueueTimesParkTool` | `src/mastra/tools/find-park-tools.ts` | Looks up Queue-Times parkId by park name |
| `getQueueTimesLiveTool` | `src/mastra/tools/get-queue-times-live-tool.ts` | Fetches live ride wait times, sorted by shortest wait first |

### Workflow

`weather-workflow` (`src/mastra/workflows/weather-workflow.ts`) — two-step pipeline: fetch weather for a city, then stream activity suggestions from the weather agent.

### Scorers

`src/mastra/scorers/weather-scorer.ts` — evaluates weather agent responses for tool call accuracy, completeness, and translation quality.

### Entry Point

`src/mastra/index.ts` — registers all agents, workflows, and scorers in the Mastra instance with composite storage (LibSQL + DuckDB), Pino logger, and observability.

## Key Patterns

- Tools use `createTool` from `@mastra/core/tools` with Zod schemas for input/output
- Agents reference tools by object key name in their instructions (the key becomes `toolName`)
- Queue-Times API: `/en-US/parks/{id}/queue_times.json` returns `{ lands: [{ rides: [...] }] }`, flattened and sorted in the tool
- Theme Park Agent uses `Memory` for conversation state — once a parkId is confirmed, it persists across follow-ups without re-looking up the park

## Development Notes

- Node.js >= 22.13.0 required
- Zod v4 is used (`zod@^4.3.6`) — there are type errors in `node_modules/@mastra/core` internal types due to Zod v3/v4 mismatch; these are harmless
- No root `tsconfig.json` — Mastra CLI manages the build config
- `.env` file is gitignored; copy from `.env.example`

## Rules

- Always load the `mastra` skill before any Mastra-related work
- Register new agents, tools, workflows, and scorers in `src/mastra/index.ts`
- Never commit `.env` files or secrets
- Never hardcode API keys
