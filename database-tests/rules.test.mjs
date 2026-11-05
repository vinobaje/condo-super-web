// Tests for database.rules.json (website chat), against the Realtime Database emulator.
// The calls are the REST calls chat-widget.js and admin-chat.html make.
//
//   cd database-tests && npm test
//
// Needs Java and the Firebase CLI. Uses a demo- project, so nothing reaches production.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const HOST = process.env.FIREBASE_DATABASE_EMULATOR_HOST || '127.0.0.1:9000';
const NS = 'demo-condo-chat-default-rtdb';
const PROJECT = 'demo-condo-chat';

const VISITOR_A = 'anonVisitorAAAAAAAAAAAAAAAA1';
const VISITOR_B = 'anonVisitorBBBBBBBBBBBBBBBB2';
const AGENT = 'agentUid0000000000000000000A';
const STRANGER = 'signedInNotAnAgent0000000001'; // any email/password account (sign-up is open)

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function token(uid, provider) {
  const now = Math.floor(Date.now() / 1000);
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
    iss: `https://securetoken.google.com/${PROJECT}`, aud: PROJECT,
    sub: uid, user_id: uid, iat: now, exp: now + 3600, auth_time: now,
    firebase: { sign_in_provider: provider, identities: {} },
  })}.`;
}
const AS = {
  nobody: null,
  visitorA: token(VISITOR_A, 'anonymous'),
  visitorB: token(VISITOR_B, 'anonymous'),
  agent: token(AGENT, 'password'),
  stranger: token(STRANGER, 'password'),
};

async function call(who, method, path, data, query = '') {
  const auth = who === 'owner' ? '' : AS[who] ? `&auth=${encodeURIComponent(AS[who])}` : '';
  const headers = { 'Content-Type': 'application/json' };
  if (who === 'owner') headers.Authorization = 'Bearer owner';
  const res = await fetch(`http://${HOST}/${path}.json?ns=${NS}${auth}${query ? '&' + query : ''}`, {
    method, headers, body: data === undefined ? undefined : JSON.stringify(data),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}
const ok = async (p) => { const r = await p; assert.equal(r.status, 200, JSON.stringify(r.body)); return r.body; };
const denied = async (p) => { const r = await p; assert.equal(r.status, 401, `expected denied, got ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`); };

const header = (extra = {}) => ({
  visitorName: 'Pat Visitor', visitorEmail: 'pat@example.com', page: 'https://condosuper.app/',
  startedAt: new Date().toISOString(), status: 'open', unreadByAgent: true,
  escalatedFrom: 'ai', escalateReason: 'manual', ...extra,
});
const msg = (extra = {}) => ({ text: 'Hello', sender: 'visitor', senderName: 'Pat Visitor', timestamp: new Date().toISOString(), ...extra });

before(async () => {
  // Sent as is: the rules file has comments, which the RTDB rules language allows.
  const rules = readFileSync(process.env.RULES_FILE || new URL('../database.rules.json', import.meta.url), 'utf8');
  const res = await fetch(`http://${HOST}/.settings/rules.json?ns=${NS}`, { method: 'PUT', headers: { Authorization: 'Bearer owner' }, body: rules });
  assert.equal(res.status, 200, await res.text());
  await call('owner', 'PUT', '', {
    chatAgents: { [AGENT]: true },
    chats: {
      // A chat from the current widget (before this change): key isn't a uid.
      visitor_1730000000000_abc123def: { ...header({ visitorName: 'Old Session' }), messages: { m1: msg() } },
    },
  });
});

test('nobody signed in can list, read, write or delete chats', async () => {
  await denied(call('nobody', 'GET', 'chats'));
  await denied(call('nobody', 'GET', 'chats', undefined, 'shallow=true'));
  await denied(call('nobody', 'GET', 'chats/visitor_1730000000000_abc123def'));
  await denied(call('nobody', 'GET', 'chats/visitor_1730000000000_abc123def/messages'));
  await denied(call('nobody', 'PATCH', 'chats/visitor_1730000000000_abc123def', { status: 'open' }));
  await denied(call('nobody', 'PUT', 'chats/newSession', header()));
  await denied(call('nobody', 'DELETE', 'chats/visitor_1730000000000_abc123def'));
  await denied(call('nobody', 'GET', 'chatAgents'));
});

test('a visitor opens their own chat and talks in it (widget flow)', async () => {
  await ok(call('visitorA', 'PATCH', `chats/${VISITOR_A}`, header()));
  await ok(call('visitorA', 'POST', `chats/${VISITOR_A}/messages`, msg({ text: 'What does it cost?' })));
  await ok(call('visitorA', 'POST', `chats/${VISITOR_A}/messages`, msg({ text: 'Plans start free.', sender: 'agent', senderName: 'Condo Super AI', isAiMessage: true })));
  await ok(call('visitorA', 'POST', `chats/${VISITOR_A}/messages`, msg({ text: 'Thanks' })));
  await ok(call('visitorA', 'PATCH', `chats/${VISITOR_A}`, { lastMessage: { text: 'Thanks', timestamp: new Date().toISOString(), sender: 'visitor' }, unreadByAgent: true }));
  const msgs = await ok(call('visitorA', 'GET', `chats/${VISITOR_A}/messages`));
  assert.equal(Object.keys(msgs).length, 3);
  // Escalating again after a reload keeps the messages.
  await ok(call('visitorA', 'PATCH', `chats/${VISITOR_A}`, header({ escalateReason: 'ai' })));
  assert.equal(Object.keys(await ok(call('visitorA', 'GET', `chats/${VISITOR_A}/messages`))).length, 3);
});

test('a visitor cannot overstep in their own chat', async () => {
  await denied(call('visitorA', 'GET', 'chats'));
  await denied(call('visitorA', 'GET', 'chats', undefined, 'shallow=true'));
  await denied(call('visitorA', 'PUT', `chats/${VISITOR_A}`, header()));             // whole-node overwrite
  await denied(call('visitorA', 'DELETE', `chats/${VISITOR_A}`));
  await denied(call('visitorA', 'PUT', `chats/${VISITOR_A}/status`, 'closed'));
  await denied(call('visitorA', 'PUT', `chats/${VISITOR_A}/unreadByAgent`, false));
  await denied(call('visitorA', 'PUT', `chats/${VISITOR_A}/unreadByVisitor`, true));
  await denied(call('visitorA', 'PATCH', `chats/${VISITOR_A}`, { isVip: true }));    // unknown field
  await denied(call('visitorA', 'PUT', `chats/${VISITOR_A}/lastMessage`, { text: 'x', timestamp: 't', sender: 'agent' }));
  await denied(call('visitorA', 'POST', `chats/${VISITOR_A}/messages`, msg({ sender: 'agent', senderName: 'Vino' }))); // posing as a person
  const msgs = await ok(call('visitorA', 'GET', `chats/${VISITOR_A}/messages`));
  const firstId = Object.keys(msgs)[0];
  await denied(call('visitorA', 'PUT', `chats/${VISITOR_A}/messages/${firstId}`, msg({ text: 'edited' })));
  await denied(call('visitorA', 'DELETE', `chats/${VISITOR_A}/messages/${firstId}`));
  await denied(call('visitorA', 'GET', 'chatAgents'));
  await denied(call('visitorA', 'PUT', `chatAgents/${VISITOR_A}`, true));
});

test('the data checks still hold', async () => {
  await denied(call('visitorA', 'POST', `chats/${VISITOR_A}/messages`, msg({ text: 'x'.repeat(2001) })));
  await ok(call('visitorA', 'POST', `chats/${VISITOR_A}/messages`, msg({ text: 'x'.repeat(2000) })));
  await denied(call('visitorA', 'POST', `chats/${VISITOR_A}/messages`, msg({ extra: 'field' })));
  await denied(call('visitorA', 'POST', `chats/${VISITOR_A}/messages`, { text: 'no sender', timestamp: 't' }));
  await denied(call('visitorA', 'PATCH', `chats/${VISITOR_A}`, { visitorEmail: 'not an email' }));
  await denied(call('visitorA', 'PATCH', `chats/${VISITOR_A}`, { visitorName: 'n'.repeat(101) }));
  await denied(call('visitorA', 'PATCH', `chats/${VISITOR_A}`, { page: 'p'.repeat(2049) }));
  // A new chat needs name, email and status.
  await denied(call('visitorB', 'PATCH', `chats/${VISITOR_B}`, { visitorName: 'B', status: 'open' }));
  // Messages can't come before the chat exists.
  await denied(call('visitorB', 'POST', `chats/${VISITOR_B}/messages`, msg()));
});

test("a visitor can't see or touch anyone else's chat", async () => {
  await denied(call('visitorB', 'GET', `chats/${VISITOR_A}`));
  await denied(call('visitorB', 'GET', `chats/${VISITOR_A}/messages`));
  await denied(call('visitorB', 'PATCH', `chats/${VISITOR_A}`, header({ visitorEmail: 'evil@example.com' })));
  await denied(call('visitorB', 'POST', `chats/${VISITOR_A}/messages`, msg()));
  await denied(call('visitorB', 'DELETE', `chats/${VISITOR_A}`));
  await denied(call('visitorB', 'GET', 'chats/visitor_1730000000000_abc123def'));
  // Keys other than your own uid, e.g. a key built to break the agent page's HTML.
  await denied(call('visitorB', 'PATCH', "chats/x');alert(1);('", header()));
});

test('a signed-in account that is not a chat agent gets nothing', async () => {
  await denied(call('stranger', 'GET', 'chats'));
  await denied(call('stranger', 'GET', `chats/${VISITOR_A}`));
  await denied(call('stranger', 'POST', `chats/${VISITOR_A}/messages`, msg({ sender: 'agent' })));
  await denied(call('stranger', 'PUT', `chats/${VISITOR_A}/status`, 'closed'));
  await denied(call('stranger', 'DELETE', `chats/${VISITOR_A}`));
});

test('a chat agent lists, answers, closes and deletes chats (agent page flow)', async () => {
  const all = await ok(call('agent', 'GET', 'chats'));
  assert.ok(all[VISITOR_A] && all.visitor_1730000000000_abc123def);
  await ok(call('agent', 'GET', 'chats', undefined, 'shallow=true'));
  await ok(call('agent', 'PUT', `chats/${VISITOR_A}/unreadByAgent`, false));
  await ok(call('agent', 'POST', `chats/${VISITOR_A}/messages`, msg({ text: 'Hi Pat!', sender: 'agent', senderName: 'Vino' })));
  await ok(call('agent', 'PATCH', `chats/${VISITOR_A}`, { lastMessage: { text: 'Hi Pat!', timestamp: new Date().toISOString(), sender: 'agent' }, unreadByVisitor: true }));
  // The visitor sees the reply.
  const msgs = await ok(call('visitorA', 'GET', `chats/${VISITOR_A}/messages`));
  assert.ok(Object.values(msgs).some((m) => m.sender === 'agent' && !m.isAiMessage && m.text === 'Hi Pat!'));
  await ok(call('agent', 'PUT', `chats/${VISITOR_A}/status`, 'closed'));
  // The visitor can reopen a closed chat by escalating again.
  await ok(call('visitorA', 'PATCH', `chats/${VISITOR_A}`, header()));
  // Chats from before the change still work for the agent.
  await ok(call('agent', 'POST', 'chats/visitor_1730000000000_abc123def/messages', msg({ sender: 'agent', senderName: 'Vino' })));
  await ok(call('agent', 'DELETE', 'chats/visitor_1730000000000_abc123def'));
  // Agents still can't change who is an agent.
  await denied(call('agent', 'GET', 'chatAgents'));
  await denied(call('agent', 'PUT', `chatAgents/${STRANGER}`, true));
});
