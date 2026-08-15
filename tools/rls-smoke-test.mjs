#!/usr/bin/env node
/**
 * Authenticated two-user RLS verifier.
 *
 * It uses only a publishable browser key and ordinary user tokens, requires
 * two separately provisioned disposable accounts with no businesses, requires
 * explicit mutation consent, never logs credentials, and verifies cleanup in
 * a finally block. Accounts must be created and confirmed through an approved
 * admin workflow, then deleted after the run. This tool never writes directly
 * to auth.users.
 */

import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

import {
  REQUIRED_VNTAX_TABLES,
  loadDatabaseContract,
} from './database-contract.mjs';

export const MUTATION_ACK = 'DELETE-DISPOSABLE-RLS-DATA';

export const SCOPED_TABLES = Object.freeze([
  'alerts',
  'audit_events',
  'business_documents',
  'connections',
  'deduction_groups',
  'export_packages',
  'financial_accounts',
  'memberships',
  'quarterly_estimates',
  'receipts',
  'sharing_grants',
  'tax_identities',
  'transactions',
]);

const FORBIDDEN_SHARED_SUPABASE_HOSTS = new Set([
  'rcmcqcinndypoupgjezi.supabase.co',
]);

// These bodies match the original public function signatures exactly. A
// made-up parameter would also produce HTTP 404 and could falsely imply that
// an exposed function had been removed from PostgREST.
const PRIVATE_RPC_PROBES = Object.freeze([
  { name: 'is_member_of', body: (businessId) => ({ b: businessId }) },
  { name: 'can_write_business', body: (businessId) => ({ b: businessId }) },
  { name: 'can_admin_business', body: (businessId) => ({ b: businessId }) },
  { name: 'role_in_business', body: (businessId) => ({ b: businessId }) },
  { name: 'shares_business_with', body: (_businessId, userId) => ({ other: userId }) },
]);

function decodeJwtPayload(token) {
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export function tokenRole(token) {
  const payload = decodeJwtPayload(token);
  return typeof payload?.role === 'string' ? payload.role : null;
}

export function looksPrivilegedKey(key) {
  const candidate = String(key).trim();
  if (candidate.startsWith('sb_secret_')) return true;
  return tokenRole(candidate) === 'service_role';
}

export function validateConfig(env) {
  const required = [
    'SUPABASE_URL',
    'SUPABASE_PUBLISHABLE_KEY',
    'RLS_EMAIL_A',
    'RLS_PASSWORD_A',
    'RLS_EMAIL_B',
    'RLS_PASSWORD_B',
  ];
  const missing = required.filter((name) => !String(env[name] ?? '').trim());
  if (missing.length) {
    throw new Error('Missing required environment variables: ' + missing.join(', '));
  }

  let url;
  try {
    url = new URL(env.SUPABASE_URL);
  } catch {
    throw new Error('SUPABASE_URL must be a valid URL.');
  }
  if (url.protocol !== 'https:') throw new Error('SUPABASE_URL must use HTTPS.');
  if (!url.hostname.endsWith('.supabase.co')) {
    throw new Error('SUPABASE_URL must be an approved *.supabase.co project URL.');
  }
  if (FORBIDDEN_SHARED_SUPABASE_HOSTS.has(url.hostname)) {
    throw new Error('Refusing the shared TrinityAI relay project; use a dedicated VNTax project.');
  }
  if (looksPrivilegedKey(env.SUPABASE_PUBLISHABLE_KEY)) {
    throw new Error('Refusing a secret or service-role key; this test must exercise RLS.');
  }
  if (env.RLS_EMAIL_A.trim().toLowerCase() === env.RLS_EMAIL_B.trim().toLowerCase()) {
    throw new Error('RLS_EMAIL_A and RLS_EMAIL_B must identify different accounts.');
  }
  if (env.RLS_PASSWORD_A === env.RLS_PASSWORD_B) {
    throw new Error('The two disposable accounts must not share a password.');
  }
  if (env.RLS_ALLOW_MUTATION !== MUTATION_ACK) {
    throw new Error('Set RLS_ALLOW_MUTATION=' + MUTATION_ACK +
      ' to acknowledge disposable test writes and cleanup.');
  }

  return {
    url: url.origin,
    publishableKey: env.SUPABASE_PUBLISHABLE_KEY.trim(),
    accounts: [
      { label: 'A', email: env.RLS_EMAIL_A.trim(), password: env.RLS_PASSWORD_A },
      { label: 'B', email: env.RLS_EMAIL_B.trim(), password: env.RLS_PASSWORD_B },
    ],
  };
}

async function readResponse(response) {
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: response.status, ok: response.ok, body };
}

function rows(result) {
  return Array.isArray(result.body) ? result.body : null;
}

function errorSummary(result) {
  if (typeof result.body === 'string') return result.body.slice(0, 200);
  if (result.body && typeof result.body === 'object') {
    return String(
      result.body.message ?? result.body.error_description ??
      result.body.error ?? result.body.code ?? ''
    ).slice(0, 200);
  }
  return 'HTTP ' + result.status;
}

export function isRlsDenial(result) {
  const text = errorSummary(result).toLowerCase();
  return result.status === 401 || result.status === 403 ||
    text.includes('row-level security') || text.includes('permission denied') ||
    result.body?.code === '42501';
}

function extractBusinessId(result) {
  const candidate = Array.isArray(result.body) ? result.body[0] : result.body;
  return typeof candidate?.id === 'string' ? candidate.id : null;
}

export async function runRlsVerification(config, options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const log = options.log ?? ((line) => console.log(line));
  const runId = options.runId ?? randomUUID();
  const checks = [];
  const cleanup = [];
  const sessions = new Map();
  const created = [];
  const schemaContract = options.schemaContract === false
    ? null
    : (options.schemaContract ?? loadDatabaseContract());

  const record = (label, passed, detail = '') => {
    checks.push({ label, passed, detail });
    log((passed ? 'PASS ' : 'FAIL ') + label + (detail ? ' -- ' + detail : ''));
  };

  const request = async (path, init = {}) => {
    const response = await fetchImpl(new URL(path, config.url + '/'), init);
    return readResponse(response);
  };

  const authHeaders = (token) => ({
    apikey: config.publishableKey,
    ...(token ? { Authorization: 'Bearer ' + token } : {}),
    'Content-Type': 'application/json',
  });

  const rest = (token, method, path, body) => request('rest/v1/' + path, {
    method,
    headers: {
      ...authHeaders(token),
      Prefer: 'return=representation',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  const signIn = async (account) => {
    const result = await request('auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ email: account.email, password: account.password }),
    });
    const token = typeof result.body?.access_token === 'string' ? result.body.access_token : null;
    const userId = typeof result.body?.user?.id === 'string' ? result.body.user.id : null;
    if (!result.ok || !token || !userId) {
      throw new Error('Disposable account ' + account.label +
        ' could not sign in (' + errorSummary(result) + ').');
    }
    if (tokenRole(token) !== 'authenticated') {
      throw new Error('Disposable account ' + account.label +
        ' did not receive an authenticated user token.');
    }
    sessions.set(account.label, { token, userId });
    record('account ' + account.label + ' signed in with an ordinary authenticated token', true);
  };

  const confirmInitiallyEmpty = async (label) => {
    const session = sessions.get(label);
    const result = await rest(session.token, 'GET', 'businesses?select=id');
    const ownRows = rows(result);
    if (!result.ok || ownRows === null) {
      throw new Error('Could not inspect account ' + label +
        ' businesses (' + errorSummary(result) + ').');
    }
    if (ownRows.length !== 0) {
      throw new Error('Disposable account ' + label + ' already sees ' +
        ownRows.length + ' business row(s). Stop and use fresh empty accounts; no mutation was performed.');
    }
    record('account ' + label + ' starts with zero visible businesses', true);
  };

  const confirmSchemaContract = async (label) => {
    if (!schemaContract) return;
    const session = sessions.get(label);
    for (const table of REQUIRED_VNTAX_TABLES) {
      const columns = schemaContract.tables[table];
      const result = await rest(
        session.token,
        'GET',
        table + '?select=' + columns.join(',') + '&limit=0',
      );
      if (!result.ok || rows(result) === null) {
        throw new Error(
          'Database schema contract failed for ' + table +
          ' (' + errorSummary(result) + '). No mutation was performed.',
        );
      }
      record('database exposes expected ' + table + ' columns', true);
    }
  };

  const createBusiness = async (label) => {
    const session = sessions.get(label);
    const result = await rest(session.token, 'POST', 'rpc/create_business', {
      p_legal_name: 'RLS Disposable ' + label + ' ' + runId,
      p_industry: 'restaurant',
      p_entity_type: 'single_member_llc',
      p_address: {
        line1: '1 Disposable Test Way',
        city: 'Washington',
        state: 'DC',
        postalCode: '20001',
        localityId: '',
      },
    });
    const businessId = extractBusinessId(result);
    if (!result.ok || !businessId) {
      throw new Error('Account ' + label +
        ' could not create its disposable business (' + errorSummary(result) + ').');
    }
    created.push({ label, businessId });
    record('account ' + label + ' created its disposable business', true);
    return businessId;
  };

  const confirmEmpty = (label, result) => {
    const resultRows = rows(result);
    record(label, result.ok && resultRows?.length === 0,
      result.ok && resultRows ? resultRows.length + ' row(s)' : errorSummary(result));
  };

  const cleanupBusiness = async (item) => {
    const session = sessions.get(item.label);
    if (!session) return;
    const id = encodeURIComponent(item.businessId);
    const deletion = await rest(session.token, 'DELETE', 'businesses?id=eq.' + id);
    const verify = await rest(session.token, 'GET', 'businesses?select=id&id=eq.' + id);
    const absent = verify.ok && Array.isArray(verify.body) && verify.body.length === 0;
    cleanup.push({
      label: item.label,
      businessId: item.businessId,
      passed: deletion.ok && absent,
    });
    log((deletion.ok && absent ? 'PASS ' : 'FAIL ') +
      'cleanup business for account ' + item.label +
      (deletion.ok && absent ? '' : ' -- ' + errorSummary(deletion)));
  };

  let fatalError = null;
  try {
    for (const account of config.accounts) await signIn(account);
    await confirmInitiallyEmpty('A');
    await confirmInitiallyEmpty('B');
    await confirmSchemaContract('A');

    const businessA = await createBusiness('A');
    const businessB = await createBusiness('B');
    const sessionA = sessions.get('A');
    const sessionB = sessions.get('B');

    const profileA = await rest(
      sessionA.token,
      'GET',
      'profiles?select=id,email,display_name,locale',
    );
    record(
      'profile trigger exposes exactly A own profile',
      profileA.ok && Array.isArray(profileA.body) && profileA.body.length === 1 &&
        profileA.body[0]?.id === sessionA.userId,
    );

    const membershipA = await rest(
      sessionA.token,
      'GET',
      'memberships?select=business_id,role,accepted_at&business_id=eq.' +
        encodeURIComponent(businessA),
    );
    record(
      'business trigger creates A accepted owner membership',
      membershipA.ok && Array.isArray(membershipA.body) && membershipA.body.length === 1 &&
        membershipA.body[0]?.role === 'owner' && Boolean(membershipA.body[0]?.accepted_at),
    );

    confirmEmpty(
      'A cannot read B profile',
      await rest(
        sessionA.token,
        'GET',
        'profiles?select=id&id=eq.' + encodeURIComponent(sessionB.userId),
      ),
    );
    confirmEmpty(
      'anonymous browser key reads zero businesses',
      await rest(null, 'GET', 'businesses?select=id'),
    );

    for (const table of ['businesses', ...SCOPED_TABLES]) {
      const key = table === 'businesses' ? 'id' : 'business_id';
      confirmEmpty(
        'A reads zero rows from B ' + table,
        await rest(
          sessionA.token,
          'GET',
          table + '?select=' + key + '&' + key + '=eq.' + encodeURIComponent(businessB),
        ),
      );
      confirmEmpty(
        'B reads zero rows from A ' + table,
        await rest(
          sessionB.token,
          'GET',
          table + '?select=' + key + '&' + key + '=eq.' + encodeURIComponent(businessA),
        ),
      );
    }

    const crossPatch = await rest(
      sessionA.token,
      'PATCH',
      'businesses?id=eq.' + encodeURIComponent(businessB),
      { legal_name: 'RLS violation ' + runId },
    );
    confirmEmpty('A updates zero rows in B business', crossPatch);
    const unchangedB = await rest(
      sessionB.token,
      'GET',
      'businesses?select=legal_name&id=eq.' + encodeURIComponent(businessB),
    );
    record(
      'B business remains unchanged after A update attempt',
      unchangedB.ok && Array.isArray(unchangedB.body) && unchangedB.body.length === 1 &&
        unchangedB.body[0]?.legal_name === 'RLS Disposable B ' + runId,
    );

    const crossTransaction = await rest(sessionA.token, 'POST', 'transactions', {
      business_id: businessB,
      amount: 100,
      posted_at: '2026-01-01T00:00:00Z',
      merchant_raw: 'RLS disposable probe',
    });
    record(
      'A cannot insert a transaction into B',
      isRlsDenial(crossTransaction),
      errorSummary(crossTransaction),
    );

    const crossDocument = await rest(sessionA.token, 'POST', 'business_documents', {
      business_id: businessB,
      title: 'RLS disposable probe',
    });
    record(
      'A cannot insert a document into B',
      isRlsDenial(crossDocument),
      errorSummary(crossDocument),
    );

    const crossMembership = await rest(sessionA.token, 'POST', 'memberships', {
      business_id: businessB,
      user_id: sessionA.userId,
      role: 'owner',
    });
    record(
      'A cannot grant itself membership in B',
      isRlsDenial(crossMembership),
      errorSummary(crossMembership),
    );

    for (const probe of PRIVATE_RPC_PROBES) {
      const result = await rest(
        sessionA.token,
        'POST',
        'rpc/' + probe.name,
        probe.body(businessB, sessionB.userId),
      );
      record(
        'private authorization RPC ' + probe.name + ' is not exposed',
        result.status === 404,
        'HTTP ' + result.status,
      );
    }

    const anonCreate = await rest(null, 'POST', 'rpc/create_business', {
      p_legal_name: 'Anonymous RLS probe ' + runId,
    });
    record(
      'anonymous browser key cannot call create_business',
      anonCreate.status === 401 || anonCreate.status === 403 ||
        anonCreate.status === 404 || isRlsDenial(anonCreate),
      errorSummary(anonCreate),
    );

    const ownA = await rest(
      sessionA.token,
      'GET',
      'businesses?select=id,created_by&id=eq.' + encodeURIComponent(businessA),
    );
    record(
      'A can read only its new business in the exact self query',
      ownA.ok && Array.isArray(ownA.body) && ownA.body.length === 1 &&
        ownA.body[0]?.id === businessA &&
        ownA.body[0]?.created_by === sessionA.userId,
    );
  } catch (error) {
    fatalError = error instanceof Error ? error.message : String(error);
    record('verification completed without a fatal setup or runtime error', false, fatalError);
  } finally {
    for (const item of [...created].reverse()) {
      try {
        await cleanupBusiness(item);
      } catch (error) {
        cleanup.push({
          ...item,
          passed: false,
          detail: error instanceof Error ? error.message : String(error),
        });
        log('FAIL cleanup business for account ' + item.label);
      }
    }
  }

  const failedChecks = checks.filter((check) => !check.passed);
  const failedCleanup = cleanup.filter((item) => !item.passed);
  return {
    passed: fatalError === null && failedChecks.length === 0 &&
      created.length === 2 && cleanup.length === 2 && failedCleanup.length === 0,
    runId,
    checks,
    cleanup,
    fatalError,
  };
}

async function main() {
  let config;
  try {
    config = validateConfig(process.env);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
    return;
  }

  console.log('Running authenticated two-user RLS verification with disposable empty accounts.');
  console.log('Tokens, passwords, and emails will not be printed.');
  const report = await runRlsVerification(config);
  const passed = report.checks.filter((check) => check.passed).length;
  console.log('Result: ' + passed + '/' + report.checks.length +
    ' checks passed; ' +
    report.cleanup.filter((item) => item.passed).length + '/' +
    report.cleanup.length + ' cleanups confirmed.');
  if (!report.passed) {
    if (report.cleanup.some((item) => !item.passed)) {
      console.error('CRITICAL: automatic cleanup was not fully confirmed.');
      console.error('Use this run ID in an approved admin cleanup workflow: ' + report.runId);
    }
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) await main();
