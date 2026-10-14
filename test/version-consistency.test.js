// Drift guards for the release identity of this package.
//
// The release version is declared in five places that must never disagree:
// package.json, package-lock.json (root + packages[""]), the registry entry we
// ship in integrations/, and whatever the MCP server reports at handshake time.
// A mismatch here is exactly the defect that shipped version 1.0.1 in
// package.json while the lock said 1.0.2.
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'));

const pkg = readJson('package.json');
const lock = readJson('package-lock.json');

test('version: package-lock root agrees with package.json', () => {
  assert.strictEqual(lock.version, pkg.version,
    'package-lock.json "version" must equal package.json "version"');
  assert.strictEqual(lock.packages?.['']?.version, pkg.version,
    'package-lock.json packages[""].version must equal package.json "version"');
});

test('version: lockfile is consistent with the manifest dependencies', () => {
  const declared = pkg.dependencies || {};
  const locked = lock.packages?.['']?.dependencies || {};
  assert.deepStrictEqual(locked, declared,
    'package-lock.json root dependencies must match package.json dependencies');
  for (const [name, range] of Object.entries(declared)) {
    const entry = lock.packages?.['node_modules/' + name];
    assert.ok(entry, 'lockfile must pin ' + name);
    assert.ok(entry.version, name + ' must have a resolved version in the lockfile');
  }
});

test('version: shipped registry entry pins this exact version', () => {
  const entry = readJson('integrations/dkg-memory-mcp.json');
  const install = entry.install || {};
  // installMcp entries have no version field in the schema (additionalProperties
  // is false), so the version pin lives in args: ["-y", "<pkg>@<version>"].
  const args = Array.isArray(install.args) ? install.args.join(' ') : String(install.args || '');
  assert.ok(args.includes(pkg.name + '@' + pkg.version),
    'registry entry install.args must invoke ' + pkg.name + '@' + pkg.version +
    ', got: ' + args);
  if (install.version !== undefined) {
    assert.strictEqual(install.version, pkg.version,
      'registry entry install.version must equal the package version when present');
  }
});

test('version: server sources its version from package.json, not a literal', () => {
  const src = readFileSync(join(root, 'src', 'server.js'), 'utf8');
  assert.match(src, /version:\s*pkg\.version/,
    'server.js must report pkg.version so it cannot drift from the package');
  assert.ok(!/version:\s*'\d+\.\d+\.\d+'/.test(src),
    'server.js must not hardcode a version literal');
});
