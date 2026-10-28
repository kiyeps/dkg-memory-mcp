// DKG HTTP client — minimal wrapper around the local DKG node REST API.
// Zero extra deps (uses built-in fetch).

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { validateEndpointUrl } from './net-guard.js';

// ---------------------------------------------------------------------------
// Auth token loading
// ---------------------------------------------------------------------------

/**
 * Resolve the DKG auth token, in this order:
 *
 *   1. `DKG_AUTH_TOKEN` — the token the registry installer passes in the
 *      integration's environment. Honoured first so the declared contract is
 *      real: an entry that advertises this variable must actually consume it.
 *   2. `~/.dkg/auth.token` — the node's own token file written by `dkg auth`.
 *      Line 1 is typically a comment; the token is on line 2. Any line starting
 *      with '#' is stripped.
 *
 * The resolved value is never logged or echoed back to the caller.
 */
export function loadAuthToken(tokenPath) {
  const envToken = (process.env.DKG_AUTH_TOKEN || '').trim();
  if (envToken) return envToken;
  const path = tokenPath || join(homedir(), '.dkg', 'auth.token');
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    throw new Error(
      `No DKG auth token: DKG_AUTH_TOKEN is unset and the token file is unreadable (${path}). ` +
      'Set DKG_AUTH_TOKEN or write ~/.dkg/auth.token via `dkg auth`.'
    );
  }
  const lines = raw.split('\n').filter(l => !l.trim().startsWith('#'));
  const token = (lines[1] || lines[0] || '').trim();
  if (!token) {
    throw new Error(
      `No DKG auth token: DKG_AUTH_TOKEN is unset and ${path} holds no token. ` +
      'Set DKG_AUTH_TOKEN or write ~/.dkg/auth.token via `dkg auth`.'
    );
  }
  return token;
}

// ---------------------------------------------------------------------------
// SPARQL helpers
// ---------------------------------------------------------------------------

/**
 * Escape a string for use inside a SPARQL double-quoted literal.
 * Backslashes, double quotes, newlines, tabs, and carriage returns are escaped.
 */
export function escapeSparqlLiteral(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Wrap a value as a SPARQL double-quoted literal.
 * The DKG node serializer treats bare strings as IRIs, so all object values
 * must be quoted.
 */
export function sparqlLiteral(value) {
  return `"${escapeSparqlLiteral(value)}"`;
}

// ---------------------------------------------------------------------------
// Subject validation
// ---------------------------------------------------------------------------

const FORBIDDEN_SUBJECT_PATTERNS = [
  /^urn:dkg:file:/,
  /^urn:dkg:extraction:/,
];

/**
 * Validate that a subject IRI does not use reserved prefixes.
 * Returns an error message string if invalid, null if valid.
 */
export function validateSubject(subject) {
  for (const pat of FORBIDDEN_SUBJECT_PATTERNS) {
    if (pat.test(subject)) {
      return `Subject "${subject}" matches reserved prefix ${pat.source}`;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Quad building
// ---------------------------------------------------------------------------

/**
 * Build a quad object {subject, predicate, object}.
 * The object value is automatically wrapped as a SPARQL literal (double-quoted).
 * Throws if the subject uses a reserved prefix.
 */
export function buildQuad(subject, predicate, objectValue) {
  const err = validateSubject(subject);
  if (err) throw new Error(err);
  return {
    subject,
    predicate,
    object: sparqlLiteral(objectValue),
  };
}

/**
 * Build an array of quads from a simple key-value map.
 * The subject and a base predicate namespace must be provided.
 * Each key becomes predicate = basePredicate + key, object = sparqlLiteral(value).
 */
export function buildQuadsFromMap(subject, basePredicate, entries) {
  const err = validateSubject(subject);
  if (err) throw new Error(err);
  return Object.entries(entries).map(([key, value]) => ({
    subject,
    predicate: `${basePredicate}${key}`,
    object: sparqlLiteral(value),
  }));
}

// ---------------------------------------------------------------------------
// KA naming with reuse guard
// ---------------------------------------------------------------------------

/**
 * Generate a fresh KA name with a timestamp suffix to avoid "partition differs"
 * seal errors when reusing a name with different data.
 */
export function freshKAName(baseName) {
  return `${baseName}-${Date.now()}`;
}

// ---------------------------------------------------------------------------
// HTTP client
// ---------------------------------------------------------------------------

export class DkgClient {
  /**
   * @param {object} opts
   * @param {string} [opts.baseUrl]       DKG node base URL (default http://127.0.0.1:9200)
   * @param {string} [opts.authToken]     Auth token (loaded from disk if omitted)
   * @param {string} [opts.tokenPath]     Path to auth token file
   * @param {string} [opts.contextGraphId] Default context graph id
   */
  constructor(opts = {}) {
    // Validate before the token is loaded or any request is built: the DKG
    // bearer token must never be sent to an unexpected plaintext origin.
    // Loopback http is allowed (local node); non-loopback requires https plus
    // the explicit DKG_ALLOW_REMOTE_ENDPOINT=1 operator opt-in.
    this.baseUrl = validateEndpointUrl(opts.baseUrl || 'http://127.0.0.1:9200', {
      name: 'DKG_API_URL',
      remoteOptInEnv: 'DKG_ALLOW_REMOTE_ENDPOINT',
    });
    this.authToken = opts.authToken || loadAuthToken(opts.tokenPath);
    this.contextGraphId = opts.contextGraphId || 'openclaw-curator';
  }

  /** Common headers for every request. */
  _headers(extra = {}) {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.authToken}`,
      ...extra,
    };
  }

  /** Generic JSON request helper. */
  async _request(method, path, body) {
    const url = `${this.baseUrl}${path}`;
    const init = {
      method,
      headers: this._headers(),
    };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }
    const res = await fetch(url, init);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    if (!res.ok) {
      const msg = typeof data === 'object' ? JSON.stringify(data) : data;
      throw new Error(`DKG ${method} ${path} → ${res.status}: ${msg}`);
    }
    return data;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * GET /api/status — node health + identity info.
   */
  async getStatus() {
    return this._request('GET', '/api/status');
  }

  /**
   * POST /api/knowledge-assets — create a Knowledge Asset with quads.
   *
   * @param {string} name          KA name (should include timestamp suffix for fresh KAs)
   * @param {Array}  quads         Array of {subject, predicate, object}
   * @param {object} [opts]
   * @param {string} [opts.contextGraphId] Override context graph
   */
  async createKnowledgeAsset(name, quads, opts = {}) {
    const cgId = opts.contextGraphId || this.contextGraphId;
    return this._request('POST', '/api/knowledge-assets', {
      name,
      contextGraphId: cgId,
      quads,
    });
  }

  /**
   * POST /api/knowledge-assets/{name}/swm/share — share a KA to Shared Working Memory.
   *
   * @param {string} name          KA name
   * @param {object} [opts]
   * @param {string} [opts.entities]  Entities to share with (default "all")
   * @param {string} [opts.contextGraphId] Override context graph
   */
  async shareToSWM(name, opts = {}) {
    const cgId = opts.contextGraphId || this.contextGraphId;
    const entities = opts.entities || 'all';
    return this._request('POST', `/api/knowledge-assets/${encodeURIComponent(name)}/swm/share`, {
      contextGraphId: cgId,
      entities,
    });
  }

  /**
   * POST /api/query — run a SPARQL query against a memory view.
   *
   * @param {string} sparql   SPARQL query string
   * @param {object} [opts]
   * @param {string} [opts.view]              Memory view: working|shared|verifiable (default "working")
   * @param {string} [opts.agentAddress]      Required for WM queries
   * @param {string} [opts.contextGraphId]    Override context graph
   */
  async query(sparql, opts = {}) {
    const viewMap = {
      working: 'working-memory',
      shared: 'shared-working-memory',
      verifiable: 'verifiable-memory',
    };
    const rawView = opts.view || 'working';
    const view = viewMap[rawView] || rawView;
    const cgId = opts.contextGraphId || this.contextGraphId;
    const body = {
      sparql,
      view,
      contextGraphId: cgId,
    };
    if (opts.agentAddress) {
      body.agentAddress = opts.agentAddress;
    }
    return this._request('POST', '/api/query', body);
  }
}
