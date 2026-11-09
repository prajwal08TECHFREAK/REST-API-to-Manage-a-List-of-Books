#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# End-to-end smoke test for the Books API, using curl (no test framework).
#
#   ./test.sh                          tests http://localhost:3000
#   BASE=http://localhost:4000 ./test.sh   tests a different port
#
# Start the server first:  npm start
# ---------------------------------------------------------------------------
set -u

BASE="${BASE:-http://localhost:3000}"
PASS=0
FAIL=0
STATUS=000
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

hr()    { printf '\n\033[1;36m-- %s\033[0m\n' "$1"; }
body()  { echo "     $(cat "$TMP")"; }

check() { # check <description> <expected-status>
  if [ "$2" = "$STATUS" ]; then
    printf '  \033[32mPASS\033[0m  %-34s [%s]\n' "$1" "$STATUS"
    PASS=$((PASS + 1))
  else
    printf '  \033[31mFAIL\033[0m  %-34s [expected %s, got %s]\n' "$1" "$2" "$STATUS"
    FAIL=$((FAIL + 1))
  fi
}

# req <METHOD> <PATH> [JSON_BODY]
# Sets the global $STATUS and writes the response body to $TMP.
req() {
  local method="$1" path="$2" payload="${3:-}" out
  if [ -n "$payload" ]; then
    out=$(curl -s -w '\n%{http_code}' -X "$method" "$BASE$path" \
          -H 'Content-Type: application/json' -d "$payload")
  else
    out=$(curl -s -w '\n%{http_code}' -X "$method" "$BASE$path")
  fi
  STATUS="${out##*$'\n'}"
  printf '%s' "${out%$'\n'*}" > "$TMP"
}

# Fail fast if the server is not running.
if ! curl -s -o /dev/null "$BASE/health"; then
  echo "Cannot reach the API at $BASE"
  echo "Start it first with:  npm start"
  exit 1
fi

echo "Testing Books API at $BASE"

hr "GET /health"
req GET /health
check "server is up" 200
body

hr "GET /books  (list all)"
req GET /books
check "returns 200" 200
body

hr "POST /books  (create)"
req POST /books '{"title":"The Hobbit","author":"J.R.R. Tolkien"}'
check "returns 201 Created" 201
body
NEW_ID=$(sed -n 's/.*"id":\([0-9]*\).*/\1/p' "$TMP" | head -1)
echo "     -> new book id = $NEW_ID"

hr "POST /books  (validation)"
req POST /books '{"title":"No Author Here"}'
check "missing author -> 400" 400
body

req POST /books '{"title":"   ","author":""}'
check "blank strings -> 400" 400
body

req POST /books '{"title":broken json}'
check "malformed JSON -> 400" 400
body

req POST /books '{"id":99,"title":"Sneaky","author":"Client"}'
check "client-supplied id -> 400" 400
body

hr "GET /books/$NEW_ID  (read one)"
req GET "/books/$NEW_ID"
check "returns 200" 200
body

hr "PUT /books/$NEW_ID  (full update)"
req PUT "/books/$NEW_ID" '{"title":"The Hobbit (2nd ed.)","author":"J.R.R. Tolkien"}'
check "returns 200" 200
body

hr "PATCH /books/$NEW_ID  (partial update)"
req PATCH "/books/$NEW_ID" '{"author":"Tolkien, J.R.R."}'
check "returns 200" 200
body

hr "GET /books?search=hobbit  (filter)"
req GET "/books?search=hobbit"
check "returns 200" 200
body

hr "DELETE /books/$NEW_ID"
req DELETE "/books/$NEW_ID"
check "returns 204 No Content" 204

hr "Negative cases"
req GET "/books/$NEW_ID"
check "GET deleted id -> 404" 404
body

req GET /books/9999
check "GET unknown id -> 404" 404

req PUT /books/9999 '{"title":"X","author":"Y"}'
check "PUT unknown id -> 404" 404

req DELETE /books/9999
check "DELETE unknown id -> 404" 404

req GET /books/abc
check "non-numeric id -> 400" 400

req GET /nope
check "unknown route -> 404" 404

hr "Summary"
printf '  %d passed, %d failed\n\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
