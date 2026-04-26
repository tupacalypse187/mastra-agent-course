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
| Weather Agent | `src/mastra/agents/weather-agent.ts` | `zai-coding-plan/glm-5-turbo` | `weatherTool` |
| Theme Park Agent | `src/mastra/agents/theme-park-agent.ts` | `zai-coding-plan/glm-5-turbo` | `findQueueTimesParkTool`, `getQueueTimesLiveTool`, `firecrawl_firecrawl_extract`, `weatherTool`, `simulateTicketPurchaseTool` |

### Tools

| Tool | File | Purpose |
| --- | --- | --- |
| `weatherTool` | `src/mastra/tools/weather-tool.ts` | Fetches current weather via Open-Meteo API |
| `findQueueTimesParkTool` | `src/mastra/tools/find-park-tools.ts` | Looks up Queue-Times parkId by park name |
| `getQueueTimesLiveTool` | `src/mastra/tools/get-queue-times-live-tool.ts` | Fetches live ride wait times, sorted by shortest wait first |
| `mockChargeTool` | `src/mastra/tools/mock-charge-tool.ts` | Simulates a Stripe-like card charge (always succeeds) |
| `simulateTicketPurchaseTool` | `src/mastra/tools/simulate-ticket-purchase-tool.ts` | Starts the ticket purchase workflow (build quote, suspend for approval, charge) |

### MCP Clients

| Client | File | Purpose |
| --- | --- | --- |
| `firecrawlMcpClient` | `src/mastra/mcp/firecrawl-mcp.ts` | Firecrawl MCP server for scraping park pages (hours, stats, calendar) |

### Workflow

| Workflow | File | Description |
| --- | --- | --- |
| `weatherWorkflow` | `src/mastra/workflows/weather-workflow.ts` | Fetches weather for a city, then streams activity suggestions from the weather agent |
| `simulateTicketPurchaseWorkflow` | `src/mastra/workflows/simulate-ticket-purchase-workflow.ts` | Four-step ticket purchase: build quote, suspend for approval, charge card via `mockChargeTool`, then generate a visit brief via the theme park agent |

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
- `FIRECRAWL_API_KEY` required in `.env` for the Firecrawl MCP server used by the theme park agent

## Rules

- Always load the `mastra` skill before any Mastra-related work
- Register new agents, tools, workflows, and scorers in `src/mastra/index.ts`
- Never commit `.env` files or secrets
- Never hardcode API keys
