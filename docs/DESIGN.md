# Design Brief - dkg-memory-mcp

DKG V10 Call for Integrations, Round 1 submission (`cfi-dkgv10-r1`). Human-readable
companion to `integrations/dkg-memory-mcp.json`.

## Problem

MCP-capable clients (Claude Desktop, Cursor, Claude Code, any generic MCP host)
cannot talk to DKG memory without bespoke HTTP wiring per client. This server
exposes DKG Working/Shared memory as standard MCP tools, so an MCP host gains
verifiable memory read/write by adding one server entry - no custom code, no
custom transport. Target users: MCP client users and agent builders who want DKG
memory available inside their existing tool loop.

## Layers touched

- Working Memory (WM): primary. dkg_write_memory creates a Knowledge Asset and
  writes redacted quads into WM (draft-open).
- Shared Working Memory (SWM): explicit. dkg_share_to_swm performs the DKG SHARE
  operation (seals by default, publish-ready).
- Verifiable Memory (VM): NOT used in Round 1. No vm/publish tool is exposed.

## DKG V10 interfaces and primitives used

- Context Graph: the operator's agent context graph (DKG_CONTEXT_GRAPH_NAME /
  default).
- Knowledge Asset: one per write (generated or caller-supplied name, e.g.
  dkg-mcp-<epoch>) via POST /api/knowledge-assets + POST
  /api/knowledge-assets/{name}/wm/write.
- Assertion: sealed on SHARE; identifiers are read from node responses, never
  constructed locally.
- SubGraph: not used. No subgraph admin operations are performed.
- Query: POST /api/query (SPARQL) powers dkg_query_memory and
  dkg_list_assertions (filters by schema:name / KA fields).
- Operations used: create KA, wm/write, swm/share, SPARQL query. No publish, no
  endorse/verify/update.

## Tools provided

1. dkg_status - node reachability + context graph info.
2. dkg_write_memory - create KA + wm/write (secret-redacted quads).
3. dkg_query_memory - SPARQL query over the graph.
4. dkg_list_assertions - list KAs written by this integration.
5. dkg_share_to_swm - SHARE a named KA to SWM (seals by default).

## How this advances LLM-Wiki and autoresearch

The MCP tool surface is the shortest path from an LLM Wiki or autoresearch agent
to DKG memory: both need read/write access to persistent, provenance-tagged
memory from inside their tool loop, and both usually run on MCP-speaking hosts.
With this server, "save this finding to verifiable memory" is a standard tool
call whose result carries the node-issued KA identity, so downstream wiki
citations and autoresearch logs reference real DKG objects instead of local
notes.

## Terminology (v10 vocabulary)

- "Write" = create KA + wm/write (no share).
- "Share" = the DKG SHARE operation (POST /api/knowledge-assets/{name}/swm/share,
  seals by default). The word "publish" is not used; PUBLISH (vm/publish) is not
  implemented in this round.

## Promotion path (current behavior)

1. Write - the KA lands in WM as a draft assertion.
2. Share - the caller explicitly invokes dkg_share_to_swm; the node seals the
   assertion and registers it in SWM (publish-ready).
3. Nothing is automatic: no timers, no background jobs. VM promotion is out of
   Round 1 scope and has no tool.

## Provenance, identifiers, and oracle input

- Names and identifiers returned to the MCP caller are taken verbatim from node
  responses; the server never fabricates a UAL or assertion id.
- Secrets are redacted before quads leave the process, so stored memory cannot
  contain harvested credentials from the model's context.
- Context oracles: shared, sealed KAs on the operator's context graph are
  candidate oracle inputs; this server does not call VM operations itself. It is
  a writer/reader of the evidence an oracle would consume.

## Security posture

- Credentials: DKG_AUTH_TOKEN env var, or ~/.dkg/auth.token fallback (comment
  lines stripped). Missing/empty credentials fail closed with a clear message
  that never includes token material.
- Transport: MCP over stdio. The server opens no network listener; the process
  itself only makes outbound calls to the configured DKG node.
- Egress: the local DKG node only (http://127.0.0.1:9200 by default). No other
  network I/O.
- Write authority: wm/write + swm/share. No VM writes.
- Redaction gate runs on every write before quads are sent.

## Round 1 checklist

- Demo: docs/demo-transcript.txt (live node, Base Sepolia testnet).
- Tests: node --test test/*.test.js - includes auth-failure, redaction,
  version-consistency and server-schema suites.

## Maintainer

@kiyeps (https://github.com/kiyeps) - 6 months post-merge support minimum.
