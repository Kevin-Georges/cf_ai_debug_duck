export const UI_HTML = /* html */`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Debug Duck</title>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg: #0d0d0d; --surface: #161616; --border: #262626;
  --text: #d4d4d4; --muted: #505050; --yellow: #e8a020;
  --user-bg: #1a2639; --user-border: #243550;
}
html, body { height: 100%; background: var(--bg); color: var(--text);
  font-family: Menlo, Consolas, 'Courier New', monospace; font-size: 14px; }
body { display: flex; flex-direction: column; height: 100dvh;
  max-width: 760px; margin: 0 auto; }

header { display: flex; align-items: center; gap: 10px;
  padding: 13px 20px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
header h1 { font-size: 15px; color: var(--yellow); font-weight: 600; }
header span.sub { font-size: 11px; color: var(--muted); margin-left: 6px; }
#dot { width: 7px; height: 7px; border-radius: 50%; background: var(--muted);
  margin-left: auto; transition: background .3s; flex-shrink: 0; }
#dot.on { background: #4ade80; }
#dot.err { background: #f87171; }

#log { flex: 1; overflow-y: auto; padding: 20px; display: flex;
  flex-direction: column; gap: 14px; }

.msg { max-width: 82%; padding: 10px 14px; border-radius: 8px;
  line-height: 1.7; word-break: break-word; white-space: pre-wrap; }
.msg.user { align-self: flex-end; background: var(--user-bg);
  border: 1px solid var(--user-border); color: #8ab4d8; white-space: pre-wrap; }
.msg.assistant { align-self: flex-start; background: var(--surface);
  border: 1px solid var(--border); }
.msg.assistant.thinking::after { content: '▋'; animation: blink 1s step-end infinite; }
@keyframes blink { 50% { opacity: 0; } }

.msg h2 { font-size: 12px; font-weight: 700; color: var(--yellow); letter-spacing: .05em;
  text-transform: uppercase; margin: 12px 0 4px; padding-bottom: 4px;
  border-bottom: 1px solid var(--border); }
.msg h2:first-child { margin-top: 0; }
.msg ul { padding-left: 18px; margin: 2px 0; }
.msg li { margin: 2px 0; }
.msg p { margin: 2px 0; }
.msg br + br { display: none; }

footer { border-top: 1px solid var(--border); padding: 10px 20px 14px;
  flex-shrink: 0; display: flex; flex-direction: column; gap: 8px; }
.cmds { display: flex; gap: 6px; }
.cmd { background: none; border: 1px solid var(--border); color: var(--muted);
  font-family: inherit; font-size: 11px; padding: 3px 10px; border-radius: 4px;
  cursor: pointer; transition: border-color .15s, color .15s; }
.cmd:hover { border-color: var(--yellow); color: var(--yellow); }
.row { display: flex; gap: 8px; }
textarea { flex: 1; background: var(--surface); border: 1px solid var(--border);
  border-radius: 6px; color: var(--text); font-family: inherit; font-size: 14px;
  padding: 8px 12px; resize: none; height: 40px; max-height: 120px;
  overflow-y: auto; outline: none; transition: border-color .15s; line-height: 1.5; }
textarea:focus { border-color: #363636; }
#btn { background: var(--yellow); border: none; border-radius: 6px; color: #000;
  font-family: inherit; font-size: 13px; font-weight: 700; padding: 0 18px;
  cursor: pointer; flex-shrink: 0; transition: opacity .15s; }
#btn:disabled { opacity: .3; cursor: default; }
</style>
</head>
<body>
<header>
  <span>🦆</span>
  <h1>Debug Duck</h1>
  <span class="sub">embedded debug companion</span>
  <div id="dot"></div>
</header>
<div id="log"></div>
<footer>
  <div class="cmds">
    <button class="cmd" onclick="send('/report')">/report</button>
    <button class="cmd" onclick="send('/reset')">/reset</button>
  </div>
  <div class="row">
    <textarea id="inp" placeholder="Describe a symptom…"></textarea>
    <button id="btn" onclick="go()" disabled>Send</button>
  </div>
</footer>
<script>
let sid = localStorage.getItem('duck_sid');
if (!sid) { sid = crypto.randomUUID().slice(0, 8); localStorage.setItem('duck_sid', sid); }

const proto = location.protocol === 'https:' ? 'wss' : 'ws';
const URL_WS = proto + '://' + location.host + '/agents/chat-agent/' + sid;

const log = document.getElementById('log');
const inp = document.getElementById('inp');
const btn = document.getElementById('btn');
const dot = document.getElementById('dot');

let ws, activeId, activeEl, buf = '';

function connect() {
  ws = new WebSocket(URL_WS);
  ws.onopen  = () => { dot.className = 'on';  btn.disabled = false; };
  ws.onclose = () => { dot.className = 'err'; btn.disabled = true; setTimeout(connect, 2000); };
  ws.onerror = () => { dot.className = 'err'; };
  ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data);

    if (msg.type === 'cf_agent_chat_messages') {
      log.innerHTML = '';
      for (const m of (msg.messages || [])) {
        if (m.role !== 'user' && m.role !== 'assistant') continue;
        const t = (m.parts || []).filter(p => p.type === 'text').map(p => p.text).join('') || m.content || '';
        bubble(m.role, t, true);
      }
      // re-attach active stream bubble if a reset cleared us mid-stream
      if (activeEl) log.appendChild(activeEl);
      scroll();
      return;
    }

    if (msg.type === 'cf_agent_use_chat_response' && msg.id === activeId) {
      if (msg.body) {
        for (const line of msg.body.split('\\n')) {
          try { const c = JSON.parse(line); if (c.type === 'text-delta') buf += c.delta; } catch {}
        }
        if (activeEl) { activeEl.innerHTML = render(buf); scroll(); }
      }
      if (msg.done || msg.error) {
        if (activeEl) activeEl.classList.remove('thinking');
        if (msg.error) bubble('assistant', '⚠ ' + (msg.body || 'stream error'), true);
        activeId = activeEl = null; buf = '';
      }
    }
  };
}

function send(text) {
  text = text.trim();
  if (!text || !ws || ws.readyState !== 1) return;
  const rid = crypto.randomUUID().slice(0, 8);
  bubble('user', text, true);
  activeId = rid; buf = '';
  activeEl = bubble('assistant', '');
  activeEl.classList.add('thinking');
  ws.send(JSON.stringify({
    id: rid, type: 'cf_agent_use_chat_request',
    init: { method: 'POST', body: JSON.stringify({
      messages: [{ id: rid, role: 'user', content: text, parts: [{ type: 'text', text }] }]
    })}
  }));
  scroll();
}

function go() { send(inp.value); inp.value = ''; inp.style.height = '40px'; }

function bubble(role, text, parsed) {
  const el = document.createElement('div');
  el.className = 'msg ' + role;
  if (parsed && text) el.innerHTML = render(text);
  log.appendChild(el);
  scroll();
  return el;
}

function scroll() { log.scrollTop = log.scrollHeight; }

function render(raw) {
  if (!raw) return '';
  const lines = raw.split('\\n');
  const out = [];
  let list = false;
  for (const line of lines) {
    const h = line.match(/^## (.+)/);
    const li = line.match(/^\\* (.+)/);
    if (h)  { if (list) { out.push('</ul>'); list = false; } out.push('<h2>' + x(h[1]) + '</h2>'); }
    else if (li) { if (!list) { out.push('<ul>'); list = true; } out.push('<li>' + x(li[1]) + '</li>'); }
    else    { if (list) { out.push('</ul>'); list = false; } out.push(line ? '<p>' + x(line) + '</p>' : '<br>'); }
  }
  if (list) out.push('</ul>');
  return out.join('');
}

function x(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

inp.addEventListener('input', () => {
  inp.style.height = '40px';
  inp.style.height = Math.min(inp.scrollHeight, 120) + 'px';
});
inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(); } });

connect();
</script>
</body>
</html>`;
