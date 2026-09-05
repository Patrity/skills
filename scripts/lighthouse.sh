#!/usr/bin/env bash
# Lighthouse (mobile preset) on the three pages the redesign must not regress.
# Usage: bash scripts/lighthouse.sh https://skills.patrity.com docs/design/lighthouse-YYYY-MM-DD-before.json
set -euo pipefail
base="${1:?base url}"; out="${2:?output json}"
tmp="$(mktemp -d)"
echo '{}' > "$out"
for path in / /skills /skill/nuxt; do
  pnpm dlx lighthouse@12 "${base}${path}" --only-categories=performance,accessibility --preset=perf --form-factor=mobile \
    --screenEmulation.mobile --quiet --chrome-flags='--headless=new' --output=json --output-path="$tmp/report.json" >/dev/null
  node -e '
    const [outPath, path, reportPath] = process.argv.slice(1)
    const fs = require("fs")
    const r = JSON.parse(fs.readFileSync(reportPath, "utf8"))
    const o = JSON.parse(fs.readFileSync(outPath, "utf8"))
    o[path] = { performance: r.categories.performance.score, accessibility: r.categories.accessibility.score }
    fs.writeFileSync(outPath, JSON.stringify(o, null, 2) + "\n")
  ' "$out" "$path" "$tmp/report.json"
done
node -e '
  const o = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))
  console.log("| page | performance | accessibility |\n| --- | --- | --- |")
  for (const [p, s] of Object.entries(o)) console.log(`| ${p} | ${Math.round(s.performance * 100)} | ${Math.round(s.accessibility * 100)} |`)
' "$out"
