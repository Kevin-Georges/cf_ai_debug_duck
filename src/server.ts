import { AIChatAgent } from "@cloudflare/ai-chat";
import { routeAgentRequest } from "agents";
import { createWorkersAI } from "workers-ai-provider";
import {
	convertToModelMessages,
	pruneMessages,
	stepCountIs,
	streamText,
} from "ai";

const REPORT_PROMPT =
	"Produce a debug report for this session. Use this exact structure with markdown headers:\n" +
	"## Symptom\n## Observations\n## Hypotheses considered\n## Ruled out\n## Suggested next steps\n" +
	"Be terse. Bullet points where appropriate. No preamble.";

export class ChatAgent extends AIChatAgent {
	async onChatMessage() {
		const lastUserMsg = [...this.messages].reverse().find((m) => m.role === "user");
		const userText =
			lastUserMsg?.parts.find((p): p is { type: "text"; text: string } => p.type === "text")
				?.text.trim() ?? "";

		if (userText === "/reset") {
			await this.persistMessages([]);
			return new Response("Session reset. Describe a new symptom when you're ready.", {
				headers: { "Content-Type": "text/plain" },
			});
		}

		const messagesForLLM =
			userText === "/report" && lastUserMsg
				? this.messages.map((m) =>
						m === lastUserMsg
							? {
									...m,
									parts: m.parts.map((p) =>
										p.type === "text" ? { ...p, text: REPORT_PROMPT } : p
									),
								}
							: m
					)
				: this.messages;

		const workersai = createWorkersAI({ binding: this.env.AI });

		const result = streamText({
			model: workersai("@cf/meta/llama-3.3-70b-instruct-fp8-fast"),
			system: `You are Debug Duck, a methodical rubber-duck debugging companion for embedded software engineers — particularly those working on automotive/CAN bus, real-time firmware, and microcontroller projects.

Your job is to help engineers diagnose problems through structured questioning, not to immediately propose fixes. Behave like a senior engineer doing a peer debug session.

When a user describes a symptom:
1. Restate the symptom precisely to confirm understanding.
2. Ask ONE targeted diagnostic question at a time. Prefer questions that rule out hypotheses (e.g. "is the failure timing-correlated with bus load?") over open questions.
3. Track what has been tried, observed, and ruled out across the conversation. If the user mentions they tried something, acknowledge it and don't suggest it again.
4. Once the search space is narrow, name the remaining hypotheses and the smallest experiment that would distinguish them.

Tone: technical, concise, no filler. Don't say "great question." Don't apologise. Treat the user as a peer. Avoid generic advice ("check your wiring") — always be specific to the data the user has shared.`,
			messages: pruneMessages({
				messages: await convertToModelMessages(messagesForLLM),
				toolCalls: "before-last-2-messages",
			}),
			stopWhen: stepCountIs(5),
		});

		return result.toUIMessageStreamResponse();
	}
}

export default {
	async fetch(request: Request, env: Env) {
		return (
			(await routeAgentRequest(request, env)) ||
			new Response("Not found", { status: 404 })
		);
	},
} satisfies ExportedHandler<Env>;
