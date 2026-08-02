# Tool/Skill Routing, Selection, and Registry Patterns in Agent Frameworks

**Research date:** August 2, 2026
**Scope:** Task-time skill routing for MCP-based agent systems with ~100+ skills

---

## TL;DR

- **Two-phase loading dominates.** Every serious system uses an index/detail pattern: compact summaries in context, full schemas loaded on-demand for top-k candidates. Tool Attention achieves 95% token reduction this way; MCP-Zero achieves 98%.
- **Keyword+tag matching is the fast path; semantic retrieval is the fallback.** ToolDNS, MCP-Zero, and Z-Space all use hierarchical tag/name matching first, then fall back to embedding similarity. Pure semantic retrieval alone (ToolRet benchmark) performs poorly on tool retrieval tasks.
- **LLM-decided routing is expensive and fragile at scale.** MemTool and Tool Attention both show that letting the LLM choose from all tools degrades reasoning. Deterministic routing with LLM intent extraction (not LLM tool selection) is the pragmatic split.
- **Registry schemas converge on: name, description, tags, input/output schema, version.** Tool Forge adds lifecycle state and credential bindings; ToolDNS adds hierarchical namespace encoding functional category.
- **Adversarial skill manipulation is real.** SKILL.md-based attacks can bias discovery (86% win rate) and selection (77.6% selection bias). Registry design must account for trust/scoring.

---

## 1. Tool Selectors/Dispatchers: The Routing Spectrum

Three dominant approaches, each with clear tradeoffs:

### 1a. LLM-Decides (Full Injection)

The simplest pattern: inject all tool schemas into the prompt and let the LLM pick. Problems scale badly — MCP Server Architecture Patterns paper (arXiv:2606.30317) finds tool-selection accuracy drops below 90% between 10-15 tools per context for Haiku and 20-30 for Sonnet. MemTool (arXiv:2507.21428) confirms reasoning models achieve 90-94% tool-removal efficiency in autonomous mode, but smaller models drop to 0-60%.

**Use when:** <10 tools, no token budget constraint.
**Avoid when:** >15 tools, multi-turn conversations, cost-sensitive.

### 1b. Deterministic Keyword/Tag Matching

Fast, predictable, zero-token-cost routing. ToolDNS (arXiv:2607.18242) encodes functional hierarchy into a domain-name-like namespace (`weather.tools.mcp.server`) and achieves O(log N) lookup. Z-Space (arXiv:2511.19483) uses a fused subspace weighted algorithm (FSWW) for fine-grained semantic alignment without parameter tuning, achieving 96.26% token reduction in production at Eleme.

Dynamic ReAct (arXiv:2509.20386) evaluates five progressively refined architectures, finding that a search-and-load mechanism achieves intelligent tool selection with 50% loading reduction while maintaining accuracy.

**Use when:** Skills have stable, well-defined tags and categories. Latency matters.
**Limitation:** Brittle to vocabulary mismatch — a user saying "make a chart" needs to match a skill tagged "visualization" or "plotting."

### 1c. Semantic/Embedding Retrieval

Encode task intent and skill descriptions into shared embedding space, retrieve top-k by cosine similarity. MCP-Zero (arXiv:2506.01056) uses hierarchical semantic routing: two-stage matching that first identifies relevant servers, then ranks tools within servers. Achieves 98% token reduction from 248k tokens across 2,797 tools.

Tool Attention (arXiv:2604.21816) computes an Intent Schema Overlap (ISO) score from sentence embeddings, combined with state-aware gating, to reduce 120-tool contexts from 47.3k to 2.4k tokens.

**Use when:** Vocabulary is diverse, skills are numerous, users phrase tasks naturally.
**Limitation:** ToolRet benchmark (arXiv:2503.01763) shows even strong IR models perform poorly on tool retrieval — conventional embedding models struggle with the semantic-functional gap. FitText (arXiv:2605.02411) addresses this with iterative pseudo-tool description evolution.

### Recommendation for ~110 Skills

**Two-tier: tag+keyword fast path with embedding fallback.** Tags handle 80-90% of cases cheaply. Semantic retrieval handles the rest. Neither alone is sufficient.

---

## 2. Registry Schema Design

The research converges on a minimal but expressive schema:

```json
{
  "name": "skill-name",
  "description": "2-3 sentence summary of what this skill does",
  "tags": ["category", "subcategory", "capability-keywords"],
  "input_schema": { ... },
  "output_schema": { ... },
  "version": "1.0.0",
  "lifecycle": "stable|beta|deprecated"
}
```

Key additions from specific systems:

- **Tool Forge** adds: `intent` (natural-language capability statement), `dependency_policy`, `credential_bindings`, `routing_metadata` (synonyms, related skills). Treats each tool as a "capsule" with full governance.
- **ToolDNS** encodes hierarchy structurally in the name itself (`category.subcategory.protocol`), turning namespace into routing signal.
- **SkillReranker** (arXiv:2607.06283) enriches skill entries with `execution_state_descriptions` and `transition_state_descriptions` — modeling what state a skill produces, not just what it does. This enables graph-based task-skill matching.

**For 110 skills:** Keep schema flat but rich. Name + description + tags + version is the baseline. Add `aliases` (synonyms) and `related_skills` for better recall. No need for ToolDNS-style hierarchy at this scale — that's for millions.

---

## 3. Progressive Loading: The Index/Detail Pattern

Every efficient system separates "summary pool" from "full schema":

| System | Index (in context) | Detail (loaded on-demand) |
|--------|-------------------|--------------------------|
| Tool Attention | Compact summary pool (top-k=5-10) | Full JSON schema promoted for gated tools |
| MCP-Zero | Server-level summaries | Tool-level schemas requested by agent |
| Tool Forge Router | Intent-scoped tool sessions | Full tool capsule loaded after routing |
| Dynamic ReAct | Search results (names + descriptions) | Full tool definitions loaded lazily |

The pattern is universal because it solves the fundamental tension: the LLM needs enough context to reason about tool selection, but not so much that it degrades reasoning quality.

**For 110 skills:** At ~100 tokens per summary, 110 skills = ~11k tokens for full index. That's borderline — feasible but not optimal. Better: category-level summaries (~15 categories × 20 tokens = 300 tokens), with per-skill summaries (~50 tokens × 110 = 5.5k tokens) loaded on first relevance hit.

---

## 4. Skill Retrieval: Embedding-Based Routing

Key findings on vector-search-over-skill-libraries:

- **SkillReranker** decomposes both task and skills into subtask descriptions, builds a directed acyclic execution graph, then uses a cross-encoder to score candidate skills per task interval. Outperforms semantic-similarity-only baselines.
- **FitText** treats retrieval as test-time evolution: the agent generates pseudo-tool descriptions, refines them iteratively using retrieval feedback, and explores diverse alternatives through stochastic generation. +2.7-10.6 NDCG@5 improvement.
- **SKILL.md attacks** (arXiv:2605.11418) demonstrate that adversarial trigger phrases in skill descriptions can achieve 86% retrieval win rate and 80% Top-10 placement in embedding-based systems. Semantic supply-chain risk is real.
- **ToolRet** benchmark finds conventional IR models struggle with tool retrieval — the semantic-functional gap means textually relevant tools are often functionally inoperative (parameter mismatches, auth failures).

**Practical implication:** Embedding retrieval alone is insufficient. Execution-grounded validation (GRETEL, arXiv:2510.17843) or schema-compatibility checks should filter results post-retrieval.

---

## 5. Category/Tag Taxonomy Design

For 100+ skills, flat tags with hierarchical sub-tags work best:

```
frontend          # L1 category
  react           # L2 subcategory
    hooks         # L3 capability
    components    # L3 capability
backend
  api
    rest
    graphql
data
  visualization
  transformation
```

**Design principles from the literature:**

1. **3-level hierarchy max** — ToolDNS uses deeper hierarchies but they're for internet-scale discovery. For 110 skills, 3 levels (category → subcategory → capability) suffice.
2. **Synonyms in aliases, not duplicate tags** — A skill tagged "chart" should also match "graph", "plot", "visualization". Store synonyms in an alias map, not as extra tags.
3. **Compound tags for precision** — `frontend:react:hooks` is more precise than three separate tags. Use colon-separated compound tags for exact matching.
4. **Category count should be 10-20** — ToolDNS's functional hierarchy uses ~20 top-level categories across 33k tools. For 110 skills, 12-15 categories is the sweet spot.

---

## 6. Open Implementations Worth Studying

| System | Approach | Key Innovation |
|--------|----------|---------------|
| **Tool Attention** (arXiv:2604.21816) | Embedding ISO + state-aware gating + lazy schema loading | 95% token reduction, two-phase promotion |
| **MCP-Zero** (arXiv:2506.01056) | Active tool request + hierarchical semantic routing | 98% token reduction, agent-driven discovery |
| **Tool Forge** (arXiv:2605.28000) | Intent-scoped routing sessions + tool capsules | 99.2% context reduction, micro-F1 0.901 |
| **Z-Space** (arXiv:2511.19483) | Fused subspace weighted filtering (FSWW) | 96.26% token reduction, production-deployed |
| **ToolDNS** (arXiv:2607.18242) | DNS-based hierarchical namespace | 95% search space reduction, O(log N) lookup |
| **Dynamic ReAct** (arXiv:2509.20386) | Five progressive architectures for MCP tool selection | 50% loading reduction, maintains accuracy |
| **FitText** (arXiv:2605.02411) | Memetic retrieval with pseudo-tool description evolution | +2.7-10.6 NDCG@5, training-free |

---

## 7. Recommendation: Schema and Strategy for ~110-Skill MCP Router

### Registry Schema

```json
{
  "skills": [
    {
      "name": "frontend-design",
      "description": "Frontend design skill covering philosophy, anti-AI-slop patterns, typography, color...",
      "tags": ["frontend", "design", "typography", "css", "ui"],
      "aliases": ["web design", "UI design", "landing page"],
      "category": "frontend",
      "input_schema": { "task": "string" },
      "output_schema": { "instructions": "string" },
      "version": "1.0.0",
      "related": ["high-end-visual-design", "minimalist-ui", "image-to-code"]
    }
  ],
  "categories": {
    "frontend": { "count": 25, "subcategories": ["design", "frameworks", "responsive"] },
    "backend": { "count": 15, "subcategories": ["api", "database", "auth"] },
    "devops": { "count": 10, "subcategories": ["ci", "containers", "monitoring"] },
    "data": { "count": 12, "subcategories": ["visualization", "pipeline", "analysis"] },
    "security": { "count": 8, "subcategories": ["audit", "auth", "vulnerabilities"] },
    "writing": { "count": 10, "subcategories": ["documentation", "articles", "reviews"] },
    "tools": { "count": 8, "subcategories": ["git", "testing", "deployment"] },
    "design-systems": { "count": 12, "subcategories": ["tokens", "components", "patterns"] },
    "agent-patterns": { "count": 10, "subcategories": ["orchestration", "memory", "routing"] }
  }
}
```

### Matching Strategy: Two-Tier with Semantic Fallback

```
find_skills(task: str) -> SkillMatch[]

1. EXTRACT intent tokens from task (no LLM needed — simple tokenization + stopword removal)
2. TAG MATCH: score each skill by keyword overlap with task tokens vs skill.tags + skill.aliases
   - Compound tag match (e.g., "frontend:react") gets 2x weight
   - Category match gets 1.5x weight
3. If top-3 tag scores > threshold (0.7): return top-3 (fast path, ~1ms)
4. SEMANTIC FALLBACK: embed task + skill descriptions, cosine similarity top-5
   - Re-rank by combining 0.6 * semantic_score + 0.4 * tag_score
5. Return top-3 with confidence scores

load_skill(name: str) -> SkillDetail
  - Returns full SKILL.md content + input/output schema + examples
  - Cached, invalidated on version bump
```

### Why This Works

- **Fast path handles 80-90% of cases** — most tasks have clear category signals ("fix CSS", "review PR", "generate tests"). Tag matching is instant, deterministic, zero-cost.
- **Semantic fallback handles vocabulary mismatch** — "make it look professional" → "frontend-design" tag match is weak, but semantic similarity catches it.
- **No LLM call in the router** — the LLM extracts intent from the user task (already happens), the router matches skills deterministically. This avoids the "LLM choosing among N tools" degradation shown in Tool Attention.
- **Two-phase loading** — `find_skills` returns summaries (~100 tokens each), `load_skill` returns full content (~2-5k tokens). Agent loads only what it needs.

### When to Add More Sophistication

- **>200 skills:** Add hierarchical category pruning (ToolDNS pattern) before tag matching
- **>500 skills:** Add vector store with embedding retrieval as primary path
- **Cross-domain skills:** Add SkillReranker-style execution graph matching
- **Adversarial concerns:** Add trust scoring and provenance tracking (Tool Forge pattern)

---

## Sources

- Tool Attention: https://arxiv.org/abs/2604.21816
- MCP-Zero: https://arxiv.org/abs/2506.01056
- Tool Forge: https://arxiv.org/abs/2605.28000
- Z-Space: https://arxiv.org/abs/2511.19483
- ToolDNS: https://arxiv.org/abs/2607.18242
- Dynamic ReAct: https://arxiv.org/abs/2509.20386
- FitText: https://arxiv.org/abs/2605.02411
- MemTool: https://arxiv.org/abs/2507.21428
- ToolRet: https://arxiv.org/abs/2503.01763
- SKILL.md Attacks: https://arxiv.org/abs/2605.11418
- SkillReranker: https://arxiv.org/abs/2607.06283
- MCP Server Architecture Patterns: https://arxiv.org/abs/2606.30317
- GRETEL: https://arxiv.org/abs/2510.17843
- ToolDNS GitHub: https://github.com/syedfahimdev/ToolsDNS
- EmergentMind Tool Discovery: https://www.emergentmind.com/topics/tool-discovery-agents
