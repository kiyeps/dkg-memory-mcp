# DKG Memory MCP Server

MCP (Model Context Protocol) server exposing OriginTrail **DKG V10** memory
(Working and Shared Memory in Round 1; no VM tools) as standard MCP tools. Mount it
in any MCP-capable client — Claude Desktop, Cursor, Claude Code, or a generic
MCP agent — and read, write, share and query DKG memory without custom HTTP wiring.

This is a submission to the **DKG v10 Call for Integrations (Round 1: Working &
Shared Memory)**. It is a transport-agnostic tooling layer, distinct from the
sibling OpenClaw Memory Curator daemon (which is OpenClaw-specific).

## Tools

| Tool | Purpose |
|------|---------|
| `dkg_status` | Node + context-graph health |
| `dkg_write_memory` | Write quads to a named Knowledge Asset in Working Memory |
| `dkg_query_memory` | SPARQL query over a memory view (working / shared / verifiable) |
| `dkg_list_assertions` | List Knowledge Assets + lifecycle state |
| `dkg_share_to_swm` | Promote a KA to Shared Working Memory (seals by default) |

Round 1 scope is Working + Shared Memory only. There is **no** `vm/publish` tool
(Verifiable Memory is a later round and requires an explicit human-gated publish)
and **no** UI endorsement/voting tool (disallowed by the bounty rules).

## Install

```bash
npm install -g dkg-memory-mcp
```

Requires a running DKG V10 node (default `http://127.0.0.1:9200`) with an auth
token at `~/.dkg/auth.token` (line 2; comment lines starting with `#` are
stripped).

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "dkg-memory": {
      "command": "dkg-memory-mcp",
      "args": []
    }
  }
}
```

### Cursor / Claude Code

Register the MCP server with command `dkg-memory-mcp` (stdio transport).

### Environment variables (optional)

| Variable | Default |
|----------|---------|
| `DKG_API_URL` | `http://127.0.0.1:9200` |
| `DKG_CONTEXT_GRAPH` | `openclaw-curator` |
| `DKG_AGENT_ADDRESS` | auto (node default agent) |

## Development

```bash
npm install
node --test test/*.test.js   # unit tests
node src/server.js           # run the stdio server
```

## Smoke test (live)

Verified end-to-end against a DKG V10 node (Base Sepolia testnet): create KA →
write quads to Working Memory → SPARQL recall → 3 bindings returned across
peer-ID, wallet, and default agent addressing.

## License

Apache-2.0
## Verified example (2026-08-22)

Real MCP round-trip against the local DKG node (v10.0.19, testnet), driven over
the stdio MCP protocol:

```json
// tools/call dkg_write_memory
{
  "kaName": "hermes-audit-manic",
  "subject": "urn:dkg:hermes:demo:manic-deposit",
  "triples": [
    {"predicate": "http://127.0.0.1:7878/actionType", "object": "deposit"},
    {"predicate": "http://127.0.0.1:7878/chain", "object": "solana"},
    {"predicate": "http://127.0.0.1:7878/outcome", "object": "success"}
  ]
}
// -> Created Knowledge Asset "hermes-audit-manic-1787398447058" with 4 quad(s)
//    assertionUri: did:dkg:.../_working_memory/.../269
//    status: wm-sealed | merkleRoot: 0x8aa210f8... | written: 4

// tools/call dkg_query_memory (SPARQL)
{"query": "SELECT ?s ?p ?o WHERE { ?s <http://127.0.0.1:7878/actionType> \"deposit\" . ?s ?p ?o }", "view": "working"}
// -> returns the deposited action quads (incl. records written by sibling tools)
```

The write sealed to Working Memory (EIP-712 seal, merkle-rooted) and the SPARQL
query recalled it back, including records written by the sibling
`dkg-hermes-bridge` — demonstrating cross-tool visibility on the shared DKG
substrate.


## Recorded walkthrough

`docs/demo.gif` is a recorded walkthrough of this integration against a live local
DKG V10 node (raw recording: `docs/demo.cast`, asciinema v2 format).
`docs/demo-transcript.txt` is the exact terminal output of that same run.

![recorded walkthrough](docs/demo.gif)
