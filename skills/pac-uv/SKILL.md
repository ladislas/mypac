---
name: pac-uv
description: "Use `uv` for Python workflows in this repo. Use when running Python scripts, adding dependencies, or replacing pip/python/venv commands."
license: MIT
compatibility: Pi coding agent; uv required.
metadata:
  author: mypac
  stage: shared
---

# Use uv for Python workflows

<!-- Original source: https://github.com/mitsuhiko/agent-stuff/blob/main/skills/uv/SKILL.md -->

## Quick Reference

```bash
uv run script.py                   # Run a script
uv run --with requests script.py   # Run with ad-hoc dependency
uv run python -m ast foo.py >/dev/null  # Verify syntax without writing __pycache__
uv add requests                    # Add dependency to project
uv init --script foo.py            # Create script with inline metadata
```

## Inline Script Dependencies

```python
# /// script
# requires-python = ">=3.12"
# dependencies = ["requests"]
# ///
```

See [scripts.md](scripts.md) for full details on running scripts, locking, and reproducibility.

## Build Backend

Use `uv_build` for pure Python packages:

```toml
[build-system]
requires = ["uv_build>=0.9.28,<0.10.0"]
build-backend = "uv_build"
```

See [build.md](build.md) for project structure, namespaces, and file inclusion.
