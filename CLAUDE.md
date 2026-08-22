# CLAUDE.md — DKG Memory MCP Server

Guidance for Claude Code when working in this repo.

## Context

This is an MCP server for DKG V10 memory. It is a bounty submission (DKG v10
Call for Integrations, Round 1: Working & Shared Memory). Keep scope tight to
Round 1 — do not add Verifiable Memory publish or endorsement/voting features.

## Before editing

- Read `DESIGN.md` and `AGENTS.md` first.
- Tests live in `test/*.test.js` using `node:test`. Run `node --test test/*.test.js`
  after any change; all must pass.

## DKG runtime gotchas (verified 2026-08-22)

- Auth token: line 2 of `~/.dkg/auth.token` (line 1 is a comment — strip `#` lines)
- Quads: `{subject, predicate, object}` — never add a per-quad `graph` field
- Reserved subjects `urn:dkg:file:*` and `urn:dkg:extraction:*` are rejected
- SPARQL object literals must be double-quoted (`"value"`) — bare strings are treated as IRIs
- Reusing a KA name with different data → "partition differs" seal error; use `freshKAName()`
- WM SPARQL view needs `agentAddress`; SWM/VM views do not
- Full `swm/share` (`entities:"all"`) seals by default → publish-ready
- HTTP share body cap 256 KB

## Registry entry

`integrations/dkg-memory-mcp.json` must stay schema-valid. Validate with:
`cd ../dkg-integration/dkg-integrations && node scripts/validate.mjs ../../dkg-memory-mcp/integrations/dkg-memory-mcp.json`
(expect 0 errors, 0 warnings). The `commit` field is pinned to the pushed SHA
before opening a PR — never leave it as 40 zeros in a submitted entry.