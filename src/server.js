#!/usr/bin/env node
// DKG Memory MCP Server — exposes DKG v10 three-layer verifiable memory as MCP tools.
// Transport: stdio (for Claude Desktop, Cursor, generic MCP clients).

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { DkgClient, buildQuad, buildQuadsFromMap, freshKAName, sparqlLiteral } from './dkg-client.js';
import { redact, redactQuads } from './redaction.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DKG_API_URL = process.env.DKG_API_URL || 'http://127.0.0.1:9200';
const DKG_CONTEXT_GRAPH = process.env.DKG_CONTEXT_GRAPH || 'openclaw-curator';
const DKG_AGENT_ADDRESS = process.env.DKG_AGENT_ADDRESS || '';

// ---------------------------------------------------------------------------
// Initialize DKG client
// ---------------------------------------------------------------------------

const dkg = new DkgClient({
  baseUrl: DKG_API_URL,
  contextGraphId: DKG_CONTEXT_GRAPH,
});

// ---------------------------------------------------------------------------
// MCP Server setup
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: 'dkg-memory-mcp',
  version: '1.0.0',
});

// ---------------------------------------------------------------------------
// Tool: dkg_status
// ---------------------------------------------------------------------------

server.tool(
  'dkg_status',
  'Check DKG node health and identity info',
  {},
  async () => {
    try {
      const status = await dkg.getStatus();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(status, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: dkg_write_memory
// ---------------------------------------------------------------------------

server.tool(
  'dkg_write_memory',
  'Write quads to a named Knowledge Asset in Working Memory. Automatically adds timestamp suffix to avoid reuse conflicts.',
  {
    kaName: z.string().describe('Base name for the Knowledge Asset (timestamp suffix added automatically)'),
    subject: z.string().describe('Subject IRI (must not match urn:dkg:file:* or urn:dkg:extraction:*)'),
    triples: z.array(z.object({
      predicate: z.string().describe('Predicate IRI'),
      object: z.string().describe('Object value (will be wrapped as SPARQL literal)'),
    })).describe('Array of predicate-object pairs'),
  },
  async ({ kaName, subject, triples }) => {
    try {
      // Build quads
      const quads = triples.map(t => buildQuad(subject, t.predicate, t.object));

      // Redact secrets before sending
      const { quads: safeQuads, redactedCount } = redactQuads(quads);
      if (redactedCount > 0) {
        console.error(`[dkg-memory-mcp] Redacted ${redactedCount} secret(s) from quads`);
      }

      // Fresh KA name with timestamp
      const fullName = freshKAName(kaName);

      // Create KA
      const result = await dkg.createKnowledgeAsset(fullName, safeQuads);

      return {
        content: [
          {
            type: 'text',
            text: `Created Knowledge Asset "${fullName}" with ${safeQuads.length} quad(s).\n\nResult: ${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: dkg_query_memory
// ---------------------------------------------------------------------------

server.tool(
  'dkg_query_memory',
  'Run a SPARQL query against a DKG memory view (working|shared|verifiable)',
  {
    query: z.string().describe('SPARQL query string'),
    view: z.enum(['working', 'shared', 'verifiable']).optional().describe('Memory view to query (default: working)'),
    agentAddress: z.string().optional().describe('Agent address (required for WM queries if not set in env)'),
  },
  async ({ query, view, agentAddress }) => {
    try {
      // Redact the query for logging (though SPARQL queries rarely contain secrets)
      const { text: safeQuery } = redact(query);

      const opts = { view: view || 'working' };
      const agent = agentAddress || DKG_AGENT_ADDRESS;
      if (agent) opts.agentAddress = agent;

      const result = await dkg.query(safeQuery, opts);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: dkg_list_assertions
// ---------------------------------------------------------------------------

server.tool(
  'dkg_list_assertions',
  'List Knowledge Assets and their lifecycle state in the context graph',
  {},
  async () => {
    try {
      // Query the _meta graph for KA listings
      const sparql = `
        PREFIX schema: <http://schema.org/>
        SELECT ?ka ?name ?created ?state WHERE {
          ?ka schema:name ?name .
          OPTIONAL { ?ka schema:dateCreated ?created }
          OPTIONAL { ?ka schema:additionalType ?state }
        }
        ORDER BY DESC(?created)
        LIMIT 100
      `;

      const result = await dkg.query(sparql, { view: 'working' });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: dkg_share_to_swm
// ---------------------------------------------------------------------------

server.tool(
  'dkg_share_to_swm',
  'Promote a Knowledge Asset to Shared Working Memory (seals the assertion)',
  {
    kaName: z.string().describe('Knowledge Asset name (including timestamp suffix if applicable)'),
    entities: z.string().optional().describe('Entities to share with (default: "all")'),
  },
  async ({ kaName, entities }) => {
    try {
      const result = await dkg.shareToSWM(kaName, { entities: entities || 'all' });

      return {
        content: [
          {
            type: 'text',
            text: `Shared Knowledge Asset "${kaName}" to Shared Working Memory.\n\nResult: ${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[dkg-memory-mcp] Server running on stdio');
}

main().catch((err) => {
  console.error('[dkg-memory-mcp] Fatal error:', err);
  process.exit(1);
});
