# Skill Registry Format — v0.1 (DRAFT)

> The open, harness-agnostic registry format behind task-time skill routing.
> Status: draft for dogfooding. License: MIT / Apache-2.0 (this spec is the
> open part of the project by design).

## 1. Goals

- **Task-time routing, not config-time pinning.** Agents (or orchestrators)
  query the registry at the moment of need; no per-agent/per-project
  skill lists.
- **Cheap index.** A one-line summary per skill so the index stays in context
  at 10–30 tokens/skill (progressive loading pattern).
- **Cross-harness.** The registry is plain JSON/JSONC — any harness adapter
  reads it. SKILL.md bodies stay in place; the registry references them.
- **Deterministic fast path, semantic fallback.** Tag+keyword matching first
  (≈1ms), embedding similarity only when the fast path returns nothing good.

## 2. Registry schema

```jsonc
{
  "$schema": "./skill-registry.schema.json",
  "version": "0.1.0",
  "updated": "2026-08-02",
  "defaults": {
    "category_hierarchy": ["domain", "family", "skill"],
    "max_candidates": 3
  },
  "skills": [
    {
      "id": "design-taste-frontend",
      "summary": "Anti-slop frontend skill for landing pages and redesigns",
      "description": "Full description used by semantic fallback (may mirror SKILL.md body intro)",
      "tags": ["frontend", "design", "ui", "landing", "redesign", "anti-slop"],
      "aliases": ["taste", "frontend-design-taste"],
      "category": ["design", "frontend", "impeccable-family"],
      "version": "1.0.0",
      "location": {
        "harness": "opencode",
        "path": "~/.config/opencode/skills/design-taste-frontend/SKILL.md",
        "type": "file"
      },
      "related": ["huashu-design", "frontend-design", "impeccable"],
      "metadata": {
        "license": "MIT",
        "author": "community",
        "cost_tier": "cheap" // cheap | mid | expensive — routing hint
      }
    }
  ]
}
```

### Field rules

| Field | Required | Notes |
|---|---|---|
| `id` | yes | stable slug; unique |
| `summary` | yes | the only field that must stay in the index (~1 line, ≤160 chars) |
| `description` | no | for semantic fallback; derive from SKILL.md body if absent |
| `tags` | yes | 3–12 lowercase tags; the routing vocabulary |
| `aliases` | no | synonyms (task words → skill), the fast-path expansion table |
| `category` | no | up to 3 levels: `domain > family > skill` |
| `location` | yes | how the router resolves the body (file/URL; harness adapter applies) |
| `related` | no | co-trigger suggestions after a match |
| `metadata` | no | license/author/cost hints; trust-scoring input (see §5) |

## 3. Router protocol (two tools)

Local stdio MCP server exposing exactly two tools:

### `find_skills(task, opts?)`

- `task`: string — the work description (free text or category label).
- `opts.top_k` (default 3), `opts.category` (optional filter).
- **Fast path:** tokenize task → match tags + aliases (exact/prefix) → rank by
  tag-hit count. ~1ms, covers 80–90%.
- **Fallback:** if no candidate scores ≥ threshold → cosine similarity over
  `description` embeddings (indexed offline; SKILL.md bodies chunked when
  available).
- Returns `[{id, summary, tags, score, related[]}]`.

### `load_skill(id)`

- Returns the full skill: `{id, body, allowed_tools?, embedded_mcp?,
  model?, license, source_path}`.
- Router reads `location.path` (harness adapter may translate), parses
  SKILL.md frontmatter; embedded-MCP manifests passed through untouched.
- **Strict-lazy contract:** the body enters the agent context only on this
  call and should be allowed to fall out after the task.

## 4. Registry generation

A generator script walks skill directories
(`~/.config/opencode/skills/*/SKILL.md`, `~/.agents/skills/*/SKILL.md`,
project `.opencode/skills/*`) and emits the registry:
- `id` ← directory name
- `summary` ← SKILL.md frontmatter `description` (truncated) or first heading
- `tags` ← frontmatter `tags` + auto-derived keywords from body word-frequency
- `aliases` ← curated per skill (the human-tuning surface — this is where
  routing quality lives)

Regeneration is idempotent; `aliases` and `tags` are preserved across runs
(manual overrides in a sidecar `registry.overrides.jsonc`).

## 5. Known attack surface (routing as a trust boundary)

- **SKILL.md prompt injection** is documented in the research
  (`docs/05-routing-registry-patterns.md`): malicious skill descriptions can
  bias retrieval (86% win rate in adversarial tests). Mitigations in scope:
  - registry `metadata.trust` score (source provenance: user-authored vs
    downloaded marketplace)
  - router never executes skill content; it only routes
  - `allowed_tools` from frontmatter, enforced by the harness, not the skill
- Ratings in this draft are design intent, not implemented guarantees.

## 6. Versioning & governance (future)

- Registry + schema versioned separately from the router implementation.
- SEP-style change proposals once the format leaves dogfooding.
- Conformance tests: a fixture registry + golden router outputs.

## 7. Open questions (v0.1)

1. JSONC vs YAML for the registry (JSONC — comments for human curation).
2. Does the router need `list_categories()` as a third tool? (likely yes, cheap)
3. Embeddings: fastembed (local) vs provider — deferred until the fast path
   proves insufficient on real queries.
4. Cross-harness `location` mapping table (which harness → which skill dir)
   — first implementation supports OpenCode only.
