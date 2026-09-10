/**
 * Loads the generated Supabase database type as a structural contract.
 *
 * The authenticated RLS verifier uses this contract to ask PostgREST for
 * every expected column with limit=0 before creating disposable rows. This is
 * structural evidence only; it does not replace migration provenance, RLS
 * isolation, trigger checks, or an authoritative schema export.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const REQUIRED_VNTAX_TABLES = Object.freeze([
  'alerts',
  'audit_events',
  'business_documents',
  'businesses',
  'connections',
  'deduction_groups',
  'export_packages',
  'financial_accounts',
  'localities',
  'memberships',
  'profiles',
  'quarterly_estimates',
  'receipts',
  'sharing_grants',
  'tax_identities',
  'transactions',
]);

export const REQUIRED_CREATE_BUSINESS_ARGS = Object.freeze([
  'p_address',
  'p_dba_name',
  'p_entity_type',
  'p_industry',
  'p_legal_name',
  'p_phone',
]);

function propertyName(member) {
  if (!member.name) return null;
  if (ts.isIdentifier(member.name) || ts.isStringLiteral(member.name)) {
    return member.name.text;
  }
  return null;
}

function propertyType(container, name) {
  if (!ts.isTypeLiteralNode(container)) {
    throw new Error('Expected a type literal while locating ' + name + '.');
  }
  const member = container.members.find((candidate) =>
    ts.isPropertySignature(candidate) && propertyName(candidate) === name
  );
  if (!member?.type) throw new Error('Generated database type is missing ' + name + '.');
  return member.type;
}

function literalProperties(node, context) {
  if (!ts.isTypeLiteralNode(node)) {
    throw new Error('Expected a type literal for ' + context + '.');
  }
  return node.members
    .filter(ts.isPropertySignature)
    .map(propertyName)
    .filter((name) => typeof name === 'string')
    .sort();
}

export function extractDatabaseContract(source) {
  const sourceFile = ts.createSourceFile(
    'database.ts',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const alias = sourceFile.statements.find((statement) =>
    ts.isTypeAliasDeclaration(statement) && statement.name.text === 'Database'
  );
  if (!alias) throw new Error('Generated database type alias Database was not found.');

  const publicType = propertyType(alias.type, 'public');
  const tablesType = propertyType(publicType, 'Tables');
  const functionsType = propertyType(publicType, 'Functions');
  if (!ts.isTypeLiteralNode(tablesType) || !ts.isTypeLiteralNode(functionsType)) {
    throw new Error('Generated database Tables or Functions is not a type literal.');
  }

  const tables = {};
  for (const member of tablesType.members.filter(ts.isPropertySignature)) {
    const name = propertyName(member);
    if (!name || !member.type) continue;
    const rowType = propertyType(member.type, 'Row');
    tables[name] = literalProperties(rowType, name + '.Row');
  }

  const functions = {};
  for (const member of functionsType.members.filter(ts.isPropertySignature)) {
    const name = propertyName(member);
    if (!name || !member.type) continue;
    const argsType = propertyType(member.type, 'Args');
    functions[name] = literalProperties(argsType, name + '.Args');
  }

  return { tables, functions };
}

export function validateDatabaseContract(contract) {
  for (const table of REQUIRED_VNTAX_TABLES) {
    const columns = contract?.tables?.[table];
    if (!Array.isArray(columns) || columns.length === 0) {
      throw new Error('Generated database contract is missing table ' + table + '.');
    }
  }
  const args = contract?.functions?.create_business;
  if (!Array.isArray(args)) {
    throw new Error('Generated database contract is missing function create_business.');
  }
  for (const arg of REQUIRED_CREATE_BUSINESS_ARGS) {
    if (!args.includes(arg)) {
      throw new Error('Generated create_business contract is missing argument ' + arg + '.');
    }
  }
  return contract;
}

export function loadDatabaseContract(filePath) {
  const defaultPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'src',
    'types',
    'database.ts',
  );
  const source = fs.readFileSync(filePath ?? defaultPath, 'utf8');
  return validateDatabaseContract(extractDatabaseContract(source));
}
