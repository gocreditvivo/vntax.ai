import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MUTATION_ACK,
  isRlsDenial,
  looksPrivilegedKey,
  runRlsVerification,
  tokenRole,
  validateConfig,
} from './rls-smoke-test.mjs';
import {
  REQUIRED_VNTAX_TABLES,
  extractDatabaseContract,
  loadDatabaseContract,
  validateDatabaseContract,
} from './database-contract.mjs';

function jwt(role, subject = 'unit-user') {
  const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ role, sub: subject })).toString('base64url');
  return header + '.' + payload + '.signature';
}

function baseEnv() {
  return {
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    RLS_EMAIL_A: 'a@example.test',
    RLS_PASSWORD_A: 'password-a',
    RLS_EMAIL_B: 'b@example.test',
    RLS_PASSWORD_B: 'password-b',
    RLS_ALLOW_MUTATION: MUTATION_ACK,
  };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('recognizes ordinary and privileged JWT roles', () => {
  assert.equal(tokenRole(jwt('authenticated')), 'authenticated');
  assert.equal(looksPrivilegedKey(jwt('service_role')), true);
  assert.equal(looksPrivilegedKey('sb_secret_example'), true);
  assert.equal(looksPrivilegedKey('  sb_secret_example  '), true);
  assert.equal(looksPrivilegedKey('sb_publishable_example'), false);
});

test('configuration fails closed without explicit mutation acknowledgement', () => {
  const env = baseEnv();
  delete env.RLS_ALLOW_MUTATION;
  assert.throws(() => validateConfig(env), /RLS_ALLOW_MUTATION/);
});

test('configuration refuses a non-Supabase URL and shared credentials', () => {
  assert.throws(
    () => validateConfig({ ...baseEnv(), SUPABASE_URL: 'https://example.com' }),
    /supabase\.co/,
  );
  assert.throws(
    () => validateConfig({
      ...baseEnv(),
      SUPABASE_URL: 'https://rcmcqcinndypoupgjezi.supabase.co',
    }),
    /shared TrinityAI relay/,
  );
  assert.throws(
    () => validateConfig({ ...baseEnv(), RLS_EMAIL_B: 'a@example.test' }),
    /different accounts/,
  );
  assert.throws(
    () => validateConfig({ ...baseEnv(), RLS_PASSWORD_B: 'password-a' }),
    /must not share a password/,
  );
});

test('generated database types contain the required VNTax structural contract', () => {
  const contract = loadDatabaseContract();
  assert.deepEqual(
    Object.keys(contract.tables).filter((name) => name !== 'waitlist').sort(),
    [...REQUIRED_VNTAX_TABLES].sort(),
  );
  assert.ok(contract.tables.businesses.includes('created_by'));
  assert.ok(contract.tables.memberships.includes('accepted_at'));
  assert.ok(contract.tables.tax_identities.includes('ein_token'));
  assert.ok(contract.functions.create_business.includes('p_legal_name'));
});

test('database contract parser fails closed when a required table is absent', () => {
  const contract = loadDatabaseContract();
  delete contract.tables.businesses;
  assert.throws(() => validateDatabaseContract(contract), /missing table businesses/);
  assert.throws(() => extractDatabaseContract('type Nope = {}'), /Database was not found/);
});

test('RLS denial requires an authorization failure, not an arbitrary validation error', () => {
  assert.equal(isRlsDenial({
    status: 403,
    body: { code: '42501', message: 'new row violates row-level security policy' },
  }), true);
  assert.equal(isRlsDenial({
    status: 400,
    body: { code: '23502', message: 'null value violates not-null constraint' },
  }), false);
});

test('existing business rows stop the verifier before any mutation', async () => {
  const config = validateConfig(baseEnv());
  const tokenA = jwt('authenticated', 'user-a');
  const tokenB = jwt('authenticated', 'user-b');
  let mutationCalls = 0;
  const logs = [];

  const fetchImpl = async (url, init) => {
    const target = String(url);
    if (target.includes('/auth/v1/token')) {
      const submitted = JSON.parse(init.body);
      const isA = submitted.email === config.accounts[0].email;
      return jsonResponse({
        access_token: isA ? tokenA : tokenB,
        user: { id: isA ? 'user-a' : 'user-b' },
      });
    }
    if (init.method !== 'GET') mutationCalls += 1;
    return jsonResponse([{ id: 'existing-business' }]);
  };

  const report = await runRlsVerification(config, {
    fetchImpl,
    log: (line) => logs.push(line),
    runId: 'unit-existing',
  });

  assert.equal(report.passed, false);
  assert.match(report.fatalError, /already sees 1 business/);
  assert.equal(mutationCalls, 0);
  assert.equal(report.cleanup.length, 0);
  assert.equal(logs.join(' ').includes(config.accounts[0].email), false);
  assert.equal(logs.join(' ').includes(config.accounts[0].password), false);
});

test('a partial setup failure still verifies cleanup of the first business', async () => {
  const config = validateConfig(baseEnv());
  const tokenA = jwt('authenticated', 'user-a');
  const tokenB = jwt('authenticated', 'user-b');
  let createdA = false;

  const fetchImpl = async (url, init) => {
    const target = new URL(url);
    const authorization = init.headers.Authorization ?? '';
    const isA = authorization === 'Bearer ' + tokenA;

    if (target.pathname.includes('/auth/v1/token')) {
      const submitted = JSON.parse(init.body);
      const accountA = submitted.email === config.accounts[0].email;
      return jsonResponse({
        access_token: accountA ? tokenA : tokenB,
        user: { id: accountA ? 'user-a' : 'user-b' },
      });
    }
    if (target.pathname.endsWith('/rest/v1/businesses') && init.method === 'GET') {
      return jsonResponse([]);
    }
    if (target.pathname.endsWith('/rest/v1/rpc/create_business') && init.method === 'POST') {
      if (isA) {
        createdA = true;
        return jsonResponse({ id: 'business-a' });
      }
      return jsonResponse({ message: 'simulated second-account failure' }, 500);
    }
    if (target.pathname.endsWith('/rest/v1/businesses') && init.method === 'DELETE') {
      createdA = false;
      return jsonResponse([{ id: 'business-a' }]);
    }
    return jsonResponse({ message: 'unexpected request' }, 500);
  };

  const report = await runRlsVerification(config, {
    fetchImpl,
    log: () => {},
    runId: 'unit-cleanup',
    schemaContract: false,
  });

  assert.equal(report.passed, false);
  assert.match(report.fatalError, /simulated second-account failure/);
  assert.equal(createdA, false);
  assert.deepEqual(report.cleanup.map((item) => item.passed), [true]);
});

test('schema mismatch stops before any disposable row is created', async () => {
  const config = validateConfig(baseEnv());
  const tokenA = jwt('authenticated', 'user-a');
  const tokenB = jwt('authenticated', 'user-b');
  let mutationCalls = 0;

  const fetchImpl = async (url, init) => {
    const target = new URL(url);
    if (target.pathname.includes('/auth/v1/token')) {
      const submitted = JSON.parse(init.body);
      const accountA = submitted.email === config.accounts[0].email;
      return jsonResponse({
        access_token: accountA ? tokenA : tokenB,
        user: { id: accountA ? 'user-a' : 'user-b' },
      });
    }
    if (init.method !== 'GET') mutationCalls += 1;
    if (target.pathname.endsWith('/rest/v1/businesses') &&
        target.searchParams.get('select') === 'id') {
      return jsonResponse([]);
    }
    return jsonResponse({ message: 'column does not exist' }, 400);
  };

  const report = await runRlsVerification(config, {
    fetchImpl,
    log: () => {},
    runId: 'unit-schema-mismatch',
    schemaContract: {
      tables: Object.fromEntries(REQUIRED_VNTAX_TABLES.map((table) => [table, ['id']])),
    },
  });

  assert.equal(report.passed, false);
  assert.match(report.fatalError, /schema contract failed/);
  assert.match(report.fatalError, /No mutation was performed/);
  assert.equal(mutationCalls, 0);
  assert.equal(report.cleanup.length, 0);
});
