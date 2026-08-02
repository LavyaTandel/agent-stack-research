# MCP Tools vs. Skills vs. CLI: Context Cost and Capability Tradeoffs

## TL;DR

- **MCP** loads 200–500 tokens per tool definition every turn; a 5-server setup can hit 55k tokens before the user speaks. Code-execution MCP patterns cut this 98–99% (Anthropic, Cloudflare).
- **Skills** cost ~100 tokens at rest (name + description); full body loads only when triggered via progressive disclosure — 13x cheaper than naive MCP at 20 skills (Progressive Skills MCP benchmark).
- **CLI** is near-zero cost for tools in the model's training data, but requires shell access and inherits human credentials — governance hole for production.
- **Skill-embedded MCPs** (OMO's design) collapse knowledge + capability into one portable unit: skills carry their own MCP servers, spin up on demand, scoped to session, and tear down when done.
- **Discovery is converging**: skill routers and MCP routers both solve the same "which tool for this task" problem — the architectural implication is that the routing layer, not the protocol layer, becomes the real integration point.

---

## 1. Context Cost Comparison

| Mechanism | Protocol baseline per capability | When it wins |
|-----------|----------------------------------|--------------|
| **MCP tools** | 200–500 tokens/tool, every turn | Capabilities used on most turns; harnesses with tool search defer unused schemas to ~0 |
| **Skills** | ~100 tokens idle (name + desc), full body on trigger | Occasional capabilities; 100 skills installed, 99 idle cost nothing |
| **CLI** | 0 for well-known CLIs (in training data); 100s per `--help` for niche | Mature tools the model already knows (`gh`, `kubectl`, `aws`); persistent shell available |

**Key data points:**
- GitHub's official MCP server alone: tens of thousands of tokens ([Simon Willison, 2025](https://simonwillison.net/2025/Oct/16/claude-skills/))
- 5-server, 58-tool MCP setup: ~55k tokens of overhead per conversation turn ([MindStudio benchmark, 2026](https://maketocreate.com/claude-skills-vs-mcp-servers-when-to-use-each-2026/))
- Anthropic's code-execution MCP: 150k → 2k tokens (98.7% reduction) ([Anthropic Engineering](https://www.anthropic.com/engineering/code-execution-with-mcp))
- Cloudflare Code Mode: 99.9% reduction for Cloudflare-sized APIs ([Cloudflare blog](https://blog.cloudflare.com/code-mode-mcp))
- Progressive Skills MCP: 20 skills via 3 tools = ~150 tokens/request vs. ~2000 for naive MCP ([Progressive Skills MCP](https://github.com/Flowtrica/progressive-skills-mcp))

**The real cost isn't protocol choice — it's server design and harness optimization.** A well-designed code-execution MCP rivals skills' lazy profile. A bloated skill with a 5k-token body can exceed a single tool definition.

---

## 2. Activation Mechanisms

**MCP tools: always in context.** Every connected server's tool schemas load into the system prompt on every turn. Modern harnesses (Claude Code's tool search, Cursor's per-session toggles, `tools/list_changed`) gate unused schemas, but the protocol baseline is eager.

**Skills: description-matched at session start.** Only name + description (~100 tokens each) load into the system prompt. The runtime or model decides when to pull the full SKILL.md body. Progressive disclosure is the core design principle — Anthropic's docs define three levels: metadata (always), instructions (on trigger), resources/code (on read) ([Anthropic Agent Skills docs](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)).

**CLI: on demand via `--help`.** Zero baseline for well-known tools; iterative discovery loop for niche ones. Requires persistent shell access. Model's training-data priors do the discovery work for free when the tool is common enough.

---

## 3. Skill-Embedded MCPs: The Hybrid Pattern

OMO's (oh-my-openagent) skill-embedded MCP design collapses three things into one portable unit: prompt guidance, packaged capability, and external tool connectivity ([OMO docs](https://github.com/code-yeongyu/oh-my-openagent)).

**How it works:**
- A skill's `SKILL.md` frontmatter includes a `mcp_servers` array with server definitions (stdio or HTTP)
- The `SkillMcpManager` handles connection pooling, session scoping, retry/reconnect, idle cleanup, and teardown
- When the skill loads, its MCP servers spin up; when the session ends, they stop
- The agent accesses embedded MCP tools via a `skill_mcp` tool call

**OMO's three-tier MCP architecture:**
1. **Built-in remote MCPs** (Exa/websearch, Context7, grep.app) — platform defaults
2. **Claude Code compatibility layer** — imports from `.mcp.json`
3. **Skill-embedded MCPs** — bind capability to knowledge package

**Why this matters:** Traditional skills are "advice only" — they tell the agent what to do but can't provide the tool to do it. Traditional MCPs are "tools only" — they provide access but no procedural context. Skill-embedded MCPs make each skill an **executable knowledge package** — instructions + machinery in one deployable unit. This is closer to dependency packaging in software engineering than prompt snippet sharing ([0xtresser analysis](https://github.com/0xtresser/Claude-Code-VS-OpenCode/blob/main/EN/Chapter_10_OMO_Innovations/10.7_Skill_Embedded_MCPs.md)).

**Other implementations of this pattern:**
- `skills_mcp_server` ([chameleonbr](https://github.com/chameleonbr/skills_mcp_server)) — wraps Agno skills as MCP tools for n8n/custom agents
- `skillful-mcp` ([kurtisvg](https://github.com/kurtisvg/skillful-mcp)) — progressive disclosure MCP that turns servers into skills with 4 meta-tools
- `mcp-skill-hub` ([undermybelt](https://github.com/undermybelt/mcp-skill-hub)) — SKILL.md files served as shared registry over MCP with keyword routing
- `skills-mcp` ([Jignesh-Ponamwar](https://github.com/Jignesh-Ponamwar/skills-mcp)) — self-hostable skill registry on Cloudflare with 3-tier progressive disclosure and semantic search

---

## 4. SKILL.md Structure and Harness Consumption

**Required frontmatter fields:**
```yaml
---
name: my-skill-name        # kebab-case, max 64 chars
description: "What it does and WHEN to use it"  # max 1024 chars, primary trigger
---
```

**Optional fields:** `license`, `compatibility` (required tools/deps), `mcp_servers` (OMO extension), `permissions`, `category`

**How harnesses consume it:**
1. **Startup:** Load `name` + `description` of every installed skill into system prompt (~100 tokens each)
2. **Task match:** Model/runtime matches user request against descriptions; if matched, reads full SKILL.md via bash
3. **Resource loading:** Bundled files (scripts, references, templates) load only when the skill body references them
4. **Script execution:** Scripts run via bash and return only output — code itself never enters context

**Description quality matters disproportionately.** The description is the primary triggering mechanism. Anthropic's skill-creator skill explicitly instructs authors to be "pushy" because "Claude has a tendency to under-trigger skills" ([skill-creator SKILL.md](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md)). A SKILLROUTER study found that name+description alone causes 29–44pp degradation vs. full body for routing accuracy ([arXiv 2603.22455](https://arxiv.org/pdf/2603.22455)).

---

## 5. Skill Router → MCP Router Convergence

The routing problem is the same across both: given a user task, find the right capability from a large pool. The approaches differ:

| | Skill routing | MCP routing |
|---|---|---|
| **What's indexed** | SKILL.md files (name + description + optional body) | MCP server tool schemas |
| **Where routing happens** | Harness-level (model decides from descriptions) or external router | Gateway/proxy (L7 capability dispatch) |
| **Current approach** | Description matching + optional semantic search | Schema-aware dispatch with tool→backend mapping |
| **Scale concern** | ~80k skills in marketplaces; routing degrades without body access | 12,000+ MCP servers across 33 registries |

**The convergence signal:** Both are converging on the same architecture — a **routing layer** that sits between the agent and capabilities. The MCP proxy/router/gateway stack ([TrueFoundry analysis](https://www.truefoundry.com/blog/mcp-gateway-vs-proxy-vs-router)) already defines three tiers: proxy (L4 forwarding), router (L7 capability dispatch), gateway (L7 policy + auth). Skill routing adds a retrieval layer (semantic search + reranking) on top.

**The architectural implication:** The protocol layer (MCP vs. Skills) is becoming less important than the routing layer. A skill router that can dispatch to either SKILL.md files or MCP tool schemas — and dynamically scope capabilities per session — subsumes the "which protocol" question. OMO's `SkillMcpManager` and skill-embedded MCPs are an early version of this: the skill IS the routing unit, and the MCP server is just a bundled dependency.

---

## 6. Registry and Marketplace Landscape

**MCP registries (12,000+ servers across 33+ platforms):**

| Platform | Type | Scale | Best for |
|----------|------|-------|----------|
| Official MCP Registry | Canonical registry | Reference index | Upstream metadata, verification |
| Glama | Marketplace | 66k+ servers, 466k+ tools | Largest curated directory + quality scoring |
| mcp.so | Marketplace | 21k+ servers | Broad discovery |
| PulseMCP | Marketplace | 15k+ servers | Freshness, weekly updates |
| Smithery | Marketplace + hosting | 7k–8k servers | One-click hosted deployment |
| Docker MCP Catalog | Marketplace | Containerized | Security-scanned servers |

Discovery is fragmented across four markets: protocol registry (canonical metadata), community directories (human browsing), client galleries (Cursor/VS Code one-click install), and monetization platforms (Smithery, MCPize with payment rails) ([StudioMeyer field report](https://studiomeyer.io/en/blog/mcp-marketplaces-2026)).

**Skill marketplaces:**
- `anthropics/skills` — reference skill repository
- `skills.sh` — skill discovery/install CLI
- `skill-swarm-mcp` ([ancrz](https://github.com/ancrz/skill-swarm-mcp)) — searches 5 registries (Skills.sh, MCP Registry, Smithery, Glama, GitHub) with BM25F matching and trust scoring
- `vercel-labs/skills` — de facto installer

**Who owns discovery today:** MCP discovery is more mature (Glama indexes 66k+ servers with automated crawling). Skill discovery is catching up via MCP-delivered registries (skill-swarm-mcp, skills-mcp) that index SKILL.md files and serve them over MCP with semantic search. The practical pattern: **skills ride MCP for distribution** — the same protocol that delivers tools also delivers the skill catalog.

---

## Sources

- [MCP vs Skills vs CLI: which one wastes the least context?](https://usewire.io/blog/mcp-vs-skills-vs-cli-context-cost/) — Wire Blog, May 2026
- [Claude Skills are awesome, maybe a bigger deal than MCP](https://simonwillison.net/2025/Oct/16/claude-skills/) — Simon Willison, Oct 2025
- [Code execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp) — Anthropic Engineering
- [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) — Anthropic Engineering
- [Agent Skills overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview) — Claude Platform Docs
- [YAML Frontmatter spec](https://www.mintlify.com/anthropics/skills/creating-skills/frontmatter) — Anthropic Skills
- [Equipping agents for the real world with Agent Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills) — Anthropic Engineering, Oct 2025
- [Skill-Embedded MCPs — OMO](https://github.com/code-yeongyu/oh-my-openagent) — oh-my-openagent
- [Chapter 10.7: Skill-Embedded MCPs](https://github.com/0xtresser/Claude-Code-VS-OpenCode/blob/main/EN/Chapter_10_OMO_Innovations/10.7_Skill_Embedded_MCPs.md) — 0xtresser analysis
- [progressive-skills-mcp](https://github.com/Flowtrica/progressive-skills-mcp) — Flowtrica, Feb 2026
- [skillful-mcp](https://github.com/kurtisvg/skillful-mcp) — kurtisvg
- [mcp-skill-hub](https://github.com/undermybelt/mcp-skill-hub) — undermybelt, Apr 2026
- [skills-mcp](https://github.com/Jignesh-Ponamwar/skills-mcp) — Jignesh-Ponamwar, Apr 2026
- [skill-swarm-mcp](https://github.com/ancrz/skill-swarm-mcp) — ancrz, Feb 2026
- [skill-router-mcp](https://github.com/anujkumar8076/skill-router-mcp) — anujkumar8076
- [SKILLROUTER paper](https://arxiv.org/pdf/2603.22455) — arXiv, Mar 2026
- [MCP vs Skills: Why Skills Save Context Tokens](https://teamcopilot.ai/blog/mcp-vs-skills-why-skills-save-context-tokens) — TeamCopilot, Jun 2026
- [MCP Servers vs Agent Skills: Which to Build in 2026](https://www.developersdigest.tech/blog/mcp-servers-vs-agent-skills-2026) — Developers Digest, Jul 2026
- [MCP Marketplaces in April 2026](https://studiomeyer.io/en/blog/mcp-marketplaces-2026) — StudioMeyer
- [Best MCP Marketplaces & Registries 2026](https://designrevision.com/blog/best-mcp-marketplaces-and-registries) — DesignRevision
- [MCP Gateway vs. Proxy vs. Router](https://www.truefoundry.com/blog/mcp-gateway-vs-proxy-vs-router) — TrueFoundry, May 2026
- [Are MCP Servers Going Obsolete?](https://peterkellner.net/2026-03-10-are-mcp-servers-going-obsolete-skills-vs-mcp/) — Peter Kellner, Mar 2026
- [MCP Servers vs. Agent Skills: When to Use Each](https://hammadhaqqani.com/blog/mcp-vs-skills-when-to-use-each) — Hammad Haqqani, Jul 2026
- [Glama MCP Registry](https://glama.ai/) — Glama
- [Smithery](https://smithery.ai/) — Smithery
