# DKG Memory MCP Server

MCP (Model Context Protocol) server that exposes OriginTrail DKG V10 three-layer
verifiable memory (WM / SWM / VM) as MCP tools, so ANY MCP-capable client
(Claude Desktop, Cursor, generic-MCP agents) can read, write, share and query
DKG memory without custom HTTP wiring.

Second submission to the DKG v10 Call for Integrations (Round 1: Working +
Shared Memory). Substantively distinct from the OpenClaw Memory Curator:
that one is an OpenClaw-specific daemon + CLI; this one is a transport-agnostic
MCP tooling layer any client can mount.

## Runtime facts (verified 2026-08-22)

- DKG daemon: http://127.0.0.1:9200 (v10.0.13, testnet Base Sepolia)
- Auth token: line 2 of ~/.dkg/auth.token (line 1 is a comment — strip `#` lines)
- Default context graph: openclaw-curator
- Quads format: JSON array of {subject, predicate, object} — NO per-quad graph field
- WM SPARQL view requires agentAddress; SWM/VM views do not
- Reserved subject IRIs urn:dkg:file:* and urn:dkg:extraction:* are REJECTED
- Full swm/share (entities:"all") seals by default => publish-ready
- HTTP share body cap 256 KB
- SPARQL object literals must be wrapped in double quotes ("value") —
  the node serializer treats bare strings as IRIs
- Reusing a KA name with different data causes "partition differs" seal error;
  use timestamp suffix for fresh ingest

## MCP tools to expose

1. `dkg_status` — node + CG health
2. `dkg_write_memory` — write quads to a named KA in Working Memory
3. `dkg_query_memory` — SPARQL over a view (working|shared|verifiable)
4. `dkg_list_assertions` — list KAs + lifecycle state via CG _meta graph
5. `dkg_share_to_swm` — promote a KA to Shared Working Memory (seals)

NO vm/publish tool in Round 1 scope (VM is later round; explicit-gate only).
NO UI endorsement / voting tools (disallowed by bounty rules).

## Constraints

- All file contents, comments, logs in English.
- Secret redaction before any literal leaves the process (reuse the redaction
  regex set from the sibling openclaw-memory-curator project).
- Zero or minimal deps. @modelcontextprotocol/sdk is acceptable if needed.
- Write unit tests with node:test for the DKG client + redaction + tool schema.
