#!/usr/bin/env python3
"""
Documentation Fetcher (template)

Fetches a library's docs straight out of its GitHub repository and caches them next
to this script. Copy this file to `.claude/skills/<lib>-docs/fetch.py`, fill in the
CONFIG block below, and delete this paragraph.

Standard library only — no pip installs. `curl` does the fetching.

Usage:
    python3 fetch.py <topic>            Fetch one topic
    python3 fetch.py <topic> --force    Bypass the cache
    python3 fetch.py --list             List available topics
    python3 fetch.py --status           Cache status
    python3 fetch.py --update-all       Re-fetch every cached topic
    python3 fetch.py --version          Print the installed package version
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path

# ─────────────────────────────── CONFIG ────────────────────────────────
# Everything you need to change lives between these two lines.

# Name of the generated skill; used in the User-Agent and in printed headings.
SKILL_NAME = "<lib>-docs"

# Where the docs live. Browse the repo first and confirm the path really exists:
# a wrong DOCS_PATH fails as a silent 404 on every topic.
REPO = "<owner>/<repo>"          # e.g. "nuxt/nuxt"
BRANCH = "main"                  # the branch or tag the docs are published from
DOCS_PATH = "docs"               # directory holding the docs, relative to the repo root
DOC_EXT = ".md"                  # ".md" or ".mdx" — whatever the repo uses

RAW_BASE = "https://raw.githubusercontent.com"
CACHE_TTL_HOURS = 24

# Optional: the package.json dependency name. Set it and every fetch reports the
# version actually installed in the project, and the cache busts when that version
# changes. Leave "" to disable version detection entirely.
PACKAGE_NAME = ""                # e.g. "nuxt"

# Optional: friendly topic → repo path (relative to DOCS_PATH, without DOC_EXT).
# Aliases are encouraged — several keys may point at the same path. Leave empty and
# the topic argument is used as a raw doc path, which is fine for flat docs trees.
TOPIC_MAP: dict[str, str] = {
    # "installation": "getting-started/installation",
    # "install": "getting-started/installation",
}

# Optional: grouping for --list. Keys are headings, values are TOPIC_MAP keys.
# Leave empty and --list prints every topic alphabetically.
CATEGORIES: dict[str, list[str]] = {
    # "Getting Started": ["installation", "configuration"],
}

# ───────────────────────────── end CONFIG ──────────────────────────────

SCRIPT_DIR = Path(__file__).parent
CACHE_DIR = SCRIPT_DIR / "cache"
MANIFEST_PATH = SCRIPT_DIR / "manifest.json"


def find_repo_root() -> Path:
    """Walk up from this script to the nearest folder holding a package.json."""
    here = SCRIPT_DIR.resolve()
    for parent in [here, *here.parents]:
        if (parent / "package.json").is_file():
            return parent
    return here


def detect_version(repo_root: Path) -> str | None:
    """Installed version of PACKAGE_NAME, or None when it cannot be determined."""
    if not PACKAGE_NAME:
        return None

    candidates = [repo_root / "node_modules" / Path(PACKAGE_NAME) / "package.json"]
    # pnpm keeps the real package under .pnpm when the top-level symlink is absent.
    pnpm_dir = repo_root / "node_modules" / ".pnpm"
    if pnpm_dir.is_dir():
        pattern = f"{PACKAGE_NAME.replace('/', '+')}@*/node_modules/{PACKAGE_NAME}/package.json"
        candidates.extend(sorted(pnpm_dir.glob(pattern))[-1:])

    for pkg_json in candidates:
        if pkg_json.is_file():
            try:
                version = json.loads(pkg_json.read_text()).get("version")
                if version:
                    return version
            except Exception:
                continue

    # Nothing installed — fall back to the range declared in package.json.
    root_pkg = repo_root / "package.json"
    if root_pkg.is_file():
        try:
            data = json.loads(root_pkg.read_text())
            for field in ("dependencies", "devDependencies", "peerDependencies"):
                declared = data.get(field, {}).get(PACKAGE_NAME)
                if declared:
                    return f"{declared} (declared, not installed)"
        except Exception:
            pass
    return None


def load_manifest() -> dict:
    if MANIFEST_PATH.exists():
        try:
            return json.loads(MANIFEST_PATH.read_text())
        except Exception:
            pass
    return {
        "source": f"https://github.com/{REPO}",
        "branch": BRANCH,
        "docs_path": DOCS_PATH,
        "installed_version": None,
        "topics": {},
    }


def save_manifest(manifest: dict) -> None:
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2))


def fetch_url(url: str) -> str | None:
    try:
        result = subprocess.run(
            ["curl", "-sL", "-H", f"User-Agent: Claude-Code-{SKILL_NAME}", url],
            capture_output=True, text=True, timeout=15,
        )
        if result.returncode == 0 and result.stdout and len(result.stdout) > 50:
            head = result.stdout[:200]
            if "404" in head and "Not Found" in head:
                return None
            return result.stdout
    except Exception as err:
        print(f"Error fetching {url}: {err}", file=sys.stderr)
    return None


def resolve(topic: str) -> str | None:
    """Map a user-supplied topic to a doc path (no DOCS_PATH prefix, no extension)."""
    key = topic.strip().lower()
    if key in TOPIC_MAP:
        return TOPIC_MAP[key]
    # Accept a raw path so a doc that predates the map is still reachable.
    if re.fullmatch(r"[a-z0-9._/-]+", key):
        return key
    return None


def source_url(doc_path: str) -> str:
    return f"{RAW_BASE}/{REPO}/{BRANCH}/{DOCS_PATH}/{doc_path}{DOC_EXT}"


def cache_key(doc_path: str) -> str:
    return doc_path.replace("/", "-")


def is_cache_valid(key: str, manifest: dict, force: bool, version: str | None) -> bool:
    if force:
        return False
    if version and manifest.get("installed_version") != version:
        return False  # version drift — a fresh doc against a stale version is worse than no doc
    entry = manifest.get("topics", {}).get(key)
    if not entry or not (CACHE_DIR / f"{key}{DOC_EXT}").is_file():
        return False
    age = datetime.now() - datetime.fromisoformat(entry["last_fetch"])
    return age < timedelta(hours=CACHE_TTL_HOURS)


def banner(version: str | None, doc_path: str, url: str) -> str:
    lines = [f"# {SKILL_NAME} — {doc_path}", ""]
    if PACKAGE_NAME:
        if version:
            lines.append(f"> Installed {PACKAGE_NAME}: **{version}**. These docs are from `{BRANCH}` —")
            lines.append("> cross-check anything that looks newer than your install.")
        else:
            lines.append(f"> Installed {PACKAGE_NAME}: **unknown** — could not read it from node_modules.")
            lines.append("> Verify against your lockfile before relying on version-specific advice.")
        lines.append(">")
    lines += [f"> Source: {url}", "", "---", ""]
    return "\n".join(lines)


def fetch_topic(topic: str, force: bool = False, quiet: bool = False) -> str | None:
    version = detect_version(find_repo_root())
    manifest = load_manifest()

    doc_path = resolve(topic)
    if doc_path is None:
        print(f"Unknown topic: {topic}", file=sys.stderr)
        print("Run --list to see available topics.", file=sys.stderr)
        return None

    key = cache_key(doc_path)
    url = source_url(doc_path)

    if is_cache_valid(key, manifest, force, version):
        if not quiet:
            print(f"Using cached docs for {doc_path} (use --force to refresh)", file=sys.stderr)
        return banner(version, doc_path, url) + (CACHE_DIR / f"{key}{DOC_EXT}").read_text()

    print(f"Fetching: {url}", file=sys.stderr)
    content = fetch_url(url)
    if content is None:
        print(f"Failed to fetch {url}", file=sys.stderr)
        return None

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    (CACHE_DIR / f"{key}{DOC_EXT}").write_text(content)

    manifest["installed_version"] = version
    manifest.setdefault("topics", {})[key] = {
        "doc_path": doc_path,
        "last_fetch": datetime.now().isoformat(),
        "source_path": f"{DOCS_PATH}/{doc_path}{DOC_EXT}",
    }
    save_manifest(manifest)

    return banner(version, doc_path, url) + content


def list_topics() -> None:
    version = detect_version(find_repo_root())
    suffix = f" (installed: {version})" if PACKAGE_NAME else ""
    print(f"=== {SKILL_NAME} topics{suffix} ===\n")

    if not TOPIC_MAP:
        print(f"No topic map configured — pass a doc path relative to {DOCS_PATH}/ instead.")
        return

    if CATEGORIES:
        listed: set[str] = set()
        for heading, topics in CATEGORIES.items():
            print(f"{heading}:")
            for topic in topics:
                print(f"  - {topic}")
                listed.add(topic)
            print()
        rest = sorted(set(TOPIC_MAP) - listed)
        if rest:
            print("Other:")
            for topic in rest:
                print(f"  - {topic}")
            print()
    else:
        for topic in sorted(TOPIC_MAP):
            print(f"  - {topic}")


def show_status() -> None:
    version = detect_version(find_repo_root())
    manifest = load_manifest()
    print(f"=== {SKILL_NAME} cache status ===\n")
    if PACKAGE_NAME:
        print(f"Installed {PACKAGE_NAME}: {version or 'unknown'}")
        print(f"Manifest version:   {manifest.get('installed_version') or 'unset'}")
    print(f"Source:             {REPO}@{BRANCH}/{DOCS_PATH}")
    print(f"Cache TTL:          {CACHE_TTL_HOURS}h\n")

    topics = manifest.get("topics", {})
    if not topics:
        print("No topics cached yet.")
        return
    print(f"Cached topics ({len(topics)}):")
    for key, data in sorted(topics.items()):
        age_h = (datetime.now() - datetime.fromisoformat(data["last_fetch"])).total_seconds() / 3600
        state = "fresh" if age_h < CACHE_TTL_HOURS else "stale"
        print(f"  {key:40} {state:6} ({age_h:.1f}h ago)")


def update_all() -> int:
    manifest = load_manifest()
    topics = manifest.get("topics", {})
    if not topics:
        print("No topics cached yet — nothing to update.", file=sys.stderr)
        return 0
    failed = 0
    for key, data in sorted(topics.items()):
        doc_path = data.get("doc_path", key)
        if fetch_topic(doc_path, force=True, quiet=True) is None:
            failed += 1
        else:
            print(f"  updated {doc_path}", file=sys.stderr)
    print(f"\n{len(topics) - failed}/{len(topics)} topics updated.", file=sys.stderr)
    return 1 if failed else 0


def main() -> None:
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(0)

    command = args[0]
    if command == "--list":
        list_topics()
    elif command == "--status":
        show_status()
    elif command == "--update-all":
        sys.exit(update_all())
    elif command == "--version":
        print(detect_version(find_repo_root()) or "unknown")
    elif command.startswith("-"):
        print(f"Unknown option: {command}", file=sys.stderr)
        sys.exit(1)
    else:
        content = fetch_topic(command, force="--force" in args)
        if content is None:
            sys.exit(1)
        print(content)


if __name__ == "__main__":
    main()
