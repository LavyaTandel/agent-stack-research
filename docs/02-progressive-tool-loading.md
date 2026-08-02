# Progressive Tool Loading for MCP

**Research — August 2026**

## TL;DR

- Progressive tool loading defers full MCP tool schemas until the agent actually calls them, replacing preloaded catalogs with a compact index (name + one-line description, ~10–30 tokens/tool).
- Anthropic's `code-execution-with-MCP` pattern benchmarks at **150,000 → 2,000 input tokens** (98.7% reduction) on equivalent tasks — the same tools available, the same model, the same results.
- Four loading policies exist: strict-lazy (fetch/drop per call), sticky-lazy (keep used schemas for the session), bounded-sticky (LRU cache, most common default), and code-mediated (agent writes code in a sandbox, highest efficiency but requires infrastructure).
- Break-even is **15–30 tools**. Below that, index bookkeeping costs more than it saves. Above it, preloaded catalogs crowd out the user's actual question.
- The pattern extends to **Skills** — index name + description at startup, load `SKILL.md` body on demand, supporting scripts/resources only at execution time.

---

## What It Is

Progressive tool loading separates **discovery** from **invocation**. At session start the agent sees a minimal index: tool name, one-line purpose, server of origin. Full schemas — parameter descriptions, validation rules, examples — stay in the runtime, not in context. When the model decides to call a tool, the runtime fetches that schema, places it in context for the call, and (depending on policy) lets it fall out afterward (Kocher, UseWire, May 2026).

The technique is a **context engineering** move, not a protocol change. MCP already separates discovery from invocation; what changed in 2026 is the assumption that every client should serialize discovery results into one big system prompt.

### Index View vs Lazy Detail

| Layer | What it contains | Token cost |
|-------|-----------------|------------|
| **Index** | `(server, tool, one-line description)` tuples | 10–30 tokens/tool |
| **Lazy detail** | Full JSON Schema, parameter docs, examples, annotations | 300–1,500 tokens/tool |

A 100-tool surface drops from **~100,000 tokens** (preloaded) to **~2,000 tokens** (index only) before the user types a word (Kruczek, Jan 2026).

---

## Anthropic's Numbers (Apr 2026)

Anthropic's `code-execution-with-MCP` write-up (published Nov 2025, benchmarks refined through Apr 2026) reports:

- **Without progressive loading:** ~150,000 input tokens consumed by tool definitions before the first user message, on a task with hundreds of connected tools across dozens of MCP servers.
- **With code-mediated progressive loading:** ~2,000 tokens for the same task — the agent navigates a filesystem of tool-as-code files, reads only the definitions it needs, and executes in a sandbox.
- **Reduction: 98.7%.**

The code-mediated approach is the most aggressive variant. The agent writes TypeScript/Python that imports tools from a typed namespace, the sandbox executes that code, and only the index and execution results enter context. The entire intermediate trajectory (parameter selection, error handling, sub-tool calls) happens outside the model's context window (Anthropic, Nov 2025).

Speakeasy's benchmarks corroborate at a different scale: 40 tools = 43,300 tokens, 100 tools = 128,900 tokens, 200 tools = 261,700 tokens, 400 tools = 405,100 tokens. At 200 tools you exceed Claude's context window; at 400 you've doubled it (Kruczek, Jan 2026).

---

## Loading Policies

| Policy | Context state | When it fits |
|--------|--------------|--------------|
| **Strict-lazy** | Index only; schemas load and unload per call | High tool counts, short tasks, cost-sensitive workloads |
| **Sticky-lazy** | Index + schemas of any tool used this session | Multi-step tasks where the same tool is called repeatedly |
| **Bounded-sticky** (LRU) | Index + LRU of N most-recently-used schemas | General-purpose agents (the common default) |
| **Code-mediated** | Index only; tools invoked from generated code in a sandbox | Highest token efficiency; requires execution infrastructure |

**Bounded-sticky** is the pragmatic default. It requires no sandbox and behaves close to the preloaded version on small surfaces. LRU of 5–10 schemas covers most trajectories (Kocher, May 2026).

**Code-mediated** is what Anthropic benchmarked at 98.7%. It's the most efficient because the entire trajectory is off-context, but it's invasive to deploy — you need a sandboxed execution environment, resource limits, and monitoring (Anthropic, Nov 2025).

---

## Break-Even Analysis

Progressive loading doesn't help everywhere:

- **Below 15–30 tools:** The index + runtime bookkeeping adds latency without buying back enough tokens. A coding assistant with one MCP server and eight tools is best served by the preloaded catalog.
- **Above 15–30 tools:** Preloaded catalogs eat enough context to materially slow inference and cost. This is where every major implementation has converged on progressive loading (Kocher, May 2026).

**Failure modes:**

1. **Tool churn.** An agent that calls a different tool every turn forces a schema fetch every turn; fetch latency starts to matter. Strict-lazy is correct here; bounded-sticky thrashes.
2. **Latency round-trip.** First use of any tool pays an extra round trip for schema fetch. For interactive agents this is usually invisible, but for sub-second SLAs it can be the difference between hitting and missing budget. Mitigation: server-side batched schema fetches (in the 2026 spec work).
3. **Cognitive overload.** Research found accuracy degrades measurably past ~20–25 tools (Paramanayakam et al., arXiv:2411.15399). Anthropic's lazy loading improved Opus 4 from 49% → 74% accuracy and Opus 4.5 from 79.5% → 88.1% on tool selection benchmarks — same model, fewer visible tools (Kruczek, Jan 2026).
4. **Poisoned descriptions.** 43% of public MCP servers had at least one vulnerability; 5.5% shipped with poisoned descriptions (Cequence, Apr 2026). Progressive loading shrinks the blast radius — poisoned descriptions enter context only when the relevant tool is called, not every session.

---

## Application to Skills

The pattern maps directly to Agent Skills (Anthropic, Dec 2025):

| Level | Loaded at | Content | Token cost |
|-------|-----------|---------|------------|
| **Metadata** (index) | Session start | Name + one-line description | ~80–100 tokens/skill |
| **Instructions** (activation) | When skill matches | Full `SKILL.md` body | 275–8,000 tokens |
| **Resources** (execution) | During task | Scripts, reference docs, configs | On demand |

All 17 Anthropic skills cost ~1,700 tokens at discovery. The key unsolved question: when does an activated skill get deactivated? Without explicit pruning, multiple activated skills destroy the token advantage over time (Griciūnas, Mar 2026).

The code-execution extension lets agents persist reusable functions as new skills. A skill becomes a folder with a `SKILL.md`, scripts, and references — the agent navigates it like a filesystem, loading only what it needs (Anthropic, Nov 2025).

---

## Implementations

| Implementation | Approach | Key detail |
|---------------|----------|------------|
| **Anthropic reference** | Code-mediated: tools-as-files on a filesystem | 150K → 2K tokens; agent navigates `./servers/` tree |
| **Klavis AI Strata** | Four-stage funnel: intent → category → action → schema | +13–15% accuracy over standard MCP; 83%+ success on complex workflows |
| **Speakeasy Gram** | Embeddings-based semantic search over tool descriptions | ~30% fewer tokens than hierarchical search for simple tasks |
| **Two-Stage (MCP Hackathon)** | `tools/list` returns empty schemas; full schema via `resource:///tool_descriptions?tools=<name>` | 96% token reduction; simplest to implement |
| **Tree pattern** (lazy-mcp, OpenMCP) | Navigable directory structure; `list_tools(path)` + `describe_tool(path)` | Mirrors filesystem navigation; implicit categorization |
| **Cloudflare Code Mode** | Same code-mediated insight as Anthropic | Independently validated approach |

The MCP 2026 roadmap lists **progressive discovery** and **composable tool execution** as priorities alongside stateless transport and server discovery. Server-side support for batched schema fetches and discovery primitives will make runtime-side progressive loading cheaper (Kocher, May 2026).

---

## Sources

1. Kocher, J. "Progressive tool loading is the new MCP context pattern." *UseWire*, May 6, 2026. https://usewire.io/blog/progressive-tool-loading-mcp-context-pattern/
2. Anthropic. "Code execution with MCP: Building more efficient agents." Nov 4, 2025. https://www.anthropic.com/engineering/code-execution-with-mcp
3. Kruczek, M. "Progressive Disclosure for MCP Servers: A Design Pattern for Scalable AI Tool Integration." Jan 27, 2026. https://matthewkruczek.ai/blog/progressive-disclosure-mcp-servers.html
4. Griciūnas, A. "State of Context Engineering in 2026." *SwirlAI Newsletter*, Mar 22, 2026. https://www.newsletter.swirlai.com/p/state-of-context-engineering-in-2026
5. Paramanayakam, V. et al. "Less is More: Optimizing Function Calling for LLM Execution on Edge Devices." arXiv:2411.15399, Nov 2024. https://arxiv.org/abs/2411.15399
6. Cequence. "CIS MCP Security Guide." Apr 2026. https://www.cequence.ai/blog/ai/cis-mcp-security-guide-how-to-govern-ai-agent-access-in-enterprise-environments/
7. Speakeasy. "Comparing Progressive Disclosure and Semantic Search for Powering Dynamic MCP." Nov 13, 2025. https://www.speakeasy.com/blog/100x-token-reduction-dynamic-toolsets
8. Liu et al. "Lost in the Middle." Stanford, 2023. https://arxiv.org/abs/2307.03172
