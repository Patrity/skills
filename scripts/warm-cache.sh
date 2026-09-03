#!/usr/bin/env bash
# Warm every ISR entry the site can serve, so no visitor pays a cold function render.
# Run it after POST /api/revalidate purges the `skills` tag and after a production deploy.
#
#   bash scripts/warm-cache.sh https://skills.example.com
#
# Needs curl, jq and the repo's node_modules (it shells out to tsx for the URL list).
set -euo pipefail

SITE="${1:-${SITE_URL:-}}"
if [ -z "$SITE" ]; then
  echo "usage: warm-cache.sh <site-url>" >&2
  exit 2
fi
SITE="${SITE%/}"

for bin in curl jq; do
  command -v "$bin" >/dev/null || { echo "warm-cache.sh needs $bin" >&2; exit 2; }
done

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

fetch() { curl -fsS --max-time 30 --retry 1 "$@"; }

# These fetches are also what warms /sitemap.xml, /api/skills and /api/skills/<slug>,
# which is why buildWarmUrls leaves them out of its list.
fetch "$SITE/sitemap.xml" -o "$tmp/sitemap.xml"
fetch "$SITE/api/skills" -o "$tmp/skills.json"

# A Vercel ISR cache key includes the query string, and the client asks for
# `<route>/_payload.json?_b=<buildId>`, so warm exactly that URL and no other.
build_id="$(fetch "$SITE/_nuxt/builds/latest.json" 2>/dev/null | jq -r '.id // empty' || true)"
if [ -z "$build_id" ]; then
  echo "warm-cache.sh: could not read a build id from $SITE/_nuxt/builds/latest.json;" \
       "payload URLs will be warmed without ?_b= and may not be the ones clients request" >&2
else
  echo "warm-cache.sh: build id $build_id"
fi

n=0
while IFS= read -r slug; do
  [ -n "$slug" ] || continue
  n=$((n + 1))
  encoded="$(jq -rn --arg s "$slug" '$s|@uri')"
  fetch "$SITE/api/skills/$encoded" -o "$tmp/detail-$n.json"
done < <(jq -r '.skills[].slug' "$tmp/skills.json")

if [ "$n" -eq 0 ]; then
  echo "warm-cache.sh: $SITE/api/skills listed no bundles" >&2
  exit 1
fi

"$root/node_modules/.bin/tsx" "$root/scripts/warm-cache-urls.ts" \
  "$tmp/sitemap.xml" "$build_id" "$tmp"/detail-*.json > "$tmp/paths.txt"

total="$(wc -l < "$tmp/paths.txt" | tr -d ' ')"
echo "warm-cache.sh: warming $total URLs on $SITE ($n bundles)"

# NUL-delimited: an apostrophe in a filename would otherwise break xargs' quote parsing.
sed "s|^|$SITE|" "$tmp/paths.txt" | tr '\n' '\0' \
  | xargs -0 -P 8 -n 1 curl -s --max-time 30 --retry 1 -o /dev/null \
      -w '%{http_code} %{time_total}s %{url}\n' \
  > "$tmp/results.txt"

sort -k1,1 "$tmp/results.txt" | awk '{ count[$1]++ } END { for (c in count) printf "  %s  %d\n", c, count[c] }'

bad="$(awk '$1 !~ /^2/' "$tmp/results.txt" || true)"
if [ -n "$bad" ]; then
  echo "warm-cache.sh: non-2xx responses:" >&2
  echo "$bad" >&2
  exit 1
fi

slowest="$(sort -k2 -gr "$tmp/results.txt" | head -3)"
echo "warm-cache.sh: all $total URLs 2xx. Slowest:"
echo "$slowest" | sed 's/^/  /'
