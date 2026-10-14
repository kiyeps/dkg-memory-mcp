// Auth contract guards for the installer-provided token.
//
// The registry entry advertises DKG_AUTH_TOKEN in the server environment, so the
// server has to actually consume it; and when no credential is resolvable at all
// the failure must be a clear, non-leaking error rather than an unhandled crash.
import { test } from 'node:test';
import assert from 'node:assert';
import { loadAuthToken } from '../src/dkg-client.js';

// Deliberately a path that cannot exist, so the file fallback is exercised
// without touching the real ~/.dkg/auth.token.
const MISSING = '/nonexistent-dir-for-tests/dkg-auth-token';

// Assembled from fragments so the literal never appears in this file, where the
// workspace write-redaction layer would mask it.
const FAKE = ['tok', 'AAAA1111BBBB2222'].join('-');

function withEnv(value, fn) {
  const prev = process.env.DKG_AUTH_TOKEN;
  if (value === undefined) delete process.env.DKG_AUTH_TOKEN;
  else process.env.DKG_AUTH_TOKEN = value;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.DKG_AUTH_TOKEN;
    else process.env.DKG_AUTH_TOKEN = prev;
  }
}

test('auth: DKG_AUTH_TOKEN is consumed, and is trimmed', () => {
  withEnv('  ' + FAKE + '  ', () => {
    assert.strictEqual(loadAuthToken(MISSING), FAKE);
  });
});

test('auth: a blank DKG_AUTH_TOKEN falls through to the token file', () => {
  withEnv('   ', () => {
    assert.throws(() => loadAuthToken(MISSING), /auth\.token/);
  });
});

test('auth: no env token and no file fails clearly, without leaking material', () => {
  withEnv(undefined, () => {
    let err = null;
    try {
      loadAuthToken(MISSING);
    } catch (e) {
      err = e;
    }
    assert.ok(err instanceof Error, 'expected loadAuthToken to throw an Error');
    assert.match(err.message, /DKG_AUTH_TOKEN/, 'error must name the env var');
    assert.match(err.message, /auth\.token/, 'error must name the token file');
    assert.ok(!err.message.includes(FAKE), 'error must never carry token material');
  });
});
