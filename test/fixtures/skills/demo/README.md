---
name: Demo
description: A fixture bundle used by the test-suite.
tags: [demo, fixture]
author: Tester
authorUrl: https://example.com
requires: [python3]
gitignore: [".claude/skills/demo-skill/cache/"]
env:
  - { name: DEMO_TOKEN, description: "Token the demo skill sends.", required: false, example: "<token>" }
---

# Demo bundle

This README is rendered on `/skill/demo`.

```bash
echo "code blocks render too"
```
