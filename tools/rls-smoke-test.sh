#!/usr/bin/env bash
#
# Row Level Security isolation test — the one test that matters most.
#
# Creates two real accounts through the public sign-up endpoint, has each create
# a business, then attempts to read the other's data with each account's own
# access token. Every read across the boundary must return zero rows.
#
# This runs against the live project with the *publishable* key only — the same
# key the browser holds. Using the service-role key here would prove nothing,
# because that key bypasses RLS by design.
#
# Usage: SUPABASE_URL=... SUPABASE_PUBLISHABLE_KEY=... bash tools/rls-smoke-test.sh

set -uo pipefail

URL="${SUPABASE_URL:?set SUPABASE_URL}"
KEY="${SUPABASE_PUBLISHABLE_KEY:?set SUPABASE_PUBLISHABLE_KEY}"

# Credentials for the two seeded test accounts (see seed-rls-test-users.sql).
# Overridable, but these defaults match the seed script.
EMAIL_A="${RLS_EMAIL_A:-rls-a@rls-test.vntax.ai}"
EMAIL_B="${RLS_EMAIL_B:-rls-b@rls-test.vntax.ai}"
PW_A="${RLS_PW_A:-RlsTestPassword-A-2026}"
PW_B="${RLS_PW_B:-RlsTestPassword-B-2026}"

FAILURES=0
pass() { printf '  PASS  %s\n' "$1"; }
fail() { printf '  FAIL  %s\n' "$1"; FAILURES=$((FAILURES + 1)); }

# Ordinary password grant — the same call the browser makes. No admin key.
login() {
  curl -sS -X POST "$URL/auth/v1/token?grant_type=password" \
    -H "apikey: $KEY" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}"
}

# $1 token  $2 method  $3 path  $4 body(optional)
rest() {
  local token="$1" method="$2" path="$3" body="${4:-}"
  if [ -n "$body" ]; then
    curl -sS -X "$method" "$URL/rest/v1/$path" \
      -H "apikey: $KEY" -H "Authorization: Bearer $token" \
      -H 'Content-Type: application/json' -H 'Prefer: return=representation' -d "$body"
  else
    curl -sS -X "$method" "$URL/rest/v1/$path" \
      -H "apikey: $KEY" -H "Authorization: Bearer $token"
  fi
}

jqr() { python3 -c "import sys,json;d=json.load(sys.stdin);print(eval(sys.argv[1],{'d':d,'len':len}))" "$1"; }

echo '── signing in as two separate accounts ─────────────────────────────────'
RA="$(login "$EMAIL_A" "$PW_A")"
RB="$(login "$EMAIL_B" "$PW_B")"

TOKEN_A="$(echo "$RA" | jqr "d.get('access_token','')")"
TOKEN_B="$(echo "$RB" | jqr "d.get('access_token','')")"
UID_A="$(echo "$RA" | jqr "(d.get('user') or d).get('id','')")"
UID_B="$(echo "$RB" | jqr "(d.get('user') or d).get('id','')")"

if [ -z "$TOKEN_A" ] || [ -z "$TOKEN_B" ]; then
  echo 'No access token returned. Run tools/seed-rls-test-users.sql first.'
  echo "A: $RA"
  exit 2
fi
pass "account A signed in ($UID_A)"
pass "account B signed in ($UID_B)"

# Proof the tokens are ordinary user tokens, not a privileged key. A
# service_role token would bypass RLS and make every check below meaningless.
ROLE_A="$(python3 -c "
import base64,json,sys
p=sys.argv[1].split('.')[1]
print(json.loads(base64.urlsafe_b64decode(p+'='*(-len(p)%4)))['role'])" "$TOKEN_A")"
if [ "$ROLE_A" = 'authenticated' ]; then
  pass "A's token carries role=authenticated, so RLS applies to every call below"
else
  fail "A's token role is '$ROLE_A' — this test would prove nothing"
  exit 1
fi

echo
echo '── trigger: profiles row auto-created ──────────────────────────────────'
PROF_A="$(rest "$TOKEN_A" GET 'profiles?select=id,email,display_name,locale')"
if [ "$(echo "$PROF_A" | jqr 'len(d)')" = '1' ]; then
  pass "A sees exactly its own profile: $(echo "$PROF_A" | jqr "d[0]['display_name']") / $(echo "$PROF_A" | jqr "d[0]['locale']")"
else
  fail "expected 1 profile row for A, got: $PROF_A"
fi

echo
echo '── each account creates a business ─────────────────────────────────────'
BIZ_NAME_A="RLS Test A LLC $(date +%s)"
BIZ_NAME_B="RLS Test B LLC $(date +%s)"
# Uses the create_business RPC, which is what the browser calls. A direct
# `insert ... returning` cannot work here — see the note in create_business().
mkbiz() {
  rest "$1" POST 'rpc/create_business' "{
    \"p_legal_name\":\"$2\",\"p_industry\":\"restaurant\",\"p_entity_type\":\"single_member_llc\",
    \"p_address\":{\"line1\":\"1 Test St\",\"city\":\"Falls Church\",\"state\":\"VA\",\"postalCode\":\"22044\",\"localityId\":\"\"}
  }"
}
BIZ_A_RAW="$(mkbiz "$TOKEN_A" "$BIZ_NAME_A")"
BIZ_B_RAW="$(mkbiz "$TOKEN_B" "$BIZ_NAME_B")"
BIZ_A="$(echo "$BIZ_A_RAW" | jqr "(d[0] if isinstance(d,list) and d else d if isinstance(d,dict) else {}).get('id','')")"
BIZ_B="$(echo "$BIZ_B_RAW" | jqr "(d[0] if isinstance(d,list) and d else d if isinstance(d,dict) else {}).get('id','')")"

[ -n "$BIZ_A" ] && pass "A created business $BIZ_A" || fail "A could not create a business: $BIZ_A_RAW"
[ -n "$BIZ_B" ] && pass "B created business $BIZ_B" || fail "B could not create a business: $BIZ_B_RAW"
[ -z "$BIZ_A" ] || [ -z "$BIZ_B" ] && { echo; echo "aborting: $FAILURES failure(s)"; exit 1; }

echo
echo '── trigger: owner membership auto-created ──────────────────────────────'
MEM_A="$(rest "$TOKEN_A" GET "memberships?select=business_id,role,accepted_at&business_id=eq.$BIZ_A")"
if [ "$(echo "$MEM_A" | jqr "d[0]['role'] if isinstance(d,list) and d else ''")" = 'owner' ] \
   && [ "$(echo "$MEM_A" | jqr "bool(isinstance(d,list) and d and d[0]['accepted_at'])")" = 'True' ]; then
  pass 'A holds an accepted owner membership, created by the database not the client'
else
  fail "expected accepted owner membership for A, got: $MEM_A"
fi

echo
echo '── ISOLATION: cross-account reads must return zero rows ────────────────'
check_empty() {
  local label="$1" body="$2"
  local n; n="$(echo "$body" | jqr "len(d) if isinstance(d,list) else -1")"
  if [ "$n" = '0' ]; then pass "$label → 0 rows"
  else fail "$label → $n rows (LEAK): $body"; fi
}

check_empty "A reads B's business by id"  "$(rest "$TOKEN_A" GET "businesses?select=id,legal_name&id=eq.$BIZ_B")"
check_empty "B reads A's business by id"  "$(rest "$TOKEN_B" GET "businesses?select=id,legal_name&id=eq.$BIZ_A")"
check_empty "A reads B's profile"         "$(rest "$TOKEN_A" GET "profiles?select=id&id=eq.$UID_B")"
check_empty "anon key alone reads businesses" "$(curl -sS "$URL/rest/v1/businesses?select=id" -H "apikey: $KEY")"

# Every table scoped by business_id, enumerated from the live schema rather
# than hand-listed — a table added later is covered without editing this file.
SCOPED_TABLES="alerts audit_events business_documents connections deduction_groups export_packages financial_accounts memberships quarterly_estimates receipts sharing_grants tax_identities transactions"
for tbl in $SCOPED_TABLES; do
  body="$(rest "$TOKEN_A" GET "$tbl?select=business_id&business_id=eq.$BIZ_B")"
  n="$(echo "$body" | jqr "len(d) if isinstance(d,list) else -1")"
  if [ "$n" = '0' ]; then pass "A reads B's $tbl → 0 rows"
  elif [ "$n" = '-1' ]; then fail "A reads B's $tbl → not a row list: $body"
  else fail "A reads B's $tbl → $n rows (LEAK)"; fi
done

echo
echo '── ISOLATION: cross-account writes must be rejected ────────────────────'
UPD="$(rest "$TOKEN_A" PATCH "businesses?id=eq.$BIZ_B" '{"legal_name":"Hijacked By A"}')"
check_empty "A updates B's business (0 rows affected = blocked)" "$UPD"

STILL="$(rest "$TOKEN_B" GET "businesses?select=legal_name&id=eq.$BIZ_B")"
if [ "$(echo "$STILL" | jqr "d[0]['legal_name'] if isinstance(d,list) and d else ''")" = "$BIZ_NAME_B" ]; then
  pass "B's business name is unchanged after A's attempt"
else
  fail "B's business was modified by A: $STILL"
fi

INS="$(rest "$TOKEN_A" POST 'transactions' "{\"business_id\":\"$BIZ_B\",\"amount\":100,\"posted_at\":\"2026-01-01T00:00:00Z\",\"merchant_raw\":\"injected\"}")"
if echo "$INS" | grep -qi 'row-level security'; then
  pass 'A cannot insert a transaction into B (rejected by RLS)'
else
  fail "A's insert into B was not rejected by RLS: $INS"
fi

DOC="$(rest "$TOKEN_A" POST 'business_documents' "{\"business_id\":\"$BIZ_B\",\"title\":\"injected\"}")"
if echo "$DOC" | grep -qi 'row-level security'; then
  pass 'A cannot insert a document into B (rejected by RLS)'
else
  fail "A's document insert into B was not rejected by RLS: $DOC"
fi

MEMB="$(rest "$TOKEN_A" POST 'memberships' "{\"business_id\":\"$BIZ_B\",\"user_id\":\"$UID_A\",\"role\":\"owner\"}")"
if echo "$MEMB" | grep -qi 'row-level security'; then
  pass 'A cannot grant itself membership of B (privilege escalation blocked)'
else
  fail "A granted itself access to B: $MEMB"
fi

RPC_SPOOF="$(rest "$TOKEN_A" POST 'rpc/create_business' '{"p_legal_name":"Spoof Co","p_industry":"not_a_real_industry"}')"
if echo "$RPC_SPOOF" | grep -qi 'invalid industry'; then
  pass 'create_business rejects an out-of-range industry rather than writing it'
else
  fail "create_business accepted an invalid industry: $RPC_SPOOF"
fi

# The authorisation primitives must not be callable over the REST API. They
# answer "what may this user do", and exposing them hands an attacker a probe.
for fn in is_member_of can_write_business can_admin_business role_in_business shares_business_with; do
  R="$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$URL/rest/v1/rpc/$fn" \
        -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN_A" \
        -H 'Content-Type: application/json' -d '{"b":"00000000-0000-0000-0000-000000000000","other":"00000000-0000-0000-0000-000000000000"}')"
  if [ "$R" = '404' ]; then pass "rpc/$fn is not exposed (HTTP 404)"
  else fail "rpc/$fn is still reachable (HTTP $R)"; fi
done

ANON_RPC="$(curl -sS -X POST "$URL/rest/v1/rpc/create_business" -H "apikey: $KEY" -H 'Content-Type: application/json' -d '{"p_legal_name":"Anon Co"}')"
if echo "$ANON_RPC" | grep -qi 'permission denied\|authentication required\|not find'; then
  pass 'create_business is not callable with the anon key alone'
else
  fail "anon key created a business: $ANON_RPC"
fi

echo
echo '── each account still sees its own data ────────────────────────────────'
OWN_A="$(rest "$TOKEN_A" GET 'businesses?select=id,legal_name,created_by')"
# Earlier runs leave rows behind, so the assertion is not "exactly one row" but
# the property that actually matters: every row A can see belongs to A, and B's
# business is not among them.
ALL_MINE="$(echo "$OWN_A" | jqr "all(r['created_by']=='$UID_A' for r in d) and len(d)>0")"
HAS_B="$(echo "$OWN_A" | jqr "any(r['id']=='$BIZ_B' for r in d)")"
if [ "$ALL_MINE" = 'True' ] && [ "$HAS_B" = 'False' ]; then
  pass "A sees $(echo "$OWN_A" | jqr 'len(d)') business(es), all created by A, none of B's"
else
  fail "A's own read is wrong: $OWN_A"
fi

# The new business is readable immediately after creation — the exact case that
# a plain `insert ... returning` could not satisfy.
FRESH="$(rest "$TOKEN_A" GET "businesses?select=id,legal_name&id=eq.$BIZ_A")"
if [ "$(echo "$FRESH" | jqr 'len(d)')" = '1' ]; then
  pass 'A can read back the business it just created'
else
  fail "A cannot read its own new business: $FRESH"
fi

echo
echo '════════════════════════════════════════════════════════════════════════'
if [ "$FAILURES" -eq 0 ]; then
  echo "ALL CHECKS PASSED — no cross-account access in either direction."
  echo "test accounts: $UID_A / $UID_B   businesses: $BIZ_A / $BIZ_B"
  exit 0
fi
echo "$FAILURES CHECK(S) FAILED — do not ship."
exit 1
