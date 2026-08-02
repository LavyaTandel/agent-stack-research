# AI Coding Agent Harness Landscape 2026: Extensibility Surfaces

*Researched 2026-08-02 · Covers OpenCode, Claude Code, Codex CLI, Grok Build, Cursor, Senpi, and omo*

## TL;DR

- **Every major harness now ships skills + MCP + hooks + plugins.** The primitives have converged; the difference is in packaging, trust models, and runtime language.
- **Skills are universally `SKILL.md` files** with YAML frontmatter (`name`, `description`), discovered from well-known paths. Cross-harness skill portability is nearly free.
- **MCP is the universal tool protocol.** All harnesses support it. The delta is config format (JSON vs TOML) and scope precedence, not capability.
- **Hooks are the governance surface.** All five terminal harnesses converge on PreToolUse/PostToolUse/Session lifecycle hooks. Event names differ but the pattern is identical.
- **OpenCode is easiest to port to** (MIT, programmatic TS plugins, SKILL.md compat). **Claude Code is hardest** (closed source, proprietary plugin format, hook schema differences).

## Per-Harness Breakdown

### OpenCode

**Skills:** `SKILL.md` in `.opencode/skills/`, `~/.config/opencode/skills/`, `.claude/skills/`, `.agents/skills/`. YAML frontmatter with `name` + `description`. Loaded on-demand via native `skill` tool — agent sees descriptions, loads full content when needed. Per-agent permission overrides in `opencode.json`. ([opencode.ai/docs/skills](https://opencode.ai/docs/skills/))

**MCP:** Configured in `opencode.json` under `mcpServers`. Static at session start. Supports stdio and remote servers. ([opencode.ai/docs/mcp-servers](https://opencode.ai/docs/mcp-servers/))

**Plugins:** TypeScript/JS modules in `.opencode/plugins/` or npm packages in config. Programmatic hooks via `tool.execute.before`, `tool.execute.after`, `session.*`, `file.*`, `shell.env`, `experimental.session.compacting`. Plugins can add custom tools with Zod schemas. ([opencode.ai/docs/plugins](https://opencode.ai/docs/plugins/))

**Multi-agent:** Subagents via `subtask: true` in commands. No native multi-agent orchestration — that's where omo fills in. ([opencode.ai/docs/agents](https://opencode.ai/docs/agents/))

---

### Claude Code

**Skills:** `SKILL.md` files in `skills/` subdirectories. Auto-discovered from project, user, and plugin scopes. Skills activate based on task context matching the description. Plugin-scoped skills are namespaced. ([code.claude.com/docs/en/skills](https://code.claude.com/docs/en/features-overview))

**MCP:** Full MCP support with `managedMcpServers` (admin), project-level, and user-level config. Supports `http`, `sse`, and `stdio` transports. MCP servers register tools alongside built-in tools — indistinguishable to the agent. ([code.claude.com/docs/en/mcp](https://code.claude.com/docs/en/mcp))

**Plugins:** Bundles of skills, MCP servers, slash commands, hooks, and subagents. Distributed via `claude-plugins-official` marketplace or git repos. Plugin structure: `.claude-plugin/plugin.json` manifest + component directories. ([code.claude.com/docs/en/plugins](https://code.claude.com/docs/en/plugins))

**Hooks:** 7+ event types: `PreToolUse`, `PostToolUse`, `Stop`, `SubagentStop`, `SessionStart`, `SessionEnd`, `UserPromptSubmit`, `PreCompact`, `Notification`. Supports command, HTTP, prompt, and agent verifier hook types. JSON-on-stdin protocol with exit-code flow control. ([code.claude.com/docs/en/hooks](https://code.claude.com/docs/en/hooks-guide))

**Multi-agent:** Subagents with isolated context. Agent teams with shared tasks and peer-to-peer messaging. ([code.claude.com/docs/en/agent-teams](https://code.claude.com/docs/en/agent-teams))

---

### OpenAI Codex CLI

**Skills:** Extracted to separate crate in v0.117.0 alpha. Uses `AGENTS.md` for project-level instructions. Plugin marketplace (v0.117) bundles skills with MCP servers and app connectors. ([codex.danielvaughan.com](https://codex.danielvaughan.com/2026/03/27/codex-cli-in-2026-whats-new/))

**MCP:** Native MCP support. Plugin marketplace (March 2026, CLI 0.117) bundles MCP servers. `codex marketplace add` for installing from GitHub, git URLs, or local dirs. ([openai/codex](https://github.com/openai/codex))

**Plugins:** `.codex-plugin/plugin.json` manifest. Plugins provide hooks, MCP servers, and skills. Plugin hook commands receive `PLUGIN_ROOT` and `PLUGIN_DATA` env vars. Enterprise plugin policy enforcement (allowlist). ([developers.openai.com/codex/hooks](https://developers.openai.com/codex/hooks))

**Hooks:** 10 event types — the broadest hook surface of any harness: `SessionStart`, `PreToolUse`, `PostToolUse`, `Stop`, `SubagentStart`, `SubagentStop`, `UserPromptSubmit`, `PreCompact`, `PostCompact`, `StopFailure`. JSON-on-stdin, exit-code flow control. Hooks are hashed for trust verification. ([developers.openai.com/codex/hooks](https://developers.openai.com/codex/hooks))

**Multi-agent:** Subagents GA (6 concurrent). Smart Approvals with guardian-based safety. Worktree-based isolation. ([codex.danielvaughan.com](https://codex.danielvaughan.com/2026/03/27/codex-cli-in-2026-whats-new/))

---

### Grok Build (xAI)

**Skills:** `SKILL.md` with YAML frontmatter: `description`, `allowed-tools`, `background`. Discovered from `.grok/skills/`, `.agents/skills/`, `.claude/skills/`, `~/.grok/skills/`, `~/.agents/skills/`, `~/.claude/skills/`, or `config.toml` paths. Dynamic discovery — new skills detected at runtime via `SkillManager`. ([deepwiki.com/xai-org/grok-build](https://deepwiki.com/xai-org/grok-build/4.2-skills-and-plugins))

**MCP:** Full MCP support via `use_tool` meta-tool dispatcher. Plugins can bundle MCP servers. ACP (Agent Client Protocol) for embedding in other apps. ([docs.x.ai/build/overview](https://docs.x.ai/build/overview))

**Plugins:** `plugin.json` manifest + component directories (skills, commands, hooks, MCP). Plugin marketplace with built-in partner plugins (MongoDB, Vercel, Sentry, Cloudflare). Trust model: `PluginScope` with `CliOverride/User > Project` precedence. Git-pinned SHAs for integrity. ([x.ai/news/grok-plugin-marketplace](https://x.ai/news/grok-plugin-marketplace))

**Hooks:** `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PermissionDenied`, `SessionStart`, `SessionEnd`, `Stop`, `StopFailure`, `PreCompact`, `PostCompact`. JSON-on-stdin or HTTP handlers. (via [deepwiki.com/xai-org/grok-build](https://deepwiki.com/xai-org/grok-build/4.5-hooks-and-extensions))

**Multi-agent:** Up to 8 parallel subagents in isolated git worktrees. Three-stage plan/search/build workflow. ([x.ai/news/grok-build-cli](https://x.ai/news/grok-build-cli))

---

### Cursor

**Skills:** `SKILL.md` in `.cursor/skills/`, `~/.cursor/skills/`. Plugin-bundled skills also supported (IDE loads from plugin cache; CLI parity is recent and fragile). ([forum.cursor.com](https://forum.cursor.com/t/cursor-agent-cli-does-not-register-skills-from-plugins/158947))

**MCP:** Native since v0.43. JSON config in Settings → Features → MCP. stdio transport. ([skillsindex.dev](https://skillsindex.dev/blog/best-ai-tools-cursor-ide-2026/))

**Plugins:** `.cursor-plugin/plugin.json` manifest. Bundles skills, rules (`.mdc`), commands, hooks (`hooks.json`), and MCP servers. Cursor Marketplace for distribution. Team marketplaces from GitHub, GitLab, BitBucket, Azure DevOps. ([cursor.com/blog/marketplace](https://cursor.com/blog/marketplace))

**Hooks:** `afterFileEdit`, `beforeShellExecution` in `hooks.json`. Narrower hook surface than terminal harnesses. ([startdebugging.net](https://startdebugging.net/2026/06/cursor-3-9-plugins-bundle-skills-rules-mcps-hooks/))

**Multi-agent:** Background Agent for async tasks. Subagents in Composer. Not as deep as terminal harness multi-agent.

---

### Senpi

**Skills:** Reuses OMO's skill system. Claude Code compatible `SKILL.md` format. ([github.com/code-yeongyu/senpi](https://github.com/code-yeongyu/senpi))

**MCP:** 3-tier MCP system inherited from OMO (native MCP, skill-embedded MCP, global MCP). ([github.com/code-yeongyu/senpi](https://github.com/code-yeongyu/senpi))

**Plugins:** TypeScript extensions via `senpi install` (npm or git packages). Extends via `.senpi/extensions/`. No plugin marketplace — install from npm/git directly. ([github.com/code-yeongyu/senpi](https://github.com/code-yeongyu/senpi))

**Hooks:** Inherited from OMO's hook system. IntentGate, continuation hooks, todo enforcers. ([github.com/code-yeongyu/senpi](https://github.com/code-yeongyu/senpi))

**Multi-agent:** Deliberately minimal — no subagents or plan mode by default. Install extensions for those. ([github.com/code-yeongyu/senpi](https://github.com/code-yeongyu/senpi))

---

### omo (oh-my-openagent) — Multi-Harness Refactor

**Current state (2026-08-02):** Package layering refactor in progress. 19 Core packages extracted (`utils`, `model-core`, `prompts-core`, `rules-engine`, `agents-md-core`, `skills-loader-core`, `mcp-client-core`, `omo-config-core`, etc.). Adapters for OpenCode (primary), Codex, Senpi, and standalone Pi goal/webfetch exist. Claude Code, Amp, Droid adapters remain exploratory. ([ROADMAP.md](https://github.com/code-yeongyu/oh-my-openagent/blob/dev/ROADMAP.md))

**Layer architecture:**
- **Core:** Pure TypeScript, no harness dependencies. 19 packages.
- **MCP:** External tool servers, stdio process boundary. Host-agnostic.
- **Skills:** Static `SKILL.md` files, no code.
- **Adapters:** Thin wrappers — import core, wrap in harness API, export.
- **Platform:** Generated Node launcher packages per target.

**Config:** `omo.json` schema landed (Senpi-first). OpenCode edition still reads `oh-my-openagent.json` — migration pending.

**Status:** Codex and Senpi adapters shipped. OpenCode is the largest adapter (still strongly coupled). Claude Code adapter is exploratory, not confirmed.

---

## Cross-Harness Analysis

### What a "Portable Agent Layer" Needs

| Concern | Shared Format | Harness Divergence |
|---|---|---|
| **Skills** | `SKILL.md` with `name` + `description` frontmatter | Nearly identical across OpenCode, Claude Code, Grok Build, Cursor. Portability is free. |
| **MCP Config** | JSON `mcpServers` object | Format is consistent. Scope precedence varies (local > project > user in most; admin layers in Claude Desktop). |
| **Hooks** | JSON-on-stdin, exit-code flow control, PreToolUse/PostToolUse | Event names differ slightly. Codex has 10 events, Claude Code 7+, Grok Build 10. Core pattern is identical. |
| **Plugins** | Directory with manifest + component subdirs | Manifest field names vary (`plugin.json` everywhere, but field schemas differ). OpenCode is the exception — uses TS modules, not JSON manifests. |
| **AGENTS.md** | Plain markdown, per-project | Adopted by 60K+ repos. Universal. |

### Adapter Requirements Per Harness

| Harness | Adapter Complexity | Notes |
|---|---|---|
| **OpenCode** | **Low** | MIT license, programmatic TS plugins, SKILL.md compat. Best portability target. |
| **Senpi** | **Low** | Already consumes omo Core packages directly. Lightest harness. |
| **Codex CLI** | **Medium** | JSON hooks compatible with omo's hook layer. Plugin manifest needs mapping. Closed-source model integration. |
| **Grok Build** | **Medium** | Open source (Apache 2.0), Rust harness. SKILL.md and hooks compatible. Plugin format maps. |
| **Claude Code** | **High** | Source-available, not open source. Proprietary plugin marketplace. Hook schema has extra fields (prompt/agent types). Skills overlap but plugin packaging differs. |
| **Cursor** | **High** | VS Code fork. Plugin format is `.cursor-plugin/`. Hook surface is narrow. IDE-specific (not terminal-first). |

### Easiest to Hardest to Port To

1. **OpenCode** — MIT, TS plugins, SKILL.md, omo already runs on it
2. **Senpi** — omo Core already consumed, minimal surface
3. **Codex CLI** — Hook convergence is real, plugin mapping needed
4. **Grok Build** — Open source, compatible primitives, Rust-specific
5. **Claude Code** — Proprietary hooks/plugins, largest divergence
6. **Cursor** — IDE-only, narrow hook surface, different architecture

### The Hook Convergence

Per Daniel Vaughan's analysis (June 2026), all five terminal harnesses converged independently on the same three-layer hook design: event emission → JSON-on-stdin dispatch → exit-code flow control. The delta between harnesses is shrinking. A portable governance layer needs only a thin adapter per harness — the underlying protocol is already de facto standard.

### What omo's Layering Gets Right

The Core/MCP/Skills/Adapters separation is the correct architecture for cross-harness portability. Skills (pure markdown) and MCP (stdio protocol) are inherently portable. The hard part is adapters — each harness's plugin API, hook schema, and session management differs. The ROADMAP's skepticism about premature abstraction ("the industry changes too fast") is well-founded. Write adapters thin and specific.

## Sources

- [OpenCode Skills](https://opencode.ai/docs/skills/) — Skill discovery, frontmatter, permissions
- [OpenCode Plugins](https://opencode.ai/docs/plugins/) — TS plugin system, events, custom tools
- [Claude Code Extensions](https://code.claude.com/docs/en/features-overview) — Skills, MCP, hooks, plugins, subagents, agent teams
- [Claude Code Hooks](https://code.claude.com/docs/en/hooks) — Hook events, prompt/agent hook types
- [Claude Desktop Extensions](https://claude.com/docs/third-party/claude-desktop/extensions) — Managed MCP, org plugins, marketplace
- [Codex CLI Hooks](https://developers.openai.com/codex/hooks) — 10-event hook surface, plugin hook integration
- [Codex CLI in 2026](https://codex.danielvaughan.com/2026/03/27/codex-cli-in-2026-whats-new/) — Models, subagents, enterprise features
- [Agent Hook Convergence](https://codex.danielvaughan.com/2026/06/25/agent-hook-convergence-codex-cli-claude-code-gemini-cli-kiro-opencode-portable-governance/) — Cross-harness hook comparison
- [Grok Build Open Source](https://x.ai/news/grok-build-open-source) — Apache 2.0 release
- [Grok Build Docs](https://docs.x.ai/build/overview) — Skills, plugins, ACP
- [Grok Build Plugin Marketplace](https://x.ai/news/grok-plugin-marketplace) — Partner plugins, trust model
- [Grok Build Skills & Plugins (DeepWiki)](https://deepwiki.com/xai-org/grok-build/4.2-skills-and-plugins) — Skill frontmatter, plugin registry, hook types
- [Cursor Plugins](https://cursor.com/blog/marketplace) — Plugin format, marketplace
- [Cursor 3.9 Plugins](https://startdebugging.net/2026/06/cursor-3-9-plugins-bundle-skills-rules-mcps-hooks/) — Plugin directory structure, hooks
- [Senpi README](https://github.com/code-yeongyu/senpi) — Minimal harness, OMO-derived
- [omo ROADMAP](https://github.com/code-yeongyu/oh-my-openagent/blob/dev/ROADMAP.md) — Package layering, adapter architecture, multi-harness status
- [AI Coding Agents 2026 (Codersera)](https://codersera.com/blog/ai-coding-agents-complete-guide-2026/) — May 2026 landscape overview
