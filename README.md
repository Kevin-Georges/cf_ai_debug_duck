# cf_ai_debug_duck

A rubber-duck debugging companion for embedded engineers, running on Cloudflare's edge.

---

## Live demo

**[https://cf-ai-debug-duck.kevin-georges-dev.workers.dev](https://cf-ai-debug-duck.kevin-georges-dev.workers.dev)**

---

## Why this exists

<!-- TODO: replace with my own paragraph -->

---

## How it maps to the fast-track requirements

| Requirement | Implementation |
|---|---|
| LLM | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` via Workers AI binding |
| Workflow / coordination | Cloudflare Agents SDK (`AIChatAgent`) + Durable Objects for turn management |
| User input | WebSocket chat — `routeAgentRequest` from the `agents` package ([src/server.ts](src/server.ts)) |
| Memory / state | Durable Object-backed SQLite conversation history, persisted across reconnects ([src/server.ts](src/server.ts)) |

---

## Run locally

```bash
git clone https://github.com/Kevin-Georges/cf_ai_debug_duck.git
cd cf_ai_debug_duck
npm install
npx wrangler login
npx wrangler dev
```

Then open [http://localhost:8787](http://localhost:8787).

---

## Deploy

```bash
npx wrangler deploy
```

---

## Slash commands

| Command | What it does |
|---|---|
| `/report` | Generates a structured markdown debug report for the current session (Symptom / Observations / Hypotheses / Ruled out / Next steps) |
| `/reset` | Clears the conversation history and starts a fresh session |

---

## What's where

- **[src/server.ts](src/server.ts)** — the entire backend: `ChatAgent` class, system prompt, slash-command interception, AI call, and HTTP/WebSocket routing
- **[src/ui.ts](src/ui.ts)** — self-contained chat UI served as HTML from `GET /`; handles WebSocket connection, streaming response rendering, and markdown display
- **[src/client.tsx](src/client.tsx)** — React/hooks version of the chat UI from the Cloudflare tutorial (not yet wired up; kept for reference)
