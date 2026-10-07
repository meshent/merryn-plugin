#!/usr/bin/env node
'use strict';
// Tests for plugins/merryn/hooks/check-in.js against a fake Merryn instance on localhost: the hook finds the device's
// registration, sends the check-in with the token from the named variable (and only there), prints the guidance as
// additionalContext, and is silent (exit 0, no output) when the variable is missing, the server refuses, or nothing
// answers. Run: node scripts/test-hook.js

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const HOOK = path.join(__dirname, '..', 'plugins', 'merryn', 'hooks', 'check-in.js');
const TOKEN = 'mk_test_' + 'not_a_real_token_value';

function home(servers) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'merryn-hook-'));
  fs.writeFileSync(path.join(dir, '.claude.json'), JSON.stringify({ mcpServers: servers }));
  return dir;
}

function run(homeDir, env, input) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, [HOOK], { env: { PATH: process.env.PATH, HOME: homeDir, USERPROFILE: homeDir, ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = ''; let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('close', (code) => resolve({ code, out, err, ms: Date.now() - started }));
    child.stdin.end(JSON.stringify(input));
  });
}

function server(handler) {
  return new Promise((resolve) => {
    const seen = [];
    const s = http.createServer((req, res) => {
      let body = '';
      req.on('data', (d) => { body += d; });
      req.on('end', () => { seen.push({ method: req.method, url: req.url, headers: req.headers, body: body ? JSON.parse(body) : null }); handler(req, res, seen[seen.length - 1]); });
    });
    s.listen(0, '127.0.0.1', () => resolve({ s, port: s.address().port, seen }));
  });
}

(async () => {
  const input = { session_id: 'sess-123', model: 'claude-fable-5-1', source: 'startup', cwd: process.cwd(), hook_event_name: 'SessionStart' };

  // 1. The happy path: one registration, the token present, guidance comes back as additionalContext.
  {
    const { s, port, seen } = await server((req, res) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ session: { id: 'x' }, guidance: 'Checked in with Merryn (Test) as claude-code:dev. Project: Test (test).' })); });
    const h = home({ 'merryn-test': { type: 'http', url: `http://127.0.0.1:${port}/mcp`, headers: { Authorization: 'Bearer ${MERRYN_TEST_TOKEN}' } }, other: { type: 'http', url: 'http://127.0.0.1:1/mcp', headers: { Authorization: 'Bearer ${OTHER_TOKEN}' } } });
    const r = await run(h, { MERRYN_TEST_TOKEN: TOKEN, OTHER_TOKEN: 'nope' }, input);
    s.close();
    assert.strictEqual(r.code, 0, 'exit 0');
    assert.strictEqual(r.err, '', 'nothing on stderr');
    const json = JSON.parse(r.out);
    assert.strictEqual(json.hookSpecificOutput.hookEventName, 'SessionStart');
    assert.strictEqual(json.hookSpecificOutput.additionalContext, 'Checked in with Merryn (Test) as claude-code:dev. Project: Test (test).');
    assert.strictEqual(seen.length, 1, 'exactly one check-in (the non-merryn registration is left alone)');
    const req = seen[0];
    assert.strictEqual(req.method, 'POST');
    assert.strictEqual(req.url, '/api/v1/sessions/check-in');
    assert.strictEqual(req.headers.authorization, `Bearer ${TOKEN}`, 'the token from the named variable');
    assert.strictEqual(req.body.sessionId, 'sess-123');
    assert.strictEqual(req.body.model, 'claude-fable-5-1');
    assert.strictEqual(req.body.harness, 'claude-code');
    assert.strictEqual(req.body.source, 'hook');
    assert.strictEqual(req.body.cwd, process.cwd());
    assert.deepStrictEqual(req.body.canDispatch, ['fable', 'opus', 'sonnet', 'haiku']);
    assert.ok(req.body.device && req.body.device.name === os.hostname() && /Windows|macOS|Linux/.test(req.body.device.os), 'device name and os');
    assert.ok(!r.out.includes(TOKEN) && !r.err.includes(TOKEN), 'the token is never printed');
    console.log('ok 1 check-in with guidance');
  }

  // 2. The variable is not set: no request is made, nothing is printed.
  {
    const { s, port, seen } = await server((req, res) => res.end('{}'));
    const h = home({ 'merryn-test': { type: 'http', url: `http://127.0.0.1:${port}/mcp`, headers: { Authorization: 'Bearer ${MERRYN_TEST_TOKEN}' } } });
    const r = await run(h, {}, input);
    s.close();
    assert.strictEqual(r.code, 0); assert.strictEqual(r.out, ''); assert.strictEqual(r.err, ''); assert.strictEqual(seen.length, 0);
    console.log('ok 2 silent without the variable');
  }

  // 3. The instance refuses (an older instance without the route, or a bad token): silent.
  {
    const { s, port } = await server((req, res) => { res.statusCode = 404; res.end('{"code":"not-found"}'); });
    const h = home({ 'merryn-test': { type: 'http', url: `http://127.0.0.1:${port}/mcp`, headers: { Authorization: 'Bearer ${MERRYN_TEST_TOKEN}' } } });
    const r = await run(h, { MERRYN_TEST_TOKEN: TOKEN }, input);
    s.close();
    assert.strictEqual(r.code, 0); assert.strictEqual(r.out, ''); assert.strictEqual(r.err, '');
    console.log('ok 3 silent on a refusal');
  }

  // 4. Nothing answers (a closed port, a dead instance): silent, and within the budget.
  {
    const h = home({ 'merryn-test': { type: 'http', url: 'http://127.0.0.1:9/mcp', headers: { Authorization: 'Bearer ${MERRYN_TEST_TOKEN}' } } });
    const r = await run(h, { MERRYN_TEST_TOKEN: TOKEN }, input);
    assert.strictEqual(r.code, 0); assert.strictEqual(r.out, ''); assert.strictEqual(r.err, '');
    assert.ok(r.ms < 3000, `finished in ${r.ms} ms`);
    console.log('ok 4 silent when nothing answers');
  }

  // 5. A server that never responds: the deadline ends the hook quietly, under 3 seconds.
  {
    const { s, port } = await server(() => { /* never answer */ });
    const h = home({ 'merryn-test': { type: 'http', url: `http://127.0.0.1:${port}/mcp`, headers: { Authorization: 'Bearer ${MERRYN_TEST_TOKEN}' } } });
    const r = await run(h, { MERRYN_TEST_TOKEN: TOKEN }, input);
    s.closeAllConnections ? s.closeAllConnections() : null; s.close();
    assert.strictEqual(r.code, 0); assert.strictEqual(r.out, '');
    assert.ok(r.ms < 3000, `finished in ${r.ms} ms`);
    console.log('ok 5 silent on a hang');
  }

  // 6. Opted out, malformed input, no registration file: silent.
  {
    const { s, port, seen } = await server((req, res) => res.end('{"guidance":"x"}'));
    const h = home({ 'merryn-test': { type: 'http', url: `http://127.0.0.1:${port}/mcp`, headers: { Authorization: 'Bearer ${MERRYN_TEST_TOKEN}' } } });
    let r = await run(h, { MERRYN_TEST_TOKEN: TOKEN, MERRYN_CHECKIN: 'off' }, input);
    assert.strictEqual(r.code, 0); assert.strictEqual(r.out, ''); assert.strictEqual(seen.length, 0);
    r = await new Promise((resolve) => { const c = spawn(process.execPath, [HOOK], { env: { PATH: process.env.PATH, HOME: h, USERPROFILE: h, MERRYN_TEST_TOKEN: TOKEN } }); let out = ''; c.stdout.on('data', (d) => { out += d; }); c.on('close', (code) => resolve({ code, out })); c.stdin.end('not json'); });
    assert.strictEqual(r.code, 0); assert.ok(r.out.length > 0, 'malformed input still checks in (a session without an id)');
    s.close();
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'merryn-hook-empty-'));
    r = await run(empty, { MERRYN_TEST_TOKEN: TOKEN }, input);
    assert.strictEqual(r.code, 0); assert.strictEqual(r.out, '');
    console.log('ok 6 opt-out, bad input, no registrations');
  }

  // 7. MERRYN_CHECKIN_SERVERS narrows to the named registration; MERRYN_CAN_DISPATCH overrides the list.
  {
    const a = await server((req, res) => res.end('{"guidance":"A"}'));
    const b = await server((req, res) => res.end('{"guidance":"B"}'));
    const h = home({ 'merryn-a': { type: 'http', url: `http://127.0.0.1:${a.port}/mcp`, headers: { Authorization: 'Bearer ${MERRYN_A_TOKEN}' } }, 'merryn-b': { type: 'http', url: `http://127.0.0.1:${b.port}/mcp`, headers: { Authorization: 'Bearer ${MERRYN_B_TOKEN}' } } });
    let r = await run(h, { MERRYN_A_TOKEN: TOKEN, MERRYN_B_TOKEN: TOKEN }, input);
    assert.strictEqual(JSON.parse(r.out).hookSpecificOutput.additionalContext.split('\n\n').sort().join('|'), 'A|B', 'both instances, both guidances');
    r = await run(h, { MERRYN_A_TOKEN: TOKEN, MERRYN_B_TOKEN: TOKEN, MERRYN_CHECKIN_SERVERS: 'merryn-b', MERRYN_CAN_DISPATCH: 'opus, haiku' }, input);
    assert.strictEqual(JSON.parse(r.out).hookSpecificOutput.additionalContext, 'B');
    assert.deepStrictEqual(b.seen[b.seen.length - 1].body.canDispatch, ['opus', 'haiku']);
    a.s.close(); b.s.close();
    console.log('ok 7 server selection and dispatch override');
  }

  console.log('all hook tests passed');
})().catch((e) => { console.error(e); process.exit(1); });
