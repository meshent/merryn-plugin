#!/usr/bin/env node
'use strict';
// Merryn session check-in: a Claude Code SessionStart hook.
//
// Reads the hook input on stdin (session_id, model, source, cwd; on resume, where there is no model, the transcript's
// last assistant turn names it), finds the Merryn instances this device registered as
// MCP servers (an entry of ~/.claude.json whose URL ends in /mcp and whose Authorization header is "Bearer ${VARIABLE}"),
// takes each token from the environment variable the registration names (the same one Claude Code reads when it
// connects), POSTs /api/v1/sessions/check-in with this session's harness, model, device and the models it can hand work
// to, and prints the instance's guidance as additionalContext so the session starts knowing its project, its routing
// and who else is online.
//
// Rules: finish within the hook's 10-second budget (node alone can take a second to start on Windows), say nothing on any failure, always exit 0, never write a token
// anywhere (not stdout, not stderr, not a file). Set MERRYN_CHECKIN=off to disable; MERRYN_CHECKIN_SERVERS to name the
// server(s) to check in with (comma-separated; default: every registration whose name, host or variable says merryn);
// MERRYN_CAN_DISPATCH to override the models this harness can dispatch to (default: fable, opus, sonnet, haiku, the
// families Claude Code's Agent tool accepts).

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const https = require('https');

const DEADLINE_MS = 8000;
const REQUEST_MS = 6000;
const DEFAULT_DISPATCH = ['fable', 'opus', 'sonnet', 'haiku'];

const deadline = setTimeout(() => process.exit(0), DEADLINE_MS);

function quit() { clearTimeout(deadline); process.exit(0); }

function osName() {
  const p = os.platform();
  const name = p === 'win32' ? 'Windows' : p === 'darwin' ? 'macOS' : p === 'linux' ? 'Linux' : p;
  return `${name} ${os.release()}`;
}

/** Every MCP registration of this device that points at a Merryn instance: {name, url, variable}. Tokens are not read here. */
function registrations(cwd) {
  let config;
  try { config = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude.json'), 'utf8')); } catch (_) { return []; }
  const entries = Object.assign({}, config && config.mcpServers);
  // Project-scoped registrations for this working directory count too.
  const projects = (config && config.projects) || {};
  for (const [dir, p] of Object.entries(projects)) {
    if (p && p.mcpServers && cwd && path.resolve(dir) === path.resolve(cwd)) Object.assign(entries, p.mcpServers);
  }
  const wanted = (process.env.MERRYN_CHECKIN_SERVERS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const out = [];
  for (const [name, e] of Object.entries(entries)) {
    if (!e || typeof e.url !== 'string') continue;
    let url;
    try { url = new URL(e.url); } catch (_) { continue; }
    if (!/\/mcp\/?$/.test(url.pathname)) continue;
    // A token travels only over TLS; plain http is accepted for this machine's own development hosts.
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.hostname.endsWith('.localhost');
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) continue;
    const header = (e.headers && (e.headers.Authorization || e.headers.authorization)) || '';
    const m = /^Bearer\s+\$\{([A-Za-z_][A-Za-z0-9_]*)\}\s*$/.exec(header);
    if (!m) continue;
    const variable = m[1];
    const merryn = wanted.length ? wanted.includes(name) : (/^merryn/i.test(name) || /merryn/i.test(url.hostname) || /^MERRYN_/.test(variable));
    if (!merryn) continue;
    if (out.some((r) => r.url.origin === url.origin && r.variable === variable)) continue;
    out.push({ name, url, variable });
  }
  return out;
}

/**
 * The session's model when the hook input does not carry one (Claude Code sends it on a fresh start, not on resume):
 * the model of the transcript's last assistant turn, then ANTHROPIC_MODEL, then the model chosen in settings.
 */
function sessionModel(hook) {
  if (typeof hook.model === 'string' && hook.model) return hook.model;
  const file = typeof hook.transcript_path === 'string' ? hook.transcript_path : '';
  if (file) {
    try {
      const size = fs.statSync(file).size;
      const length = Math.min(size, 2 * 1024 * 1024);
      const fd = fs.openSync(file, 'r');
      const buffer = Buffer.alloc(length);
      fs.readSync(fd, buffer, 0, length, size - length);
      fs.closeSync(fd);
      const lines = buffer.toString('utf8').split('\n');
      for (let i = lines.length - 1; i >= 0; i--) {
        if (!lines[i].includes('"assistant"')) continue;
        let entry;
        try { entry = JSON.parse(lines[i]); } catch (_) { continue; }
        const model = entry && entry.type === 'assistant' && entry.message && entry.message.model;
        if (typeof model === 'string' && /^claude-/.test(model)) return model;
      }
    } catch (_) { /* no transcript yet */ }
  }
  if (process.env.ANTHROPIC_MODEL) return process.env.ANTHROPIC_MODEL;
  try {
    const settings = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude', 'settings.json'), 'utf8'));
    if (settings && typeof settings.model === 'string' && settings.model) return settings.model;
  } catch (_) { /* no settings */ }
  return undefined;
}

function checkIn(reg, body) {
  return new Promise((resolve) => {
    const token = process.env[reg.variable];
    if (!token) return resolve(null);
    const target = new URL('/api/v1/sessions/check-in', reg.url.origin);
    const payload = JSON.stringify(body);
    const client = target.protocol === 'https:' ? https : http;
    let done = false;
    const finish = (value) => { if (!done) { done = true; resolve(value); } };
    const req = client.request(target, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json', authorization: `Bearer ${token}`, 'content-length': Buffer.byteLength(payload), 'user-agent': 'merryn-plugin check-in' },
      timeout: REQUEST_MS,
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (d) => { if (data.length < 65536) data += d; });
      res.on('end', () => {
        if (res.statusCode !== 200) return finish(null);
        try {
          const json = JSON.parse(data);
          finish(typeof json.guidance === 'string' && json.guidance.trim() ? json.guidance.trim() : null);
        } catch (_) { finish(null); }
      });
      res.on('error', () => finish(null));
    });
    req.on('timeout', () => { req.destroy(); finish(null); });
    req.on('error', () => finish(null));
    req.end(payload);
  });
}

async function main(input) {
  if (/^(0|off|false|no)$/i.test(process.env.MERRYN_CHECKIN || '')) return quit();
  let hook = {};
  try { hook = JSON.parse(input || '{}') || {}; } catch (_) { hook = {}; }
  const cwd = typeof hook.cwd === 'string' && hook.cwd ? hook.cwd : process.cwd();
  // Two registrations that send the same token to the same instance are one principal: check in once. (Compared in
  // memory only; the token is still never written anywhere.)
  const seen = new Set();
  const regs = registrations(cwd).filter((r) => {
    const key = `${r.url.origin}\n${process.env[r.variable] || r.variable}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!regs.length) return quit();
  const dispatch = (process.env.MERRYN_CAN_DISPATCH || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const body = {
    sessionId: typeof hook.session_id === 'string' ? hook.session_id : undefined,
    harness: 'claude-code',
    harnessVersion: process.env.CLAUDE_CODE_VERSION || undefined,
    model: sessionModel(hook),
    device: { name: os.hostname(), os: osName() },
    cwd,
    canDispatch: dispatch.length ? dispatch : DEFAULT_DISPATCH,
    source: 'hook',
  };
  const results = await Promise.all(regs.map((r) => checkIn(r, body)));
  const lines = results.filter(Boolean);
  if (lines.length) {
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: lines.join('\n\n') } }) + '\n');
  }
  quit();
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { input += d; });
process.stdin.on('end', () => { main(input).catch(quit); });
process.stdin.on('error', quit);
process.on('uncaughtException', quit);
process.on('unhandledRejection', quit);
