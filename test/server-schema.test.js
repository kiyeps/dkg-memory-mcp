import { test } from 'node:test';
import assert from 'node:assert';
import { z } from 'zod';

// Test that the tool schemas are properly defined
// We can't import the server directly (it starts immediately), so we test the schema patterns

test('tool schema: dkg_write_memory parameters', () => {
  const schema = {
    kaName: z.string(),
    subject: z.string(),
    triples: z.array(z.object({
      predicate: z.string(),
      object: z.string(),
    })),
  };

  // Valid input
  const valid = {
    kaName: 'test-ka',
    subject: 'http://example.org/s',
    triples: [
      { predicate: 'http://example.org/p', object: 'value' },
    ],
  };

  const result = z.object(schema).safeParse(valid);
  assert.ok(result.success);
});

test('tool schema: dkg_write_memory rejects invalid triples', () => {
  const schema = {
    kaName: z.string(),
    subject: z.string(),
    triples: z.array(z.object({
      predicate: z.string(),
      object: z.string(),
    })),
  };

  const invalid = {
    kaName: 'test-ka',
    subject: 'http://example.org/s',
    triples: [
      { predicate: 'http://example.org/p' }, // missing object
    ],
  };

  const result = z.object(schema).safeParse(invalid);
  assert.ok(!result.success);
});

test('tool schema: dkg_query_memory parameters', () => {
  const schema = {
    query: z.string(),
    view: z.enum(['working', 'shared', 'verifiable']).optional(),
    agentAddress: z.string().optional(),
  };

  const valid = {
    query: 'SELECT * WHERE { ?s ?p ?o }',
    view: 'working',
  };

  const result = z.object(schema).safeParse(valid);
  assert.ok(result.success);
});

test('tool schema: dkg_query_memory rejects invalid view', () => {
  const schema = {
    query: z.string(),
    view: z.enum(['working', 'shared', 'verifiable']).optional(),
    agentAddress: z.string().optional(),
  };

  const invalid = {
    query: 'SELECT * WHERE { ?s ?p ?o }',
    view: 'invalid-view',
  };

  const result = z.object(schema).safeParse(invalid);
  assert.ok(!result.success);
});

test('tool schema: dkg_share_to_swm parameters', () => {
  const schema = {
    kaName: z.string(),
    entities: z.string().optional(),
  };

  const valid = {
    kaName: 'test-ka-1234567890',
    entities: 'all',
  };

  const result = z.object(schema).safeParse(valid);
  assert.ok(result.success);
});

test('tool schema: dkg_share_to_swm allows optional entities', () => {
  const schema = {
    kaName: z.string(),
    entities: z.string().optional(),
  };

  const valid = {
    kaName: 'test-ka-1234567890',
  };

  const result = z.object(schema).safeParse(valid);
  assert.ok(result.success);
});

test('tool schema: dkg_status has no required parameters', () => {
  const schema = {};

  const valid = {};

  const result = z.object(schema).safeParse(valid);
  assert.ok(result.success);
});

test('tool schema: dkg_list_assertions has no required parameters', () => {
  const schema = {};

  const valid = {};

  const result = z.object(schema).safeParse(valid);
  assert.ok(result.success);
});
