# Contributing

This is primarily a personal registry, but pull requests for genuinely reusable bundles are welcome.

## Add a bundle

1. Fork the repository and create `skills/<slug>/` (see [Bundle structure](/docs/bundle-structure)).
2. Write `README.md` with valid [frontmatter](/docs/frontmatter) and a body that explains what the bundle does and how to install it.
3. Run the validator locally:

   ```bash
   pnpm install
   pnpm validate:skills
   ```

4. Run the site against your working tree and check the page:

   ```bash
   pnpm dev
   # open http://localhost:3000/skill/<slug>
   ```

5. Open a pull request. CI runs the same validator plus the app's lint, typecheck, tests and build.

## What happens on merge

Bundle content is read from GitHub **at runtime**. Merging to `main`:

- skips the Vercel build when only `skills/**` changed (the Ignored Build Step in `vercel.json`);
- runs the `revalidate` workflow, which purges the cache tag and asserts the site now serves your commit.

Your bundle is live within seconds of the merge.

## Skill conventions

Three habits keep a bundle composable with the others. All three are about files a bundle must not
own.

**Read configuration from `.claude/.env`, never the repo root `.env`.** That separation is the
whole point: a project can hand Claude a read-only database replica while the app keeps its own
connection string. Declare each variable in the [`env` frontmatter](/docs/frontmatter) and let the
tool write `.claude/.env.example`.

```bash
set -a; . "$CLAUDE_PROJECT_DIR/.claude/.env"; set +a
```

```js
process.loadEnvFile('.claude/.env')
```

Python has no `.env` reader in its standard library, and a skill that adds `python-dotenv` for a
dozen lines hands every user of it a pip install. Parse the file:

```python
import os
from pathlib import Path

def load_claude_env(path=Path(__file__).resolve().parents[2] / '.env'):
    if not path.is_file():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        name, sep, value = line.partition('=')
        if not sep:
            continue
        value = value.strip()
        if len(value) > 1 and value[0] == value[-1] and value[0] in '"\'':
            value = value[1:-1]
        os.environ.setdefault(name.strip(), value)
```

`setdefault`, not assignment, so a value already exported in the shell wins. Where a skill has
dependencies anyway, `python-dotenv` reads the same file:

```python
from dotenv import dotenv_values

config = dotenv_values(Path(__file__).resolve().parents[2] / '.env')
```

Either way the path walks up from `.claude/skills/<name>/script.py` to `.claude/`, so a script one
level deeper needs `parents[3]`. Take an explicit path argument if it can be run from anywhere.

**Cache under your own skill directory, and declare it.** A skill that downloads or generates
anything writes it beside its own `SKILL.md`, so removing the skill removes the cache. Put the path
in the [`gitignore` frontmatter](/docs/frontmatter) and the tool adds it to the project's managed
block. The site never zips or serves a `cache/` directory anyway, so a committed cache is dead
weight in the repo and nothing else.

**Never ship a `.env.example` file.** The project gets exactly one, assembled from every installed
bundle, and a bundle that ships its own fails validation with a pointer to the `env` key.

## Ground rules

- No secrets, credentials, internal hostnames or IPs. Bundles are public.
- No generated caches. `cache/` directories are ignored anyway, but do not commit them.
- Keep bundles generic. Project-specific paths, theme mappings or account names belong in the user's own `CLAUDE.md`, not here.
- Lowercase tags, one concern per bundle.
- READMEs render as markdown with raw HTML allowed (scripts and event handlers are stripped), so bundle content is trusted at PR-review time — review it as you would any other code you merge.
