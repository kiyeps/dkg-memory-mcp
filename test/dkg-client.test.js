import { test } from 'node:test';
import assert from 'node:assert';
import {
  escapeSparqlLiteral,
  sparqlLiteral,
  validateSubject,
  buildQuad,
  buildQuadsFromMap,
  freshKAName,
} from '../src/dkg-client.js';

test('escapeSparqlLiteral: basic string', () => {
  const result = escapeSparqlLiteral('hello world');
  assert.strictEqual(result, 'hello world');
});

test('escapeSparqlLiteral: double quotes', () => {
  const result = escapeSparqlLiteral('say "hello"');
  assert.strictEqual(result, 'say \\"hello\\"');
});

test('escapeSparqlLiteral: backslashes', () => {
  const result = escapeSparqlLiteral('path\\to\\file');
  assert.strictEqual(result, 'path\\\\to\\\\file');
});

test('escapeSparqlLiteral: newlines and tabs', () => {
  const result = escapeSparqlLiteral('line1\nline2\ttab');
  assert.strictEqual(result, 'line1\\nline2\\ttab');
});

test('escapeSparqlLiteral: carriage return', () => {
  const result = escapeSparqlLiteral('line1\rline2');
  assert.strictEqual(result, 'line1\\rline2');
});

test('sparqlLiteral: wraps in double quotes', () => {
  const result = sparqlLiteral('test value');
  assert.strictEqual(result, '"test value"');
});

test('sparqlLiteral: escapes and wraps', () => {
  const result = sparqlLiteral('say "hi"');
  assert.strictEqual(result, '"say \\"hi\\""');
});

test('validateSubject: valid subject', () => {
  const result = validateSubject('http://example.org/subject');
  assert.strictEqual(result, null);
});

test('validateSubject: reserved urn:dkg:file prefix', () => {
  const result = validateSubject('urn:dkg:file:123');
  assert.ok(result.includes('reserved prefix'));
});

test('validateSubject: reserved urn:dkg:extraction prefix', () => {
  const result = validateSubject('urn:dkg:extraction:abc');
  assert.ok(result.includes('reserved prefix'));
});

test('buildQuad: creates valid quad', () => {
  const quad = buildQuad('http://example.org/s', 'http://example.org/p', 'value');
  assert.strictEqual(quad.subject, 'http://example.org/s');
  assert.strictEqual(quad.predicate, 'http://example.org/p');
  assert.strictEqual(quad.object, '"value"');
});

test('buildQuad: escapes object value', () => {
  const quad = buildQuad('http://example.org/s', 'http://example.org/p', 'say "hi"');
  assert.strictEqual(quad.object, '"say \\"hi\\""');
});

test('buildQuad: rejects reserved subject', () => {
  assert.throws(() => {
    buildQuad('urn:dkg:file:123', 'http://example.org/p', 'value');
  }, /reserved prefix/);
});

test('buildQuadsFromMap: creates quads from map', () => {
  const quads = buildQuadsFromMap(
    'http://example.org/s',
    'http://example.org/pred/',
    { name: 'Alice', age: '30' }
  );
  assert.strictEqual(quads.length, 2);
  assert.strictEqual(quads[0].subject, 'http://example.org/s');
  assert.strictEqual(quads[0].predicate, 'http://example.org/pred/name');
  assert.strictEqual(quads[0].object, '"Alice"');
  assert.strictEqual(quads[1].predicate, 'http://example.org/pred/age');
  assert.strictEqual(quads[1].object, '"30"');
});

test('buildQuadsFromMap: rejects reserved subject', () => {
  assert.throws(() => {
    buildQuadsFromMap('urn:dkg:extraction:abc', 'http://example.org/pred/', { key: 'value' });
  }, /reserved prefix/);
});

test('freshKAName: adds timestamp suffix', () => {
  const before = Date.now();
  const name = freshKAName('test-ka');
  const after = Date.now();

  assert.ok(name.startsWith('test-ka-'));
  const timestamp = parseInt(name.split('-').pop(), 10);
  assert.ok(timestamp >= before && timestamp <= after);
});

test('freshKAName: different calls produce different names', () => {
  const name1 = freshKAName('ka');
  // Small delay to ensure different timestamp
  const start = Date.now();
  while (Date.now() === start) { /* wait */ }
  const name2 = freshKAName('ka');

  assert.notStrictEqual(name1, name2);
});
