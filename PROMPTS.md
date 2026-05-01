# PROMPTS.md

A record of every prompt used to build this project, in order.

---

## 1 — Scaffold

> I'm building cf_ai_debug_duck: a rubber-duck debugging companion for embedded engineers, submitted to Cloudflare's AI internship fast-track. Two-hour total budget.
>
> Scaffold the project by following Cloudflare's official tutorial at https://developers.cloudflare.com/agents/getting-started/build-a-chat-agent/ — use TypeScript and accept all defaults. The directory must be named exactly `cf_ai_debug_duck` (this becomes the GitHub repo name).
>
> After scaffolding:
> - Run `npm install` and `npx wrangler types` to confirm everything resolves
> - Initialize git locally but do NOT push yet
> - Show me the file tree of `src/` and tell me where the system prompt and message handler live
>
> Do not modify any source files in this step. Do not run `wrangler dev` yet. I want to verify the unmodified template builds before we customize.

Used `npm create cloudflare@latest` to scaffold a Hello World Worker, installed dependencies, fixed placeholder tokens in `wrangler.jsonc`, and confirmed `npx wrangler types` resolved cleanly.

---

## 2 — System prompt

> Find the agent's system prompt (likely a constant in src/server.ts or wherever the LLM is invoked) and replace it with exactly this: [Debug Duck system prompt]
>
> Don't change anything else — keep the chat UI, transport layer, and persistence exactly as the template provides. After the replacement, run `npx wrangler types` to confirm types still resolve. Tell me which file and which line range you changed.

Installed the chat agent packages (`agents`, `@cloudflare/ai-chat`, `ai`, `workers-ai-provider`, `zod`), created `src/server.ts` and `src/client.tsx` from the tutorial scaffold, and replaced the tutorial's placeholder system prompt with the Debug Duck prompt. Upgraded wrangler to v4 to resolve a zod peer-dependency conflict.

---

## 3 — Slash commands

> Add slash command handling to the agent's incoming message handler. Two commands, intercepted BEFORE the message is sent to the LLM:
>
> 1. `/reset` — clears the agent's conversation history and replies with exactly: "Session reset. Describe a new symptom when you're ready."
> 2. `/report` — does NOT short-circuit; instead, replaces the user's message with a structured report prompt before passing it to the LLM.
>
> Constraints: don't add new dependencies, don't refactor beyond what's necessary, match existing TypeScript style, run `npx wrangler types` after the change.

Inspected the `AIChatAgent` type definitions to find `persistMessages()` (persists to SQLite without re-triggering `onChatMessage`) and the `UIMessage` structure. Added 31 lines to `onChatMessage`: a message-text extractor, an early-return branch for `/reset`, and a message-substitution branch for `/report`.

---

## 4 — Local dev + integration test

> Start the dev server with `npx wrangler dev`. I'll handle any OAuth prompts in my browser if it appears.
>
> Once it's running, send these test messages to the agent in order: [SUFST CAN-bus symptom, bitrate follow-up, `/report`, `/reset`]
>
> Expected behavior: [per-message expectations listed]. If anything breaks, diagnose and fix it. If `@cf/meta/llama-3.3-70b-instruct-fp8-fast` is unavailable, fall back to `@cf/meta/llama-3.1-8b-instruct`.

Resolved four environment issues in sequence: wrong WebSocket URL path (camelCase → kebab-case routing), missing workers.dev subdomain (registered via Cloudflare API), miniflare AI binding proxy failure (fixed with `"remote": true` in `wrangler.jsonc`), and `llama-4-scout` internal errors (switched to `llama-3.3-70b-instruct-fp8-fast`). Also removed the tutorial's demo tools (`getWeather`, `getUserTimezone`, `calculate`) which were causing the model to refuse non-tool queries. All four test messages passed.

---

## 5 — Deploy

> Deploy to Cloudflare: `npx wrangler deploy`
>
> I'll handle any OAuth prompts in the browser. Once deployed, capture the `*.workers.dev` URL. Verify the deployed app by sending the same SUFST CAN-bus message — confirm the response is coherent and that `/report` works against the deployed instance.
>
> Report back with the live URL, whether deployed behavior matched local, and any production-only issues.

`npx wrangler deploy` succeeded on first run. Verified all four messages against the live WebSocket endpoint. No production-only issues; behavior matched local.

---

## 6 — How to test locally

> how can i test it on my computer

Explained the `test-agent.mjs` script (change `BASE_URL` to the production URL) and `wscat` as an alternative, with a note that a browser UI was the natural next step.

---

## 7 — Codebase explanation

> what does the code even do

Plain-language walkthrough: WebSocket transport, three message paths (slash commands vs LLM), Durable Object SQLite persistence, and how the system prompt shapes model behavior.

---

## 8 — GUI

> add a gui

Created `src/ui.ts` — a self-contained HTML/CSS/JS chat interface served from `GET /` with no build step. Handles WebSocket connection, streaming text-delta reassembly, minimal markdown rendering for `/report` output, auto-reconnect, and session persistence via `localStorage`. Wired it into the `fetch` handler in `server.ts` and deployed.

---

## 9 — Cost question

> does it cost anything to run

Broke down Workers AI (10k Neurons/day free, ~20–30 conversations before the cap), Durable Objects (free tier sufficient for personal use), and Workers compute (not a factor). Conclusion: free for casual personal use.

---

## 10 — Billing behaviour

> would it cut my use once i hit the cap or will it charge me

Workers AI stops responding at the cap — no silent charges. Charges require an explicit paid plan upgrade in the dashboard.

---

## 11 — Documentation + push

> Write the project documentation. [README.md and PROMPTS.md specs, then push to GitHub]

This file.

---

## Reflection

### What worked

<!-- TODO -->

### What didn't

<!-- TODO -->

### What I'd do differently with more time

<!-- TODO -->
