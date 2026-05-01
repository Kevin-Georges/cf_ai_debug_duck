// Test script for Debug Duck agent
// Usage: node test-agent.mjs
import WebSocket from "ws";
import { randomBytes } from "crypto";

const BASE_URL = "wss://cf-ai-debug-duck.kevin-georges-dev.workers.dev";
const AGENT_ID = "test-session-1";
const WS_URL = `${BASE_URL}/agents/chat-agent/${AGENT_ID}`;

function nanoid(n = 8) {
  return randomBytes(n).toString("base64url").slice(0, n);
}

function makeUserMsg(text) {
  const id = nanoid();
  return { id, role: "user", content: text, parts: [{ type: "text", text }] };
}

function sendChat(ws, text) {
  const reqId = nanoid();
  const body = JSON.stringify({ messages: [makeUserMsg(text)] });
  ws.send(JSON.stringify({ id: reqId, type: "cf_agent_use_chat_request", init: { method: "POST", body } }));
  return reqId;
}

function sendSlash(ws, command) {
  return sendChat(ws, command);
}

function decodeStreamBody(body) {
  // The AI SDK emits newline-delimited JSON data-stream chunks.
  // Extract text-delta values and join them into a plain string.
  let text = "";
  for (const line of body.split("\n")) {
    const s = line.trim();
    if (!s) continue;
    try {
      const chunk = JSON.parse(s);
      if (chunk.type === "text-delta" && chunk.delta) text += chunk.delta;
    } catch { /* non-JSON line, skip */ }
  }
  return text;
}

async function waitForResponse(ws, reqId, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const textParts = [];
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for response to ${reqId}`)), timeoutMs);

    const handler = (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      if (msg.type === "cf_agent_use_chat_response" && msg.id === reqId) {
        if (msg.body?.trim()) {
          const decoded = decodeStreamBody(msg.body);
          if (decoded) textParts.push(decoded);
        }
        if (msg.done) {
          clearTimeout(timer);
          ws.off("message", handler);
          resolve(textParts.join(""));
        }
        if (msg.error) {
          clearTimeout(timer);
          ws.off("message", handler);
          reject(new Error(`Stream error: ${msg.body}`));
        }
      }
    };

    ws.on("message", handler);
  });
}

async function connectAndDrain(ws) {
  // Wait for initial cf_agent_chat_messages sync (or just a moment)
  return new Promise((resolve) => {
    const onFirst = (raw) => {
      try {
        const msg = JSON.parse(raw);
        if (msg.type === "cf_agent_chat_messages") {
          ws.off("message", onFirst);
          resolve();
        }
      } catch {}
    };
    ws.on("message", onFirst);
    // Fallback: resolve after 1s even if no message
    setTimeout(resolve, 1000);
  });
}

async function run() {
  console.log(`Connecting to ${WS_URL}...\n`);
  const ws = new WebSocket(WS_URL);

  await new Promise((res, rej) => {
    ws.on("open", res);
    ws.on("error", rej);
  });
  console.log("Connected.\n");

  await connectAndDrain(ws);

  // ── Message 1 ──────────────────────────────────────────────────────────────
  const msg1 = "Our SUFST VCU is occasionally dropping CAN frames at 1Mbps under heavy bus load. The fault is intermittent.";
  console.log(`[USER] ${msg1}\n`);
  const r1 = sendChat(ws, msg1);
  const reply1 = await waitForResponse(ws, r1);
  console.log(`[DUCK] ${reply1}\n`);

  // ── Message 2 ──────────────────────────────────────────────────────────────
  const msg2 = "I tried lowering the bitrate to 500kbps and the issue went away.";
  console.log(`[USER] ${msg2}\n`);
  const r2 = sendChat(ws, msg2);
  const reply2 = await waitForResponse(ws, r2);
  console.log(`[DUCK] ${reply2}\n`);

  // ── /report ────────────────────────────────────────────────────────────────
  console.log("[USER] /report\n");
  const r3 = sendSlash(ws, "/report");
  const reply3 = await waitForResponse(ws, r3);
  console.log(`[DUCK]\n${reply3}\n`);

  // ── /reset ─────────────────────────────────────────────────────────────────
  console.log("[USER] /reset\n");
  const r4 = sendSlash(ws, "/reset");
  const reply4 = await waitForResponse(ws, r4);
  console.log(`[DUCK] ${reply4}\n`);

  ws.close();
  console.log("Done.");
}

run().catch((err) => { console.error("FATAL:", err.message); process.exit(1); });
