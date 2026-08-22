import { test } from 'node:test';
import assert from 'node:assert';
import { redact, redactQuads } from '../src/redaction.js';

test('redact: empty string', () => {
  const result = redact('');
  assert.strictEqual(result.text, '');
  assert.strictEqual(result.count, 0);
});

test('redact: no secrets', () => {
  const text = 'Hello world, this is a normal message';
  const result = redact(text);
  assert.strictEqual(result.text, text);
  assert.strictEqual(result.count, 0);
});

test('redact: hex private key', () => {
  const text = 'My private key is 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  const result = redact(text);
  assert.ok(result.text.includes('[REDACTED:hex-private-key]'));
  assert.strictEqual(result.count, 1);
});

test('redact: API token with prefix', () => {
  const text = 'Using sk-test_1234567890abcdef here';
  const result = redact(text);
  assert.ok(result.text.includes('[REDACTED:api-token]'));
  assert.strictEqual(result.count, 1);
});

test('redact: GitHub token', () => {
  const text = 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcd';
  const result = redact(text);
  assert.ok(result.text.includes('[REDACTED:api-token]'));
  assert.strictEqual(result.count, 1);
});

test('redact: secret line pattern', () => {
  const text = 'secret=mySecretValue123';
  const result = redact(text);
  assert.ok(result.text.includes('[REDACTED:secret-line]'));
  assert.strictEqual(result.count, 1);
});

test('redact: multiple secrets', () => {
  const text = 'Key: 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef and sk-test_1234567890abcdef and secret=myval';
  const result = redact(text);
  // hex key → api-token → secret-line = 3
  assert.strictEqual(result.count, 3);
  assert.ok(result.text.includes('[REDACTED:hex-private-key]'));
  assert.ok(result.text.includes('[REDACTED:api-token]'));
  assert.ok(result.text.includes('[REDACTED:secret-line]'));
});

test('redactQuads: empty array', () => {
  const result = redactQuads([]);
  assert.deepStrictEqual(result.quads, []);
  assert.strictEqual(result.redactedCount, 0);
});

test('redactQuads: no secrets in objects', () => {
  const quads = [
    { subject: 'http://example.org/s1', predicate: 'http://example.org/p1', object: 'normal value' },
  ];
  const result = redactQuads(quads);
  assert.strictEqual(result.quads[0].object, 'normal value');
  assert.strictEqual(result.redactedCount, 0);
});

test('redactQuads: secret in object value', () => {
  const quads = [
    { subject: 'http://example.org/s1', predicate: 'http://example.org/p1', object: 'my sk-test_1234567890abcdef key' },
  ];
  const result = redactQuads(quads);
  assert.ok(result.quads[0].object.includes('[REDACTED:'));
  assert.strictEqual(result.redactedCount, 1);
});

test('redactQuads: multiple quads with secrets', () => {
  const quads = [
    { subject: 's1', predicate: 'p1', object: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' },
    { subject: 's2', predicate: 'p2', object: 'normal' },
    { subject: 's3', predicate: 'p3', object: 'secret=abc123' },
  ];
  const result = redactQuads(quads);
  assert.strictEqual(result.redactedCount, 2);
  assert.ok(result.quads[0].object.includes('[REDACTED:'));
  assert.strictEqual(result.quads[1].object, 'normal');
  assert.ok(result.quads[2].object.includes('[REDACTED:'));
});
