#!/usr/bin/env node
// Demo MCP client: drives the dkg-memory-mcp server over stdio and prints every exchange.
// Usage: node examples/demo-client.mjs
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const P = 'http://127.0.0.1:7878';
const BASE_KA = `mcp-demo-${Date.now().toString(36)}`;

const transport = new StdioClientTransport({ command: 'node', args: ['src/server.js'] });
const client = new Client({ name: 'dkg-demo-client', version: '1.0.0' });
await client.connect(transport);
const sv = client.getServerVersion();
console.log(`connected to ${sv.name} v${sv.version} over stdio`);

const tools = await client.listTools();
console.log(`tools exposed (${tools.tools.length}): ${tools.tools.map(t => t.name).join(', ')}`);

async function call(name, args) {
  console.log(`\n> tools/call ${name} ${JSON.stringify(args)}`);
  const res = await client.callTool({ name, arguments: args });
  const text = res.content?.[0]?.text ?? JSON.stringify(res);
  console.log(text.length > 900 ? text.slice(0, 900) + '\n...[truncated for the transcript]' : text);
  return text;
}

await call('dkg_status', {});

const written = await call('dkg_write_memory', {
  kaName: BASE_KA,
  subject: `urn:dkg:demo:${BASE_KA}`,
  triples: [
    { predicate: `${P}/title`, object: 'MCP demo note' },
    { predicate: `${P}/body`, object: 'dkg-memory-mcp writes verifiable memory over stdio JSON-RPC.' },
  ],
});

const fullName = (written.match(/Knowledge Asset "([^"]+)"/) || [])[1];
if (!fullName) {
  console.error('could not read the KA name from the write response');
  process.exit(1);
}

await call('dkg_share_to_swm', { kaName: fullName });
await call('dkg_query_memory', {
  query: `SELECT ?p ?o WHERE { <urn:dkg:demo:${BASE_KA}> ?p ?o } LIMIT 10`,
  view: 'shared',
});

await client.close();
