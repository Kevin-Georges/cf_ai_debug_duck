import { AIChatAgent } from "@cloudflare/ai-chat";
import { routeAgentRequest } from "agents";
import { createWorkersAI } from "workers-ai-provider";
import {
	convertToModelMessages,
	pruneMessages,
	stepCountIs,
	streamText,
	tool,
} from "ai";
import { z } from "zod";

export class ChatAgent extends AIChatAgent {
	async onChatMessage() {
		const workersai = createWorkersAI({ binding: this.env.AI });

		const result = streamText({
			model: workersai("@cf/meta/llama-4-scout-17b-16e-instruct"),
			system: `You are Debug Duck, a methodical rubber-duck debugging companion for embedded software engineers — particularly those working on automotive/CAN bus, real-time firmware, and microcontroller projects.

Your job is to help engineers diagnose problems through structured questioning, not to immediately propose fixes. Behave like a senior engineer doing a peer debug session.

When a user describes a symptom:
1. Restate the symptom precisely to confirm understanding.
2. Ask ONE targeted diagnostic question at a time. Prefer questions that rule out hypotheses (e.g. "is the failure timing-correlated with bus load?") over open questions.
3. Track what has been tried, observed, and ruled out across the conversation. If the user mentions they tried something, acknowledge it and don't suggest it again.
4. Once the search space is narrow, name the remaining hypotheses and the smallest experiment that would distinguish them.

Tone: technical, concise, no filler. Don't say "great question." Don't apologise. Treat the user as a peer. Avoid generic advice ("check your wiring") — always be specific to the data the user has shared.`,
			messages: pruneMessages({
				messages: await convertToModelMessages(this.messages),
				toolCalls: "before-last-2-messages",
			}),
			tools: {
				getWeather: tool({
					description: "Get the current weather for a city",
					inputSchema: z.object({
						city: z.string().describe("City name"),
					}),
					execute: async ({ city }) => {
						const conditions = ["sunny", "cloudy", "rainy"];
						const temp = Math.floor(Math.random() * 30) + 5;
						return {
							city,
							temperature: temp,
							condition:
								conditions[Math.floor(Math.random() * conditions.length)],
						};
					},
				}),

				getUserTimezone: tool({
					description: "Get the user's timezone from their browser",
					inputSchema: z.object({}),
				}),

				calculate: tool({
					description:
						"Perform a math calculation with two numbers. " +
						"Requires user approval for large numbers.",
					inputSchema: z.object({
						a: z.number().describe("First number"),
						b: z.number().describe("Second number"),
						operator: z
							.enum(["+", "-", "*", "/", "%"])
							.describe("Arithmetic operator"),
					}),
					needsApproval: async ({ a, b }) =>
						Math.abs(a) > 1000 || Math.abs(b) > 1000,
					execute: async ({ a, b, operator }) => {
						const ops: Record<string, (x: number, y: number) => number> = {
							"+": (x, y) => x + y,
							"-": (x, y) => x - y,
							"*": (x, y) => x * y,
							"/": (x, y) => x / y,
							"%": (x, y) => x % y,
						};
						if (operator === "/" && b === 0) {
							return { error: "Division by zero" };
						}
						return {
							expression: `${a} ${operator} ${b}`,
							result: ops[operator](a, b),
						};
					},
				}),
			},
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
