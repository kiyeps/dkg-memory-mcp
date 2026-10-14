// Live-node integration tests.
//
// These exercise a REAL DKG V10 node over HTTP. They are opt-in by nature:
// every test is skipped unless a node answers at DKG_BASE_URL, so ordinary CI
// (which has no DKG node) simply skips them instead of failing.
//
// Run locally against the node the README documents:
//   node --test test/integration.test.js
//
// Overrides:
//   DKG_BASE_URL            default http://127.0.0.1:9200
//   DKG_TEST_CONTEXT_GRAPH  default openclaw-curator (a v10 node refuses unknown
//                           context graphs, so the test reuses the graph the
//                           integration itself targets and namespaces every
//                           artifact it writes with an itest- prefix)
//
// Side effect: the round-trip test writes one Knowledge Asset into the context
// graph and shares it to Shared Working Memory. That is deliberate -- the point
// is to prove the write/share/read path end to end -- and it is why the suite
// is gated behind a reachable node.
import { test } from 'node:test';
import assert from 'node:assert';
import { DkgClient } from '../src/dkg-client.js';

const BASE = process.env.DKG_BASE_URL || 'http://127.0.0.1:9200';
const CONTEXT_GRAPH = process.env.DKG_TEST_CONTEXT_GRAPH || 'openclaw-curator';
const PRED = 'http://127.0.0.1:7878/itest';

async function nodeAvailable() {
  try {
    const res = await fetch(BASE + '/api/status', { signal: AbortSignal.timeout(3000) });
    // 200 (authorised) or 401 (reachable, auth-gated) both prove a node is there.
    return res.status > 0 && res.status < 500;
  } catch {
    return false;
  }
}

const hasNode = await nodeAvailable();
const skip = !hasNode && 'no local DKG node reachable at ' + BASE;

// The node returns binding values as plain strings holding the raw SPARQL
// literal (e.g. "\"itest-value\""), not { type, value } objects.
function unwrap(value) {
  return String(value && typeof value === 'object' ? value.value : value).replace(/^"|"$/g, '');
}

test('integration: node reports a v10 build', { skip }, async () => {
  const client = new DkgClient({ baseUrl: BASE, contextGraphId: CONTEXT_GRAPH });
  const status = await client.getStatus();
  assert.match(String(status.version || ''), /^10\./, 'expected a DKG v10 node');
  assert.ok(status.commit, 'node should report its build commit');
});

test('integration: unauthenticated query is rejected', { skip }, async () => {
  const res = await fetch(BASE + '/api/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sparql: 'SELECT * WHERE { ?s ?p ?o } LIMIT 1', view: 'shared-working-memory' }),
    signal: AbortSignal.timeout(10000),
  });
  assert.ok(res.status === 401 || res.status === 403,
    'an unauthenticated /api/query must be rejected, got HTTP ' + res.status);
});

test('integration: create -> share -> query round-trip', { skip }, async () => {
  const client = new DkgClient({ baseUrl: BASE, contextGraphId: CONTEXT_GRAPH });
  const suffix = String(process.pid) + '-' + Date.now().toString(36);
  const kaName = 'itest-mcp-' + suffix;
  const subject = 'urn:kiyeps:itest:mcp:' + suffix;
  const quads = [
    { subject, predicate: PRED, object: '"itest-value"' },
    { subject, predicate: PRED + 'Kind', object: '"itest"' },
  ];

  const created = await client.createKnowledgeAsset(kaName, quads);
  assert.ok(created && (created.assertionUri || created.name),
    'create should return an assertion reference, got: ' + JSON.stringify(created));

  const shared = await client.shareToSWM(kaName, { entities: 'all' });
  assert.strictEqual(shared.swmShared, true, 'share should report swmShared=true');

  const sparql = 'SELECT ?s ?o WHERE { BIND(<' + subject + '> AS ?s) ?s <' + PRED + '> ?o } LIMIT 5';
  const res = await client.query(sparql, { view: 'shared' });
  const bindings = res?.result?.bindings || res?.results?.bindings || [];
  assert.ok(bindings.length > 0, 'shared assertion must be queryable back');
  assert.strictEqual(unwrap(bindings[0].o), 'itest-value', 'value should round-trip');
});
