# STRATEGY — Agent Stack Research & the Skill Router

> Experiment thesis. Written before execution. Evidence-first: this document is
> the hypothesis; the dogfood results are the test.

## 1. The Problem

Agent harnesses (OpenCode, Claude Code, Codex, Grok Build) each ship their own
skill system, MCP wiring, and plugin surface. Users accumulate 100+ skills and
dozens of MCPs — but skill activation is a heuristic (prose-description
matching at session start), context bloat grows with every connected server,
and nothing is portable across harnesses. Users are handed down a stack; they
cannot cleanly bring their own.

## 2. The Thesis (wedge + moat)

- **Wedge** — a multi-harness agent plugin ("your stack, your rules, every
  harness") that demos the routing layer and drives adoption.
- **Moat** — the *skill routing layer*: a harness-agnostic registry format +
  task-time router protocol (progressive loading: index in context, detail on
  demand). Format lock-in + network effects. Standards get adopted; forks get
  absorbed.
- **Reach** — multi-harness support (OpenCode → Claude Code → Codex → Grok
  Build) via thin adapters over a shared core.

Infra precedent: MCP = spec + SDKs + reference servers. Terraform = format +
CLI. We write the standard in public (this repo), like MCP did.

## 3. Clean-Room Boundaries (legal)

Source of inspiration: oh-my-openagent (code-yeongyu/oh-my-openagent) —
**Sustainable Use License 1.0**: non-commercial, internal/personal use only.
We cannot fork-and-sell it. Rules:

1. **No copying** of omo source code, prompts, or docs verbatim.
2. **No reuse** of omo's agent names (Sisyphus, Hephaestus, ...) or keywords
   (ultrawork) — those read as knockoff.
3. Ideas, architecture patterns, and public protocol knowledge are free to
   reimplement from first principles (copyright protects expression, not ideas).
4. This repo's content is our own research and writing. Cite sources.
5. Our own license: registry format + spec = MIT/Apache-2.0 (open standard);
   product layer = ours.

## 4. What We Already Decided (ADR log)

- **ADR-001** — Install omo (Ultimate, OpenCode) as the orchestration layer;
  keep its hooks/team-mode; it's tool-agnostic by design.
- **ADR-002** — Disable omo's built-in MCPs (`websearch`, `context7`,
  `grep_app`); use our stack: firecrawl (self-hosted Docker :3002), searxng
  (:8888), context7 (same official server, identical tool names), gh-axi, and
  our memory/wiki layers (cognee, repowise).
- **ADR-003** — Patch Librarian prompt (only agent hardcoding external tool
  names; verified by repo-wide grep) to prefer our stack. Upgrade-safe via
  `file://` prompt override.
- **ADR-004** — Skill activation = task-time routing via our own router MCP
  (`find_skills` / `load_skill`), never config-time per-agent pinning.
- **ADR-005** — Progressive tool loading: index (one-liners, 10-30 tok/tool)
  in context; SKILL.md bodies load only when a skill is chosen (strict-lazy).
  Pattern validated by Anthropic's Apr 2026 numbers (150k → 2k tokens).
- **ADR-006** — Models: OpenCode Zen free tier + local providers only; no
  Claude subscription. Routing reference supplied by user.

## 5. Success Metrics (evidence before YC)

| Metric | Baseline | Target |
|---|---|---|
| Skill routing hit-rate | description-matching (unmeasured) | find_skills returns the right skill ≥ 80% |
| Context cost of skill catalog | all 100+ descriptions preloaded | index only (≈10-30 tok/skill) |
| Token savings (progressive loading) | preloaded baseline | ≥ 90% on search-heavy tasks |
| Cross-harness portability | 1 harness (OpenCode) | registry loads on ≥ 2 harnesses |
| MCP provenance | cloud/blocked | all research/search on local infra |

## 6. Open Questions

- Does skills-ride-MCP converge (skill-embedded MCPs), making "skill router" an
  MCP router? (Counter: our registry remains the neutral discovery layer.)
- Willingness to pay / who pays — OSS tooling today, company only with evidence.
- Contributor/author relationship with omo maintainer: upstream contribution or
  commercial license conversation (later, not now).

## 7. Non-Goals (now)

- No fork of omo. No selling anything. No YC pitch without metrics. No new
  harness adapters until the OpenCode dogfood proves the router.
