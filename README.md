# Theme Park Agent

A Mastra AI agent project for planning theme park days — with live ride wait times, weather awareness, and ticket purchase simulation.

## Getting Started

```shell
npm install
npm run dev
```

Open [http://localhost:4111](http://localhost:4111) to access Mastra Studio.

### Environment Variables

Copy `.env.example` to `.env` and fill in required keys:

```shell
cp .env.example .env
```

| Variable | Required | Used by |
| --- | --- | --- |
| `ZHIPU_API_KEY` | Yes | Both agents via [`zai-coding-plan/glm-5-turbo`](https://mastra.ai/models/providers/zai-coding-plan) provider |
| `ANTHROPIC_API_KEY` | Yes | Weather agent model (`claude-sonnet-4-5`) |
| `FIRECRAWL_API_KEY` | Yes | Firecrawl MCP server for scraping park pages |

## External APIs & MCPs

### APIs (no auth required)

| API | Used by | Purpose |
| --- | --- | --- |
| [Queue-Times](https://queue-times.com/) | `findQueueTimesParkTool`, `getQueueTimesLiveTool` | Park lookup and live ride wait times |
| [Open-Meteo](https://open-meteo.com/) | `weatherTool` | Current weather and forecasts |

### MCP Servers

| MCP Server | Package | Scope | What it provides |
| --- | --- | --- | --- |
| [Firecrawl](https://firecrawl.dev/) | `firecrawl-mcp` | In-app (agent runtime) | `firecrawl_firecrawl_extract` — scrapes queue-times.com park pages for hours, stats, calendar, and crowd forecasts |
| [Mastra Docs](https://mastra.ai/docs/build-with-ai/mcp-docs-server) | `@mastra/mcp-docs-server` | Dev-time (`.mcp.json`) | Embedded documentation, API reference, and course content for Mastra packages in `node_modules` |

#### Firecrawl MCP (in-app)

The Firecrawl MCP client (`src/mastra/mcp/firecrawl-mcp.ts`) is configured with `@mastra/mcp`'s `MCPClient`. It spawns `firecrawl-mcp` as a subprocess via `npx`, passing `FIRECRAWL_API_KEY` from the environment. Tools from the server are listed at import time and wired directly into the theme park agent.

To set up:

```shell
# 1. Install @mastra/mcp
npm install @mastra/mcp

# 2. Add your API key to .env
FIRECRAWL_API_KEY=fc-your-key-here

# 3. The MCP client is already configured in src/mastra/mcp/firecrawl-mcp.ts
```

#### Mastra Docs MCP (dev-time)

Configured in `.mcp.json` and auto-spawned when you open the project in an MCP-compatible client (like Claude Code). Provides access to Mastra documentation without leaving your editor.

```jsonc
// .mcp.json
{
  "mcpServers": {
    "mastra": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@mastra/mcp-docs-server@latest"]
    }
  }
}
```

No install or API key required — it runs on demand via `npx`.

### Claude Code Skills

Mastra skills are installed via the Claude Code skills system and tracked in `skills-lock.json`. They provide interactive guidance for building with Mastra.

| Skill | Source | What it provides |
| --- | --- | --- |
| `mastra` | `mastra-ai/skills` (GitHub) | Framework guide, embedded docs lookup, remote docs, migration help, and provider registry |

To install/update:

```shell
# The skill is already installed (see skills-lock.json)
# To reinstall or update:
/install mastra-ai/skills
```

## Architecture

### Agents

| Agent | Purpose | Model |
| --- | --- | --- |
| Weather Agent | Fetches weather and suggests activities | [`zai-coding-plan/glm-5-turbo`](https://mastra.ai/models/providers/zai-coding-plan) |
| Theme Park Agent | Plans park days with live wait times, weather, and ticket purchasing | [`zai-coding-plan/glm-5-turbo`](https://mastra.ai/models/providers/zai-coding-plan) |

### Tools

| Tool | What it does |
| --- | --- |
| `findQueueTimesParkTool` | Looks up a park's ID on queue-times.com by name |
| `getQueueTimesLiveTool` | Fetches live ride wait times, sorted shortest first |
| `weatherTool` | Gets current weather via Open-Meteo API |
| `firecrawl_firecrawl_extract` | Scrapes park pages for hours, stats, and crowd forecasts (via MCP) |
| `mockChargeTool` | Simulates a Stripe-like card charge |
| `simulateTicketPurchaseTool` | Kicks off the ticket purchase workflow from the agent |

### Workflows

| Workflow | What it does |
| --- | --- |
| `weatherWorkflow` | Fetch weather → stream activity suggestions from the weather agent |
| `simulateTicketPurchaseWorkflow` | Build quote → suspend for approval → charge card → agent-generated visit brief (or cancel) |

### Example Conversations

**Live wait times:**
> "What are the wait times at Universal's Islands of Adventure?"
>
> The agent looks up the park, fetches live wait times, and presents them sorted by shortest wait.

**Weather-aware planning:**
> "Should I go to Universal Studios Orlando tomorrow?"
>
> The agent fetches weather for Orlando and factors conditions into its recommendations.

**Ticket purchase:**
> "Buy 3 tickets for Islands of Adventure on 2026-05-15"
>
> The agent starts the purchase workflow, returns a quote ($330 + fees), and informs you the purchase is pending approval. Once approved (via Studio's workflow runner), the card is charged and the agent streams a 3-point visit brief with arrival tips, must-do attractions, and things to avoid.

## Commit History

### `2962d42` Scaffold Mastra project with theme park agent
Initial project setup with two agents (weather + theme park), ride wait time tools from queue-times.com, a weather workflow, and scorers for evaluating weather agent responses.

### `2c34d8f` Add Firecrawl MCP integration and cross-tool support
Added `@mastra/mcp` with a Firecrawl MCP client so the theme park agent can scrape park pages (hours, stats, calendar, crowd forecasts). Also gave the agent access to `weatherTool` for weather-aware ride recommendations.

### `0a3d2ef` Add simulate ticket purchase workflow with suspend/resume approval
Built a three-step workflow using Mastra's human-in-the-loop pattern:
1. **build-quote** — calculates ticket price, quantity, and fees
2. **approve-purchase** — suspends the workflow for external approval (uses `suspend()`/`bail()`)
3. **charge-card** — runs `mockChargeTool` if approved, or returns cancellation if rejected

### `77b9dc6` Integrate ticket purchase workflow into theme park agent
Created `simulateTicketPurchaseTool` that starts the workflow from the agent via `mastra.getWorkflow()`. The tool handles both suspended (returns quote for review) and success (returns final result) states. Wired it into the theme park agent with instructions for when to trigger a purchase.

### `(next)` Add post-purchase visit brief step to ticket workflow
Added a `postPurchaseSummary` workflow step that runs after card charge. It retrieves the theme park agent from the Mastra instance, streams a 3-point visit brief (best arrival time, must-do attraction, things to avoid) using `agent.stream()` with `textStream.tee()` for both workflow writer and terminal output. Extended the workflow output schema with a `visitBrief` field and updated the tool to pass it through.

## Learn More

- [Mastra docs](https://mastra.ai/docs/)
- [Agents](https://mastra.ai/docs/agents/overview) / [Tools](https://mastra.ai/docs/agents/using-tools) / [Workflows](https://mastra.ai/docs/workflows/overview) / [Observability](https://mastra.ai/docs/observability/overview)
- [Mastra course](https://mastra.ai/learn) / [YouTube](https://youtube.com/@mastra-ai) / [Discord](https://discord.gg/BTYqqHKUrf)
