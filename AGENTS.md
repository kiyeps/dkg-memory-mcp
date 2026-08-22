# AGENTS.md — DKG Memory MCP Server

## Project

MCP server exposing DKG V10 verifiable memory (WM/SWM/VM) as MCP tools for any
MCP-capable client. Submission to DKG v10 Call for Integrations, Round 1.

## Commands

```bash
npm install                 # install deps
node --test test/*.test.js  # run unit tests (must pass before PR)
node src/server.js          # run stdio server
```

## Key files

- `src/dkg-client.js` — DKG HTTP client (auth token from `~/.dkg/auth.token`
  line 2, SPARQL escaping, quad building, KA management)
- `src/redaction.js` — secret redaction before any literal leaves the process
- `src/server.js` — MCP stdio server with 5 tools
- `integrations/dkg-memory-mcp.json` — registry entry (validate before PR)

## Non-negotiables

- Quads: JSON array of `{subject, predicate, object}` — never a per-quad `graph` field
- Subjects must NOT match `urn:dkg:file:*` or `urn:dkg:extraction:*`
- SPARQL object literals wrapped in double quotes (`"value"`), not bare IRIs
- Fresh KAs use a timestamp suffix (`freshKAName`) to avoid "partition differs" seal errors
- Round 1 scope: WM + SWM only. NO `vm/publish` tool, NO endorsement/voting tools
- All file contents, comments, logs in English

## Validation

```bash
cd ../dkg-integration/dkg-integrations
node scripts/validate.mjs ../../dkg-memory-mcp/integrations/dkg-memory-mcp.json
# must report 0 errors
```