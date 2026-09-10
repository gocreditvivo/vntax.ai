import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, extname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ALLOWED_SURFACES = new Set(['locked', 'live_limited', 'synthetic_demo']);
const REQUIRED_HEADERS = new Map([
  ['x-frame-options', (value) => value.toLowerCase() === 'deny'],
  ['x-content-type-options', (value) => value.toLowerCase() === 'nosniff'],
  ['x-permitted-cross-domain-policies', (value) => value.toLowerCase() === 'none'],
  ['referrer-policy', (value) => value.toLowerCase() === 'strict-origin-when-cross-origin'],
  ['permissions-policy', (value) => ['camera=()', 'microphone=()', 'geolocation=()'].every((item) => value.includes(item))],
  ['cross-origin-opener-policy', (value) => value.toLowerCase() === 'same-origin'],
  ['cross-origin-resource-policy', (value) => value.toLowerCase() === 'same-origin'],
  ['strict-transport-security', (value) => /max-age=(?:[3-9]\d{7}|\d{9,})/i.test(value) && /includesubdomains/i.test(value)],
]);
const EXACT_CSP_DIRECTIVES = new Map([
  ['default-src', ["'self'"]],
  ['script-src', ["'self'"]],
  ['connect-src', ["'self'", 'https://*.supabase.co', 'wss://*.supabase.co']],
  ['object-src', ["'none'"]],
  ['base-uri', ["'self'"]],
  ['frame-ancestors', ["'none'"]],
  ['form-action', ["'self'"]],
  ['upgrade-insecure-requests', []],
]);
const SECRET_PATTERNS = [
  { name: 'Supabase secret key', pattern: /sb_secret_[A-Za-z0-9_-]{20,}/g },
  { name: 'private key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: 'live payment key', pattern: /sk_live_[A-Za-z0-9]{16,}/g },
  { name: 'GitHub token', pattern: /gh[pousr]_[A-Za-z0-9]{30,}/g },
];

function walkFiles(root) {
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = join(root, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Artifact contains a symbolic link: ${full}`);
    if (entry.isDirectory()) files.push(...walkFiles(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex').toUpperCase();
}

function parseHeaders(vercelConfig) {
  const globalRule = vercelConfig.headers?.find((rule) => rule.source === '/(.*)');
  if (!globalRule || !Array.isArray(globalRule.headers)) {
    throw new Error('vercel.json must define a global /(.*) header rule.');
  }
  return new Map(globalRule.headers.map(({ key, value }) => [String(key).toLowerCase(), String(value)]));
}

export function validateHeaderPolicy(vercelConfig) {
  const headers = parseHeaders(vercelConfig);
  const failures = [];
  for (const [key, validate] of REQUIRED_HEADERS) {
    const value = headers.get(key);
    if (!value || !validate(value)) failures.push(`missing or unsafe ${key}`);
  }
  const csp = headers.get('content-security-policy') ?? '';
  const parsedCsp = new Map(
    csp
      .split(';')
      .map((directive) => directive.trim())
      .filter(Boolean)
      .map((directive) => {
        const [name, ...values] = directive.split(/\s+/);
        return [name.toLowerCase(), values];
      }),
  );
  for (const [name, expectedValues] of EXACT_CSP_DIRECTIVES) {
    const actualValues = parsedCsp.get(name);
    const actual = actualValues ? [...actualValues].sort() : null;
    const expected = [...expectedValues].sort();
    if (!actual || actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
      failures.push(`CSP ${name} must be exactly ${expectedValues.join(' ') || '(no values)'}`);
    }
  }
  if (failures.length > 0) throw new Error(`Deployment header policy failed: ${failures.join('; ')}`);
  return { passed: true, checkedHeaders: REQUIRED_HEADERS.size + 1 };
}

export function validateBuildManifest(manifest, expectedSurface) {
  if (!ALLOWED_SURFACES.has(expectedSurface)) {
    throw new Error(`Unknown expected surface ${expectedSurface}.`);
  }
  if (manifest.schemaVersion !== 1 || manifest.product !== 'vntax') {
    throw new Error('Missing or incompatible VNTax build manifest.');
  }
  if (manifest.runtimeSurface !== expectedSurface) {
    throw new Error(`Artifact surface is ${manifest.runtimeSurface}; expected ${expectedSurface}.`);
  }
  if (manifest.sourceMaps !== false) throw new Error('Build manifest must record source maps as disabled.');

  if (expectedSurface === 'locked') {
    if (manifest.supabaseConfiguration !== 'absent' || manifest.syntheticDemoRequested !== false) {
      throw new Error('Locked artifact must have no Supabase configuration and no synthetic-demo request.');
    }
  } else if (expectedSurface === 'live_limited') {
    if (manifest.supabaseConfiguration !== 'valid' || manifest.syntheticDemoRequested !== false) {
      throw new Error('Live-limited artifact requires valid Supabase configuration and no demo request.');
    }
  } else if (manifest.supabaseConfiguration !== 'absent' || manifest.syntheticDemoRequested !== true) {
    throw new Error('Synthetic artifact must have no Supabase configuration and an explicit demo request.');
  }
  return { passed: true, runtimeSurface: expectedSurface };
}

function findPrivilegedJwt(text) {
  const candidates = text.match(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g) ?? [];
  for (const candidate of candidates) {
    try {
      const payload = JSON.parse(Buffer.from(candidate.split('.')[1], 'base64url').toString('utf8'));
      if (payload?.role === 'service_role') return candidate;
    } catch {
      // A JWT-shaped application string is not itself evidence of a secret.
    }
  }
  return null;
}

export function scanArtifact(distDir) {
  if (!existsSync(distDir) || !statSync(distDir).isDirectory()) {
    throw new Error(`Build directory does not exist: ${distDir}`);
  }
  const files = walkFiles(distDir);
  if (files.length === 0) throw new Error('Build directory is empty.');
  const failures = [];
  const assets = [];

  for (const file of files) {
    const name = relative(distDir, file).replaceAll('\\', '/');
    if (extname(file).toLowerCase() === '.map') failures.push(`${name}: source map emitted`);
    const bytes = readFileSync(file);
    const content = bytes.toString('utf8');
    if (/sourceMappingURL\s*=/.test(content)) failures.push(`${name}: source-map reference emitted`);
    for (const secret of SECRET_PATTERNS) {
      secret.pattern.lastIndex = 0;
      if (secret.pattern.test(content)) failures.push(`${name}: ${secret.name} pattern found`);
    }
    if (findPrivilegedJwt(content)) failures.push(`${name}: service-role JWT found`);
    assets.push({ path: name, bytes: bytes.length, sha256: sha256(file) });
  }

  if (!files.some((file) => basename(file) === 'index.html')) failures.push('index.html missing');
  if (!files.some((file) => basename(file) === 'vntax-build-manifest.json')) {
    failures.push('vntax-build-manifest.json missing');
  }
  if (failures.length > 0) throw new Error(`Artifact scan failed: ${failures.join('; ')}`);
  return { passed: true, files: assets.sort((a, b) => a.path.localeCompare(b.path)) };
}

export function runReleasePreflight({ rootDir = process.cwd(), expectedSurface = 'locked' } = {}) {
  const distDir = resolve(rootDir, 'dist');
  const vercelConfig = JSON.parse(readFileSync(resolve(rootDir, 'vercel.json'), 'utf8'));
  const manifest = JSON.parse(readFileSync(resolve(distDir, 'vntax-build-manifest.json'), 'utf8'));
  return {
    schemaVersion: 1,
    product: 'vntax',
    expectedSurface,
    manifest: validateBuildManifest(manifest, expectedSurface),
    headers: validateHeaderPolicy(vercelConfig),
    artifact: scanArtifact(distDir),
  };
}

function expectedSurfaceFromArgs(args) {
  const index = args.indexOf('--expect');
  if (index === -1) return 'locked';
  if (!args[index + 1]) throw new Error('--expect requires locked, live_limited, or synthetic_demo.');
  return args[index + 1];
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) {
  try {
    const report = runReleasePreflight({ expectedSurface: expectedSurfaceFromArgs(process.argv.slice(2)) });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`VNTax release preflight failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
