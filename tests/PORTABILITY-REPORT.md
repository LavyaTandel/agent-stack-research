# Cross-Harness Portability Report

**Date:** 2026-08-04
**Status:** ✅ All adapters pass (20/20)

## Summary

The same `registry.json` (156 deduplicated skills) works across three agent
harnesses with zero data transformation. Adapters are thin path-mapping layers,
not forks.

## Tested Harnesses

| Harness | Adapter | Path Convention | Status |
|---------|---------|-----------------|--------|
| OpenCode | `opencode-adapter.js` | `~/.config/opencode/skills/<name>/SKILL.md` | ✅ |
| Claude Code | `claude-code-adapter.js` | `~/.claude/skills/<name>/SKILL.md` | ✅ |
| Codex | `codex-adapter.js` | `~/.codex/skills/<hash>/<name>/SKILL.md` | ✅ |

## Test Results

```
Schema Validation        8/8 ✓
File Existence           1/1 ✓
OpenCode Adapter         3/3 ✓
Claude Code Adapter      3/3 ✓
Codex Adapter            3/3 ✓
Cross-Harness Compat     2/2 ✓
```

## What each adapter does

- **OpenCode**: Native path — reads skills directly from `~/.config/opencode/skills/`
- **Claude Code**: Remaps paths — `opencode/` → `claude/` in the skill directory tree
- **Codex**: Hash-trusted paths — inserts a 12-char SHA-256 prefix for sandbox integrity

## Key finding

The registry format is harness-agnostic. Only path resolution differs.
The `id` field is the stable cross-harness identifier; paths are harness-local.
