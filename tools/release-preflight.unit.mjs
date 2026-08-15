import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  runReleasePreflight,
  scanArtifact,
  validateBuildManifest,
  validateHeaderPolicy,
} from './release-preflight.mjs';

function manifest(surface = 'locked') {
  return {
    schemaVersion: 1,
    product: 'vntax',
    runtimeSurface: surface,
    supabaseConfiguration: surface === 'live_limited' ? 'valid' : 'absent',
    syntheticDemoRequested: surface === 'synthetic_demo',
    sourceMaps: false,
  };
}

function vercelConfig() {
  return {
    headers: [{
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests" },
      ],
    }],
  };
}

function fixtureRoot() {
  const root = mkdtempSync(join(tmpdir(), 'vntax-preflight-'));
  const dist = join(root, 'dist');
  mkdirSync(join(dist, 'assets'), { recursive: true });
  writeFileSync(join(root, 'vercel.json'), JSON.stringify(vercelConfig()));
  writeFileSync(join(dist, 'index.html'), '<script type="module" src="/assets/index-abc.js"></script>');
  writeFileSync(join(dist, 'assets', 'index-abc.js'), 'console.log("safe")');
  writeFileSync(join(dist, 'vntax-build-manifest.json'), JSON.stringify(manifest()));
  return root;
}

test('accepts a locked artifact with the required deployment boundary', () => {
  const root = fixtureRoot();
  try {
    const report = runReleasePreflight({ rootDir: root, expectedSurface: 'locked' });
    assert.equal(report.artifact.passed, true);
    assert.equal(report.headers.passed, true);
    assert.equal(report.manifest.runtimeSurface, 'locked');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('refuses a release whose build surface does not match the approval target', () => {
  assert.throws(() => validateBuildManifest(manifest('synthetic_demo'), 'locked'), /expected locked/);
  assert.throws(
    () => validateBuildManifest({ ...manifest('live_limited'), syntheticDemoRequested: true }, 'live_limited'),
    /no demo request/,
  );
});

test('refuses source maps and privileged credentials in the artifact', () => {
  const root = fixtureRoot();
  try {
    const serviceHeader = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const servicePayload = Buffer.from(JSON.stringify({ role: 'service_role', sub: 'unit' })).toString('base64url');
    writeFileSync(join(root, 'dist', 'assets', 'index.js.map'), '{}');
    writeFileSync(join(root, 'dist', 'assets', 'bad.js'), `const key = 'sb_secret_${'a'.repeat(24)}'`);
    writeFileSync(join(root, 'dist', 'assets', 'bad-jwt.js'), `${serviceHeader}.${servicePayload}.${'x'.repeat(32)}`);
    assert.throws(() => scanArtifact(join(root, 'dist')), (error) => {
      assert.match(error.message, /source map emitted/);
      assert.match(error.message, /Supabase secret key/);
      assert.match(error.message, /service-role JWT/);
      return true;
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('refuses a weakened deployment header policy', () => {
  const config = vercelConfig();
  const csp = config.headers[0].headers.find((header) => header.key === 'Content-Security-Policy');
  csp.value = csp.value.replace(
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co *",
  );
  assert.throws(() => validateHeaderPolicy(config), /CSP connect-src must be exactly/);
});

test('live and synthetic manifests require unambiguous configuration states', () => {
  assert.equal(validateBuildManifest(manifest('live_limited'), 'live_limited').passed, true);
  assert.equal(validateBuildManifest(manifest('synthetic_demo'), 'synthetic_demo').passed, true);
  assert.throws(
    () => validateBuildManifest({ ...manifest('synthetic_demo'), supabaseConfiguration: 'invalid' }, 'synthetic_demo'),
    /must have no Supabase configuration/,
  );
});
