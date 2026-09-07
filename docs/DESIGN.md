# Design Brief — dkg-memory-mcp

DKG V10 Round 1 submission (`cfi-dkgv10-r1`). Companion to `integrations/dkg-memory-mcp.json`.

## Problem

Desktop agent clients (Claude Desktop, Cursor, Claude Code) speak MCP but have no
native way to use DKG V10 three-layer memory. Exposing WM/SWM as MCP tools makes
DKG memory available in the tools agents already use.

## Design

An MCP server (`dkg-memory-mcp`) exposing five tools:

- `dkg_status` — node health/identity.
- `dkg_write_memory` — write quads to a named Knowledge Asset in WM (timestamped
  KA names avoid reuse conflicts; Merkle root + author address returned on seal).
- `dkg_query_memory` — SPARQL over working | shared | verifiable views.
- `dkg_list_assertions` — KA lifecycle state in the context graph.
- `dkg_share_to_swm` — promote a KA to Shared Working Memory (seals the assertion).

All tool inputs are zod-validated; quads are `{subject, predicate, object}` triples
built through a strict literal escaper (backslash-first escaping). Secret-shaped
values are redacted before any literal leaves the process.

## Security posture

- Talks only to the local node at `http://127.0.0.1:9200` (declared egress).
- stdio transport only — no network listener is opened.
- Dependencies limited to `@modelcontextprotocol/sdk` + `zod`; both advisories
  (fast-uri GHSA-jqff-g426-hqxp, qs GHSA-x5fp-wj9c-mxmx / GHSA-4mjr-xmp4-gh2g)
  were resolved via lockfile upgrade; `npm audit --omit=dev` is clean, and the
  affected components are not loaded by the stdio runtime path.

## Demo

`docs/demo-transcript.txt` — recorded against a live local DKG V10 node
(v10.0.15, Base Sepolia testnet, context graph `openclaw-curator`):
status → write (with Merkle root + author) → SPARQL query → share to SWM.

## Maintenance

Maintained by @kiyeps. Support window: 6 months post-merge minimum.
